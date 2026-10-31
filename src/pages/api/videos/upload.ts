import type { APIRoute } from "astro";
import { mkdirSync, appendFileSync, rmSync, statSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { AUTH_COOKIE, isAuthed } from "../../../lib/auth";

export const prerender = false;

/**
 * 视频上传（仅登录）：request.body 逐块追加写盘——内存占用恒定，500MB 也稳。
 * 大小护栏按 Content-Length 预判（超限直接 413 不收流）；落盘文件名 = 时间戳-随机.ext。
 * 返回 /media/<文件名>，由 /media 路由（带 Range 与隐私门禁）伺服播放。
 */
const MAX_BYTES = 500 * 1024 * 1024;
const EXT_BY_MIME: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAuthed(cookies.get(AUTH_COOKIE)?.value)) {
    return new Response(JSON.stringify({ error: "请先登录" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  const mime = (request.headers.get("content-type") || "").split(";")[0].trim();
  const ext = EXT_BY_MIME[mime];
  if (!ext) {
    return new Response(JSON.stringify({ error: "仅支持 MP4 / WebM / MOV 视频" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  const len = Number(request.headers.get("content-length") || 0);
  if (!len) {
    return new Response(JSON.stringify({ error: "缺少文件内容" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  if (len > MAX_BYTES) {
    return new Response(JSON.stringify({ error: "视频不能超过 500MB" }), { status: 413, headers: { "Content-Type": "application/json" } });
  }

  const name = `${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
  // basename 白名单断言：服务端生成的文件名必须是「13 位时间戳-8 位十六进制.受控扩展名」，
  // 正则保证 name 不含任何路径分隔符与 ..，拼接出的写盘路径恒在 data/videos 内
  if (!/^[0-9]{13}-[0-9a-f]{8}\.(mp4|webm|mov)$/.test(name)) {
    return new Response(JSON.stringify({ error: "上传失败" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  const dir = "./data/videos";
  mkdirSync(dir, { recursive: true });
  const full = `./data/videos/${name}`;

  // 逐块追加写入：与流式等价（内存恒定）；失败即删除半成品
  try {
    for await (const chunk of Readable.fromWeb(request.body as import("node:stream/web").ReadableStream)) {
      appendFileSync(full, chunk);
    }
  } catch {
    rmSync(full, { force: true });
    return new Response(JSON.stringify({ error: "上传失败" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ url: `/media/${name}`, size: statSync(full).size }), { headers: { "Content-Type": "application/json" } });
};
