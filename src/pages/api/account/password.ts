import type { APIRoute } from "astro";
import { AUTH_COOKIE, isAuthed, verifyPassword, savePassword } from "../../../lib/auth";

/** POST /api/account/password —— 修改登录密码（需登录；校验原密码；scrypt 落库） */
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAuthed(cookies.get(AUTH_COOKIE)?.value)) {
    return new Response(JSON.stringify({ error: "请先登录" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { currentPassword, newPassword } = await request.json();

    if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
      return new Response(JSON.stringify({ error: "请求无效" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!verifyPassword(currentPassword)) {
      return new Response(JSON.stringify({ error: "当前密码不正确" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (newPassword.length < 6 || newPassword.length > 64) {
      return new Response(JSON.stringify({ error: "新密码长度需在 6~64 位之间" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (newPassword === currentPassword) {
      return new Response(JSON.stringify({ error: "新密码不能与当前密码相同" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    savePassword(newPassword);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "请求无效" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
};
