#!/usr/bin/env node
/**
 * 文章打包 + 体检 —— 三条自动化线（旅游 / 书籍+开源项目 / 每月游戏）共用
 *
 * 做四件事：
 *  1. 把 `--dir` 下的正文分片（`_p1.md`、`_p2.md` … 自然序）合并成一篇；
 *     单次 Write 长中文正文会被截断（2026-09-11 连续两次断在同一句），所以要分片写。
 *  2. 把 `{{FIG1}}` / `{{FIG2}}` 占位符替换成 `/uploads/<slug>-figN.jpg`。
 *  3. 生成 `article.json`（`JSON.stringify`，不手工拼 JSON）。
 *  4. 打印体检项：汉字数、分节数、插图数、excerpt 长度、裸 `|` 泄漏、禁用词、
 *     占位符残留、ASCII 引号、em-dash、段落缩进、逐节汉字数。
 *
 * 用法：
 *   node scripts/build-article.mjs --dir=scripts/_travel --slug=travel-luoyang-20260911 \
 *     --tags="生活,旅游" --excerpt="……" --cover=data/uploads/_cover-tmp-travel-luoyang-20260911.jpg \
 *     --min-han=3600 --max-han=4000 --figs=2
 *
 * 常用参数：
 *   --dir=<dir>        正文分片目录（必填）
 *   --out=<file>       article.json 输出路径，默认 <dir>/article.json
 *   --slug / --tags / --excerpt / --cover / --title
 *   --min-han / --max-han        汉字数区间（默认 3500 / 4200）
 *   --min-excerpt / --max-excerpt 默认 80 / 120
 *   --figs=<n>         期望正文插图数，默认 2
 *   --banned="a,b,c"   本线额外的禁用词（命中即 FAIL），如书籍线的「重读,再读,重温」
 *   --require-indent   要求正文自然段以两个全角空格开头（游戏线用），违规即 FAIL
 *
 * 退出码：0 = 全部通过；1 = 有 FAIL 项（按提示修完重跑，不要跳过）。
 */

import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
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

const dir = resolve(args.dir || ".");
if (!existsSync(dir)) {
  console.error(`❌ 目录不存在：${dir}`);
  process.exit(2);
}
const slug = args.slug;
if (!slug) {
  console.error("❌ 缺少 --slug");
  process.exit(2);
}
const outPath = resolve(args.out || join(dir, "article.json"));
const titleArg = args.title;
const tags = args.tags ? String(args.tags).split(",").map((s) => s.trim()).filter(Boolean) : [];
const excerpt = args.excerpt ?? "";
const cover = args.cover;
const minHan = Number(args["min-han"] || 3500);
const maxHan = Number(args["max-han"] || 4200);
const minExcerpt = Number(args["min-excerpt"] || 80);
const maxExcerpt = Number(args["max-excerpt"] || 120);
const expectFigs = Number(args.figs || 2);
const extraBanned = args.banned
  ? String(args.banned).split(",").map((s) => s.trim()).filter(Boolean)
  : [];
const requireIndent = Boolean(args["require-indent"]);

/* ---------------- 合并分片 ---------------- */

function collectFragments() {
  const all = readdirSync(dir).filter((f) => f.endsWith(".md"));
  const parts = all
    .filter((f) => /^_?p\d+\.md$/i.test(f))
    .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10));
  if (parts.length) return { files: parts, mode: "分片" };
  for (const cand of ["draft.md", "_tmp.md", "article.md", "_article.md"]) {
    if (all.includes(cand)) return { files: [cand], mode: "单文件" };
  }
  if (all.length === 1) return { files: all, mode: "单文件" };
  return { files: [], mode: "无" };
}

const { files, mode } = collectFragments();
if (!files.length) {
  console.error(`❌ ${dir} 下没找到正文（分片命名 _p1.md / _p2.md …，或单个 draft.md）`);
  process.exit(2);
}

let md = files
  .map((f) => readFileSync(join(dir, f), "utf-8"))
  .join("\n\n")
  .replace(/\r\n/g, "\n")
  .replace(/\n{3,}/g, "\n\n")
  .trim();

