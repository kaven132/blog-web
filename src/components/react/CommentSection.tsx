/**
 * CommentSection.tsx — View/add/delete comments (React Island)
 * client:visible — below the fold, hydrates when visible
 *
 * Props:
 * - articleId: string
 * - initialComments: Comment[] (SSR pre-rendered)
 */

import { useState, useCallback } from "react";
import { useToast } from "./Toast";

interface Comment {
  id: string;
  articleId: string;
  author: string | null;
  content: string;
  createdAt: string;
}

interface Props {
  articleId: string;
  initialComments: Comment[];
}

export default function CommentSection({ articleId, initialComments }: Props) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [author, setAuthor] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = useCallback(async () => {
    if (!content.trim()) {
      showToast("评论内容不能为空", "error");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/articles/${articleId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author: author.trim() || "匿名",
          content: content.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        showToast(data.error || "评论失败", "error");
        return;
      }

      const newComment: Comment = await res.json();
      setComments((prev) => [newComment, ...prev]);
      setAuthor("");
      setContent("");
      showToast("评论发表成功", "success");
    } catch {
      showToast("网络错误，请重试", "error");
    } finally {
      setSubmitting(false);
    }
  }, [articleId, author, content, showToast]);

  const handleDelete = useCallback(
    async (commentId: string) => {
      if (!confirm("确定要删除这条评论吗？")) return;

      // Optimistic delete
      setComments((prev) => prev.filter((c) => c.id !== commentId));

      try {
        const res = await fetch(`/api/comments/${commentId}`, { method: "DELETE" });
        if (!res.ok) {
          // Rollback — but we don't have the old data, so reload
          showToast("删除失败", "error");
          // Refetch
          const refetchRes = await fetch(`/api/articles/${articleId}/comments`);
          if (refetchRes.ok) {
            setComments(await refetchRes.json());
          }
        } else {
          showToast("评论已删除", "success");
        }
      } catch {
        showToast("网络错误", "error");
      }
    },
    [articleId, showToast],
  );

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <section className="comments-section bg-bg-card shadow-default rounded-default border border-border p-6 md:p-8 mt-5">
      <h3 className="comments-title text-lg font-semibold text-text mb-5">
        <i className="fa-regular fa-comments"></i> 评论 ({comments.length})
      </h3>

      {/* Comment form */}
      <div className="comment-form mb-6 pb-6 border-b border-border">
        <input
          type="text"
          placeholder="你的昵称"
          maxLength={30}
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          className="comment-input block w-full px-4 py-2.5 border border-border rounded-default mb-3 text-sm bg-bg focus:outline-none focus:border-primary"
        />
        <div className="comment-input-row flex gap-3">
          <textarea
            placeholder="写下你的想法..."
            rows={3}
            maxLength={500}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                handleSubmit();
              }
            }}
            className="comment-textarea flex-1 px-4 py-2.5 border border-border rounded-default text-sm bg-bg resize-y focus:outline-none focus:border-primary"
          ></textarea>
          <button
            className="btn btn-primary btn-sm self-end"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <i className="fa-solid fa-spinner fa-spin"></i>
            ) : (
              <i className="fa-solid fa-paper-plane"></i>
            )}{" "}
            发表
          </button>
        </div>
      </div>

      {/* Comments list */}
      <div className="comments-list" id="comments-list">
        {comments.length === 0 ? (
          <p className="text-text-muted text-center py-6">暂无评论，来抢沙发吧！</p>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className="comment-item py-4 border-b border-border-light last:border-0 flex justify-between items-start"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-medium text-sm text-text">
                    {comment.author || "匿名"}
                  </span>
                  <time className="text-xs text-text-muted">
                    {formatDate(comment.createdAt)}
                  </time>
                </div>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {comment.content}
                </p>
              </div>
              <button
                className="text-text-muted hover:text-danger transition-colors ml-3 mt-1"
                onClick={() => handleDelete(comment.id)}
                title="删除评论"
              >
                <i className="fa-solid fa-trash-can text-xs"></i>
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
