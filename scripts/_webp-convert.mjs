/**
 * 一次性转换：uploads 内 JPEG → WebP q82，同名 .jpg 写回（/uploads 路由按魔数嗅探 MIME，零链接改动）。
 * 跳过：已压过的相册图（gallery-nature/city/sunset-*）与非 JPEG。
 * 每张转完校验可解码与尺寸一致；写 .tmp 后 rename 防 Windows 文件锁。
 * 用法：node scripts/_webp-convert.mjs --sample=10   （抽样模式：只转 10 张做验收）
 *       node scripts/_webp-convert.mjs               （全量）
 */
import sharp from "sharp";
import { readdirSync, statSync, renameSync, rmSync, openSync, readSync, closeSync } from "node:fs";
import { join } from "node:path";

const DIR = "data/uploads";

/** 已是 WebP 内容（同名 .jpg 装的）直接跳过：防止重跑时 WebP→WebP 二次有损 */
function isWebpContent(p) {
  try {
    const head = Buffer.alloc(12);
    const fd = openSync(p, "r");
    readSync(fd, head, 0, 12, 0);
    closeSync(fd);
    return head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46 && head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50;
  } catch {
    return false;
  }
}

const SKIP = new Set([
  ...Array.from({ length: 6 }, (_, i) => `gallery-nature-${i + 1}.jpg`),
  ...Array.from({ length: 6 }, (_, i) => `gallery-city-${i + 1}.jpg`),
  ...Array.from({ length: 6 }, (_, i) => `gallery-sunset-${i + 1}.jpg`),
]);
const sample = process.argv.includes("--sample");

const files = readdirSync(DIR)
  .filter((f) => /\.jpe?g$/i.test(f) && !SKIP.has(f))
  .sort();
console.log(`JPEG 待转: ${files.length} 张${sample ? "（抽样 10 张）" : ""}`);

let before = 0;
let after = 0;
let done = 0;
let failed = 0;
const t0 = Date.now();

for (const f of files) {
  if (sample && done >= 10) break;
  const p = join(DIR, f);
  if (isWebpContent(p)) continue; // 已转换过，跳过
  const size0 = statSync(p).size;
  try {
    const meta = await sharp(p).metadata();
    const buf = await sharp(p).webp({ quality: 82 }).toBuffer();
    // 校验：可解码、宽高一致
    const check = await sharp(buf).metadata();
    if (check.format !== "webp" || check.width !== meta.width || check.height !== meta.height) {
      throw new Error(`decode check failed ${check.format} ${check.width}x${check.height}`);
    }
    if (buf.length >= size0) {
      // WebP 反而更大（极端小图/高噪点）：跳过保留 JPEG
      console.log(`  跳过(不变小) ${f} ${size0}B -> ${buf.length}B`);
      continue;
    }
    const tmp = p + ".tmp";
    const { writeFileSync } = await import("node:fs");
    writeFileSync(tmp, buf);
    rmSync(p);
    renameSync(tmp, p);
    before += size0;
    after += buf.length;
    done++;
    if (done % 50 === 0) console.log(`  进度 ${done} 张，累计 ${(before / 1048576).toFixed(0)}MB -> ${(after / 1048576).toFixed(0)}MB`);
  } catch (err) {
    failed++;
    console.error(`  ❌ ${f}: ${err.message}`);
  }
}

console.log(`\n完成 ${done} 张 / 失败 ${failed} 张 / 耗时 ${((Date.now() - t0) / 1000).toFixed(0)}s`);
console.log(`体积: ${(before / 1048576).toFixed(0)}MB -> ${(after / 1048576).toFixed(0)}MB（-且 ${((1 - after / before) * 100).toFixed(0)}%）`);
