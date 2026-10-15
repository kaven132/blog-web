import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import sharp from "sharp";

/**
 * 图片按需转 WebP + 磁盘缓存的公共入口。
 * 原图一律不动：转换结果写进 data/img-cache，首次请求转换、之后直读缓存。
 * 命中即回的兼容性兜底：转换失败或转换后反而更大时，回退返回原图字节。
 */

export const CACHE_ROOT = resolve("./data/img-cache");
export const WEBP_QUALITY = 80;
/** 远程图单张大小上限：超过直接拒绝，防把内存当下载器 */
export const REMOTE_MAX_BYTES = 20 * 1024 * 1024;

export function ensureCacheDir(): void {
  mkdirSync(CACHE_ROOT, { recursive: true });
}

/** 校验过缓存目录边界的本地 uploads 图缓存路径（<原名>.webp）；越界返回 null */
export function uploadsCachePath(name: string): string | null {
  const full = resolve(CACHE_ROOT, `${name}.webp`);
  if (!full.startsWith(CACHE_ROOT + sep)) return null;
  return full;
}

/** 某张 uploads 图的全部尺寸变体缓存（<原名>.w<宽>.webp），删原图时连带清理 */
export function uploadsCacheVariants(name: string): string[] {
  const prefix = `${name}.w`;
  try {
    return readdirSync(CACHE_ROOT)
      .filter((f) => f.startsWith(prefix) && f.endsWith(".webp"))
      .map((f) => resolve(CACHE_ROOT, f))
      .filter((full) => full.startsWith(CACHE_ROOT + sep));
  } catch {
    return [];
  }
}

/** 远程图缓存路径：<sha256(url)>.webp（可转换）或 .raw + .ct 旁车（不可转换，记录原始类型） */
export function remoteCachePaths(url: string) {
  const h = createHash("sha256").update(url).digest("hex");
  return {
    webp: resolve(CACHE_ROOT, `${h}.webp`),
    raw: resolve(CACHE_ROOT, `${h}.raw`),
    ct: resolve(CACHE_ROOT, `${h}.ct`),
    hash: h,
  };
}

/** 按扩展名判断本地 uploads 图是否值得转（webp 已是目标格式直接跳过，gif/avif 转了有害无益） */
export function shouldConvertUpload(ext: string): boolean {
  const e = ext.toLowerCase();
  return [".jpg", ".jpeg", ".png"].includes(e);
}

/** 原子写缓存：先写临时文件再改名，并发首访最多重复转一次，不会出现半截文件；width>0 时按宽缩放（不放大小图） */
export async function convertToWebpFile(srcPath: string, destPath: string, width = 0): Promise<boolean> {
  ensureCacheDir();
  const tmp = `${destPath}.${process.hrtime.bigint().toString(36)}.tmp`;
  try {
    let pipeline = sharp(srcPath);
    if (width > 0) pipeline = pipeline.resize({ width, withoutEnlargement: true });
    await pipeline.webp({ quality: WEBP_QUALITY }).toFile(tmp);
    renameSync(tmp, destPath);
    return true;
  } catch {
    // 坏图/不支持的格式：清掉临时文件，调用方回退原图
    try {
      unlinkSync(tmp);
    } catch {
      // ignore
    }
    return false;
  }
}

export function writeCacheAtomic(destPath: string, data: Buffer | string): void {
  ensureCacheDir();
  const tmp = `${destPath}.${process.hrtime.bigint().toString(36)}.tmp`;
  try {
    writeFileSync(tmp, data);
    renameSync(tmp, destPath);
  } catch (e) {
    try {
      unlinkSync(tmp);
    } catch {
      // ignore
    }
    throw e;
  }
}

/** 缓存转 WebP 后反而更大（小图/已优化图）时用它兜底；失败返回 null 走原图 */
export async function convertBufferToWebp(buf: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(buf).webp({ quality: WEBP_QUALITY }).toBuffer();
  } catch {
    return null;
  }
}

/**
 * 按文件头魔数识别图片真实类型。
 * 不少图源用 application/octet-stream 或缺 Content-Type 下发图片，只看响应头会误杀。
 */
export function sniffImageType(buf: Buffer): "image/jpeg" | "image/png" | "image/gif" | "image/webp" | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "image/gif";
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

/**
 * SSRF 防护：/api/img 只代理公网 http(s) 图片。
 * 挡掉本机/内网/链路本地字面量地址，防被人当跳板扫内网。
 * （个人博客不做 DNS 解析级钉扎，这里拦的是明显私网目标。）
 */
export function isBlockedRemoteHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h.endsWith(".local") ||
    h === "::1" ||
    h === "0.0.0.0" ||
    /^127\./.test(h) ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^169\.254\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    /^f[cd][0-9a-f]{2}:/i.test(h)
  );
}
