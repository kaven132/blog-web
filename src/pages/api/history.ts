import type { APIRoute } from "astro";
import { db } from "../../db";
import { browseHistory } from "../../db/schema";
import { and, desc, eq } from "drizzle-orm";
import { AUTH_COOKIE, isAuthed } from "../../lib/auth";

export const prerender = false;

/** 浏览历史接口（仅登录，单管理员 user_id=1）：
 *  GET            → 最近 50 条（viewed_at 倒序，与表容量护栏一致）
 *  DELETE ?id=    → 删除单条
 *  DELETE ?all=1  → 清空当前用户全部历史
 */
const USER_ID = 1;

export const GET: APIRoute = async ({ cookies }) => {
  if (!isAuthed(cookies.get(AUTH_COOKIE)?.value)) {
    return new Response(JSON.stringify({ error: "请先登录" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  const rows = db
    .select()
    .from(browseHistory)
    .where(eq(browseHistory.userId, USER_ID))
    .orderBy(desc(browseHistory.viewedAt), desc(browseHistory.id))
    .limit(50)
    .all();
  return new Response(JSON.stringify({ items: rows }), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
};

export const DELETE: APIRoute = async ({ cookies, url }) => {
  if (!isAuthed(cookies.get(AUTH_COOKIE)?.value)) {
    return new Response(JSON.stringify({ error: "请先登录" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  if (url.searchParams.get("all") === "1") {
    db.delete(browseHistory).where(eq(browseHistory.userId, USER_ID)).run();
    return new Response(JSON.stringify({ ok: true, cleared: true }), { headers: { "Content-Type": "application/json" } });
  }
  const id = Number(url.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return new Response(JSON.stringify({ error: "无效的记录" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  db.delete(browseHistory).where(and(eq(browseHistory.userId, USER_ID), eq(browseHistory.id, id))).run();
  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
};
