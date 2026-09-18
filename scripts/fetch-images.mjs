#!/usr/bin/env node
/**
 * 配图下载器 —— 三条自动化线（旅游 / 书籍+开源项目 / 每月游戏）共用
 *
 * 它解决的四个真实问题（全部来自 2026-09 的执行记录）：
 *  1. loremflickr 对「无匹配结果」的关键词会返回**同一张固定兜底图**（当前实测 248658 字节，
 *     md5 2be570b7…），字节数也一样，光看 `ls -l` 分辨不出来 —— 用 md5 + 字节数双重否决；
 *  2. 同一关键词换 lock 会在真图/兜底图之间跳，所以每个关键词要试多个 lock；
 *  3. 不同关键词、不同图之间会撞同一张图（封面与 fig2 撞过）—— 本次运行内按 md5 去重；
 *  4. 命中兜底图时单次请求要 ~19 秒，串行试探会把整条流水线拖超时 —— 改成**并发 + 总预算**，
 *     预算用尽立刻落 picsum，不让配图环节卡住发布。
 *
 * 用法（一行同时搞定封面 + 两张正文插图）：
 *   node scripts/fetch-images.mjs --slug=travel-luoyang-20260911 --date=20260911 \
 *     --cover="luoyang,oldtown|longmen|chinese,pagoda|temple" \
 *     --fig1="city,street|asia,city" \
 *     --fig2="noodles,soup|street,food"
 *
 * 参数：
 *   --slug=<slug>        必填，用于兜底图 seed
 *   --date=<YYYYMMDD>    lock 前缀，默认取本地日期
 *   --cover="k1|k2|k3"   封面候选关键词（越靠前越优先），不传则不处理封面
 *   --fig1 / --fig2 / --fig3 / --fig4   正文插图候选关键词
 *   --cover-out=<path>   封面落盘位置，默认 data/uploads/_cover-tmp-<slug>.jpg
 *   --fig-dir=<dir>      插图落盘目录，默认 data/uploads（文件名 <slug>-figN.jpg）
 *   --manifest=<path>    把命中的完整 URL 写进该文件，便于复现
 *   --min-bytes=<n>      最小字节数，默认 20480
 *   --timeout=<ms>       单次请求超时，默认 15000（兜底图要 ~19s，会被超时掐掉，正好快速失败）
 *   --budget=<ms>        loremflickr 阶段总预算，默认 60000，用尽直接落 picsum
 *   --concurrency=<n>    并发数，默认 6
 *   --locks=<n>          每个关键词试几个 lock，默认 3
 *   --engine=<fetch|curl> 默认 fetch（不依赖 PATH），curl 作为备选
 *   --reject-md5=<p1,p2> 额外否决这些 md5 前缀的图（当次运行有效，用于排掉上一轮用过的真图）
 *
 * 退出码：封面失败 → 1；只有插图失败 → 0（缺图不阻塞发布）。
 */

import { mkdirSync, writeFileSync, existsSync, statSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { basename, dirname, join, resolve } from "node:path";

/* ---------------- 参数 ---------------- */

const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith("--")) continue;
  const eq = a.indexOf("=");
  if (eq > -1) args[a.slice(2, eq)] = a.slice(eq + 1);
  else if (argv[i + 1] && !argv[i + 1].startsWith("--")) args[a.slice(2)] = argv[++i];
  else args[a.slice(2)] = true;
}

const slug = args.slug;
if (!slug) {
  console.error("❌ 缺少 --slug");
  process.exit(2);
}

