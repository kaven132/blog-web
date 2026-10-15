import { useCallback, useEffect, useState } from "react";

interface Heading {
  level: number;
  text: string;
  id: string;
}

/**
 * 文章目录（详情页右栏，xl 起显示）。
 * - 每行单行截断省略，行高一致
 * - 可向右收起成悬浮按钮（选择存 localStorage，跨页面保持）
 * - 高亮：捕获阶段监听 scroll（AppShell 在 xl 下是内容列独立滚动，
 *   scroll 事件不冒泡，必须捕获才能收到），取视口 110px 以上最后一个标题
 */
export default function TocNav({ headings }: { headings: Heading[] }) {
  const [collapsed, setCollapsed] = useState(false);
  const [active, setActive] = useState(headings[0]?.id ?? "");

  // 收起状态持久化（挂载后再读，避免 SSR 水合不一致）
  useEffect(() => {
    try {
      if (localStorage.getItem("toc-collapsed") === "1") setCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((v) => {
      try {
        localStorage.setItem("toc-collapsed", v ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !v;
    });
  }, []);

  useEffect(() => {
    const onScroll = () => {
      let current = headings[0]?.id ?? "";
      for (const h of headings) {
        const el = document.getElementById(h.id);
        if (el && el.getBoundingClientRect().top <= 110) current = h.id;
      }
      setActive(current);
    };
    document.addEventListener("scroll", onScroll, true);
    onScroll();
    return () => document.removeEventListener("scroll", onScroll, true);
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <>
      {/* 目录面板（向右滑出收起） */}
      <nav
        aria-label="文章目录"
        className={`hidden xl:block fixed top-24 right-6 w-60 max-h-[calc(100vh-8rem)] overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/80 backdrop-blur-xl p-4 transition-all duration-300 ${
          collapsed
            ? "translate-x-[calc(100%+28px)] opacity-0 pointer-events-none"
            : "translate-x-0 opacity-100"
        }`}
      >
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[var(--color-text-subtle)]">目录</p>
          <button
            type="button"
            onClick={toggle}
            aria-label="收起目录"
            title="收起目录"
            className="w-6 h-6 flex items-center justify-center rounded-md text-[var(--color-text-subtle)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <ul className="space-y-0.5 border-l border-[var(--color-border)]">
          {headings.map((h) => (
            <li key={h.id}>
              <a
                href={`#${h.id}`}
                title={h.text}
                className={`block truncate py-1 leading-snug transition-colors -ml-px border-l-2 ${
                  h.level === 3 ? "pl-5" : "pl-3"
                } ${
                  active === h.id
                    ? "text-[var(--color-accent)] border-[var(--color-accent)] font-semibold"
                    : "text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-text)] hover:border-[var(--color-border-hover)]"
                }`}
              >
                {h.text}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* 收起后的悬浮展开按钮 */}
      {collapsed && (
        <button
          type="button"
          onClick={toggle}
          aria-label="展开目录"
          title="展开目录"
          className="hidden xl:flex fixed top-24 right-6 w-10 h-10 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/80 backdrop-blur-xl text-[var(--color-text-subtle)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)]/40 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h10M4 18h7" />
          </svg>
        </button>
      )}
    </>
  );
}
