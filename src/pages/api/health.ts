import type { APIRoute } from "astro";

/**
 * GET /api/health — Health check (matches Express response shape)
 */
export const GET: APIRoute = () => {
  return new Response(
    JSON.stringify({
      status: "ok",
      db: process.cwd() + "/data.db",
      uptime: process.uptime(),
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
};