const now = new Date();
const pad = (n) => String(n).padStart(2, "0");
const dateArg = args.date || `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
const minBytes = Number(args["min-bytes"] || 20480);
const timeoutMs = Number(args.timeout || 15000);
const budgetMs = Number(args.budget || 60000);
const concurrency = Number(args.concurrency || 6);
const lockCount = Number(args.locks || 3);
const engine = String(args.engine || "fetch");
const coverOut = resolve(args["cover-out"] || `data/uploads/_cover-tmp-${slug}.jpg`);
const figDir = resolve(args["fig-dir"] || "data/uploads");
const manifestPath = args.manifest ? resolve(args.manifest) : null;
const quiet = Boolean(args.quiet);

/** 已实测的 loremflickr 无结果兜底图指纹（2026-09-09 / 09-10 / 09-11 / 09-14 四次复现）
 *  2026-09-14 新增第三组：248734B / md5 3fa2bac5…（一张伊斯坦布尔街边的猫雕塑，与本线主题完全无关）。
 *  若不加进这张表，它会在「候选列表第一条」被直接接受，因为跨关键词重复判定要等第二个关键词命中才触发。
 *  2026-09-16 新增第四组：79863B / md5 f987912f…，**不是正常照片**，而是 loremflickr 的故障占位帧：
 *  整张图是纯红底，中间嵌一张很小的黑白老照片，角落印着 "travelling (sorry glitch, so reloading)"。
 *  图片能正常解码、字节数也不小，所以只能靠 md5 比对拦下来（实测命中 `asia,village`）。
 *  2026-09-17 新增第五组：45092B / md5 88b3637c…，是同一个故障占位帧的**另一个尺寸变体**（同样是
 *  纯红底 + 中间嵌一张小黑白照片，角落印 CC 与作者名）。实测命中 `keyboard,code@20260917keyboardcode`，
 *  说明这个占位帧每次返回的字节数/md5 都可能不同，指纹表只能一只一只补。
 *  2026-09-17 再补第六组：48635B / md5 099cb6b1…，仍是同一个故障占位帧的尺寸变体（纯红底 +
 *  中间嵌一张小照片 + 角落印 "thanks for ... views"），实测命中 `bazaar@zbazaar`。
 *  **截至 2026-09-17 该占位帧已累计发现 3 个变体，且本组字节数最小（48KB）仍在 20KB 门槛之上，
 *  只能靠 md5 拦下；每次肉眼看到纯红底大留白就要立刻把新 md5 补进这张表。**
 *  2026-09-18 再补第七组：50499B / md5 f321533b…（纯红底 + 中间嵌一张雪地教堂小照片，
 *  命中 `orthodox,church`），以及同期数次出现的 248472B 兜底尺寸。同一天里
 *  `writing,paper` 又返回了纯红底占位帧的**另一个尺寸** 43945B —— 同一形态在同一轮里
 *  换了两个尺寸、两个 md5，再次说明这张表只能靠肉眼抓一只补一只。 */
const KNOWN_FALLBACK_MD5 = ["2be570b7", "2cdbe2d7", "3fa2bac5", "f987912f", "88b3637c", "099cb6b1", "f321533b"];
const KNOWN_FALLBACK_SIZE = [248658, 248685, 248734, 79863, 45092, 48635, 248472, 50499, 43945];

/** --reject-md5=<前缀1,前缀2> 额外否决（当次运行有效）
 *  用途：loremflickr 整站退化时，某些标签组合会返回**上一轮已经用过的真图**（不是兜底图，
 *  所以在上面的表里抓不到）。2026-09-15 实测 `desk,laptop` / `workspace,laptop` 反复返回
 *  51873B / md5 1b6c07ef（前一天 deepseek-20260914.jpg 用的那张），需要临时排掉换标签。 */
const extraRejectMd5 = String(args["reject-md5"] || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/* ---------------- 下载 ---------------- */

const t0 = Date.now();
const elapsed = () => ((Date.now() - t0) / 1000).toFixed(1) + "s";

async function get(url) {
  const t = Date.now();
  if (engine === "curl") {
    const tmp = join(dirname(coverOut), `.curl-tmp-${process.pid}.jpg`);
    mkdirSync(dirname(tmp), { recursive: true });
    const r = spawnSync("curl", ["-sL", "--max-time", String(Math.ceil(timeoutMs / 1000)), "-o", tmp, url], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    if (r.error || r.status !== 0 || !existsSync(tmp) || !statSync(tmp).size) return { ok: false, ms: Date.now() - t };
    const buf = readFileSync(tmp);
    return { ok: buf.length > 0, buf, ms: Date.now() - t };
  }
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return { ok: false, ms: Date.now() - t, note: `HTTP ${res.status}` };
    const buf = Buffer.from(await res.arrayBuffer());
    return { ok: buf.length > 0, buf, ms: Date.now() - t };
  } catch (e) {
    return { ok: false, ms: Date.now() - t, note: e.name === "TimeoutError" ? `超时 >${timeoutMs}ms` : e.message };
  }
}

/* ---------------- 候选构造 ---------------- */

const sanitize = (kw) => String(kw).trim().replace(/\s+/g, "");

function locksFor(kw, n) {
  const key = sanitize(kw).replace(/[^a-z0-9]/gi, "");
  const all = [`${dateArg}${key}`, `z${key}`, `y${key}`, `${dateArg}`, `x${key}`, `w${key}`];
  return all.slice(0, n);
}

const specs = [];
if (args.cover) specs.push({ label: "cover", out: coverOut, required: true, keywords: String(args.cover).split("|") });
for (let n = 1; n <= 4; n++) {
  if (!args[`fig${n}`]) continue;
  specs.push({
    label: `fig${n}`,
    out: join(figDir, `${slug}-fig${n}.jpg`),
    required: false,
    keywords: String(args[`fig${n}`]).split("|"),
  });
}
if (!specs.length) {
  console.error("❌ 至少要给 --cover / --fig1 中的一个候选关键词列表");
  process.exit(2);
}

/* ---------------- 状态 ---------------- */

const usedMd5 = new Map(); // md5 -> label
const dynamicFallback = new Set();
const md5FirstSeenKw = new Map();
const rejected = [];
const log = (...a) => !quiet && console.log(...a);

function judge(buf, kw, label) {
  const md5 = createHash("md5").update(buf).digest("hex");
  const size = buf.length;
  if (size < minBytes) return { md5, size, why: `字节数 ${size} < ${minBytes}` };
  if (KNOWN_FALLBACK_MD5.some((p) => md5.startsWith(p))) return { md5, size, why: "已知兜底图" };
  if (extraRejectMd5.some((p) => md5.startsWith(p))) return { md5, size, why: "命中 --reject-md5" };
  if (KNOWN_FALLBACK_SIZE.includes(size)) return { md5, size, why: "字节数与兜底图一致" };
  const prev = md5FirstSeenKw.get(md5);
  if (prev === undefined) md5FirstSeenKw.set(md5, kw);
  else if (prev !== kw) {
    dynamicFallback.add(md5);
    return { md5, size, why: "同一张图出现在不同关键词上（兜底图特征）" };
  }
  if (dynamicFallback.has(md5)) return { md5, size, why: "本次运行中已判定为兜底图" };
  if (usedMd5.has(md5)) return { md5, size, why: `与 ${usedMd5.get(md5)} 撞图` };
  return { md5, size, why: null };
}

/* ---------------- 任务队列 ---------------- */

const tasks = [];
for (const s of specs) {
  for (const kwRaw of s.keywords) {
    const kw = sanitize(kwRaw);
    if (!kw) continue;
    for (const lock of locksFor(kw, lockCount)) {
      tasks.push({ spec: s, kw, lock, url: `https://loremflickr.com/1200/800/${kw}?lock=${lock}` });
    }
  }
}

