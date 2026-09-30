import { db } from "../db";
import { posts } from "../db/schema";
import { eq } from "drizzle-orm";
import { sanitizeSlug, slugify } from "./slug";

/**
 * slug 唯一事实来源：api/posts.ts 与 scripts/post-article.ts 共用。
 * 手输 slug 清洗（防空格/?/# 坏链接）→ 空则由标题生成 → 仍冲突则 -2/-3 递增。
 */
export function resolveSlug(title: string, slug: string | undefined, excludeId?: number): string {
  const clean = sanitizeSlug(slug?.trim() || "") || slugify(title) || `post-${Date.now()}`;
  let candidate = clean;
  let i = 2;
  while (true) {
    const rows = db.select({ id: posts.id }).from(posts).where(eq(posts.slug, candidate)).all();
    if (rows.every((r) => r.id === excludeId)) return candidate;
    candidate = `${clean}-${i++}`;
  }
}

/** tags 兼容：字符串原样用，数组（误传）序列化，其他一律空数组 */
export function normalizeTags(tags: unknown): string {
  if (typeof tags === "string") return tags;
  return JSON.stringify(Array.isArray(tags) ? tags : []);
}
