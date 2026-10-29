import type { APIRoute } from "astro";
import { createUploadHandler, MB } from "../../lib/upload-handler";

/** 通用上传（头像、文章插图）：单张 5MB */
export const POST: APIRoute = createUploadHandler(5 * MB);
