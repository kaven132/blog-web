import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = async ({ url: site }) => {
  const origin = site.origin.replace(/\/$/, "");

  const body =
    `User-agent: *\n` +
    `Allow: /\n` +
    `Disallow: /admin\n` +
    `Disallow: /account\n` +
    `Disallow: /api\n` +
    `\n` +
    `Sitemap: ${origin}/sitemap.xml\n`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
