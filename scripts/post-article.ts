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
 *   仅自检    node_modules/.bin/tsx scripts/post-article.ts --file=article.json --check-only
 *   删除文章  node_modules/.bin/tsx scripts/post-article.ts --delete --slug=<slug>
 *
 * 插入前自动执行两项体检（任一 FAIL 退出码 1，不写库）：
 *   - slug 查重：库中已有同 slug → 判定重复调度/重复发布，拒绝入库（防 -2 重复行）
 *   - 渲染体检：renderMarkdown 后 <img>/<h2> 数与 markdown 源一致、裸 | 不泄漏
 *
 * 必须在该仓库根目录（含 ./data 与 ./node_modules）下运行。
 */

import { readFileSync, copyFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import { db } from "../src/db";
import { posts } from "../src/db/schema";
import { resolveSlug } from "../src/lib/posts";
import { renderMarkdown } from "../src/lib/markdown";
import { eq } from "drizzle-orm";

interface Article {
  title: string;
  content: string;
  excerpt?: string;
  tags?: string[];
  slug?: string;
  coverImage?: string;
}

/**
 * 发布前渲染体检（2026-10-15 起内建，替代各自动化线「发布后离线调 renderMarkdown」步骤）：
 *  - 每个正文插图 markdown 都要渲染出 <img>（占位符替换遗漏会在这里现形）
 *  - `##` 分节数 = 渲染后 <h2> 数（渲染器吞节会现形）
 *  - 裸 `|` 不能泄进 HTML（渲染器不支持表格）
 * 任一不符 → 打印 FAIL 并以退出码 1 结束（--check-only 时不写库，可提前自检）。
 */
function renderCheck(article: Article): void {
  const html = renderMarkdown(article.content);
  const mdImgs = (article.content.match(/!\[[^\]]*\]\([^)]+\)/g) || []).length;
  const htmlImgs = (html.match(/<img\b/g) || []).length;
  const mdH2 = (article.content.match(/^## /gm) || []).length;
  const htmlH2 = (html.match(/<h2\b/g) || []).length;
  const leakedPipes = html.includes("|");

  console.log("--- 渲染体检 ---");
  console.log(`  <img> : ${htmlImgs}（markdown 插图 ${mdImgs}）`);
  console.log(`  <h2>  : ${htmlH2}（## 分节 ${mdH2}）`);
  console.log(`  裸 |   : ${leakedPipes ? "泄漏进 HTML" : "无"}`);

  const fails: string[] = [];
  if (htmlImgs !== mdImgs) fails.push(`插图渲染缺失：markdown ${mdImgs} 张 → HTML ${htmlImgs} 个 <img>`);
  if (htmlH2 !== mdH2) fails.push(`分节渲染异常：## ${mdH2} 个 → <h2> ${htmlH2} 个`);
  if (leakedPipes) fails.push("裸 | 泄漏进渲染 HTML（渲染器不支持表格）");
  if (mdImgs === 0 && article.coverImage && article.coverImage.startsWith("/uploads/") && article.content.includes(article.coverImage)) {
    fails.push("封面 URL 出现在正文里（封面应在 cover_image 字段，不在 content）");
  }
  if (fails.length) {
    console.error("❌ 渲染体检 FAIL：");
    fails.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  }
}

/** slug 查重：库中已有同 slug 文章说明是重复调度/重复发布，直接拒绝（避免 -2 重复行）。
 *  必须在 resolveSlug 之前调用——resolveSlug 碰到撞 slug 会静默加 -2 后缀，查重就失真了。 */
function slugDupCheck(requestedSlug: string | undefined, finalSlug: string): void {
  const targets = [...new Set([requestedSlug, finalSlug].filter(Boolean))] as string[];
  for (const s of targets) {
    const existing = db.select({ id: posts.id }).from(posts).where(eq(posts.slug, s)).get();
    if (existing) {
      console.error(`❌ slug=${s} 已存在（id=${existing.id}），疑似重复调度或重复发布，拒绝入库。`);
      console.error("   若是重复调度：跳过本次任务并说明原因；若要改内容请直接改库，不要重发。");
      process.exit(1);
    }
  }
}

/**
 * 处理封面图：
 *  - http(s) 外链 → 原样使用（兼容之前的 Unsplash 方案）
 *  - 本地文件路径 → 拷入 data/uploads/ 并重命名为 <slug>.<ext>，返回 /uploads/<slug>.<ext>
 *    供博客的 uploads/[...file].ts 路由直接服务（无需登录）
 *  - 源文件若位于 data/uploads 内（fetch-images 的 _cover-tmp-* 中间产物），拷完即删，不留孤儿
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
  const dest = join(uploadDir, destName);
  copyFileSync(cover, dest);
  console.log(`🖼️  封面已本地化：/uploads/${destName}`);

  const uploadRoot = resolve(uploadDir);
  const srcAbs = resolve(cover);
  if (srcAbs !== resolve(dest) && srcAbs.startsWith(uploadRoot + sep)) {
    unlinkSync(srcAbs);
    console.log(`🧹 已清理中间产物：${srcAbs}`);
  }
  return `/uploads/${destName}`;
}

function insertArticle(file: string, checkOnly: boolean) {
  const raw = readFileSync(file, "utf-8");
  const article = JSON.parse(raw) as Article;

  if (!article.title || !article.content) {
    console.error("❌ 缺少必填字段 title 或 content");
    process.exit(1);
  }

  slugDupCheck(article.slug, resolveSlug(article.title, article.slug));
  renderCheck(article);

  const finalSlug = resolveSlug(article.title, article.slug);
  const tagsJson = JSON.stringify(article.tags ?? []);

  if (checkOnly) {
    console.log(`✅ 自检通过（--check-only，未写库）：slug=${finalSlug}`);
    return;
  }

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
  const checkOnly = args.includes("--check-only");

  if (doDelete && slugArg) {
    deleteArticle(slugArg);
    return;
  }

  if (fileArg) {
    insertArticle(fileArg, checkOnly);
    return;
  }

  console.log("用法：");
  console.log("  插入: tsx scripts/post-article.ts --file=<article.json>");
  console.log("  自检（不写库）: tsx scripts/post-article.ts --file=<article.json> --check-only");
  console.log("  删除: tsx scripts/post-article.ts --delete --slug=<slug>");
}

main();
