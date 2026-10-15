/**
 * 图片 URL 改写（同构：React 岛与 SSR 都能用，禁止引入 node 依赖）。
 * 远程 http(s) 图统一走 /api/img 代理：服务端拉取转 WebP + 磁盘缓存后回源；
 * 本站 /uploads 不改写——由 /uploads 端点按浏览器 Accept 协商转 WebP，URL 保持不变。
 */
export function optimizeImgSrc(src?: string | null): string | undefined {
  if (!src) return undefined;
  return /^https?:\/\//i.test(src) ? `/api/img?u=${encodeURIComponent(src)}` : src;
}

/** 带宽度的变体 URL：远程走代理 &w=，本站 /uploads 走 ?w=（两端点都按需缩放+缓存） */
export function sizedImgSrc(src: string, w: number): string {
  if (/^https?:\/\//i.test(src)) return `/api/img?u=${encodeURIComponent(src)}&w=${w}`;
  if (src.startsWith("/uploads/")) return `${src}?w=${w}`;
  return src;
}

/** srcset 属性串（宽度描述符）；调用方自行配 sizes */
export function imgSrcSet(src?: string | null, widths: number[] = []): string | undefined {
  if (!src || widths.length === 0) return undefined;
  return widths.map((w) => `${sizedImgSrc(src, w)} ${w}w`).join(", ");
}

/** 正文图（内容列 768px 封顶、移动端全宽）的响应式属性串；非代理范围图返回空串 */
export function responsiveImgAttrs(src?: string | null): string {
  if (!src || !(/^https?:\/\//i.test(src) || src.startsWith("/uploads/"))) return "";
  const set = imgSrcSet(src, [640, 1280, 1920]);
  if (!set) return "";
  return ` srcset="${set}" sizes="(max-width: 768px) 100vw, 768px"`;
}
