import { useState } from "react";

/**
 * 移动端底部标签栏（<xl 显示，≥xl 隐藏）：
 * 按手机操作逻辑单独适配 —— 五个主导航固定底部，拇指可达；
 * 当前路由高亮；预留 iOS 安全区内边距。
 */

const TABS = [
  {
    href: "/",
    label: "首页",
    // 实心小房子
    icon: "M11.47 3.841a.75.75 0 0 1 1.06 0l8.69 8.69a.75.75 0 1 0 1.06-1.061l-8.689-8.69a2.25 2.25 0 0 0-3.182 0l-8.69 8.69a.75.75 0 1 0 1.061 1.06l8.69-8.689Z",
    extra: "m12 5.432 8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 0 1-.75-.75v-4.5a.75.75 0 0 0-.75-.75h-3a.75.75 0 0 0-.75.75V21c0 .414-.336.75-.75.75H5.625A1.875 1.875 0 0 1 3.75 19.875v-6.198c.03-.028.061-.056.091-.086Z",
  },
  {
    href: "/posts",
    label: "文章",
    // 报纸
    icon: "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5",
    extra: "M12 12.75a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3ZM7.5 15.75h.008v.008H7.5v-.008Zm3 0h.008v.008h-.008v-.008Zm3 0h.008v.008h-.008v-.008Z",
  },
  {
    href: "/travel",
    label: "旅行",
    // 地图折页 + 定位针
    icon: "M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
    extra: "M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z",
  },
  {
    href: "/games",
    label: "游戏",
    // 游戏手柄
    icon: "M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 0 1-.657.643 48.39 48.39 0 0 1-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 0 1-.658.66 48.675 48.675 0 0 1-3.158-.084.656.656 0 0 1-.657-.66c0-1.517-.163-3.023-.48-4.51a.65.65 0 0 1-.647.129 48.51 48.51 0 0 0-1.662-.108.64.64 0 0 0-.66.657 48.25 48.25 0 0 0 .117 2.362c.052.706.124 1.41.209 2.111a126.124 126.124 0 0 0 .791 5.87c.098.616.325 1.192.652 1.7.642 1.017 1.531 1.33 2.618 1.33 3.447 0 6.894-.13 10.34-.387q2.286-.17 4.566-.382a48.24 48.24 0 0 0 3.646-.435c.7-.11 1.338-.364 1.91-.752.81-.544 1.2-1.39 1.2-2.336 0-2.328-.335-4.649-.97-6.908a39.98 39.98 0 0 0-1.42-4.267 39.977 39.977 0 0 0-1.774-3.795 1.126 1.126 0 0 0-1.02-.64 48.748 48.748 0 0 0-4.83.245ZM3.75 14.25a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0Zm3.75 1.5a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z",
    extra: "M8.25 8.25a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Zm3.75 2.25a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z",
  },
  {
    href: "/about",
    label: "关于",
    // 信息圆圈
    icon: "M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z",
    extra: "M12 18.75a.75.75 0 0 0 .75-.75v-6a.75.75 0 0 0-1.5 0v6a.75.75 0 0 0 .75.75ZM12 7.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z",
  },
];

export default function TabBar() {
  // 当前路由（含前缀匹配：/posts/xxx 命中「文章」）
  const path = typeof location !== "undefined" ? location.pathname : "/";
  const isActive = (href: string) =>
    href === "/" ? path === "/" : path === href || path.startsWith(href + "/");

  return (
    <nav
      className="xl:hidden fixed bottom-0 inset-x-0 z-[70] bg-[var(--color-surface)]/95 backdrop-blur-xl border-t border-[var(--color-border)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="移动端导航"
    >
      <div className="grid grid-cols-5">
        {TABS.map((t) => {
          const active = isActive(t.href);
          return (
            <a
              key={t.href}
              href={t.href}
              aria-label={t.label}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 py-1.5 transition-colors ${
                active ? "text-[var(--color-accent)]" : "text-[var(--color-text-subtle)] hover:text-[var(--color-text-muted)]"
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d={t.icon} />
                {t.extra && <path strokeLinecap="round" strokeLinejoin="round" d={t.extra} />}
              </svg>
              <span className="text-[10px] leading-none font-medium">{t.label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
