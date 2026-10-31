import type { APIRoute } from "astro";
import { createReadStream, existsSync, statSync } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";
import { AUTH_COOKIE, isAuthed } from "../../../../lib/auth";
import { getFlashGame } from "../../../../lib/flash-games";

export const prerender = false;

/**
 * Flash 游戏 SWF 托管（动态路由）：/games/<id>/swf/main.swf（+ sub/*.swf 相对加载、preview.png 卡片预览图）
 * 文件放 data/games/<id>/（已被 /data/ gitignore，不进仓库），游戏必须登记在 flash-games 注册表。
 * 主 SWF 按相对路径拉 sub 场景，catch-all 端点天然支持。
 * 仅登录用户：存档随账号走，游戏内容（与存在性）不对匿名暴露，一律 404。
 */
const MIME: Record<string, string> = {
  ".swf": "application/x-shockwave-flash",
  ".png": "image/png",
  ".mp3": "audio/mpeg",
  ".ttf": "font/ttf", // 设备字体（fontSources 注册用，如 maisa 的对话字体）
};

export const GET: APIRoute = async ({ params, cookies }) => {
  if (!isAuthed(cookies.get(AUTH_COOKIE)?.value)) {
    return new Response(null, { status: 404 });
  }
  const game = getFlashGame(params.id);
  if (!game) return new Response(null, { status: 404 });

  const rel = params.file;
  if (!rel) return new Response(null, { status: 404 });

  const mime = MIME[path.extname(rel).toLowerCase()];
  if (!mime) return new Response(null, { status: 404 });

  // 游戏数据根：默认在项目树外（与项目平级的 blog2-gamedata），可用环境变量覆盖
  const GAMES_ROOT = path.resolve(process.env.GAME_DATA_ROOT || path.join("..", "blog2-gamedata", "games"));
  const GAME_ROOT = path.join(GAMES_ROOT, game.id);
  const full = path.resolve(GAME_ROOT, rel);
  if (!full.startsWith(GAME_ROOT + path.sep)) return new Response(null, { status: 404 });
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
