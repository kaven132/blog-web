import type { APIRoute } from "astro";
import { db } from "../../db";
import { likes } from "../../db/schema";
import { sql } from "drizzle-orm";

export const POST: APIRoute = async ({ request }) => {
  try {
    const { postId } = await request.json();

    if (!postId || typeof postId !== "number") {
      return new Response(JSON.stringify({ error: "无效的请求" }), {
        status: 400,
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
