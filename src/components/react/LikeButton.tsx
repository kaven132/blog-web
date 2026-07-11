/**
 * LikeButton.tsx — Heart like button with optimistic update (React Island)
 * client:load — needed immediately for article detail page
 *
 * Props:
 * - articleId: string
 * - initialCount: number (SSR pre-rendered count)
 * - initialLiked: boolean (SSR pre-rendered state)
 *
 * Uses localStorage userToken for anonymous like tracking.
 */

import { useState, useCallback } from "react";
import { useToast } from "./Toast";

interface Props {
  articleId: string;
  initialCount: number;
  initialLiked: boolean;
}

export default function LikeButton({ articleId, initialCount, initialLiked }: Props) {
  const [count, setCount] = useState(initialCount);
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [animating, setAnimating] = useState(false);
  const { showToast } = useToast();

  // Get or create user token for anonymous like tracking
  const getUserToken = (): string => {
    let token = localStorage.getItem("blog_user_token");
    if (!token) {
      token = "user_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
      localStorage.setItem("blog_user_token", token);
    }
    return token;
  };

  const handleClick = useCallback(async () => {
    const userToken = getUserToken();

    if (isLiked) {
      // Optimistic unlike
      setCount((c) => Math.max(0, c - 1));
      setIsLiked(false);

      try {
        const res = await fetch(`/api/articles/${articleId}/likes`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userToken }),
        });
        if (!res.ok) {
          // Rollback
          setCount((c) => c + 1);
          setIsLiked(true);
          const data = await res.json();
          showToast(data.error || "取消点赞失败", "error");
        }
      } catch {
        setCount((c) => c + 1);
        setIsLiked(true);
        showToast("网络错误，请重试", "error");
      }
    } else {
      // Optimistic like
      setCount((c) => c + 1);
      setIsLiked(true);
      setAnimating(true);
      setTimeout(() => setAnimating(false), 400);

      try {
        const res = await fetch(`/api/articles/${articleId}/likes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userToken }),
        });
        if (!res.ok) {
          // Rollback
          setCount((c) => Math.max(0, c - 1));
          setIsLiked(false);
          const data = await res.json();
          if (res.status !== 409) {
            showToast(data.error || "点赞失败", "error");
          }
        }
      } catch {
        setCount((c) => Math.max(0, c - 1));
        setIsLiked(false);
        showToast("网络错误，请重试", "error");
      }
    }
  }, [articleId, isLiked, showToast]);

  return (
    <button
      className={`engage-btn like-btn ${isLiked ? "liked" : ""} ${animating ? "animate-pop" : ""}`}
      onClick={handleClick}
      title={isLiked ? "取消点赞" : "点赞"}
    >
      <i className={`${isLiked ? "fa-solid" : "fa-regular"} fa-heart`}></i>
      <span>{count}</span>
    </button>
  );
}
