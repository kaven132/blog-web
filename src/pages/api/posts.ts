import type { APIRoute } from "astro";
import { db } from "../../db";
import { posts } from "../../db/schema";
import { eq, sql } from "drizzle-orm";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  // Check auth
  const authed = cookies.get("auth")?.value === "true";
  if (!authed) {
    return new Response(JSON.stringify({ error: "请先登录" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await request.json();
    const { title, slug, excerpt, content, tags } = body;

    if (!title || !slug || !content) {
      return new Response(JSON.stringify({ error: "标题、slug 和内容为必填" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    db.insert(posts).values({
      title,
      slug,
      excerpt: excerpt || "",
      content,
      tags: tags || "[]",
      published: true,
    }).run();

    return new Response(JSON.stringify({ ok: true, slug }), {
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
  const authed = cookies.get("auth")?.value === "true";
  if (!authed) {
    return new Response(JSON.stringify({ error: "请先登录" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await request.json();
    const { id, title, slug, excerpt, content, tags } = body;

    if (!id || !title || !slug || !content) {
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

    db.update(posts)
      .set({
        title,
        slug,
        excerpt: excerpt || "",
        content,
        tags: tags || "[]",
        updatedAt: sql`(CURRENT_TIMESTAMP)`,
      })
      .where(eq(posts.id, Number(id)))
      .run();

    return new Response(JSON.stringify({ ok: true, slug }), {
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
  const authed = cookies.get("auth")?.value === "true";
  if (!authed) {
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

  db.delete(posts).where(eq(posts.id, id)).run();

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
