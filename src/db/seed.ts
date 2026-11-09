import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import { posts, comments, likes, profile } from "./schema";

const sqlite = new Database("./data/blog.db");
sqlite.pragma("journal_mode = WAL");
const db = drizzle(sqlite);

// 是否显式要求「清空重建」。db:seed 不带该标志（只做空库初始化），
// db:reset 会带 --force 才会走到删除分支。
const FORCE_RESET = process.argv.includes("--force") || process.env.SEED_FORCE === "1";

// Create tables
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    excerpt TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL,
    cover_image TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    published INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    author TEXT NOT NULL DEFAULT '匿名',
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL UNIQUE REFERENCES posts(id) ON DELETE CASCADE,
    count INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS profile (
    id INTEGER PRIMARY KEY DEFAULT 1,
    name TEXT NOT NULL DEFAULT 'kaven',
    bio TEXT NOT NULL DEFAULT '',
    city TEXT DEFAULT '',
    gender TEXT DEFAULT '',
    avatar TEXT DEFAULT '',
    github TEXT DEFAULT '',
    website TEXT DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ────────────────────────────────────────────────────────────────
// 破坏性操作闸门
// db:seed   = 仅当表为空时写入示例数据，绝不删除/覆盖已有内容
// db:reset  = 本脚本带 --force，会清空 posts/comments/likes/profile
// ────────────────────────────────────────────────────────────────
const existingPosts = (
  sqlite.prepare("SELECT COUNT(*) AS n FROM posts").get() as { n: number }
).n;

if (existingPosts > 0 && !FORCE_RESET) {
  console.log(`ℹ️  数据库已有 ${existingPosts} 篇文章，本次未改动任何数据。`);
  console.log("    db:seed 只做「空库初始化」，不会删除或覆盖现有内容。");
  console.log("    确实要清空全站并重建示例数据：npm run db:reset");
  process.exit(0);
}

if (existingPosts > 0) {
  // 清空之前先落一份可回滚的物理备份（WAL 先 checkpoint，避免漏数据）
  const backupDir = "./data/backups";
  mkdirSync(backupDir, { recursive: true });
  sqlite.pragma("wal_checkpoint(TRUNCATE)");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `${backupDir}/blog-${stamp}.db`;
  copyFileSync("./data/blog.db", backupPath);
  console.log(`📦 已备份当前数据库到 ${backupPath}`);

  console.log(`🧨 reset 模式：清空 ${existingPosts} 篇文章及评论/点赞/个人信息 …`);
  db.delete(comments).run();
  db.delete(likes).run();
  db.delete(posts).run();
  db.delete(profile).run();
}

// 示例数据外置在 data/seed/（gitignored，只留本地不进仓库）；缺失时只建表/清库，不灌数据
const SEED_DIR = "./data/seed";
if (!existsSync(`${SEED_DIR}/seed-posts.json`)) {
  console.log("ℹ️  未找到 data/seed/seed-posts.json，跳过示例数据灌入（库为空表）。");
  console.log("🚀 运行 `npm run dev` 启动博客");
  process.exit(0);
}

const seedPosts = JSON.parse(readFileSync(`${SEED_DIR}/seed-posts.json`, "utf8")) as Array<{
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string | null;
  tags: string;
  published: boolean;
}>;
const inserted = db.insert(posts).values(seedPosts).returning().all();

const commentsFile = `${SEED_DIR}/seed-comments.json`;
if (existsSync(commentsFile)) {
  const seedComments = JSON.parse(readFileSync(commentsFile, "utf8")) as Array<{
    slug: string;
    author: string;
    content: string;
  }>;
  const idBySlug = new Map(inserted.map((p) => [p.slug, p.id]));
  db.insert(comments)
    .values(
      seedComments.map(({ slug, author, content }) => ({
        postId: idBySlug.get(slug)!,
        author,
        content,
      })),
    )
    .run();
  console.log(`✅ 已插入 ${seedComments.length} 条示例评论`);
}

// Seed likes
inserted.forEach((post) => {
  db.insert(likes).values({ postId: post.id, count: Math.floor(Math.random() * 50) }).run();
});

// 个人信息：只在完全没有记录时写入默认值，不覆盖用户已填内容（不碰头像）
const existingProfile = db.select().from(profile).where(eq(profile.id, 1)).get();
if (!existingProfile) {
  db.insert(profile)
    .values({ id: 1, name: "kaven", bio: "用代码构建更好的互联网", city: "上海", gender: "male" })
    .run();
}

console.log(`✅ 已插入 ${inserted.length} 篇文章`);
console.log("✅ 已初始化点赞数据");
console.log("✅ 已初始化个人信息");
console.log("🚀 运行 `npm run dev` 启动博客");
