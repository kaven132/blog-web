import type { APIRoute } from "astro";
import { login } from "../../../lib/auth";

/**
 * POST /api/auth/login
 *
 * Accepts: { username: string, password: string }
 * Returns: { token: string, username: string }
 * Also sets: httpOnly cookie `blog_session` (JWT)
 */
export const POST: APIRoute = async ({ request }) => {
  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "请求格式错误" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { username, password } = body;

  if (!username || !password) {
    return new Response(JSON.stringify({ error: "请输入账号和密码" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const result = await login(username, password);

  if (!result) {
    return new Response(JSON.stringify({ error: "账号或密码错误" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ token: result.token, username: result.username }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": result.cookieHeader,
      },
    },
  );
};
