import type { APIRoute } from "astro";
import { db } from "../../db";
import { likes } from "../../db/schema";
import { eq, sql } from "drizzle-orm";

export const POST: APIRoute = async ({ request }) => {
  try {
    const { postId } = await request.json();

    if (!postId || typeof postId !== "number") {
      return new Response(JSON.stringify({ error: "无效的请求" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Upsert: increment count
    const existing = db.select().from(likes).where(eq(likes.postId, postId)).get();

    if (existing) {
      db.update(likes)
        .set({ count: existing.count + 1 })
        .where(eq(likes.postId, postId))
        .run();
    } else {
      db.insert(likes).values({ postId, count: 1 }).run();
    }

    const updated = db.select().from(likes).where(eq(likes.postId, postId)).get();

    return new Response(JSON.stringify({ count: updated?.count || 1 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "服务器错误" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
