import type { APIRoute } from "astro";
import { createReadStream, existsSync, statSync, openSync, readSync, closeSync } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";
import {
  uploadsCachePath,
  shouldConvertUpload,
  convertToWebpFile,
  sniffImageType,
} from "../../lib/imgopt";

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
};

export const prerender = false;

const UPLOAD_ROOT = path.resolve("./data/uploads");

/** 流式回文件：readFileSync 会阻塞 SSR 单进程的事件循环 */
function fileResponse(full: string, mime: string, varyAccept: boolean) {
  const size = statSync(full).size;
  const stream = Readable.toWeb(createReadStream(full)) as unknown as ReadableStream;
  return new Response(stream, {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(size),
      "Cache-Control": "public, max-age=31536000, immutable",
      // 同一 URL 按协商可能返回 WebP 或原图，CDN 必须按 Accept 区分缓存
      ...(varyAccept ? { Vary: "Accept" } : {}),
    },
  });
}

export const GET: APIRoute = async ({ params, request }) => {
  const url = new URL(request.url);
  const name = params.file;
  if (!name) return new Response(null, { status: 404 });

  const ext = path.extname(name);
  const mime = MIME[ext.slice(1).toLowerCase()];
  if (!mime) return new Response(null, { status: 404 });

  // 路径穿越防护：resolve 后必须仍落在 uploads 根目录内（双保险，纯 basename 也过不了这关）
  const full = path.resolve(UPLOAD_ROOT, name);
  if (full !== UPLOAD_ROOT && !full.startsWith(UPLOAD_ROOT + path.sep)) {
    return new Response(null, { status: 404 });
  }
  if (!existsSync(full)) return new Response(null, { status: 404 });

  // 内容真实格式优先于扩展名（存量 JPEG 已批量转 WebP、文件名不变）：
  // 读前 12 字节做魔数嗅探，Content-Type 以内容为准，否则浏览器拿到错误类型
  let sniffed: string | null = null;
  try {
    const head = Buffer.alloc(12);
    const fd = openSync(full, "r");
    readSync(fd, head, 0, 12, 0);
    closeSync(fd);
    sniffed = sniffImageType(head);
  } catch {
    // 嗅探失败按扩展名走
  }
  const isWebpContent = sniffed === "image/webp";

  // w= 期望宽度：srcset 用，按需缩放转 WebP（不放大小图）；范围收紧防乱刷缓存
  const wRaw = Number(url.searchParams.get("w") ?? 0);
  const w = Number.isInteger(wRaw) && wRaw >= 64 && wRaw <= 2560 ? wRaw : 0;

  // 带 w 的缩放变体：显式选型 URL，直接回 WebP；不值得转的类型或内容已是 WebP 时回原图
  if (w && shouldConvertUpload(ext) && !isWebpContent) {
    const cacheFull = uploadsCachePath(`${name}.w${w}`);
    if (cacheFull) {
      if (!existsSync(cacheFull)) await convertToWebpFile(full, cacheFull, w);
      if (existsSync(cacheFull)) {
        try {
          return fileResponse(cacheFull, "image/webp", false);
        } catch {
          // 缓存读取失败就回原图
        }
      }
    }
  }
  if (w) return fileResponse(full, mime, false);

  // 浏览器支持 WebP 且原图值得转（jpg/png）时，按需转档并回缓存；
  // URL 不变，爬虫等不带 Accept: image/webp 的客户端仍拿原图，og:image 因此无需特殊处理。
  // 内容已是 WebP（存量预转）时跳过转档直接回，Content-Type 按嗅探结果。
  const wantsWebp = (request.headers.get("accept") ?? "").includes("image/webp");
  if (wantsWebp && !isWebpContent && shouldConvertUpload(ext)) {
    const cacheFull = uploadsCachePath(name);
    if (cacheFull) {
      if (!existsSync(cacheFull)) await convertToWebpFile(full, cacheFull);
      if (existsSync(cacheFull)) {
        try {
          return fileResponse(cacheFull, "image/webp", true);
        } catch {
          // 缓存读取失败就回退原图
        }
      }
    }
  }

  try {
    const finalMime = sniffed ?? mime;
    return fileResponse(full, finalMime, !isWebpContent);
  } catch {
    return new Response(null, { status: 404 });
  }
};
