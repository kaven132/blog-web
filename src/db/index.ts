import { mkdirSync } from "node:fs";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

// Auto-create data directory if missing
mkdirSync("./data", { recursive: true });

const sqlite = new Database("./data/blog.db");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
// 凭证表随进程启动兜底建表（官方迁移路径仍是 drizzle-kit push，这里保证旧库直接可用）
sqlite.exec(`CREATE TABLE IF NOT EXISTS credentials (
  id INTEGER PRIMARY KEY,
  password_hash TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
)`);

// 后加列的兜底迁移（列已存在时 ALTER 会抛错，吞掉即可）
try {
  sqlite.exec("ALTER TABLE posts ADD COLUMN views INTEGER NOT NULL DEFAULT 0");
} catch { /* 列已存在 */ }
try {
  sqlite.exec("ALTER TABLE comments ADD COLUMN parent_id INTEGER");
} catch { /* 列已存在 */ }

// 游戏云端存档（每用户每游戏一条）
sqlite.exec(`CREATE TABLE IF NOT EXISTS game_saves (
  user_id INTEGER NOT NULL,
  game TEXT NOT NULL,
  data TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (user_id, game)
)`);

// 相册（分类型相册 + 照片，照片随相册级联删除）
sqlite.exec(`CREATE TABLE IF NOT EXISTS galleries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  description TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
)`);
sqlite.exec(`CREATE TABLE IF NOT EXISTS gallery_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gallery_id INTEGER NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0
)`);
// 分类格式迁移：旧版单 id（travel/daily/other）→ 两级 JSON 数组（如 '["旅行"]'，幂等：仅迁移非 JSON 行）
try {
  const legacyMap = { travel: "旅行", daily: "日常", other: "其他" };
  const legacyRows = sqlite.prepare("SELECT id, category FROM galleries WHERE category NOT LIKE '[%'").all();
  for (const row of legacyRows) {
    const label = legacyMap[row.category] ?? "其他";
    sqlite.prepare("UPDATE galleries SET category = ? WHERE id = ?").run(JSON.stringify([label]), row.id);
  }
} catch (err) {
  console.error("[db] 相册分类迁移失败:", err instanceof Error ? err.message : err);
}
// 相册浏览量列（后加列兜底迁移）
try {
  sqlite.exec("ALTER TABLE galleries ADD COLUMN views INTEGER NOT NULL DEFAULT 0");
} catch { /* 列已存在 */ }
try {
  sqlite.exec("ALTER TABLE galleries ADD COLUMN is_private INTEGER NOT NULL DEFAULT 0");
} catch { /* 列已存在 */ }
// 相册点赞与评论（与文章同构）
sqlite.exec(`CREATE TABLE IF NOT EXISTS gallery_likes (
  gallery_id INTEGER PRIMARY KEY REFERENCES galleries(id) ON DELETE CASCADE,
  count INTEGER NOT NULL DEFAULT 0
)`);
sqlite.exec(`CREATE TABLE IF NOT EXISTS gallery_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gallery_id INTEGER NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
  parent_id INTEGER,
  author TEXT NOT NULL DEFAULT '匿名',
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
)`);

// 视频（上传播放）：文件在 data/videos/，url 指向 /media/<文件名>；点赞评论与相册同构
sqlite.exec(`CREATE TABLE IF NOT EXISTS videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  poster TEXT NOT NULL DEFAULT '',
  is_private INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
)`);
sqlite.exec(`CREATE TABLE IF NOT EXISTS video_likes (
  video_id INTEGER PRIMARY KEY REFERENCES videos(id) ON DELETE CASCADE,
  count INTEGER NOT NULL DEFAULT 0
)`);
sqlite.exec(`CREATE TABLE IF NOT EXISTS video_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  parent_id INTEGER,
  author TEXT NOT NULL DEFAULT '匿名',
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
)`);

// 浏览历史（随账号走）：(user_id, kind, ref_id) 唯一，重复浏览 upsert 置顶
sqlite.exec(`CREATE TABLE IF NOT EXISTS browse_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  ref_id TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  viewed_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
)`);
sqlite.exec(`CREATE UNIQUE INDEX IF NOT EXISTS browse_history_unique ON browse_history(user_id, kind, ref_id)`);
// 容量护栏：每用户最多保留最近 50 条。DROP + 重建使限额调整随重启生效（IF NOT EXISTS 不会更新已存在的触发器）
sqlite.exec("DROP TRIGGER IF EXISTS browse_history_cap");
sqlite.exec(`CREATE TRIGGER browse_history_cap AFTER INSERT ON browse_history BEGIN
  DELETE FROM browse_history WHERE user_id = new.user_id AND id NOT IN (
    SELECT id FROM browse_history WHERE user_id = new.user_id ORDER BY viewed_at DESC, id DESC LIMIT 50
  );
END`);

// ── 全文搜索（FTS5 trigram）：外部内容表 + 触发器同步，正文可搜、中文子串命中 ──
// trigram 按 3 字滑窗切词：中文 ≥3 字的查询走 MATCH（快、带相关性与高亮片段），
// <3 字由查询层回落 LIKE。触发器保证自动化脚本直写库时索引也不漏。
try {
  sqlite.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts USING fts5(
    title, excerpt, content,
    content='posts', content_rowid='id',
    tokenize='trigram'
  )`);
  sqlite.exec(`CREATE TRIGGER IF NOT EXISTS posts_fts_insert AFTER INSERT ON posts BEGIN
    INSERT INTO posts_fts(rowid, title, excerpt, content) VALUES (new.id, new.title, new.excerpt, new.content);
  END`);
  // UPDATE OF 限定列：views 自增这类与文本无关的更新不触发重建索引
  sqlite.exec(`CREATE TRIGGER IF NOT EXISTS posts_fts_update AFTER UPDATE OF title, excerpt, content ON posts BEGIN
    INSERT INTO posts_fts(posts_fts, rowid, title, excerpt, content) VALUES ('delete', old.id, old.title, old.excerpt, old.content);
    INSERT INTO posts_fts(rowid, title, excerpt, content) VALUES (new.id, new.title, new.excerpt, new.content);
  END`);
  sqlite.exec(`CREATE TRIGGER IF NOT EXISTS posts_fts_delete AFTER DELETE ON posts BEGIN
    INSERT INTO posts_fts(posts_fts, rowid, title, excerpt, content) VALUES ('delete', old.id, old.title, old.excerpt, old.content);
  END`);
  // 启动时全量重建索引：存量文章与外部直写的数据一次对齐（百篇级耗时可忽略）
  sqlite.exec("INSERT INTO posts_fts(posts_fts) VALUES('rebuild')");
} catch (err) {
  console.error("[db] FTS5 初始化失败，全文搜索将不可用:", err instanceof Error ? err.message : err);
}

export { sqlite };
export const db = drizzle(sqlite);
