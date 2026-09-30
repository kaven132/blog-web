/**
 * 清洗任意输入（手输 slug 或标题）为合法 slug：只保留小写字母/数字/中文/连字符。
 * 返回空串表示输入里没有可用字符。
 */
export function sanitizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export function slugify(title: string): string {
  return sanitizeSlug(title).slice(0, 80);
}
