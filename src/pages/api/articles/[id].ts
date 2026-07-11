import type { APIRoute } from "astro";
import { db } from "../../../lib/db";
import { articles, comments, likes, categoryTree } from "../../../db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../../../lib/auth";
import { articleToJSON } from "../../../lib/utils";

/**
 * Ensure a subcategory exists in the category_tree (INSERT OR IGNORE).
 */
function ensureSubcategory(category: string, subcategory: string) {
  if (!category || !subcategory) return;
  db.insert(categoryTree)
    .values({ parent: category.trim(), child: subcategory.trim() })
    .onConflictDoNothing()
    .run();
}

/**
 * GET /api/articles/:id — Single article, public
 */
export const GET: APIRoute = async ({ params }) => {
  const row = db
    .select()
    .from(articles)
    .where(eq(articles.id, params.id!))
    .get();

  if (!row) {
    return new Response(JSON.stringify({ error: "文章不存在" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(articleToJSON(row)), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

/**
 * PUT /api/articles/:id — Update article (auth required)
 */
export const PUT: APIRoute = async ({ params, request }) => {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  const existing = db
    .select()
    .from(articles)
    .where(eq(articles.id, params.id!))
    .get();

  if (!existing) {
    return new Response(JSON.stringify({ error: "文章不存在" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.json();
  const { title, content, category, subcategory, tags, summary, coverImage, isPinned } =
    body || {};

  const cat = category !== undefined ? (category || "").trim() : existing.category;
  const subcat =
    subcategory !== undefined ? (subcategory || "").trim() : existing.subcategory;
  ensureSubcategory(cat, subcat);

  const now = new Date().toISOString();

  db.update(articles)
    .set({
      title: title !== undefined ? title.trim() : existing.title,
      content: content !== undefined ? content : existing.content,
      category: cat,
      subcategory: subcat,
      tags: tags !== undefined ? JSON.stringify(tags) : existing.tags,
      summary: summary !== undefined ? (summary || "").trim() : existing.summary,
      coverImage:
        coverImage !== undefined ? (coverImage || "").trim() : existing.coverImage,
      isPinned: isPinned !== undefined ? (isPinned ? 1 : 0) : existing.isPinned,
      updatedAt: now,
    })
    .where(eq(articles.id, params.id!))
    .run();

  const row = db
    .select()
    .from(articles)
    .where(eq(articles.id, params.id!))
    .get();

  return new Response(JSON.stringify(articleToJSON(row!)), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

/**
 * DELETE /api/articles/:id — Delete article + cascade (auth required)
 */
export const DELETE: APIRoute = async ({ params, request }) => {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  const existing = db
    .select()
    .from(articles)
    .where(eq(articles.id, params.id!))
    .get();

  if (!existing) {
    return new Response(JSON.stringify({ error: "文章不存在" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Explicit cascade (matching Express behavior, FK constraints also enforce this)
  db.delete(comments).where(eq(comments.articleId, params.id!)).run();
  db.delete(likes).where(eq(likes.articleId, params.id!)).run();
  db.delete(articles).where(eq(articles.id, params.id!)).run();

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