let cursor = 0;
let attempts = 0;

async function worker() {
  while (true) {
    if (Date.now() - t0 > budgetMs) return;
    if (specs.every((s) => s.done)) return;
    const i = cursor++;
    if (i >= tasks.length) return;
    const task = tasks[i];
    if (task.spec.done) continue;
    attempts++;
    const r = await get(task.url);
    if (!r.ok) {
      log(`  [${elapsed()}] ${task.spec.label.padEnd(5)} ${task.kw}@${task.lock} ✗ ${r.note || "空响应"} (${r.ms}ms)`);
      continue;
    }
    const j = judge(r.buf, task.kw, task.spec.label);
    if (j.why) {
      rejected.push({ label: task.spec.label, kw: task.kw, lock: task.lock, size: j.size, md5: j.md5, why: j.why });
      log(`  [${elapsed()}] ${task.spec.label.padEnd(5)} ${task.kw}@${task.lock} ✗ ${j.why} (${j.size}B, ${r.ms}ms)`);
      continue;
    }
    if (task.spec.done) continue; // 同一张图已被别的尝试抢先用掉
    usedMd5.set(j.md5, task.spec.label);
    task.spec.done = true;
    task.spec.hit = { kw: task.kw, lock: task.lock, url: task.url, size: j.size, md5: j.md5, fallback: false };
    mkdirSync(dirname(task.spec.out), { recursive: true });
    writeFileSync(task.spec.out, r.buf);
    log(`  [${elapsed()}] ${task.spec.label.padEnd(5)} ${task.kw}@${task.lock} ✓ ${j.size}B md5=${j.md5.slice(0, 8)} (${r.ms}ms)`);
  }
}

