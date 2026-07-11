import type { APIRoute } from "astro";
import { db } from "../../../../lib/db";
import { articles, likes } from "../../../../db/schema";
import { eq, and, sql } from "drizzle-orm";

/**
 * Helper: get current like count for an article
 */
function getLikeCount(articleId: string): number {
  const row = db
    .select({ likesCount: articles.likesCount })
    .from(articles)
    .where(eq(articles.id, articleId))
    .get();
  return row?.likesCount ?? 0;
}

/**
 * GET /api/articles/:id/likes — Get like status (public)
 * Query params: userToken
 * Returns: { count: number, isLiked: boolean }
 * Matches Express JSON shape exactly.
 */
export const GET: APIRoute = async ({ params, request }) => {
  const article = db
    .select({ id: articles.id, likesCount: articles.likesCount })
    .from(articles)
    .where(eq(articles.id, params.id!))
    .get();

  if (!article) {
    return new Response(JSON.stringify({ error: "文章不存在" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(request.url);
  const userToken = url.searchParams.get("userToken");
  let isLiked = false;

  if (userToken) {
    const like = db
      .select({ id: likes.id })
      .from(likes)
      .where(
        and(
          eq(likes.articleId, params.id!),
          eq(likes.userToken, userToken),
        ),
      )
      .get();
    isLiked = !!like;
  }

  return new Response(
    JSON.stringify({ count: article.likesCount, isLiked }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
};

/**
 * POST /api/articles/:id/likes — Like an article (public, token-based)
 * Body: { userToken: string }
 * Returns: { count: number, isLiked: true }
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
  const { userToken } = body || {};

  if (!userToken) {
    return new Response(JSON.stringify({ error: "缺少 userToken" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Check existing like
  const existing = db
    .select({ id: likes.id })
    .from(likes)
    .where(
      and(
        eq(likes.articleId, params.id!),
        eq(likes.userToken, userToken),
      ),
    )
    .get();

  if (existing) {
    return new Response(
      JSON.stringify({
        error: "已经点过赞了",
        count: getLikeCount(params.id!),
      }),
      {
        status: 409,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // Insert like + increment counter
  db.insert(likes)
    .values({ articleId: params.id!, userToken })
    .run();

  db.update(articles)
    .set({ likesCount: sql`likes_count + 1` })
    .where(eq(articles.id, params.id!))
    .run();

  return new Response(
    JSON.stringify({ count: getLikeCount(params.id!), isLiked: true }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
};

/**
 * DELETE /api/articles/:id/likes — Unlike an article (public, token-based)
 * Body: { userToken: string }
 * Returns: { count: number, isLiked: false }
 */
export const DELETE: APIRoute = async ({ params, request }) => {
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
  const { userToken } = body || {};

  if (!userToken) {
    return new Response(JSON.stringify({ error: "缺少 userToken" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Check existing like
  const existing = db
    .select({ id: likes.id })
    .from(likes)
    .where(
      and(
        eq(likes.articleId, params.id!),
        eq(likes.userToken, userToken),
      ),
    )
    .get();

  if (!existing) {
    return new Response(
      JSON.stringify({
        error: "还没有点赞",
        count: getLikeCount(params.id!),
      }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // Delete like + decrement counter (floor at 0)
  db.delete(likes)
    .where(
      and(
        eq(likes.articleId, params.id!),
        eq(likes.userToken, userToken),
      ),
    )
    .run();

  db.update(articles)
    .set({ likesCount: sql`MAX(0, likes_count - 1)` })
    .where(eq(articles.id, params.id!))
    .run();

  return new Response(
    JSON.stringify({ count: getLikeCount(params.id!), isLiked: false }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
};
