import type { APIRoute } from "astro";
import { createReadStream, existsSync, statSync } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";
import {
  uploadsCachePath,
  shouldConvertUpload,
  convertToWebpFile,
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

  // 浏览器支持 WebP 且原图值得转（jpg/png）时，按需转档并回缓存；
  // URL 不变，爬虫等不带 Accept: image/webp 的客户端仍拿原图，og:image 因此无需特殊处理。
  const wantsWebp = (request.headers.get("accept") ?? "").includes("image/webp");
  if (wantsWebp && shouldConvertUpload(ext)) {
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
    return fileResponse(full, mime, true);
  } catch {
    return new Response(null, { status: 404 });
  }
};
