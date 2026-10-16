import type { APIRoute } from "astro";
import { db } from "../../db";
import { gameSaves } from "../../db/schema";
import { eq } from "drizzle-orm";
import { AUTH_COOKIE, isAuthed } from "../../lib/auth";

export const prerender = false;

/**
 * 网页游戏云端存档接口。
 * GET  /api/game-save?game=<id>          → { data: base64|null, size, updatedAt }
 * POST /api/game-save { game, data }     → 覆盖保存（data 为 base64 的 .sol 文件字节）
 * 仅登录用户（单管理员体系，user_id 恒为 1）。sol 实际只有几 KB，上限放宽到 200KB base64 防滥用。
 */

const GAME_ID = /^[a-z0-9_-]{1,40}$/i;
const MAX_B64_LEN = 200_000;
const B64 = /^[A-Za-z0-9+/=\r\n]+$/;
/** 单管理员：credentials 恒一行（id=1），isAuthed 通过即为本人 */
const USER_ID = 1;

export const GET: APIRoute = async ({ cookies, url }) => {
  if (!isAuthed(cookies.get(AUTH_COOKIE)?.value)) {
    return new Response(JSON.stringify({ error: "请先登录" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  const game = (url.searchParams.get("game") || "").trim();
  if (!GAME_ID.test(game)) {
    return new Response(JSON.stringify({ error: "无效的游戏标识" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  const row = db.select().from(gameSaves).where(eq(gameSaves.game, game)).get();
  return new Response(
    JSON.stringify({ data: row?.data ?? null, size: row?.size ?? 0, updatedAt: row?.updatedAt ?? null }),
    { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
  );
};

export const POST: APIRoute = async ({ cookies, request }) => {
  if (!isAuthed(cookies.get(AUTH_COOKIE)?.value)) {
    return new Response(JSON.stringify({ error: "请先登录" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  const body = (await request.json().catch(() => null)) as { game?: string; data?: string } | null;
  const game = (body?.game || "").trim();
  const data = typeof body?.data === "string" ? body.data : "";
  if (!GAME_ID.test(game) || !data || data.length > MAX_B64_LEN || !B64.test(data)) {
    return new Response(JSON.stringify({ error: "无效的存档数据" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  // 粗校验 sol 头：Ruffle/Flash 的 .sol 都是 \x00\xbf 开头 + TCSO 魔数（放宽到前 16 字节内找 TCSO）
  let head = "";
  try {
    head = Buffer.from(data, "base64").subarray(0, 16).toString("latin1");
  } catch {
    return new Response(JSON.stringify({ error: "存档解码失败" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  if (!head.includes("TCSO")) {
    return new Response(JSON.stringify({ error: "不是有效的 .sol 存档" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const size = Math.floor((data.length * 3) / 4);
  db.insert(gameSaves)
    .values({ userId: USER_ID, game, data, size })
    .onConflictDoUpdate({
      target: [gameSaves.userId, gameSaves.game],
      set: { data, size, updatedAt: new Date().toISOString().slice(0, 19).replace("T", " ") },
    })
    .run();

  return new Response(JSON.stringify({ ok: true, size }), { headers: { "Content-Type": "application/json" } });
};
