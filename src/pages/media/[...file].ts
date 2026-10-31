import type { APIRoute } from "astro";
import { createReadStream, existsSync, statSync } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";
import { db } from "../../db";
import { videos } from "../../db/schema";
import { eq } from "drizzle-orm";
import { AUTH_COOKIE, isAuthed } from "../../lib/auth";

export const prerender = false;

/**
 * 视频文件伺服（/media/<文件名>）：HTML5 拖进度条必需 Range/206 支持。
 * 门禁：文件必须登记在 videos 表——隐私视频匿名一律 404，未登记的孤儿文件同样 404（不可探测）。
 * 文件名白名单与上传端一致（时间戳-随机.受控扩展名），resolve 边界校验双保险。
 */
const VIDEO_ROOT = path.resolve("./data/videos");
const MIME: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

export const GET: APIRoute = async ({ params, request, cookies }) => {
  const name = params.file;
  if (!name || !/^[0-9]{13}-[0-9a-f]{8}\.(mp4|webm|mov)$/.test(name)) {
    return new Response(null, { status: 404 });
  }

  const full = path.resolve(VIDEO_ROOT, name);
  if (full !== VIDEO_ROOT && !full.startsWith(VIDEO_ROOT + path.sep)) {
    return new Response(null, { status: 404 });
  }
  if (!existsSync(full)) return new Response(null, { status: 404 });

  // 隐私门禁：以 DB 登记为准（匿名 + 隐私视频 → 404）
  const row = db.select({ isPrivate: videos.isPrivate }).from(videos).where(eq(videos.url, `/media/${name}`)).get();
  if (!row) return new Response(null, { status: 404 });
  if (row.isPrivate && !isAuthed(cookies.get(AUTH_COOKIE)?.value)) {
    return new Response(null, { status: 404 });
  }

  const size = statSync(full).size;
  const ext = path.extname(name).slice(1).toLowerCase();
  const mime = MIME[ext] ?? "application/octet-stream";
  const baseHeaders: Record<string, string> = {
    "Content-Type": mime,
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000, immutable",
  };

  // Range：只处理 "bytes=start-end" 与 "bytes=start-"（浏览器 video 元素只用这两种形态）
  const range = request.headers.get("range");
  const m = range?.match(/^bytes=(\d+)-(\d*)$/);
  if (m) {
    const start = Number(m[1]);
    const end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    const stream = Readable.toWeb(createReadStream(full, { start, end })) as unknown as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: {
        ...baseHeaders,
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": String(end - start + 1),
      },
    });
  }

  const stream = Readable.toWeb(createReadStream(full)) as unknown as ReadableStream;
  return new Response(stream, { headers: { ...baseHeaders, "Content-Length": String(size) } });
};
