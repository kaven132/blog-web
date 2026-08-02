/**
 * 自动发文脚本（供每日自动化任务调用）
 *
 * 复用项目已有的 Drizzle schema 与 SQLite 连接，直接写库。
 * 选择"直接写库"而非调 /api/posts，原因：
 *   - 无需维护登录 cookie（auth=true）
 *   - 不依赖博客服务进程是否在线
 *   - 与 SSR 动态渲染天然兼容：写入后访问即见，无需重新构建
 *
 * 用法：
 *   插入文章  node_modules/.bin/tsx scripts/post-article.ts --file=article.json
 *   删除文章  node_modules/.bin/tsx scripts/post-article.ts --delete --slug=<slug>
 *
 * 必须在该仓库根目录（含 ./data 与 ./node_modules）下运行。
 */

import { readFileSync, copyFileSync, existsSync, mkdirSync } from "node:fs";
import { extname, join } from "node:path";
import { db } from "../src/db";
import { posts } from "../src/db/schema";
import { slugify } from "../src/lib/slug";
import { eq } from "drizzle-orm";

interface Article {
  title: string;
  content: string;
  excerpt?: string;
  tags?: string[];
  slug?: string;
  coverImage?: string;
}

/** 与 src/pages/api/posts.ts 的 resolveSlug 保持一致：自动去重 */
function resolveSlug(title: string, slug: string | undefined, excludeId?: number): string {
  const clean = slug?.trim() || slugify(title) || `post-${Date.now()}`;
  let candidate = clean;
  let i = 2;
  while (true) {
    const rows = db
      .select({ id: posts.id })
      .from(posts)
      .where(eq(posts.slug, candidate))
      .all();
    if (rows.every((r) => r.id === excludeId)) return candidate;
    candidate = `${clean}-${i++}`;
  }
}

/**
 * 处理封面图：
 *  - http(s) 外链 → 原样使用（兼容之前的 Unsplash 方案）
 *  - 本地文件路径 → 拷入 data/uploads/ 并重命名为 <slug>.<ext>，返回 /uploads/<slug>.<ext>
 *    供博客的 uploads/[...file].ts 路由直接服务（无需登录）
 */
function resolveCover(cover: string | undefined, slug: string): string | null {
  if (!cover) return null;
  if (/^https?:\/\//i.test(cover)) return cover;
  if (!existsSync(cover)) {
    console.warn(`⚠️ coverImage 本地文件不存在，已忽略封面：${cover}`);
    return null;
  }
  const uploadDir = join(process.cwd(), "data", "uploads");
  mkdirSync(uploadDir, { recursive: true });
  const ext = extname(cover).toLowerCase() || ".png";
  const destName = `${slug}${ext}`;
  copyFileSync(cover, join(uploadDir, destName));
  console.log(`🖼️  封面已本地化：/uploads/${destName}`);
  return `/uploads/${destName}`;
}

function insertArticle(file: string) {
  const raw = readFileSync(file, "utf-8");
  const article = JSON.parse(raw) as Article;

  if (!article.title || !article.content) {
    console.error("❌ 缺少必填字段 title 或 content");
    process.exit(1);
  }

  const finalSlug = resolveSlug(article.title, article.slug);
  const tagsJson = JSON.stringify(article.tags ?? []);

  const result = db
    .insert(posts)
    .values({
      title: article.title,
      slug: finalSlug,
      excerpt: article.excerpt ?? "",
      content: article.content,
      tags: tagsJson,
      coverImage: resolveCover(article.coverImage, finalSlug),
      published: true,
    })
    .run();

  console.log(
    `✅ 已发布文章：slug=${finalSlug}  id=${result.lastInsertRowid}`,
  );
  return finalSlug;
}

function deleteArticle(slug: string) {
  const existing = db.select().from(posts).where(eq(posts.slug, slug)).get();
  if (!existing) {
    console.error(`❌ 未找到 slug=${slug} 的文章`);
    process.exit(1);
  }
  db.delete(posts).where(eq(posts.slug, slug)).run();
  console.log(`🗑️  已删除文章：slug=${slug}  id=${existing.id}`);
}

function main() {
  const args = process.argv.slice(2);
  const fileArg = args.find((a) => a.startsWith("--file="))?.split("=")[1];
  const slugArg = args.find((a) => a.startsWith("--slug="))?.split("=")[1];
  const doDelete = args.includes("--delete");

  if (doDelete && slugArg) {
    deleteArticle(slugArg);
    return;
  }

  if (fileArg) {
    insertArticle(fileArg);
    return;
  }

  console.log("用法：");
  console.log(
    "  插入: tsx scripts/post-article.ts --file=<article.json>",
  );
  console.log(
    "  删除: tsx scripts/post-article.ts --delete --slug=<slug>",
  );
}

main();
