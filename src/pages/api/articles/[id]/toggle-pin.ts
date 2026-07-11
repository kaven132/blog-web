import type { APIRoute } from "astro";
import { db } from "../../../../lib/db";
import { articles } from "../../../../db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../../../../lib/auth";

/**
 * POST /api/articles/:id/toggle-pin — Toggle article pin status (auth required)
 * Returns: { isPinned: boolean }
 */
export const POST: APIRoute = async ({ params, request }) => {
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

  const newPinned = existing.isPinned ? 0 : 1;

  db.update(articles)
    .set({ isPinned: newPinned })
    .where(eq(articles.id, params.id!))
    .run();

  return new Response(JSON.stringify({ isPinned: !!newPinned }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
