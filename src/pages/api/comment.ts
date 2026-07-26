import type { APIRoute } from "astro";
import { db } from "../../db";
import { comments } from "../../db/schema";

export const POST: APIRoute = async ({ request, redirect }) => {
  try {
    const formData = await request.formData();
    const postId = formData.get("postId");
    const slug = formData.get("slug");
    const author = formData.get("author")?.toString().trim() || "匿名";
    const content = formData.get("content")?.toString().trim();

    if (!postId || !content || !slug) {
      return new Response("缺少必要参数", { status: 400 });
    }

    if (content.length > 500) {
      return new Response("评论内容不能超过500字", { status: 400 });
    }

    db.insert(comments).values({
      postId: Number(postId),
      author: author || "匿名",
      content,
    }).run();

    return redirect(`/posts/${slug}#comments`, 302);
  } catch {
    return new Response("服务器错误", { status: 500 });
  }
};
