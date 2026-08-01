import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface NewsItem {
  title: string;
  summary: string;
  link: string;
  date: string;
}

interface NewsCategory {
  id: string;
  name: string;
  items: NewsItem[];
}

const TABS = [
  { id: "international", label: "国际" },
  { id: "tech", label: "科技" },
  { id: "games", label: "游戏" },
];

function formatDate(raw: string): string {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

function Skeleton() {
  return (
    <div className="space-y-3 p-4 pt-2">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="space-y-1.5">
          <div className="skeleton h-3 w-full" />
          <div className="skeleton h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export default function NewsPanel() {
  const [active, setActive] = useState("international");
  const [data, setData] = useState<Record<string, NewsCategory>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState<NewsItem | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    fetch("/api/news")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: NewsCategory[]) => {
        const map: Record<string, NewsCategory> = {};
        d.forEach((c) => (map[c.id] = c));
        setData(map);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const category = data[active];
  const items = category?.items || [];

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" />
          <h2 className="text-sm font-bold tracking-[-0.01em] text-[var(--color-text)]">最新资讯</h2>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="w-6 h-6 flex items-center justify-center rounded-md text-[var(--color-text-subtle)] hover:text-[var(--color-accent)] hover:bg-[var(--color-bg)] transition-all disabled:opacity-40"
          title="刷新"
          aria-label="刷新资讯"
        >
          <svg
            className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex px-4 gap-4 border-b border-[var(--color-border)]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`relative pb-2 text-xs font-semibold tracking-wide transition-colors ${
              active === tab.id ? "text-[var(--color-accent)]" : "text-[var(--color-text-subtle)] hover:text-[var(--color-text)]"
            }`}
          >
            {tab.label}
            {active === tab.id && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[var(--color-accent)]" />
            )}
          </button>
        ))}
      </div>

      {/* Body */}
      {loading ? (
        <Skeleton />
      ) : error ? (
        <div className="p-6 text-center">
          <p className="text-xs text-[var(--color-text-subtle)] mb-3">资讯加载失败</p>
          <button
            onClick={load}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-hover)] transition-all"
          >
            重试
          </button>
        </div>
      ) : items.length === 0 ? (
        <p className="p-6 text-center text-xs text-[var(--color-text-subtle)] font-serif">暂无资讯</p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {items.map((item, i) => (
            <li key={`${active}-${i}`} className="group animate-[fade-in_0.4s_ease-out_both]" style={{ animationDelay: `${i * 0.05}s` }}>
              <a
                href={item.link || undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-4 py-3 hover:bg-[var(--color-bg)] transition-colors duration-200 cursor-pointer"
                onClick={(e) => {
                  if (!item.link) return;
                  e.preventDefault();
                  setPending(item);
                }}
              >
                <div className="space-y-1">
                  <p className="text-xs font-medium leading-snug text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors line-clamp-2">
                    {item.title}
                  </p>
                  {formatDate(item.date) && (
                    <time className="block text-right text-[10px] text-[var(--color-text-subtle)]/70">
                      {formatDate(item.date)}
                    </time>
                  )}
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}

      {/* Source footer */}
      {!loading && !error && category?.source && (
        <div className="px-4 py-2.5 border-t border-[var(--color-border)] flex items-center gap-1.5">
          <svg className="w-3 h-3 text-[var(--color-text-subtle)]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5A2.25 2.25 0 0018 18" />
          </svg>
          <span className="text-[10px] text-[var(--color-text-subtle)]">来源：{category.source}</span>
        </div>
      )}

      {/* Jump confirm modal */}
      {pending && createPortal(<JumpConfirm item={pending} onClose={() => setPending(null)} />, document.body)}
    </div>
  );
}

function JumpConfirm({ item, onClose }: { item: NewsItem; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const confirm = () => {
    window.open(item.link, "_blank", "noopener,noreferrer");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-sm bg-[var(--color-surface)] rounded-2xl shadow-2xl shadow-black/10 overflow-hidden"
        style={{ animation: "scale-in 0.15s ease-out" }}
      >
        <div className="h-1 bg-[var(--color-accent)]" />

        <div className="px-5 pt-5 pb-4">
          <div className="w-10 h-10 rounded-full bg-[var(--color-accent-muted)] text-[var(--color-accent)] flex items-center justify-center mb-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
            </svg>
          </div>

          <h3 className="text-base font-bold text-[var(--color-text)] tracking-[-0.01em] mb-1">即将跳转外部网站</h3>
          <p className="text-xs text-[var(--color-text-muted)] leading-relaxed mb-3">{item.title}</p>

          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 mb-1">
            <p className="text-[10px] text-[var(--color-text-subtle)] mb-0.5">目标网址</p>
            <p className="text-xs text-[var(--color-text)] break-all leading-relaxed">{item.link}</p>
          </div>
        </div>

        <div className="flex border-t border-[var(--color-border)]">
          <button
            onClick={onClose}
            className="flex-1 py-3 text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] transition-colors border-r border-[var(--color-border)]"
          >
            取消
          </button>
          <button
            onClick={confirm}
            className="flex-1 py-3 text-sm font-semibold text-[var(--color-accent)] hover:bg-[var(--color-accent-muted)] transition-colors"
          >
            确认跳转
          </button>
        </div>
      </div>
    </div>
  );
}
