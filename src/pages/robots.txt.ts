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
    // R18 游戏区（登录 + NSFW 开关双闸门之后的内容，不进任何搜索引擎索引）
    `Disallow: /games\n` +
    // 媒体原文件（视频二进制）与登录后功能页：可索引的是列表/详情页，不是这些
    `Disallow: /media\n` +
    `Disallow: /write\n` +
    `Disallow: /history\n` +
    `\n` +
    `Sitemap: ${origin}/sitemap.xml\n`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
