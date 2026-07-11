import type { APIRoute } from "astro";
import { db } from "../../lib/db";
import { articles, categoryTree } from "../../db/schema";
import { count, isNotNull, asc } from "drizzle-orm";

/**
 * GET /api/categories — Public, returns article counts + category tree
 * Response: { counts: Record<string, number>, tree: Record<string, string[]> }
 * Matches Express JSON shape exactly.
 */
export const GET: APIRoute = () => {
  // Get article counts grouped by category
  // Equivalent to: SELECT category, COUNT(*) FROM articles WHERE category IS NOT NULL AND category != '' GROUP BY category ORDER BY category COLLATE NOCASE ASC
  const countRows = db
    .select({
      category: articles.category,
      count: count(),
    })
    .from(articles)
    .where(
      isNotNull(articles.category),
      // Note: Drizzle's ne doesn't work with isNotNull chaining.
      // We'll add the empty string filter manually.
    )
    .groupBy(articles.category)
    .orderBy(asc(articles.category))
    .all()
    .filter((row) => row.category !== "");

  const counts: Record<string, number> = {};
  for (const row of countRows) {
    if (row.category) {
      counts[row.category] = row.count;
    }
  }

  // Get category tree (parent → children mapping)
  // Equivalent to: SELECT parent, child FROM category_tree ORDER BY parent, child
  const treeRows = db
    .select()
    .from(categoryTree)
    .orderBy(asc(categoryTree.parent), asc(categoryTree.child))
    .all();

  const tree: Record<string, string[]> = {};
  for (const row of treeRows) {
    if (!tree[row.parent]) tree[row.parent] = [];
    tree[row.parent].push(row.child);
  }

  return new Response(JSON.stringify({ counts, tree }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
