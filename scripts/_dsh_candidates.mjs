// dsh 插件市场候选池扫描（autonomation 5cff0944 第二篇选题用）
// 用法: node scripts/_dsh_candidates.mjs [关键词...]
// 无参数时按内置五类输出候选清单
import fs from "node:fs";

const RAW = "C:/Users/kaven/.dsh/plugins/dsh-market/plugins-cache.json";
if (!fs.existsSync(RAW)) {
  console.error(`找不到市场缓存：${RAW}`);
  console.error("（dsh 的 dsh-market 插件未安装或未刷新缓存时会出现这种情况）");
  process.exit(1);
}
const raw = JSON.parse(fs.readFileSync(RAW, "utf8"));
const list = raw.plugins ?? [];

// 已写过的项目名（片段匹配用），与 scripts/_posted.json 的 plugins 保持同步
const POSTED = JSON.parse(fs.readFileSync("scripts/_posted.json", "utf8")).plugins || [];
const postedKeys = POSTED.map((s) =>
  s.split(/[—\-–]/)[0].trim().toLowerCase()
).filter(Boolean);

const NOISE = [
  "skin", "pet-", "pets", "wallpaper", "rtl", "arabic", "wooden-fish",
  "image-viewer", "custom-css", "jailbreak", "越狱", "破甲", "anime",
  "fish-sound", "exchange-rate", "汇率",
];

// 候选里混进过 star 数注水的聚合型项目（自称支持全部平台、star 数与仓库年龄严重不匹配）
// —— 不是硬性排除，只是提醒人工核查时重点看这一点
const SUSPICIOUS = ["ruflo"];

const CATEGORIES = {
  "1-技能包 skill": ["skill", "skills"],
  "2-插件扩展": ["plugin", "taskboard", "context", "market", "routing"],
  "3-MCP 与工具接入": ["mcp"],
  "4-记忆检索上下文": ["memory", "recall", "retrieval", "rag", "index"],
  "5-执行与操作环境": ["browser", "sandbox", "docker", "podman", "ssh", "terminal", "tui", "ocr", "vision"],
};

const custom = process.argv.slice(2);

function text(p) {
  return [p.name, p.description, p.descriptionZh, (p.tags || []).join(" ")]
    .join(" ")
    .toLowerCase();
}

function isNoise(t) {
  return NOISE.some((n) => t.includes(n));
}

function isSuspicious(p) {
  const t = text(p);
  return SUSPICIOUS.some((s) => t.includes(s));
}

function isPosted(p) {
  const t = text(p);
  return postedKeys.some((k) => k.length > 3 && t.includes(k));
}

function show(label, kws) {
  const rows = list
    .filter((p) => {
      const t = text(p);
      if (isNoise(t)) return false;
      if (isPosted(p)) return false;
      if (!p.install?.commands?.[0]) return false;
      return kws.some((k) => t.includes(k));
    })
    .sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0) || b.stars - a.stars)
    .slice(0, 15);

  console.log(`\n=== ${label}（${rows.length} 条）===`);
  for (const p of rows) {
    const flag = isSuspicious(p) ? "  ⚠️star 数存疑，须重点核查" : "";
    console.log(`[${String(p.score?.total ?? 0).padStart(3)}] ${p.name} ★${p.stars} ${p.license || "-"} ${(p.pushedAt || "").slice(0, 10)}${flag}`);
    console.log(`      ${(p.descriptionZh || "").slice(0, 76)}`);
    console.log(`      装: ${p.install.commands[0].slice(0, 110)}`);
  }
}

if (custom.length) {
  show(`自定义关键词: ${custom.join(",")}`, custom);
} else {
  console.log(`市场缓存 generatedAt=${raw.generatedAt}，共 ${list.length} 条；已排除已写过的 ${postedKeys.length} 个项目`);
  for (const [label, kws] of Object.entries(CATEGORIES)) show(label, kws);
}
