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

export const db = drizzle(sqlite);
