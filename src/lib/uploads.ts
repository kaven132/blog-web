import { existsSync, unlinkSync } from "node:fs";
import { resolve, sep } from "node:path";
import { db } from "../db";
import { posts, profile } from "../db/schema";
import { eq, ne } from "drizzle-orm";

const UPLOAD_ROOT = resolve("./data/uploads");

/** 从任意文本里提取 /uploads/<name> 引用（原样 + percent-decode 双形态都收，防漏配中文文件名） */
export function extractUploadNames(...texts: (string | null | undefined)[]): Set<string> {
  const names = new Set<string>();
  for (const t of texts) {
    if (!t) continue;
    for (const m of String(t).matchAll(/\/uploads\/([^)\s"'<>\\]+)/g)) {
      names.add(m[1]);
      try {
        names.add(decodeURIComponent(m[1]));
      } catch {
        // 非法编码序列只按原样匹配
      }
    }
  }
  return names;
}

/** uploads 文件名 → 校验过根目录边界的绝对路径；越界返回 null */
export function uploadFilePath(name: string): string | null {
  const full = resolve(UPLOAD_ROOT, name);
  if (full !== UPLOAD_ROOT && !full.startsWith(UPLOAD_ROOT + sep)) return null;
  return full;
}

/** 全库当前仍被引用的 uploads 文件名集合；excludePostId 用于「删掉这篇文章后」的场景 */
export function collectUploadRefs(excludePostId?: number): Set<string> {
  const base = {
    cover: posts.coverImage,
    content: posts.content,
    excerpt: posts.excerpt,
  };
  const rows = excludePostId
    ? db.select(base).from(posts).where(ne(posts.id, excludePostId)).all()
    : db.select(base).from(posts).all();

  const used = new Set<string>();
  for (const r of rows) {
    for (const n of extractUploadNames(r.cover, r.content, r.excerpt)) used.add(n);
  }
  const prof = db.select({ avatar: profile.avatar }).from(profile).where(eq(profile.id, 1)).get();
  for (const n of extractUploadNames(prof?.avatar)) used.add(n);
  return used;
}

/**
 * 把 names 里已无人引用的本地图从 data/uploads 删除（孤儿图根治的统一出口）。
 * 调用时机：删文之后、换封面之后 —— 仍被其他文章/头像引用的文件自动跳过。
 */
export function removeUnreferenced(names: Iterable<string>): string[] {
  const used = collectUploadRefs();
  const removed: string[] = [];
  for (const name of names) {
    if (used.has(name)) continue;
    const p = uploadFilePath(name);
    if (p && existsSync(p)) {
      unlinkSync(p);
      removed.push(name);
    }
  }
  return removed;
}
