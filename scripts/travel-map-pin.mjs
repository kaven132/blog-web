#!/usr/bin/env node
/**
 * 旅行地图打点工具：旅游线发文后，把新城市登记进 src/data/travel-cities.json 坐标台账，
 * 并审计「已发布旅游文中标题『：』前缀城市」的漏点情况。
 *
 * 原理（与 src/pages/travel.astro 的聚合逻辑保持一致）：
 *   已发布 + tags 含「旅游」的文章 → 标题.split("：")[0].trim() = 城市名 → 查台账取坐标上图钉。
 *   台账里没有的城市会被 travel.astro 静默跳过（不报错、不上图），所以发文后必须登记。
 *
 * 用法（必须在仓库根目录执行）：
 *   node scripts/travel-map-pin.mjs                                  # 审计：列出已打点/漏点城市
 *   node scripts/travel-map-pin.mjs --check                          # 审计，存在漏点时退出码 1
 *   node scripts/travel-map-pin.mjs --add="北海|国内|109.1|21.5"      # 登记城市（幂等），登记后自动审计
 *   node scripts/travel-map-pin.mjs --add="京都|国际|135.8|35.0" --check
 *
 * --add 字段顺序：城市名 | 国内/国际 | 经度 | 纬度（城市中心坐标，1 位小数即可）。
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const ROOT = process.cwd();
const JSON_FILE = path.join(ROOT, "src", "data", "travel-cities.json");
const DB_FILE = path.join(ROOT, "data", "blog.db");

const args = process.argv.slice(2);
const adds = args.filter((a) => a.startsWith("--add=")).map((a) => a.slice(6).trim());
const check = args.includes("--check");

function loadRegistry() {
  return JSON.parse(readFileSync(JSON_FILE, "utf8"));
}

/** 登记一条城市（幂等：已存在则原样返回）；写入时保持「国内在前、国际在后」的分组 */
function addCity(registry, { name, type, lng, lat }) {
  if (registry[name]) return { registry, changed: false };
  registry[name] = { type, lng, lat };
  const ordered = {};
  for (const [k, v] of Object.entries(registry)) if (v.type === "国内") ordered[k] = v;
  for (const [k, v] of Object.entries(registry)) if (v.type !== "国内") ordered[k] = v;
  return { registry: ordered, changed: true };
}

/** 审计：返回漏点城市名数组 */
function audit() {
  const registry = loadRegistry();

  const db = new Database(DB_FILE, { readonly: true });
  const rows = db.prepare("select title, tags, published from posts").all();
  db.close();

  const counts = new Map();
  let travelPosts = 0;
  for (const r of rows) {
    if (!r.published) continue;
    let tags = [];
    try {
      tags = JSON.parse(r.tags || "[]");
    } catch {
      /* tags 不是 JSON 就跳过 */
    }
    if (!tags.includes("旅游")) continue;
    travelPosts++;
    const name = r.title.split("：")[0].trim();
    counts.set(name, (counts.get(name) || 0) + 1);
  }

  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const pinned = entries.filter(([n]) => registry[n]);
  const missing = entries.filter(([n]) => !registry[n]).map(([n]) => n);

  console.log(`旅游文章 ${travelPosts} 篇，聚合出 ${entries.length} 座城市：已打点 ${pinned.length}，漏点 ${missing.length}`);
  console.log(`台账登记数：${Object.keys(registry).length}`);
  if (missing.length) console.log("⚠️ 漏点（发文了但地图上没有图钉）：" + missing.join("、"));
  return missing;
}

function main() {
  let registry = loadRegistry();
  let dirty = false;

  for (const raw of adds) {
    const parts = raw.split("|").map((s) => s.trim());
    if (parts.length !== 4) throw new Error(`--add 格式应为「城市|国内/国际|经度|纬度」，收到：${raw}`);
    const [name, type, lngStr, latStr] = parts;
    if (!name) throw new Error("城市名不能为空");
    if (type !== "国内" && type !== "国际") throw new Error(`type 必须是「国内」或「国际」，收到：${type}`);
    const lng = Number(lngStr);
    const lat = Number(latStr);
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) throw new Error(`经度不合法：${lngStr}`);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new Error(`纬度不合法：${latStr}`);

    const res = addCity(registry, { name, type, lng, lat });
    registry = res.registry;
    if (res.changed) {
      dirty = true;
      console.log(`✅ 已登记：${name}（${type}，${lng}, ${lat}）→ src/data/travel-cities.json`);
    } else {
      console.log(`↩︎ ${name} 已在台账中，跳过`);
    }
  }

  if (dirty) writeFileSync(JSON_FILE, JSON.stringify(registry, null, 2) + "\n", "utf8");

  const missing = audit();
  if (check && missing.length) {
    console.error(`FAIL：存在 ${missing.length} 个漏点城市，用 --add 逐个登记后重跑 --check`);
    process.exit(1);
  }
}

main();
