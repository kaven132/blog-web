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

import { mkdirSync, readdirSync, statSync, unlinkSync, existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
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

// ── 图片存储养护（与备份同频）：兜底转 WebP + 清运行时转档缓存 ──
// 1) 幂等兜底：把漏网的新 JPEG 转成 WebP（脚本自带"已转跳过/不变小跳过"，重复跑无副作用）
try {
  console.log("── 图片兜底转换 ──");
  const { spawnSync } = await import("node:child_process");
  spawnSync(process.execPath, ["scripts/_webp-convert.mjs"], { stdio: "inherit" });
} catch (err) {
  console.error("⚠️ 兜底转换失败（不影响备份）:", err.message);
}
// 2) 清运行时转档缓存（/uploads 按 Accept 协商产生的 .webp 副本；存量已预转，多数缓存冗余）
try {
  const cacheDir = resolve("./data/img-cache");
  if (existsSync(cacheDir)) {
    rmSync(cacheDir, { recursive: true, force: true });
    console.log("🧹 已清理图片转档缓存 data/img-cache（下次访问按需重建）");
  }
} catch (err) {
  console.error("⚠️ 缓存清理失败（不影响备份）:", err.message);
}
