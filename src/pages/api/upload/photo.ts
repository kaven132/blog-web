import type { APIRoute } from "astro";
import { createUploadHandler, MB } from "../../../lib/upload-handler";

/** 相册照片上传：高清原图放宽到单张 10MB */
export const POST: APIRoute = createUploadHandler(10 * MB);
