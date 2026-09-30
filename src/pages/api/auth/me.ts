import type { APIRoute } from "astro";
import { AUTH_COOKIE, isAuthed } from "../../../lib/auth";

export const GET: APIRoute = async ({ cookies }) => {
  return new Response(JSON.stringify({ loggedIn: isAuthed(cookies.get(AUTH_COOKIE)?.value) }), {
    headers: { "Content-Type": "application/json" },
  });
};