log(`候选 ${tasks.length} 条，并发 ${concurrency}，预算 ${budgetMs / 1000}s，引擎 ${engine}`);
await Promise.all(Array.from({ length: concurrency }, () => worker()));

/* ---------------- picsum 兜底 ---------------- */

const unfilled = specs.filter((s) => !s.done);
if (unfilled.length) {
  log(`--- ${unfilled.length} 张未命中真图，转 picsum 兜底 ---`);
  const pics = [];
  for (const s of unfilled) {
    for (let n = 1; n <= 3; n++) {
      const seed = `${slug}-${s.label}${n > 1 ? "-" + n : ""}`;
      pics.push({ spec: s, url: `https://picsum.photos/seed/${seed}/1200/800` });
    }
  }
  const limit = 6;
  let idx = 0;
  async function pw() {
    while (true) {
      if (specs.every((s) => s.done)) return;
      const i = idx++;
      if (i >= pics.length) return;
      const t = pics[i];
      if (t.spec.done) continue;
      attempts++;
      const r = await get(t.url);
      if (!r.ok) continue;
      const j = judge(r.buf, `picsum:${t.spec.label}`, t.spec.label);
      if (j.why) continue;
      if (t.spec.done) continue;
      usedMd5.set(j.md5, t.spec.label);
      t.spec.done = true;
      t.spec.hit = { kw: "picsum兜底", lock: "-", url: t.url, size: j.size, md5: j.md5, fallback: true };
      mkdirSync(dirname(t.spec.out), { recursive: true });
      writeFileSync(t.spec.out, r.buf);
      log(`  ${t.spec.label.padEnd(5)} picsum ✓ ${j.size}B md5=${j.md5.slice(0, 8)} (${r.ms}ms)`);
    }
  }
  await Promise.all(Array.from({ length: limit }, () => pw()));
}

/* ---------------- 报告 ---------------- */

const pad2 = (s, n) => String(s).padEnd(n).slice(0, n);
console.log("");
console.log("=== 配图结果 ===");
for (const s of specs) {
  if (!s.hit) {
    console.log(`❌ ${pad2(s.label, 6)} 全部候选失败 → ${basename(s.out)} 未生成`);
    continue;
  }
  const h = s.hit;
  console.log(
    `${h.fallback ? "🟡" : "✅"} ${pad2(s.label, 6)} ${pad2(h.kw, 20)} ${pad2(h.lock, 18)} ${pad2(h.size, 8)}B md5=${h.md5.slice(0, 8)}`,
  );
  if (h.fallback) console.log(`   ↳ 走了 picsum 兜底：${h.url}`);
}
console.log(`共请求 ${attempts} 次，耗时 ${elapsed()}。`);
if (!quiet && rejected.length) {
  const fl = rejected.filter((r) => r.why.includes("兜底"));
  console.log(`被否决 ${rejected.length} 条，其中判定为兜底图 ${fl.length} 条。`);
  for (const r of rejected.slice(0, 6)) {
    console.log(`  ${pad2(r.label, 6)}${pad2(r.kw, 20)}${pad2(r.size, 8)} ${r.why}`);
  }
}
const fallbackHits = specs.filter((s) => s.hit?.fallback).length;
if (fallbackHits >= 2) {
  console.log("⚠️ 多张图落到了 picsum：loremflickr 当前很可能整站返回兜底图，下次执行可先跑一次探测再决定关键词。");
}
if (manifestPath) {
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(
    manifestPath,
    specs
      .filter((s) => s.hit)
      .map((s) => `${s.label}\t${s.hit.url}\t${s.hit.size}\t${s.hit.md5}`)
      .join("\n") + "\n",
  );
  console.log(`manifest: ${manifestPath}`);
}

const coverSpec = specs.find((s) => s.label === "cover");
process.exit(coverSpec && !coverSpec.done ? 1 : 0);
