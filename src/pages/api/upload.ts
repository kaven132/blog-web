import type { APIRoute } from "astro";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { requireAuth } from "../../lib/auth";

/**
 * POST /api/upload — Upload an image file (auth required)
 *
 * Uses request.formData() instead of multer (MIGRATION_PLAN Phase 2).
 * - 10MB max file size
 * - Allowed types: PNG, JPG, GIF, WebP, SVG, AVIF
 * - Returns: { url: string, filename: string, size: number }
 * Matches Express response shape exactly.
 */
export const POST: APIRoute = async ({ request }) => {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  // Ensure uploads directory exists
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return new Response(JSON.stringify({ error: "请求格式错误" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const file = formData.get("image") as File | null;

  if (!file || !(file instanceof File)) {
    return new Response(JSON.stringify({ error: "未选择文件" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Validate file type
  const allowedTypes = [
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "image/avif",
  ];
  if (!allowedTypes.includes(file.type)) {
    return new Response(
      JSON.stringify({ error: "仅支持 PNG / JPG / GIF / WebP / SVG / AVIF 格式" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // Validate file size (10MB)
  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return new Response(
      JSON.stringify({ error: "文件大小不能超过 10MB" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // Generate unique filename (matching Express multer pattern)
  const ext = path.extname(file.name) || ".png";
  const filename =
    "img_" +
    Date.now().toString(36) +
    "_" +
    crypto.randomBytes(4).toString("hex") +
    ext;
  const filePath = path.join(uploadsDir, filename);

  // Write file to disk
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(filePath, buffer);

  const url = "/uploads/" + filename;

  return new Response(
    JSON.stringify({ url, filename, size: file.size }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
};
