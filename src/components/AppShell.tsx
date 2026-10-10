import { useState, type ReactNode } from "react";
import TopNav from "./TopNav";
import ProfileCard from "./ProfileCard";
import NewsPanel from "./NewsPanel";

interface AppShellProps {
  children: ReactNode;
  /** 服务端读 cookie 得出的登录态，避免客户端再发 /api/auth/me，也消除「登录」按钮闪烁 */
  authed: boolean;
  userName?: string;
}

const PAD = "px-4 sm:px-5 md:px-6 xl:px-8";

export default function AppShell({ children, authed, userName }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    // ≥xl 时锁定为满屏应用式布局：左栏（个人卡片+资讯）与右栏（页面内容）
    // 各自独立滚动，互不牵连；<xl 仍走普通文档流整页滚动
    <div className="min-h-screen flex flex-col xl:h-screen xl:overflow-hidden">
      <TopNav onToggleSidebar={() => setSidebarOpen((v) => !v)} sidebarOpen={sidebarOpen} authed={authed} userName={userName} />

      {/* ── Body ── */}
      <div className={`flex-1 w-full max-w-[var(--spacing-container)] mx-auto ${PAD} py-6 lg:py-8 xl:min-h-0 xl:overflow-hidden`}>
        <div className="flex flex-col xl:flex-row xl:h-full xl:min-h-0 gap-6 xl:gap-8">

          {/* Desktop: inline ProfileCard (≥1280px)，整列自带纵向滚动，隐藏滚动条 */}
          <aside className="hidden xl:block xl:w-60 xl:flex-shrink-0 xl:h-full xl:min-h-0 xl:overflow-y-auto xl:overscroll-contain scrollbar-none">
            <div className="space-y-5">
              <ProfileCard authed={authed} />
              <NewsPanel />
            </div>
          </aside>

          {/* Content：独立滚动列，滚动事件不再走 window（ReadingProgress 已适配），隐藏滚动条 */}
          <div className="flex-1 min-w-0 xl:h-full xl:min-h-0 xl:overflow-y-auto xl:overscroll-contain scrollbar-none">
            {children}
          </div>
        </div>
      </div>

      {/* ── Mobile sidebar overlay (<1280px) ── */}
      {sidebarOpen && (
        <div className="xl:hidden fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-[var(--color-surface)] border-r border-[var(--color-border)] overflow-y-auto shadow-2xl scrollbar-none animate-[slide-in-left_0.25s_ease-out]">
            {/* z-10 必须要有：卡片内的 relative/动画元素会在 DOM 后序绘制，
                没 z-index 时滚动内容会盖住这根吸顶栏的半透明底，只剩一条边框线 */}
            <div className="sticky top-0 z-10 flex justify-end p-3 bg-[var(--color-surface)]/80 backdrop-blur-xl border-b border-[var(--color-border)]">
              <button
                onClick={() => setSidebarOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--color-text-subtle)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <ProfileCard authed={authed} />
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
