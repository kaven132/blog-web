import type { APIRoute } from "astro";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { Readable } from "node:stream";
import sharp from "sharp";
import {
  REMOTE_MAX_BYTES,
  convertBufferToWebp,
  ensureCacheDir,
  isBlockedRemoteHost,
  remoteCachePaths,
  sniffImageType,
  writeCacheAtomic,
} from "../../lib/imgopt";

export const prerender = false;

/**
 * 远程图片代理优化端点：/api/img?u=<encodeURIComponent(http(s) 图 URL)>&w=<可选宽度>
 * 首次请求：拉取远端 → 原始字节与转档结果都落盘缓存；之后直读缓存。
 * 带 w= 时按宽缩放（不放大小图），srcset 多尺寸共用同一份原始字节派生。
 * 正文 markdown 里的远程图由 renderMarkdown 统一改写到本端点，浏览器侧零改造成本。
 *
 * 防护：仅 http(s) 公网地址（拦私网/本机字面量，防当内网跳板）、单张 20MB 上限、
 * 15s 超时、只接受图片内容（魔数为准）——不是图片直接 415，不做开放代理。
 * 兜底：源站拉不动（防盗链 403/超时）时 302 回原图，浏览器直连，图绝不挂。
 */

function fileResponse(full: string, mime: string) {
  const size = statSync(full).size;
  const stream = Readable.toWeb(createReadStream(full)) as unknown as ReadableStream;
  return new Response(stream, {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(size),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

function bufResponse(buf: Buffer, mime: string, cacheable: boolean) {
  return new Response(buf, {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(buf.byteLength),
      "Cache-Control": cacheable ? "public, max-age=31536000, immutable" : "no-store",
    },
  });
}

/** 源站拉不动（403/超时等）时 302 回原图，浏览器用自己的 UA/Cookie 直连 */
function passthroughRedirect(target: URL): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: target.href, "Cache-Control": "no-store" },
  });
}

/** 拉取原始字节：优先本地 .raw 缓存，其次回源；成功即落原始缓存供各尺寸派生 */
async function loadOriginal(target: URL, cache: ReturnType<typeof remoteCachePaths>) {
  if (existsSync(cache.raw) && existsSync(cache.ct)) {
    return { buf: readFileSync(cache.raw), mime: readFileSync(cache.ct, "utf8").trim() };
  }
  const resp = await fetch(target, {
    signal: AbortSignal.timeout(15000),
    redirect: "follow",
    // 带浏览器 UA + 同站 Referer：部分图源有 UA/防盗链过滤，纯服务端 UA 会被拒
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      Referer: `${target.origin}/`,
      Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
    },
  });
  if (!resp.ok) return null;
  const declaredLen = Number(resp.headers.get("content-length") ?? 0);
  if (declaredLen > REMOTE_MAX_BYTES) return null;
  const buf = Buffer.from(await resp.arrayBuffer());
  if (buf.byteLength > REMOTE_MAX_BYTES) return null;
  const ct = (resp.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  // 类型判定以魔数为准，Content-Type 只补位（svg 只有声明没有魔数）
  const mime = sniffImageType(buf) ?? (ct.startsWith("image/") ? ct : "");
  if (!mime) return null;
  try {
    writeCacheAtomic(cache.raw, buf);
    writeCacheAtomic(cache.ct, mime);
  } catch {
    // 缓存写失败不影响本次返回
  }
  return { buf, mime };
}

export const GET: APIRoute = async ({ url: reqUrl }) => {
  const raw = reqUrl.searchParams.get("u") ?? "";
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new Response("无效的图片地址", { status: 400 });
  }
  if (
    (target.protocol !== "http:" && target.protocol !== "https:") ||
    isBlockedRemoteHost(target.hostname)
  ) {
    return new Response("不允许的图片地址", { status: 403 });
  }

  // w= 期望宽度：srcset 用；范围收紧防乱刷缓存
  const wRaw = Number(reqUrl.searchParams.get("w") ?? 0);
  const w = Number.isInteger(wRaw) && wRaw >= 64 && wRaw <= 2560 ? wRaw : 0;

  ensureCacheDir();
  const cache = remoteCachePaths(target.href);

  // 缓存命中：带 w 优先对应尺寸，否则完整 WebP
  if (w && existsSync(`${cache.webp}.w${w}`)) return fileResponse(`${cache.webp}.w${w}`, "image/webp");
  if (!w && existsSync(cache.webp)) return fileResponse(cache.webp, "image/webp");

  const orig = await loadOriginal(target, cache).catch(() => null);
  if (!orig) return passthroughRedirect(target);
  const { buf, mime } = orig;

  // gif（动图）/svg/avif/webp：不重编码，原始字节即最终答案
  if (!/^image\/(jpeg|png)$/i.test(mime)) {
    return bufResponse(buf, mime, true);
  }

  const resized = w
    ? await sharp(buf)
        .resize({ width: w, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer()
        .catch(() => null)
    : await convertBufferToWebp(buf);

  // 转换失败或转完反而更大（小图标/已优化图）：回原图，绝不放大体积
  if (!resized || resized.byteLength >= buf.byteLength) {
    return bufResponse(buf, mime, true);
  }

  try {
    writeCacheAtomic(w ? `${cache.webp}.w${w}` : cache.webp, resized);
  } catch {
    // 缓存写失败不影响本次返回
  }
  return bufResponse(resized, "image/webp", true);
};
