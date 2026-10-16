import type { APIRoute } from "astro";
import { createReadStream, existsSync, statSync } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";

export const prerender = false;

/**
 * Ruffle（Flash 模拟器）自托管运行时：/ruffle/ruffle.js 及其 chunk / wasm。
 * 文件来自 npm 依赖 @ruffle-rs/ruffle（node_modules 已 gitignore，依赖声明在 package.json）。
 * ruffle.js 按自身 URL 相对拉取 core.*.js 与 *.wasm，catch-all 端点天然支持。
 */
const RUFFLE_ROOT = path.resolve("./node_modules/@ruffle-rs/ruffle");

const MIME: Record<string, string> = {
  ".js": "text/javascript; charset=utf-8",
  ".wasm": "application/wasm",
};

export const GET: APIRoute = async ({ params }) => {
  const rel = params.file;
  if (!rel) return new Response(null, { status: 404 });

  const ext = path.extname(rel).toLowerCase();
  const mime = MIME[ext];
  if (!mime) return new Response(null, { status: 404 });

  const full = path.resolve(RUFFLE_ROOT, rel);
  if (!full.startsWith(RUFFLE_ROOT + path.sep)) return new Response(null, { status: 404 });
  if (!existsSync(full) || !statSync(full).isFile()) return new Response(null, { status: 404 });

  const size = statSync(full).size;
  const stream = Readable.toWeb(createReadStream(full)) as unknown as ReadableStream;
  return new Response(stream, {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(size),
      // 产物文件名带内容哈希，可永久缓存；ruffle.js 本身无哈希但随依赖版本走
      "Cache-Control": "public, max-age=86400",
    },
  });
};
