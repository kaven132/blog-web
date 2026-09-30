import type { APIRoute } from "astro";
import { db } from "../../db";
import { posts } from "../../db/schema";
import { eq, sql } from "drizzle-orm";
import { resolveSlug, normalizeTags } from "../../lib/posts";
import { extractUploadNames, removeUnreferenced } from "../../lib/uploads";
import { AUTH_COOKIE, isAuthed } from "../../lib/auth";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  // Check auth
  if (!isAuthed(cookies.get(AUTH_COOKIE)?.value)) {
    return new Response(JSON.stringify({ error: "请先登录" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await request.json();
    const { title, slug, excerpt, content, tags, coverImage } = body;

    if (!title || !content || typeof content !== "string") {
      return new Response(JSON.stringify({ error: "标题和内容为必填" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const finalSlug = resolveSlug(title, slug);

    db.insert(posts).values({
      title,
      slug: finalSlug,
      excerpt: excerpt || "",
      content,
      tags: normalizeTags(tags),
      coverImage: coverImage || null,
      published: true,
    }).run();

    return new Response(JSON.stringify({ ok: true, slug: finalSlug }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "创建失败，slug 可能重复" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const PUT: APIRoute = async ({ request, cookies }) => {
  if (!isAuthed(cookies.get(AUTH_COOKIE)?.value)) {
    return new Response(JSON.stringify({ error: "请先登录" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await request.json();
    const { id, title, slug, excerpt, content, tags, coverImage } = body;

    if (!id || !title || !content || typeof content !== "string") {
      return new Response(JSON.stringify({ error: "参数不完整" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const existing = db.select().from(posts).where(eq(posts.id, Number(id))).get();
    if (!existing) {
      return new Response(JSON.stringify({ error: "文章不存在" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const finalSlug = resolveSlug(title, slug, Number(id));

    // 旧封面是本地 /uploads/ 文件且本次被换掉时，更新后若无引用则删掉，防孤儿
    const oldCoverNames = extractUploadNames(existing.coverImage);

    db.update(posts)
      .set({
        title,
        slug: finalSlug,
        excerpt: excerpt || "",
        content,
        tags: normalizeTags(tags),
        coverImage: coverImage || null,
        updatedAt: sql`(CURRENT_TIMESTAMP)`,
      })
      .where(eq(posts.id, Number(id)))
      .run();

    const removedImages = removeUnreferenced(oldCoverNames);

    return new Response(JSON.stringify({ ok: true, slug: finalSlug, removedImages: removedImages.length }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "更新失败，slug 可能重复" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
export const DELETE: APIRoute = async ({ url, cookies }) => {
  if (!isAuthed(cookies.get(AUTH_COOKIE)?.value)) {
    return new Response(JSON.stringify({ error: "请先登录" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const id = Number(url.searchParams.get("id"));
  if (!id) {
    return new Response(JSON.stringify({ error: "无效的请求" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const existing = db.select().from(posts).where(eq(posts.id, id)).get();
  if (!existing) {
    return new Response(JSON.stringify({ error: "文章不存在" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 孤儿图根治：这篇删掉后，本地图（封面 + 正文插图）若无人再引用则一并删除
  const deletedNames = extractUploadNames(existing.coverImage, existing.content, existing.excerpt);
  db.delete(posts).where(eq(posts.id, id)).run();
  const removedImages = removeUnreferenced(deletedNames);

  return new Response(JSON.stringify({ ok: true, removedImages: removedImages.length }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
