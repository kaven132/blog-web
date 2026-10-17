import { defineMiddleware } from "astro:middleware";

/**
 * SSR 页面禁缓存：HTML 永远即时渲染。
 * 实测踩坑：页面无缓存头时浏览器启发式缓存旧 HTML，配合陈旧的 JS 子资源缓存，
 * 会让一次坏构建的产物在用户浏览器里残留数天（jsxDEV 报错刷不掉）。
 * 注：/_astro/*、/uploads/*、/games/* 等静态资源不经过 middleware，
 * 由各自端点或浏览器默认策略处理。
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();
  if (!response.headers.has("Cache-Control")) {
    response.headers.set("Cache-Control", "no-store");
  }
  return response;
});
