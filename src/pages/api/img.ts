import type { APIRoute } from "astro";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { Readable } from "node:stream";
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
 * 远程图片代理优化端点：/api/img?u=<encodeURIComponent(http(s) 图 URL)>
 * 首次请求：拉取远端 → sharp 转 WebP（q80）→ 落盘缓存 → 返回；之后直读缓存。
 * 正文 markdown 里的远程图由 renderMarkdown 统一改写到本端点，浏览器侧零改造成本。
 *
 * 防护：仅 http(s) 公网地址（拦私网/本机字面量，防当内网跳板）、单张 20MB 上限、
 * 15s 超时、只接受图片内容（魔数为准）——不是图片直接 415，不做开放代理。
 * 兜底：源站拉不动（防盗链 403/超时）时 302 回原图，浏览器直连，图绝不挂。
 */

/** 不可转换类型（动图/矢量/已更优格式）：缓存原图字节，旁车 .ct 记录类型 */

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

  ensureCacheDir();
  const cache = remoteCachePaths(target.href);

  // 缓存命中：优先转换后的 WebP，其次不可转换类型的原图字节
  if (existsSync(cache.webp)) return fileResponse(cache.webp, "image/webp");
  if (existsSync(cache.raw) && existsSync(cache.ct)) {
    const mime = readFileSync(cache.ct, "utf8").trim() || "image/webp";
    return fileResponse(cache.raw, mime);
  }

  let resp: Response;
  try {
    resp = await fetch(target, {
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
  } catch {
    // 拉不动就 302 回原图：浏览器直连（与未代理时行为一致），绝不让图挂掉
    return passthroughRedirect(target);
  }
  if (!resp.ok) return passthroughRedirect(target);

  const declaredLen = Number(resp.headers.get("content-length") ?? 0);
  if (declaredLen > REMOTE_MAX_BYTES) return new Response("图片过大", { status: 413 });
  const buf = Buffer.from(await resp.arrayBuffer());
  if (buf.byteLength > REMOTE_MAX_BYTES) return new Response("图片过大", { status: 413 });

  const ct = (resp.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const sniffed = sniffImageType(buf);
  // 类型判定以魔数为准，Content-Type 只补位（svg 只有声明没有魔数）
  const realType = sniffed ?? (ct.startsWith("image/") ? ct : null);
  if (!realType) return new Response("不是图片", { status: 415 });

  // gif（动图）/svg/avif/webp：不重编码，缓存原图字节原样回
  if (/^image\/(gif|svg|avif|webp)/i.test(realType)) {
    try {
      writeCacheAtomic(cache.raw, buf);
      writeCacheAtomic(cache.ct, realType);
    } catch {
      // 缓存写失败不影响本次返回
    }
    return bufResponse(buf, realType, true);
  }

  const out = await convertBufferToWebp(buf);
  // 转换失败或转完反而更大（小图标/已优化图）：缓存并返回原图，绝不放大体积
  if (!out || out.byteLength >= buf.byteLength) {
    try {
      writeCacheAtomic(cache.raw, buf);
      writeCacheAtomic(cache.ct, realType);
    } catch {
      // ignore
    }
    return bufResponse(buf, realType, true);
  }

  try {
    writeCacheAtomic(cache.webp, out);
  } catch {
    // ignore
  }
  return bufResponse(out, "image/webp", true);
};
