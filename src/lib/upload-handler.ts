import type { APIRoute } from "astro";
import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { AUTH_COOKIE, isAuthed } from "./auth";

const ALLOWED: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

export const MB = 1024 * 1024;

/**
 * 上传接口工厂：各路由以不同大小上限实例化，上限由路由决定（服务端静态可查）：
 *   /api/upload       → 5MB（头像、文章插图）
 *   /api/upload/photo → 10MB（相册照片，高清原图）
 */
export function createUploadHandler(maxSize: number): APIRoute {
  const maxMB = Math.round(maxSize / MB);
  return async ({ request, cookies }) => {
    if (!isAuthed(cookies.get(AUTH_COOKIE)?.value)) {
      return new Response(JSON.stringify({ error: "请先登录" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const form = await request.formData();
      const file = form.get("file");

      if (!file || typeof file === "string" || file.size === undefined) {
        return new Response(JSON.stringify({ error: "请选择图片文件" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const ext = ALLOWED[file.type as string];
      if (!ext) {
        return new Response(JSON.stringify({ error: "仅支持 PNG / JPG / WebP / GIF / AVIF 图片" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (file.size > maxSize) {
        return new Response(JSON.stringify({ error: `图片不能超过 ${maxMB}MB` }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const name = `${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
      const dir = "./data/uploads";
      mkdirSync(dir, { recursive: true });
      writeFileSync(`${dir}/${name}`, Buffer.from(await file.arrayBuffer()));

      return new Response(JSON.stringify({ url: `/uploads/${name}` }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      return new Response(JSON.stringify({ error: "上传失败" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  };
}
