import type { APIRoute } from "astro";
import { db } from "../../db";
import { likes, posts } from "../../db/schema";
import { eq, sql } from "drizzle-orm";

export const POST: APIRoute = async ({ request }) => {
  try {
    const { postId } = await request.json();

    if (!postId || typeof postId !== "number" || !Number.isInteger(postId)) {
      return new Response(JSON.stringify({ error: "无效的请求" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 不存在的文章：外键约束会把插入变成 500，提前拦成 404
    const exists = db.select({ id: posts.id }).from(posts).where(eq(posts.id, postId)).get();
    if (!exists) {
      return new Response(JSON.stringify({ error: "文章不存在" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 单条原子语句完成累加：并发请求不会产生重复行，
    // 也不会出现「读-改-写」丢更新（依赖 likes.post_id 上的唯一索引）
    const rows = db
      .insert(likes)
      .values({ postId, count: 1 })
      .onConflictDoUpdate({
        target: likes.postId,
        set: { count: sql`${likes.count} + 1` },
      })
      .returning()
      .all();

    const count = rows[0]?.count ?? 1;

    return new Response(JSON.stringify({ count }), {
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
