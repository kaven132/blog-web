#!/usr/bin/env node
/**
 * 书籍线 / AI 工具线共用的前置数据一键输出：
 * 同日查重 + 去重台账规模 + 本线最近 3 篇回读 + 本线执行记忆末尾，一次跑完。
 *
 * 用法（仓库根目录）：
 *   export NODE_OPTIONS= && E:/devtools/nodejs/node.exe scripts/line-preflight.mjs --key=books    # 书籍线
 *   export NODE_OPTIONS= && E:/devtools/nodejs/node.exe scripts/line-preflight.mjs --key=plugins  # AI 工具线
 * 可选 --memory-tail=<字符数>（默认 1800）
 *
 * 输出：单行 JSON。字段：
 *   todaySlugExists / todaySlug —— 同日重复调度判定（true → 直接跳过本次任务）
 *   ledger                      —— _posted.json 里本线去重键（数组长度 + 全部元素）
 *   recent                      —— 本线最近 3 篇 {title, slug}
 *   memoryTail                  —— 本线执行记忆末尾（历史教训，不要重踩）
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const ROOT = process.cwd();
const POSTED = path.join(ROOT, "scripts", "_posted.json");
const DB = path.join(ROOT, "data", "blog.db");

const LINES = {
  books: {
    slugPrefix: "book-rec",
    memoryId: "5cff0944-fe62-40bd-806c-8876375b3ee0",
  },
  plugins: {
    slugPrefix: "deepseek",
    memoryId: "a21c40ac-7e30-4084-be78-2704f63ab1fb",
  },
};

const args = process.argv.slice(2);
const key = args.find((a) => a.startsWith("--key="))?.split("=")[1];
const memoryTailLen = Number(args.find((a) => a.startsWith("--memory-tail="))?.split("=")[1]) || 1800;

const line = LINES[key];
if (!line) {
  console.error("--key 必须是 books 或 plugins");
  process.exit(2);
}

const now = new Date(Date.now() + 8 * 3600 * 1000);
const today = now.toISOString().slice(0, 10);

let ledger = [];
try {
  const posted = JSON.parse(readFileSync(POSTED, "utf8"));
  ledger = Array.isArray(posted[key]) ? posted[key] : [];
} catch {
  /* _posted.json 缺失时台账视为空 */
}

const db = new Database(DB, { readonly: true });
const todaySlug = db
  .prepare(
    "select slug from posts where datetime(created_at,'+8 hours') like ? and slug like ? limit 1",
  )
  .get(`${today}%`, `${line.slugPrefix}-%`);
const recentRows = db
  .prepare("select title, slug from posts where slug like ? order by id desc limit 3")
  .all(`${line.slugPrefix}-%`);
db.close();

let memoryTail = "";
try {
  const buf = readFileSync(
    path.join(ROOT, ".workbuddy", "memory", "automations", line.memoryId, "memory.md"),
    "utf8",
  );
  memoryTail = buf.slice(-memoryTailLen);
} catch {
  memoryTail = "(执行记忆文件不存在)";
}

const out = {
  line: key,
  today,
  todaySlugExists: Boolean(todaySlug),
  todaySlug: todaySlug?.slug ?? null,
  ledgerCount: ledger.length,
  ledger,
  recent: recentRows,
  memoryTail,
};
console.log(JSON.stringify(out));
