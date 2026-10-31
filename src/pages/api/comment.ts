import type { APIRoute } from "astro";
import { db } from "../../db";
import { comments, posts, galleries, galleryComments, videos, videoComments } from "../../db/schema";
import { eq } from "drizzle-orm";
import { AUTH_COOKIE, isAuthed } from "../../lib/auth";

export const POST: APIRoute = async ({ request, redirect }) => {
  try {
    const formData = await request.formData();

    // ── 视频评论分支：videoId 存在时走 video_comments（结构与相册分支完全同构） ──
    const videoIdRaw = formData.get("videoId");
    if (videoIdRaw) {
      const videoId = Number(videoIdRaw);
      const authorRaw = formData.get("author")?.toString().trim() || "匿名";
      const content = formData.get("content")?.toString().trim();
      if (!Number.isInteger(videoId) || videoId <= 0 || !content) {
        return new Response("缺少必要参数", { status: 400 });
      }
      if (content.length > 500) {
        return new Response("评论内容不能超过500字", { status: 400 });
      }
      const video = db.select({ id: videos.id }).from(videos).where(eq(videos.id, videoId)).get();
      if (!video) {
        return new Response("视频不存在", { status: 404 });
      }
      const author = authorRaw.slice(0, 20) || "匿名";
      const parentIdRaw = formData.get("parentId");
      let parentId: number | null = null;
      if (parentIdRaw) {
        const pid = Number(parentIdRaw);
        const parent = Number.isInteger(pid)
          ? db.select().from(videoComments).where(eq(videoComments.id, pid)).get()
          : undefined;
        if (!parent || parent.videoId !== videoId || parent.parentId !== null) {
          return new Response("回复目标无效", { status: 400 });
        }
        parentId = pid;
      }
      db.insert(videoComments).values({ videoId, parentId, author, content }).run();
      return redirect(`/videos/${videoId}#comments`, 302);
    }

    // ── 相册评论分支：galleryId 存在时走 gallery_comments ──
    const galleryIdRaw = formData.get("galleryId");
    if (galleryIdRaw) {
      const galleryId = Number(galleryIdRaw);
      const authorRaw = formData.get("author")?.toString().trim() || "匿名";
      const content = formData.get("content")?.toString().trim();
      if (!Number.isInteger(galleryId) || galleryId <= 0 || !content) {
        return new Response("缺少必要参数", { status: 400 });
      }
      if (content.length > 500) {
        return new Response("评论内容不能超过500字", { status: 400 });
      }
      const gallery = db.select({ id: galleries.id }).from(galleries).where(eq(galleries.id, galleryId)).get();
      if (!gallery) {
        return new Response("相册不存在", { status: 404 });
      }
      const author = authorRaw.slice(0, 20) || "匿名";
      const parentIdRaw = formData.get("parentId");
      let parentId: number | null = null;
      if (parentIdRaw) {
        const pid = Number(parentIdRaw);
        const parent = Number.isInteger(pid)
          ? db.select().from(galleryComments).where(eq(galleryComments.id, pid)).get()
          : undefined;
        if (!parent || parent.galleryId !== galleryId || parent.parentId !== null) {
          return new Response("回复目标无效", { status: 400 });
        }
        parentId = pid;
      }
      db.insert(galleryComments).values({ galleryId, parentId, author, content }).run();
      return redirect(`/gallery/${galleryId}#comments`, 302);
    }

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

    // 回复目标（可选）：必须存在、属于同一篇、且本身是顶层评论（只做一层盖楼）
    const parentIdRaw = formData.get("parentId");
    let parentId: number | null = null;
    if (parentIdRaw) {
      const pid = Number(parentIdRaw);
      const parent = Number.isInteger(pid)
        ? db.select().from(comments).where(eq(comments.id, pid)).get()
        : undefined;
      if (!parent || parent.postId !== post.id || parent.parentId !== null) {
        return new Response("回复目标无效", { status: 400 });
      }
      parentId = pid;
    }

    db.insert(comments).values({
      postId: post.id,
      parentId,
      author,
      content,
    }).run();

    // Location 头不允许非 ASCII，中文 slug 必须 percent-encode（旧实现遇中文 slug 评论会 500）
    return redirect(`/posts/${encodeURIComponent(post.slug)}#comments`, 302);
  } catch (err) {
    console.error("[comment] 插入或重定向失败:", err);
    return new Response("服务器错误", { status: 500 });
  }
};

/** DELETE /api/comment?id= —— 删除评论（需登录）；顶层评论连带删除其下回复 */
export const DELETE: APIRoute = async ({ url, cookies }) => {
  if (!isAuthed(cookies.get(AUTH_COOKIE)?.value)) {
    return new Response(JSON.stringify({ error: "请先登录" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const id = Number(url.searchParams.get("id"));
  if (!id) {
    return new Response(JSON.stringify({ error: "无效的请求" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // target=gallery：删相册评论（连带其下回复）；缺省删文章评论
  const isGalleryTarget = url.searchParams.get("target") === "gallery";

  const deleted = isGalleryTarget
    ? db.delete(galleryComments).where(eq(galleryComments.id, id)).run()
    : db.delete(comments).where(eq(comments.id, id)).run();
  if (deleted.changes === 0) {
    return new Response(JSON.stringify({ error: "评论不存在" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  // 级联删除挂在该评论下的回复（仅一层盖楼）
  if (isGalleryTarget) {
    db.delete(galleryComments).where(eq(galleryComments.parentId, id)).run();
  } else {
    db.delete(comments).where(eq(comments.parentId, id)).run();
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
};
