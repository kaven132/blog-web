import type { APIRoute } from "astro";
import { db } from "../../../../lib/db";
import { articles, comments } from "../../../../db/schema";
import { eq, desc } from "drizzle-orm";
import { generateId } from "../../../../lib/utils";

/**
 * GET /api/articles/:id/comments — List comments for an article (public)
 * Returns: comment[] (ordered by created_at DESC)
 */
export const GET: APIRoute = async ({ params }) => {
  const article = db
    .select({ id: articles.id })
    .from(articles)
    .where(eq(articles.id, params.id!))
    .get();

  if (!article) {
    return new Response(JSON.stringify({ error: "文章不存在" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rows = db
    .select()
    .from(comments)
    .where(eq(comments.articleId, params.id!))
    .orderBy(desc(comments.createdAt))
    .all();

  return new Response(JSON.stringify(rows), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

/**
 * POST /api/articles/:id/comments — Create a comment (public)
 * Body: { author?: string, content: string }
 * Returns: the created comment
 */
export const POST: APIRoute = async ({ params, request }) => {
  const article = db
    .select({ id: articles.id })
    .from(articles)
    .where(eq(articles.id, params.id!))
    .get();

  if (!article) {
    return new Response(JSON.stringify({ error: "文章不存在" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.json();
  const { author, content } = body || {};

  if (!content || !content.trim()) {
    return new Response(JSON.stringify({ error: "评论内容不能为空" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const id = generateId("cmt");
  const now = new Date().toISOString();

  db.insert(comments)
    .values({
      id,
      articleId: params.id!,
      author: (author || "").trim() || "匿名",
      content: content.trim(),
      createdAt: now,
    })
    .run();

  const row = db
    .select()
    .from(comments)
    .where(eq(comments.id, id))
    .get();

  return new Response(JSON.stringify(row), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};
