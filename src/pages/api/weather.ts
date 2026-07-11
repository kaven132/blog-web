import type { APIRoute } from "astro";

/**
 * GET /api/weather — Server-side weather proxy
 *
 * Fetches weather from wttr.in on the server side (no CORS, no HTML response).
 * Returns: { icon: string, text: string }
 * Caches result for 30 minutes via client-side localStorage.
 */
export const GET: APIRoute = async () => {
  try {
    // wttr.in with format and proper User-Agent to get plain text
    const res = await fetch("https://wttr.in?format=%c+%C+%t", {
      headers: { "User-Agent": "curl/8.0" },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) throw new Error("Weather service unavailable");

    const text = (await res.text()).trim();

    // Format: "☀️ Sunny +25°C" or similar
    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=1800", // 30 min CDN cache
      },
    });
  } catch {
    return new Response(JSON.stringify({ text: "天气不可用" }), {
      status: 200, // Return 200 with fallback message
      headers: { "Content-Type": "application/json" },
    });
  }
};
