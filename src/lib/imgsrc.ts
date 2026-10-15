/**
 * 图片 URL 改写（同构：React 岛与 SSR 都能用，禁止引入 node 依赖）。
 * 远程 http(s) 图统一走 /api/img 代理：服务端拉取转 WebP + 磁盘缓存后回源；
 * 本站 /uploads 不改写——由 /uploads 端点按浏览器 Accept 协商转 WebP，URL 保持不变。
 */
export function optimizeImgSrc(src?: string | null): string | undefined {
  if (!src) return undefined;
  return /^https?:\/\//i.test(src) ? `/api/img?u=${encodeURIComponent(src)}` : src;
}
