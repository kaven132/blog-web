import type { APIRoute } from "astro";
import { db } from "../../db";
import { likes, posts, galleries, galleryLikes, videos, videoLikes } from "../../db/schema";
import { eq, sql } from "drizzle-orm";
import { rateLimit } from "../../lib/rate-limit";

const LIKED_COOKIE = "liked-ids";
/** 单 cookie 记录最近 100 个已点赞目标（超出截尾），防 header 无限膨胀 */
const LIKED_COOKIE_MAX = 100;

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  try {
    // 防刷一：IP 频控——点赞是廉价操作，10 次/分钟远超真人节奏（脚本清 cookie 也撞这条线）
    const rl = rateLimit("like:" + (clientAddress || "unknown"), 10, 60_000);
    if (!rl.ok) {
      return new Response(JSON.stringify({ error: "操作过于频繁" }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": String(rl.retryAfterSec) },
      });
    }

    const body = await request.json();
    const postId = typeof body?.postId === "number" ? body.postId : undefined;
    const galleryId = typeof body?.galleryId === "number" ? body.galleryId : undefined;
    const videoId = typeof body?.videoId === "number" ? body.videoId : undefined;

    // 防刷二：cookie 去重——同一访客对同一目标只 +1 一次（点了再点/重复请求返回当前计数不累加）
    const dedupKey =
      videoId !== undefined ? "v" + videoId : galleryId !== undefined ? "g" + galleryId : postId !== undefined ? "p" + postId : "";
    const seen = (cookies.get(LIKED_COOKIE)?.value || "").split(",").filter(Boolean);
    const alreadyLiked = Boolean(dedupKey) && seen.includes(dedupKey);
    const rememberLike = () => {
      if (!dedupKey) return;
      const next = [...seen.filter((k) => k !== dedupKey), dedupKey].slice(-LIKED_COOKIE_MAX).join(",");
      cookies.set(LIKED_COOKIE, next, { path: "/", maxAge: 60 * 60 * 24 * 365, httpOnly: true, sameSite: "lax" });
    };
    const currentCount = () =>
      videoId !== undefined
        ? db.select({ c: videoLikes.count }).from(videoLikes).where(eq(videoLikes.videoId, videoId)).get()?.c ?? 0
        : galleryId !== undefined
          ? db.select({ c: galleryLikes.count }).from(galleryLikes).where(eq(galleryLikes.galleryId, galleryId)).get()?.c ?? 0
          : db.select({ c: likes.count }).from(likes).where(eq(likes.postId, postId)).get()?.c ?? 0;

    // 视频点赞：与文章/相册同款原子累加（video_likes.video_id 主键天然去重）
    if (videoId !== undefined) {
      if (!Number.isInteger(videoId) || videoId <= 0) {
        return new Response(JSON.stringify({ error: "无效的请求" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      const exists = db.select({ id: videos.id }).from(videos).where(eq(videos.id, videoId)).get();
      if (!exists) {
        return new Response(JSON.stringify({ error: "视频不存在" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (alreadyLiked) {
        return new Response(JSON.stringify({ count: currentCount() }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      const rows = db
        .insert(videoLikes)
        .values({ videoId, count: 1 })
        .onConflictDoUpdate({
          target: videoLikes.videoId,
          set: { count: sql`${videoLikes.count} + 1` },
        })
        .returning()
        .all();
      rememberLike();
      return new Response(JSON.stringify({ count: rows[0]?.count ?? 1 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 相册点赞：与文章同款原子累加（gallery_likes.gallery_id 主键天然去重）
    if (galleryId !== undefined) {
      if (!Number.isInteger(galleryId) || galleryId <= 0) {
        return new Response(JSON.stringify({ error: "无效的请求" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      const exists = db.select({ id: galleries.id }).from(galleries).where(eq(galleries.id, galleryId)).get();
      if (!exists) {
        return new Response(JSON.stringify({ error: "相册不存在" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (alreadyLiked) {
        return new Response(JSON.stringify({ count: currentCount() }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      const rows = db
        .insert(galleryLikes)
        .values({ galleryId, count: 1 })
        .onConflictDoUpdate({
          target: galleryLikes.galleryId,
          set: { count: sql`${galleryLikes.count} + 1` },
        })
        .returning()
        .all();
      rememberLike();
      return new Response(JSON.stringify({ count: rows[0]?.count ?? 1 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

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

    if (alreadyLiked) {
      return new Response(JSON.stringify({ count: currentCount() }), {
        status: 200,
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
    rememberLike();

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
