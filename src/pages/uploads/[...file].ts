import type { APIRoute } from "astro";
import { createReadStream, existsSync, statSync } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";

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

export const GET: APIRoute = async ({ params }) => {
  const name = params.file;
  if (!name) return new Response(null, { status: 404 });

  const mime = MIME[path.extname(name).slice(1).toLowerCase()];
  if (!mime) return new Response(null, { status: 404 });

  // 路径穿越防护：resolve 后必须仍落在 uploads 根目录内（双保险，纯 basename 也过不了这关）
  const full = path.resolve(UPLOAD_ROOT, name);
  if (full !== UPLOAD_ROOT && !full.startsWith(UPLOAD_ROOT + path.sep)) {
    return new Response(null, { status: 404 });
  }
  if (!existsSync(full)) return new Response(null, { status: 404 });

  // 流式读取：readFileSync 会阻塞 SSR 单进程的事件循环
  try {
    const size = statSync(full).size;
    const stream = Readable.toWeb(createReadStream(full)) as unknown as ReadableStream;
    return new Response(stream, {
      headers: {
        "Content-Type": mime,
        "Content-Length": String(size),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
};
