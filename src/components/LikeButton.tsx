import { useState, useCallback, useEffect } from "react";

interface LikeButtonProps {
  postId: number;
  initialCount: number;
}

export default function LikeButton({ postId, initialCount }: LikeButtonProps) {
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [animating, setAnimating] = useState(false);

  // 已点赞状态落到 localStorage：刷新/再次访问不会「已点赞」变回未点，
  // 防止无意识重复点赞把计数刷虚高（服务端本身没有按用户去重）
  useEffect(() => {
    try {
      if (localStorage.getItem(`liked:${postId}`) === "1") setLiked(true);
    } catch {
      // 隐私模式等拿不到 localStorage 就退回无记忆行为
    }
  }, [postId]);

  const handleLike = useCallback(async () => {
    if (liked || loading) return;
    setLoading(true);
    setAnimating(true);
    setTimeout(() => setAnimating(false), 600);
    try {
      const res = await fetch("/api/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });
      if (res.ok) {
        const data = await res.json();
        setCount(data.count);
        setLiked(true);
        try {
          localStorage.setItem(`liked:${postId}`, "1");
        } catch {
          // ignore
        }
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [postId, liked, loading]);

  return (
    <button
      onClick={handleLike}
      disabled={liked || loading}
      className={`group inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ease-out ${
        liked
          ? "bg-[var(--color-accent-muted)] text-[var(--color-accent)] cursor-default"
          : "bg-[var(--color-bg)] text-[var(--color-text-muted)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/30 hover:text-[var(--color-accent)] cursor-pointer active:scale-[0.97]"
      }`}
      title={liked ? "已点赞" : "点赞"}
    >
      {/* Heart icon */}
      <svg
        className={`w-[18px] h-[18px] transition-all duration-300 ${
          liked ? "scale-110" : "group-hover:scale-110"
        } ${animating ? "animate-bounce" : ""}`}
        fill={liked ? "var(--color-accent)" : "none"}
        stroke={liked ? "var(--color-accent)" : "currentColor"}
        strokeWidth={1.8}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
        />
      </svg>

      <span className={`tabular-nums transition-all duration-300 ${liked ? "font-semibold" : ""}`}>
        {count}
      </span>
    </button>
  );
}
