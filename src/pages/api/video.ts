import type { APIRoute } from "astro";
import { db } from "../../db";
import { videos, videoLikes } from "../../db/schema";
import { eq } from "drizzle-orm";
import { AUTH_COOKIE, isAuthed } from "../../lib/auth";

export const prerender = false;

/**
 * 视频管理接口（仅登录）：
 * POST   创建   { title, description?, url, poster?, isPrivate? }   url 为 /api/videos/upload 返回的 /media/<文件名>
 * PUT    更新   { id, title, description?, url?, poster?, isPrivate? }
 * DELETE ?id=   删除视频（点赞/评论级联；data/videos/ 中的文件保留，与相册图片同策略）
 */
type Parsed = { title: string; description: string; url: string; poster: string; isPrivate: number };

const URL_RE = /^\/media\/[A-Za-z0-9._-]+$/;
const POSTER_RE = /^\/uploads\/[A-Za-z0-9._-]+$/;

function parseBody(raw: unknown): { error: string } | Parsed {
  const b = (raw ?? {}) as Record<string, unknown>;
  const title = typeof b.title === "string" ? b.title.trim() : "";
  const description = typeof b.description === "string" ? b.description.trim().slice(0, 300) : "";
  const url = typeof b.url === "string" ? b.url.trim() : "";
  const poster = typeof b.poster === "string" ? b.poster.trim() : "";
  const isPrivate = b.isPrivate === 1 || b.isPrivate === true ? 1 : 0;

  if (!title || title.length > 60) return { error: "标题需 1-60 字" };
  if (!URL_RE.test(url)) return { error: "视频文件无效（请先上传视频）" };
  if (poster && !POSTER_RE.test(poster)) return { error: "封面图路径无效" };
  return { title, description, url, poster, isPrivate };
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
    const v = tx
      .insert(videos)
      .values({ title: parsed.title, description: parsed.description, url: parsed.url, poster: parsed.poster, isPrivate: parsed.isPrivate })
      .returning({ id: videos.id })
      .get();
    tx.insert(videoLikes).values({ videoId: v.id, count: 0 }).run();
    return v.id;
  });

  return new Response(JSON.stringify({ ok: true, id }), { headers: { "Content-Type": "application/json" } });
};

export const PUT: APIRoute = async ({ request, cookies }) => {
  if (!isAuthed(cookies.get(AUTH_COOKIE)?.value)) return unauthorized();
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const id = Number(body?.id);
  if (!Number.isInteger(id) || id <= 0) return bad("无效的视频");
  const parsed = parseBody(body);
  if ("error" in parsed) return bad(parsed.error);

  const exists = db.select({ id: videos.id }).from(videos).where(eq(videos.id, id)).get();
  if (!exists) return bad("视频不存在");

  db.update(videos)
    .set({ title: parsed.title, description: parsed.description, url: parsed.url, poster: parsed.poster, isPrivate: parsed.isPrivate })
    .where(eq(videos.id, id))
    .run();

  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
};

export const DELETE: APIRoute = async ({ cookies, url }) => {
  if (!isAuthed(cookies.get(AUTH_COOKIE)?.value)) return unauthorized();
  const id = Number(url.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return bad("无效的视频");
  db.delete(videos).where(eq(videos.id, id)).run();
  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
};
