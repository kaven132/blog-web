import type { APIRoute } from "astro";
import { logoutCookie } from "../../../lib/auth";

/**
 * POST /api/auth/logout
 *
 * Clears the httpOnly `blog_session` cookie.
 * No request body needed.
 */
export const POST: APIRoute = () => {
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": logoutCookie(),
    },
  });
};
