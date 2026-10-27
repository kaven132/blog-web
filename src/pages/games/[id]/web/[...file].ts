import type { APIRoute } from "astro";
import { createReadStream, existsSync, statSync } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";
import { AUTH_COOKIE, isAuthed } from "../../../../lib/auth";
import { getRpgGame } from "../../../../lib/rpg-games";

export const prerender = false;

/**
 * RPG Maker 网页游戏静态托管（动态路由）：/games/<id>/web/** ← data/games/<id>/www/**
 * 游戏必须登记在 rpg-games 注册表；仅登录用户可取（匿名一律 404）。
 * 引擎按需 XHR 拉取资源，同源 iframe 内运行，无 CORS 问题。
 * preview.png 特例：从游戏根目录（www 外）伺服，供小游戏列表卡片使用。
 */
const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  // RPG Maker MV 加密资产（引擎 XHR 拉取后自行解密）
  ".rpgmvp": "image/png",
  ".rpgmvo": "audio/ogg",
  ".rpgmvm": "audio/mp4",
  ".rpgsave": "application/octet-stream",
};

export const GET: APIRoute = async ({ params, cookies }) => {
  if (!isAuthed(cookies.get(AUTH_COOKIE)?.value)) {
    return new Response(null, { status: 404 });
  }
  const game = getRpgGame(params.id);
  if (!game) return new Response(null, { status: 404 });

  const rel = params.file;
  if (!rel) return new Response(null, { status: 404 });

  const mime = MIME[path.extname(rel).toLowerCase()];
  if (!mime) return new Response(null, { status: 404 });

  // 游戏数据根：默认在项目树外（与项目平级的 blog2-gamedata），可用环境变量覆盖
  const GAMES_ROOT = path.resolve(process.env.GAME_DATA_ROOT || path.join("..", "blog2-gamedata", "games"));
  const GAME_DIR = path.join(GAMES_ROOT, game.id);
  const WWW_ROOT = path.join(GAME_DIR, "www");
  // preview.png 特例：卡片预览图在游戏根目录（www 外）
  const full = rel === "preview.png" ? path.join(GAME_DIR, "preview.png") : path.resolve(WWW_ROOT, rel);
  if (!full.startsWith(GAME_DIR + path.sep)) return new Response(null, { status: 404 });
  if (!existsSync(full) || !statSync(full).isFile()) return new Response(null, { status: 404 });

  const size = statSync(full).size;
  const stream = Readable.toWeb(createReadStream(full)) as unknown as ReadableStream;
  return new Response(stream, {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(size),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};
