import type { APIRoute } from "astro";

/**
 * GET /api/weather — Server-side weather proxy
 * Returns: { icon: string, temp: string, location: string }
 */
export const GET: APIRoute = async () => {
  try {
    const res = await fetch("https://wttr.in?format=%c+%t+%l", {
      headers: { "User-Agent": "curl/8.0" },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) throw new Error("Weather service unavailable");

    const raw = (await res.text()).trim();
    // raw e.g.: "☀️ +33°C Shanghai, China" or "☀️ +33°C 34.77,113.72"
    const tokens = raw.split(/\s+/);

    const icon = tokens[0] || "";
    const tempIdx = tokens.findIndex((t) => t.includes("°C"));
    const temp = tempIdx >= 0 ? tokens[tempIdx].replace(/^\+/, "") : "";
    const rest = tempIdx >= 0 ? tokens.slice(tempIdx + 1).join(" ") : "";
    // Discard coordinates (e.g., "34.773200,113.722000")
    const location = /^\d+\.\d+,/.test(rest) ? "" : rest;

    return new Response(JSON.stringify({ icon, temp, location }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=1800",
      },
    });
  } catch {
    return new Response(JSON.stringify({ icon: "🌤", temp: "--°C", location: "" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
};
