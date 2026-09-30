#!/usr/bin/env node
/**
 * SQLite 在线备份 —— data/blog.db 是全站唯一数据源且不进 git，磁盘故障就全没了。
 * 用 better-sqlite3 的 .backup() API：WAL 模式下可安全在线备份，博客服务运行中也能执行。
 *
 * 用法：
 *   npm run db:backup                # 备份到 data/backups/blog-auto-<时间戳>.db
 *   node scripts/backup-db.mjs --keep=10   # 只保留最近 10 份自动备份（默认 30）
 *
 * 建议挂到自动发文流水线末尾，或系统定时任务每天跑一次。
 */

import { mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";

const keepArg = process.argv.find((a) => a.startsWith("--keep="));
const KEEP = Math.max(1, Number(keepArg?.split("=")[1] ?? 30));

const SRC = "./data/blog.db";
const DIR = "./data/backups";

mkdirSync(DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dest = join(DIR, `blog-auto-${stamp}.db`);

const sqlite = new Database(SRC);
await sqlite.backup(dest);
sqlite.close();

// 只清理自己产出的 blog-auto-*.db，不碰 db:reset 的手动备份
const autos = readdirSync(DIR)
  .filter((f) => /^blog-auto-\d+.*\.db$/.test(f))
  .sort();
while (autos.length > KEEP) {
  const old = autos.shift();
  unlinkSync(join(DIR, old));
  console.log(`🧹 清理旧备份：${old}`);
}

console.log(`✅ 已备份：${dest}（${(statSync(dest).size / 1024).toFixed(1)} KB）`);
