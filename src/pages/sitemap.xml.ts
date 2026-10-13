import type { APIRoute } from "astro";
import { db } from "../db";
import { posts } from "../db/schema";
import { eq } from "drizzle-orm";

export const prerender = false;

/** SQLite 的 UTC 时间串 → W3C 格式（sitemap 的 lastmod 要求） */
function toW3C(s: string): string {
  return s ? `${s.replace(" ", "T")}Z` : "";
}

export const GET: APIRoute = async ({ url: site }) => {
  const origin = site.origin.replace(/\/$/, "");

  // 固定页面 + 全部已发布文章（lastmod 取更新时间，帮助爬虫优先抓新内容）
  const staticPages = ["/", "/posts", "/about", "/games"];
  const postRows = db
    .select({ slug: posts.slug, updatedAt: posts.updatedAt })
    .from(posts)
    .where(eq(posts.published, true))
    .all();

  const items = [
    ...staticPages.map((p) => ({ loc: `${origin}${p}`, lastmod: "" })),
    ...postRows.map((p) => ({
      loc: `${origin}/posts/${encodeURIComponent(p.slug)}`,
      lastmod: toW3C(p.updatedAt),
    })),
  ];

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    items.map((i) => `  <url>\n    <loc>${i.loc}</loc>\n${i.lastmod ? `    <lastmod>${i.lastmod}</lastmod>\n` : ""}  </url>`).join("\n") +
    `\n</urlset>\n`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
