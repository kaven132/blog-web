import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ cookies }) => {
  const authed = cookies.get("auth")?.value === "true";
  return new Response(JSON.stringify({ loggedIn: authed }), {
    headers: { "Content-Type": "application/json" },
  });
};
