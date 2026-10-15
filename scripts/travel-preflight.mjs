#!/usr/bin/env node
/**
 * 旅游线（automation 3b3c6b54）前置数据一键输出：
 * 同日查重 + 四类计数 + 最近 5 篇回读 + 类别建议 + 本线执行记忆末尾，一次跑完，
 * 替代过去 3-4 次分散的 DB 查询与人工计数（省 token，也消灭 UTC+8 手工换算错误）。
 *
 * 用法（仓库根目录）：
 *   export NODE_OPTIONS= && E:/devtools/nodejs/node.exe scripts/travel-preflight.mjs
 * 可选 --memory-tail=<字符数>（默认 1800）
 *
 * 输出：单行 JSON。字段：
 *   todaySlugExists / todaySlug —— 同日重复调度判定（true → 直接跳过本次任务）
 *   typeCounts                 —— 四类计数（由 types 台账实时计算，不再落快照）
 *   recent                     —— 最近 5 篇 {title, slug, type}
 *   suggestedType / note       —— 按 prompt 规则算出的本篇建议类别（四类之一）
 *   memoryTail                 —— 本线执行记忆末尾（历史教训，不要重踩）
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const ROOT = process.cwd();
const STATE = path.join(ROOT, "scripts", "_travel-state.json");
const DB = path.join(ROOT, "data", "blog.db");
const MEMORY = path.join(
  ROOT,
  ".workbuddy",
  "memory",
  "automations",
  "3b3c6b54-5a95-4e0a-aabd-943e10443a4a",
  "memory.md",
);

const CLASSES = ["国际经典", "国际小众", "国内热门", "国内小众"];
const PRIORITY = ["国际小众", "国内小众", "国际经典", "国内热门"];
const big = (c) => (c.startsWith("国际") ? "国际" : "国内");

const args = process.argv.slice(2);
const memoryTailLen = Number(args.find((a) => a.startsWith("--memory-tail="))?.split("=")[1]) || 1800;

const state = JSON.parse(readFileSync(STATE, "utf8"));
const types = state.types || {};

// 今天（北京时间）
const now = new Date(Date.now() + 8 * 3600 * 1000);
const today = now.toISOString().slice(0, 10);

const db = new Database(DB, { readonly: true });
const todaySlug = db
  .prepare(
    "select slug from posts where datetime(created_at,'+8 hours') like ? and slug like 'travel-%' limit 1",
  )
  .get(`${today}%`);
const recentRows = db
  .prepare("select title, slug from posts where slug like 'travel-%' order by id desc limit 5")
  .all();
db.close();

const typeCounts = {};
for (const c of CLASSES) typeCounts[c] = 0;
for (const t of Object.values(types)) if (typeCounts[t] !== undefined) typeCounts[t] += 1;

const recent = recentRows.map((r) => ({
  title: r.title,
  slug: r.slug,
  type: types[r.title.split("：")[0].trim()] ?? null,
}));

// 类别决策（与 prompt 规则一致）：候选=计数最少类 → 剔除与上一篇同类 → 剔除造成连续两篇同大类 → 优先级取
const mins = Math.min(...Object.values(typeCounts));
let candidates = CLASSES.filter((c) => typeCounts[c] === mins);
const notes = [`候选（计数最少 ${mins}）：${candidates.join("/")}`];
const lastType = recent[0]?.type ?? null;
if (lastType && candidates.includes(lastType) && candidates.length > 1) {
  candidates = candidates.filter((c) => c !== lastType);
  notes.push(`剔除与上一篇同类（${lastType}）`);
}
const c1 = recent[0]?.type ? big(recent[0].type) : null;
const c2 = recent[1]?.type ? big(recent[1].type) : null;
if (c1 && c1 === c2) {
  const filtered = candidates.filter((c) => big(c) !== c1);
  if (filtered.length) {
    candidates = filtered;
    notes.push(`剔除造成连续两篇同${c1}`);
  }
}
let suggestedType;
if (candidates.length) {
  suggestedType = PRIORITY.find((c) => candidates.includes(c));
} else {
  suggestedType = PRIORITY.find((c) => CLASSES.filter((c2) => typeCounts[c2] === mins).includes(c)) ?? PRIORITY[0];
  notes.push("全部被剔除，退回计数最少类");
}

let memoryTail = "";
try {
  const buf = readFileSync(MEMORY, "utf8");
  memoryTail = buf.slice(-memoryTailLen);
} catch {
  memoryTail = "(执行记忆文件不存在)";
}

const out = {
  today,
  todaySlugExists: Boolean(todaySlug),
  todaySlug: todaySlug?.slug ?? null,
  typeCounts,
  recent,
  suggestedType,
  note: notes.join("；"),
  memoryTail,
};
console.log(JSON.stringify(out));
