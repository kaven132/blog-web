import type { APIRoute } from "astro";
import { db } from "../../db";
import { posts } from "../../db/schema";

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
