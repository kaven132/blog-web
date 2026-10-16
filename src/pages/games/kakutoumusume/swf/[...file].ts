import type { APIRoute } from "astro";
import { createReadStream, existsSync, statSync } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";

export const prerender = false;

/**
 * Flash 游戏 SWF 托管：/games/kakutoumusume/swf/main.swf（+ sub/*.swf 相对加载）
 * 文件放 data/games/kakutoumusume/（已被 /data/ gitignore，不进仓库）。
 * 主 SWF 按相对路径拉 sub 场景，catch-all 端点天然支持。
 */
const GAME_ROOT = path.resolve("./data/games/kakutoumusume");

export const GET: APIRoute = async ({ params }) => {
  const rel = params.file;
  if (!rel) return new Response(null, { status: 404 });

  const full = path.resolve(GAME_ROOT, rel);
  if (!full.startsWith(GAME_ROOT + path.sep)) return new Response(null, { status: 404 });
  if (!existsSync(full) || !statSync(full).isFile()) return new Response(null, { status: 404 });

  const size = statSync(full).size;
  const stream = Readable.toWeb(createReadStream(full)) as unknown as ReadableStream;
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-shockwave-flash",
      "Content-Length": String(size),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};
