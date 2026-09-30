import type { APIRoute } from "astro";
import { db } from "../../db";
import { comments, posts } from "../../db/schema";
import { eq } from "drizzle-orm";

export const POST: APIRoute = async ({ request, redirect }) => {
  try {
    const formData = await request.formData();
    const postIdRaw = formData.get("postId");
    const authorRaw = formData.get("author")?.toString().trim() || "匿名";
    const content = formData.get("content")?.toString().trim();

    const postId = Number(postIdRaw);
    if (!Number.isInteger(postId) || postId <= 0 || !content) {
      return new Response("缺少必要参数", { status: 400 });
    }

    if (content.length > 500) {
      return new Response("评论内容不能超过500字", { status: 400 });
    }

    // 文章必须存在：外键约束会让无效 postId 变成 500，这里提前拦成 404。
    // 跳转用库里真实的 slug，不信任客户端传值。
    const post = db.select({ id: posts.id, slug: posts.slug }).from(posts).where(eq(posts.id, postId)).get();
    if (!post) {
      return new Response("文章不存在", { status: 404 });
    }

    // 昵称服务端再截一次（前端 maxlength 可绕过）
    const author = authorRaw.slice(0, 20) || "匿名";

    db.insert(comments).values({
      postId: post.id,
      author,
      content,
    }).run();

    // Location 头不允许非 ASCII，中文 slug 必须 percent-encode（旧实现遇中文 slug 评论会 500）
    return redirect(`/posts/${encodeURIComponent(post.slug)}#comments`, 302);
  } catch (err) {
    console.error("[comment] 插入或重定向失败:", err);
    return new Response("服务器错误", { status: 500 });
  }};