/* ---------------- 标题 ---------------- */

let title = titleArg;
const h1 = md.match(/^#\s+(.+)$/m);
if (!title) {
  if (!h1) {
    console.error("❌ 正文里没有 `# 标题` 行，也没有传 --title");
    process.exit(2);
  }
  title = h1[1].trim();
}
md = md.replace(/^#\s+.+$(?:\n\n?)?/m, "").trim();

/* ---------------- 占位符 ---------------- */

const residual = [];
for (let n = 1; n <= 6; n++) {
  const re = new RegExp(`\\{\\{FIG${n}\\}\\}`, "g");
  if (re.test(md)) {
    md = md.replace(re, `/uploads/${slug}-fig${n}.jpg`);
  }
}
for (let n = 1; n <= 6; n++) {
  if (md.includes(`{{FIG${n}}}`)) residual.push(`{{FIG${n}}}`);
}

const content = md;
const article = {
  title,
  content,
  excerpt,
  tags,
  slug,
  ...(cover ? { coverImage: cover } : {}),
};
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(article, null, 2));

/* ---------------- 体检 ---------------- */

const stripCode = (s) => s.replace(/```[\s\S]*?```/g, "");
const countHan = (s) => (s.replace(/\s/g, "").match(/[\u4e00-\u9fa5]/g) || []).length;

const hanAll = countHan(content);
const hanNoCode = countHan(stripCode(content));
const h2 = (content.match(/^## /gm) || []).length;
const h3 = (content.match(/^### /gm) || []).length;
const figs = (content.match(/!\[[^\]]*\]\([^)]+\)/g) || []).length;
const excerptLen = [...excerpt].length;
const noCode = stripCode(content);
const pipeCount = (noCode.match(/\|/g) || []).length;
const asciiQuotes = (content.match(/"/g) || []).length + (content.match(/'/g) || []).length;
const emDash = (content.match(/—/g) || []).length;

const HARD_BANNED = [
  "当今时代", "众所周知", "毋庸置疑", "不可否认", "总而言之", "总的来说",
  "综上所述", "由此可见", "值得一提的是", "细细想来", "不禁让人想到",
  "让我们一起", "仿佛置身于一幅画卷", "让人流连忘返",
];
const SOFT_BANNED = ["其实", "事实上", "被誉为", "某种程度上", "某种意义上", "或许可以说"];

const hit = (list) =>
  list.map((w) => [w, content.split(w).length - 1]).filter(([, n]) => n > 0);

const hardBannedHit = hit(HARD_BANNED);
const softBannedHit = hit(SOFT_BANNED);
const extraBannedHit = hit(extraBanned);

// 段落缩进检查（游戏线：每个自然段以两个全角空格开头）
const indentViolations = [];
if (requireIndent) {
  content.split("\n").forEach((line, i) => {
    const t = line.trim();
    if (!t) return;
    if (/^(#{1,6}\s|!|\||>|-|\*|\d+\.|　)/.test(t)) return;
    if (!line.startsWith("　　")) indentViolations.push(`第 ${i + 1} 行: ${t.slice(0, 18)}…`);
  });
}

const fails = [];
const warns = [];
if (hanAll < minHan || hanAll > maxHan) fails.push(`汉字数 ${hanAll} 不在 ${minHan}–${maxHan}`);
if (excerptLen < minExcerpt || excerptLen > maxExcerpt)
  fails.push(`excerpt ${excerptLen} 字不在 ${minExcerpt}–${maxExcerpt}`);
if (!excerpt) fails.push("excerpt 为空");
if (pipeCount > 0) fails.push(`正文含 ${pipeCount} 个裸 | （渲染器不支持表格）`);
if (residual.length) fails.push(`占位符残留：${residual.join(", ")}`);
if (figs !== expectFigs) fails.push(`正文插图 ${figs} 张，期望 ${expectFigs} 张`);
if (h2 < 4) fails.push(`## 分节只有 ${h2} 个，太少了`);
if (hardBannedHit.length) fails.push(`命中禁用词：${hardBannedHit.map(([w, n]) => `${w}×${n}`).join("、")}`);
if (extraBannedHit.length) fails.push(`命中本线禁用词：${extraBannedHit.map(([w, n]) => `${w}×${n}`).join("、")}`);
if (indentViolations.length > 3) fails.push(`段落缩进违规 ${indentViolations.length} 处（例：${indentViolations[0]}）`);
else if (indentViolations.length)
  warns.push(`段落缩进有 ${indentViolations.length} 处没以两个全角空格开头（例：${indentViolations[0]}）`);
if (cover) {
  if (!existsSync(resolve(cover))) fails.push(`封面文件不存在：${cover}`);
  else if (statSync(resolve(cover)).size < 20480)
    fails.push(`封面只有 ${statSync(resolve(cover)).size} 字节（应 > 20KB）`);
} else {
  fails.push("没有给 --cover");
}
if (!tags.length) fails.push("没有给 --tags");
if (asciiQuotes > 0) warns.push(`正文含 ${asciiQuotes} 个 ASCII 引号（中文应统一用「」）`);
if (emDash > 0) warns.push(`正文含 ${emDash} 个破折号 ——`);
if (softBannedHit.length)
  warns.push(`疑似填充词：${softBannedHit.map(([w, n]) => `${w}×${n}`).join("、")}（自行判断是否改写）`);

const mark = (ok) => (ok ? "✅" : "❌");
console.log("");
console.log("=== 文章体检报告 ===");
console.log(`来源       : ${basename(dir)}（${mode}：${files.join(", ")}）`);
console.log(`输出       : ${outPath}`);
console.log(`标题       : ${title}`);
console.log(`slug       : ${slug}`);
console.log(`tags       : ${JSON.stringify(tags)}`);
console.log(
  `${mark(hanAll >= minHan && hanAll <= maxHan)} 汉字数   : ${hanAll}   [${minHan}–${maxHan}]${hanNoCode !== hanAll ? `（去代码块 ${hanNoCode}）` : ""}`,
);
console.log(`${mark(figs === expectFigs)} 正文插图 : ${figs} / ${expectFigs}`);
console.log(`  ## 分节  : ${h2}    ### 子节: ${h3}`);
console.log(
  `${mark(excerptLen >= minExcerpt && excerptLen <= maxExcerpt)} excerpt  : ${excerptLen} 字 [${minExcerpt}–${maxExcerpt}]`,
);
console.log(`${mark(pipeCount === 0)} 裸 |     : ${pipeCount}`);
console.log(`${mark(residual.length === 0)} 占位符   : ${residual.length ? residual.join(",") : "无残留"}`);
if (cover) {
  const p = resolve(cover);
  const cs = existsSync(p) ? statSync(p).size : 0;
  console.log(`${mark(cs > 20480)} 封面     : ${basename(p)}  ${cs} 字节`);
}
console.log(`  禁用词   : ${hardBannedHit.length || extraBannedHit.length ? "命中" : "无"}`);
if (requireIndent) {
  const n = indentViolations.length;
  console.log(`${mark(n === 0)} 段落缩进 : ${n ? `不合规 ${n} 处，例：${indentViolations[0]}` : "全部合规"}`);
}

console.log("--- 逐节汉字数 ---");
content.split(/^## /m).forEach((sec, i) => {
  const c = countHan(stripCode(sec));
  const head = (sec.split("\n")[0] || "(引言)").slice(0, 26);
  console.log(`  #${i} [${c}字] ${head}`);
});

if (warns.length) {
  console.log("--- 提醒（不算 FAIL）---");
  warns.forEach((w) => console.log(`  ⚠️ ${w}`));
}
console.log("");
if (fails.length) {
  console.log("=== 结果：FAIL ===");
  fails.forEach((f) => console.log(`  ❌ ${f}`));
  console.log("按上面逐条修完，重跑本脚本。");
  process.exit(1);
}
console.log("=== 结果：PASS ===");
console.log(
  `发布命令：export NODE_OPTIONS= && E:/devtools/nodejs/node.exe node_modules/tsx/dist/cli.mjs scripts/post-article.ts --file=${outPath.replace(/\\/g, "/")}`,
);
process.exit(0);
