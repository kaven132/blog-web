import type { APIRoute } from "astro";
import { requireAuth } from "../../../lib/auth";

/**
 * GET /api/auth/me — Check current auth status (no side effects)
 * Returns: { username: string } if logged in, 401 if not
 * Used by AuthProvider for silent auth check on mount.
 */
export const GET: APIRoute = async ({ request }) => {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  return new Response(JSON.stringify({ username: auth.username }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
