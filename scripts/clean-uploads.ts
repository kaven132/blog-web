/**
 * 孤儿图清理 —— 把 data/uploads 里没被任何文章引用的图片移入
 * data/backups/uploads-orphan-<时间戳>/（只移动不删除，确认无误后可整目录删掉）。
 *
 * 引用判定与线上「删文/换封面自动清理」共用 src/lib/uploads.ts 的实现，
 * 判定范围：posts.cover_image / content / excerpt + profile.avatar。
 * 日常运行中孤儿图会在删文/换封面时自动清掉，本脚本用于兜底复查（比如清理历史遗留）。
 *
 * 用法：
 *   npm run uploads:clean            # dry-run，只打印清单
 *   npm run uploads:clean -- --apply # 真正移动孤儿图
 */

import { mkdirSync, readdirSync, renameSync, statSync } from "node:fs";
import { join } from "node:path";
import { db } from "../src/db";
import { collectUploadRefs } from "../src/lib/uploads";

const upDir = join(process.cwd(), "data", "uploads");
const apply = process.argv.includes("--apply");
const trash = join(process.cwd(), "data", "backups", `uploads-orphan-${new Date().toISOString().replace(/[:.]/g, "-")}`);

const used = collectUploadRefs();

const files = readdirSync(upDir).filter((f) => !f.startsWith("."));
const kept: string[] = [];
const orphans: string[] = [];
let keptBytes = 0;
let orphanBytes = 0;
for (const f of files) {
  const s = statSync(join(upDir, f)).size;
  if (used.has(f)) {
    kept.push(f);
    keptBytes += s;
  } else {
    orphans.push(f);
    orphanBytes += s;
  }
}

const mb = (b: number) => (b / 1048576).toFixed(1) + " MB";
console.log(`uploads 共 ${files.length} 个文件：被引用 ${kept.length} 个（${mb(keptBytes)}）｜孤儿 ${orphans.length} 个（${mb(orphanBytes)}）`);

if (!apply) {
  console.log("(dry-run 未移动；加 --apply 执行)");
  for (const f of orphans.slice(0, 25)) console.log("  将移动:", f);
  if (orphans.length > 25) console.log(`  … 等共 ${orphans.length} 个`);
} else if (orphans.length === 0) {
  console.log("没有孤儿图，无需移动。");
} else {
  mkdirSync(trash, { recursive: true });
  for (const f of orphans) renameSync(join(upDir, f), join(trash, f));
  console.log(`✅ 已移动 ${orphans.length} 个文件 -> ${trash}`);
  console.log(`   uploads 目录剩 ${kept.length} 个文件（${mb(keptBytes)}）`);
}
db.close?.();
