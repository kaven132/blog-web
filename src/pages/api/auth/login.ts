import type { APIRoute } from "astro";

// Simple password — in production use env vars
const ADMIN_ACCOUNT = "kavenyyds";
const ADMIN_PASSWORD = "4399123456";

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { account, password } = await request.json();

    if (account === ADMIN_ACCOUNT && password === ADMIN_PASSWORD) {
      cookies.set("auth", "true", {
        httpOnly: true,
        secure: false, // set true in production
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: false, error: "密码错误" }), {
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
