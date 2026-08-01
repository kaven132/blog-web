import type { APIRoute } from "astro";
import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const ALLOWED: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

const MAX_SIZE = 5 * 1024 * 1024;

export const POST: APIRoute = async ({ request, cookies }) => {
  const authed = cookies.get("auth")?.value === "true";
  if (!authed) {
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
    if (file.size > MAX_SIZE) {
      return new Response(JSON.stringify({ error: "图片不能超过 5MB" }), {
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
