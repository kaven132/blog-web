import rss from "@astrojs/rss";
import type { APIRoute } from "astro";
import { db } from "../db";
import { posts } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import { parseTags, getParentTag } from "../lib/tags";
import { renderMarkdown } from "../lib/markdown";

export const prerender = false;

/**
 * RSS 2.0 全文订阅：/rss.xml（全部已发布文章）
 * 可选分类过滤：/rss.xml?cat=技术 —— 只输出该一级分类的文章。
 * 实时查库生成，自动化线发文后订阅者立即可见。
 */

export const GET: APIRoute = async (context) => {
  const origin = context.url.origin;
  const cat = (context.url.searchParams.get("cat") || "").trim();

  const all = db
    .select({
      title: posts.title,
      slug: posts.slug,
      excerpt: posts.excerpt,
      content: posts.content,
      tags: posts.tags,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .where(eq(posts.published, true))
    .orderBy(desc(posts.createdAt))
    .all();

  const origin_ = origin.replace(/\/$/, "");
  const items = all
    .filter((p) => {
      if (!cat) return true;
      return getParentTag(parseTags(p.tags)) === cat;
    })
    .map((p) => {
      const d = new Date(p.createdAt.replace(" ", "T") + "Z");
      let html = renderMarkdown(p.content);
      // 正文里的站内相对路径图片转绝对地址，保证阅读器中正常显示
      html = html.replace(/(src=")(\/[^"]+)/g, `$1${origin_}$2`);
      return {
        title: p.title,
        pubDate: isNaN(d.getTime()) ? new Date() : d,
        link: `${origin_}/posts/${p.slug}`,
        description: p.excerpt,
        content: html,
        categories: parseTags(p.tags),
      };
    });

  return rss({
    title: "kaven的个人网页",
    description: "自动化发文线与手写随笔 —— 技术、阅读与旅途",
    site: origin_,
    items,
    customData: "<language>zh-cn</language>",
  });
};
