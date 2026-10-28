import type { APIRoute } from "astro";
import { db } from "../../db";
import { galleries, galleryPhotos } from "../../db/schema";
import { eq } from "drizzle-orm";
import { AUTH_COOKIE, isAuthed } from "../../lib/auth";
import { parseCategoryPath } from "../../lib/gallery-categories";

export const prerender = false;

/**
 * 相册管理接口（仅登录）：
 * POST   创建   { title, categoryPath: string[], description?, photos: string[] }
 * PUT    更新   { id, title, categoryPath, description?, photos }（照片整表替换，顺序即浏览顺序）
 * DELETE ?id=   删除相册（照片记录级联删除；uploads 中的图片文件保留）
 * categoryPath 为两级自由分类（一级必填、二级可选），存为 JSON 数组字符串
 */
const MAX_PHOTOS = 200;
const PHOTO_RE = /^\/uploads\/[A-Za-z0-9._-]+$/;

type Parsed = { title: string; category: string; description: string; photos: string[] };

function parseBody(raw: unknown): { error: string } | Parsed {
  const b = (raw ?? {}) as Record<string, unknown>;
  const title = typeof b.title === "string" ? b.title.trim() : "";
  const description = typeof b.description === "string" ? b.description.trim().slice(0, 300) : "";
  const photos = Array.isArray(b.photos) ? b.photos : [];

  if (!title || title.length > 60) return { error: "标题需 1-60 字" };
  const catRaw = Array.isArray(b.categoryPath) ? b.categoryPath : [];
  const categoryPath = catRaw.map((x) => String(x).trim()).filter(Boolean).slice(0, 2);
  if (categoryPath.length === 0 || categoryPath.some((x) => x.length > 20)) {
    return { error: "一级分类必填（二级可选），各不超过 20 字" };
  }
  // 允许 0 张：先建相册再上传照片是管理页的标准流程
  if (photos.length > MAX_PHOTOS) return { error: `照片最多 ${MAX_PHOTOS} 张` };
  if (!photos.every((p): p is string => typeof p === "string" && PHOTO_RE.test(p))) {
    return { error: "照片路径无效" };
  }
  return { title, category: JSON.stringify(categoryPath), description, photos };
}

const unauthorized = () =>
  new Response(JSON.stringify({ error: "请先登录" }), { status: 401, headers: { "Content-Type": "application/json" } });
const bad = (error: string) =>
  new Response(JSON.stringify({ error }), { status: 400, headers: { "Content-Type": "application/json" } });

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAuthed(cookies.get(AUTH_COOKIE)?.value)) return unauthorized();
  const parsed = parseBody(await request.json().catch(() => null));
  if ("error" in parsed) return bad(parsed.error);

  const id = db.transaction((tx) => {
    const g = tx
      .insert(galleries)
      .values({ title: parsed.title, category: parsed.category, description: parsed.description })
      .returning({ id: galleries.id })
      .get();
    // drizzle 的 insert.values() 不接受空数组：无照片时跳过
    if (parsed.photos.length > 0) {
      tx.insert(galleryPhotos).values(parsed.photos.map((path, i) => ({ galleryId: g.id, path, sort: i }))).run();
    }
    return g.id;
  });

  return new Response(JSON.stringify({ ok: true, id }), { headers: { "Content-Type": "application/json" } });
};

export const PUT: APIRoute = async ({ request, cookies }) => {
  if (!isAuthed(cookies.get(AUTH_COOKIE)?.value)) return unauthorized();
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const id = Number(body?.id);
  if (!Number.isInteger(id) || id <= 0) return bad("无效的相册");
  const parsed = parseBody(body);
  if ("error" in parsed) return bad(parsed.error);

  const exists = db.select({ id: galleries.id }).from(galleries).where(eq(galleries.id, id)).get();
  if (!exists) return bad("相册不存在");

  db.transaction((tx) => {
    tx.update(galleries)
      .set({ title: parsed.title, category: parsed.category, description: parsed.description })
      .where(eq(galleries.id, id))
      .run();
    tx.delete(galleryPhotos).where(eq(galleryPhotos.galleryId, id)).run();
    if (parsed.photos.length > 0) {
      tx.insert(galleryPhotos).values(parsed.photos.map((path, i) => ({ galleryId: id, path, sort: i }))).run();
    }
  });

  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
};

export const DELETE: APIRoute = async ({ cookies, url }) => {
  if (!isAuthed(cookies.get(AUTH_COOKIE)?.value)) return unauthorized();
  const id = Number(url.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return bad("无效的相册");
  db.delete(galleries).where(eq(galleries.id, id)).run();
  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
};
