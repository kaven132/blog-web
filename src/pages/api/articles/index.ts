import type { APIRoute } from "astro";
import { db } from "../../../lib/db";
import { articles, categoryTree } from "../../../db/schema";
import { eq, like, or, and, desc, asc } from "drizzle-orm";
import { requireAuth } from "../../../lib/auth";
import { generateId, articleToJSON } from "../../../lib/utils";

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
 * GET /api/articles
 * Query params: category, subcategory, search, sort
 * Matches Express response shape exactly.
 */
export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const category = url.searchParams.get("category");
  const subcategory = url.searchParams.get("subcategory");
  const search = url.searchParams.get("search");
  const sort = url.searchParams.get("sort");

  const conditions = [];

  if (category && category !== "all") {
    conditions.push(eq(articles.category, category));
  }

  if (subcategory && subcategory !== "all") {
    conditions.push(eq(articles.subcategory, subcategory));
  }

  if (search?.trim()) {
    const q = "%" + search.trim() + "%";
    conditions.push(
      or(
        like(articles.title, q),
        like(articles.summary, q),
        like(articles.content, q),
        like(articles.tags, q),
      )!,
    );
  }

  let query = db.select().from(articles).$dynamic();

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  // Order: pinned first, then by sort param
  switch (sort) {
    case "oldest":
      query = query.orderBy(desc(articles.isPinned), asc(articles.createdAt));
      break;
    case "title":
      query = query.orderBy(desc(articles.isPinned), asc(articles.title));
      break;
    case "newest":
    default:
      query = query.orderBy(desc(articles.isPinned), desc(articles.createdAt));
  }

  const rows = query.all();

  return new Response(JSON.stringify(rows.map(articleToJSON)), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

/**
 * POST /api/articles — Create article (auth required)
 */
export const POST: APIRoute = async ({ request }) => {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  const body = await request.json();
  const { title, content, category, subcategory, tags, summary, coverImage, isPinned } =
    body || {};

  if (!title?.trim()) {
    return new Response(JSON.stringify({ error: "标题不能为空" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const cat = (category || "").trim();
  const subcat = (subcategory || "").trim();
  ensureSubcategory(cat, subcat);

  const id = generateId("art");
  const now = new Date().toISOString();

  db.insert(articles)
    .values({
      id,
      title: title.trim(),
      content: content || "",
      category: cat,
      subcategory: subcat,
      tags: JSON.stringify(tags || []),
      summary: (summary || "").trim(),
      coverImage: (coverImage || "").trim(),
      isPinned: isPinned ? 1 : 0,
      likesCount: 0,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  const row = db.select().from(articles).where(eq(articles.id, id)).get();

  return new Response(JSON.stringify(articleToJSON(row!)), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};
