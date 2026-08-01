import { useState, type ReactNode } from "react";
import TopNav from "./TopNav";
import ProfileCard from "./ProfileCard";
import NewsPanel from "./NewsPanel";

interface AppShellProps {
  children: ReactNode;
}

const PAD = "px-4 sm:px-5 md:px-6 xl:px-8";

export default function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav onToggleSidebar={() => setSidebarOpen((v) => !v)} sidebarOpen={sidebarOpen} />

      {/* ── Body ── */}
      <div className={`flex-1 w-full max-w-[var(--spacing-container)] mx-auto ${PAD} py-6 lg:py-8`}>
        <div className="flex flex-col xl:flex-row gap-6 xl:gap-8">

          {/* Desktop: inline ProfileCard (≥1280px) */}
          <aside className="hidden xl:block xl:w-60 xl:flex-shrink-0">
            <div className="xl:sticky xl:top-20 space-y-5">
              <ProfileCard />
              <NewsPanel />
            </div>
          </aside>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {children}
          </div>
        </div>
      </div>

      {/* ── Mobile sidebar overlay (<1280px) ── */}
      {sidebarOpen && (
        <div className="xl:hidden fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-[var(--color-surface)] border-r border-[var(--color-border)] overflow-y-auto shadow-2xl animate-[slide-in-left_0.25s_ease-out]">
            <div className="sticky top-0 flex justify-end p-3 bg-[var(--color-surface)]/80 backdrop-blur-xl border-b border-[var(--color-border)]">
              <button
                onClick={() => setSidebarOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--color-text-subtle)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <ProfileCard />
            <div className="p-3 pb-4"><NewsPanel /></div>
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <footer className="mt-auto mb-6">
        <div className={`w-full max-w-[var(--spacing-container)] mx-auto ${PAD}`}>
          <div className="border-t border-[var(--color-border)] pt-5 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-[11px] text-[var(--color-text-subtle)] tracking-wide uppercase font-medium">
              &copy; {new Date().getFullYear()} kaven的个人网页
            </p>
            <p className="text-[11px] text-[var(--color-text-subtle)]">
              Astro SSR · React Islands · Tailwind v4 · Drizzle ORM
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
