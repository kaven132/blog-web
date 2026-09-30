import type { APIRoute } from "astro";
import { AUTH_COOKIE, ADMIN_ACCOUNT, ADMIN_PASSWORD, makeAuthToken } from "../../../lib/auth";

/**
 * 登录失败限流：同一 IP 10 分钟内失败满 5 次，锁定 10 分钟。
 * 只存内存，重启即清零 —— 个人博客够用，部署到多实例时需换共享存储。
 */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILS = 5;
const attempts = new Map<string, { fails: number; firstFailAt: number; lockedUntil: number }>();

function pruneAttempts(now: number) {
  if (attempts.size < 1000) return;
  for (const [ip, rec] of attempts) {
    if (now > rec.lockedUntil && now - rec.firstFailAt > WINDOW_MS) attempts.delete(ip);
  }
}

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  const ip = clientAddress || "unknown";
  const now = Date.now();

  const locked = attempts.get(ip);
  if (locked && locked.lockedUntil > now) {
    return new Response(JSON.stringify({ error: "尝试次数过多，请 10 分钟后再试" }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": String(Math.ceil((locked.lockedUntil - now) / 1000)) },
    });
  }

  try {
    const { account, password } = await request.json();

    if (account === ADMIN_ACCOUNT && password === ADMIN_PASSWORD) {
      attempts.delete(ip);
      cookies.set(AUTH_COOKIE, makeAuthToken(), {
        httpOnly: true,
        // 本地 HTTP 调试保持 false；上了 HTTPS 用 COOKIE_SECURE=1 打开
        secure: process.env.COOKIE_SECURE === "1",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 滑动窗口：窗口内的失败次数累加，满 5 次锁定一个窗口期
    let rec = attempts.get(ip);
    if (!rec || now - rec.firstFailAt > WINDOW_MS) {
      rec = { fails: 0, firstFailAt: now, lockedUntil: 0 };
    }
    rec.fails += 1;
    if (rec.fails >= MAX_FAILS) rec.lockedUntil = now + WINDOW_MS;
    attempts.set(ip, rec);
    pruneAttempts(now);

    return new Response(JSON.stringify({ error: "账号或密码错误" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "请求无效" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
};
