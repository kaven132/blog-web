import { useEffect, useState } from "react";

interface Heading {
  level: number;
  text: string;
  id: string;
}

/**
 * 文章目录（详情页右栏，xl 起显示）。
 * 高亮：捕获阶段监听 scroll（AppShell 在 xl 下是内容列独立滚动，
 * scroll 事件不冒泡，必须捕获才能收到），取视口 110px 以上最后一个标题。
 */
export default function TocNav({ headings }: { headings: Heading[] }) {
  const [active, setActive] = useState(headings[0]?.id ?? "");

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
    <nav
      aria-label="文章目录"
      className="hidden xl:block fixed top-24 right-6 w-60 max-h-[calc(100vh-8rem)] overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/80 backdrop-blur-xl p-4"
    >
      <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[var(--color-text-subtle)] mb-2.5">目录</p>
      <ul className="space-y-0.5 border-l border-[var(--color-border)]">
        {headings.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              className={`block py-1 leading-snug transition-colors -ml-px border-l-2 ${
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
  );
}
