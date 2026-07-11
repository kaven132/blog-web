import type { APIRoute } from "astro";
import { db } from "../../../lib/db";
import { comments } from "../../../db/schema";
import { eq } from "drizzle-orm";

/**
 * DELETE /api/comments/:id — Delete a comment (public, matches Express behavior)
 * Returns: { success: true }
 */
export const DELETE: APIRoute = async ({ params }) => {
  const existing = db
    .select()
    .from(comments)
    .where(eq(comments.id, params.id!))
    .get();

  if (!existing) {
    return new Response(JSON.stringify({ error: "评论不存在" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  db.delete(comments)
    .where(eq(comments.id, params.id!))
    .run();

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
