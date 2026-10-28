import { useEffect, useState } from "react";
import { House, Newspaper, Images, Map, Gamepad2, Info } from "lucide-react";

/**
 * 移动端底部标签栏（<xl 显示）：顶栏导航链接（≥xl 显示）在中等与窄屏收起时的替代导航，
 * 与顶栏链接严格互斥 —— 任何宽度下两套导航恰好出现一套。
 * 图标用 Lucide 线性风格；当前路由高亮；预留 iOS 安全区内边距。
 */

const TABS = [
  { href: "/", label: "首页", Icon: House },
  { href: "/posts", label: "文章", Icon: Newspaper },
  { href: "/gallery", label: "相册", Icon: Images },
  { href: "/travel", label: "旅行", Icon: Map },
  { href: "/games", label: "游戏", Icon: Gamepad2 },
  { href: "/about", label: "关于", Icon: Info },
];

export default function TabBar() {
  // 当前路由（含前缀匹配：/posts/xxx 命中「文章」）。
  // SSR 阶段 location 不存在只能渲染 "/"，mount 后用真实路径纠正 —— 不能直接读
  // location 计算：水合不会可靠地修复这条分支（实测高亮停留在服务端结果）。
  const [path, setPath] = useState("/");
  useEffect(() => {
    const update = () => setPath(location.pathname);
    update();
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  const isActive = (href: string) =>
    href === "/" ? path === "/" : path === href || path.startsWith(href + "/");

  return (
    <nav
      className="xl:hidden fixed bottom-0 inset-x-0 z-[70] bg-[var(--color-surface)]/95 backdrop-blur-xl border-t border-[var(--color-border)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="移动端导航"
    >
      <div className="grid grid-cols-6">
        {TABS.map((t) => {
          const active = isActive(t.href);
          return (
            <a
              key={t.href}
              href={t.href}
              aria-label={t.label}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-1 py-2 transition-colors ${
                active ? "text-[var(--color-accent)]" : "text-[var(--color-text-subtle)] hover:text-[var(--color-text-muted)]"
              }`}
            >
              <t.Icon size={20} strokeWidth={active ? 2.4 : 1.8} aria-hidden="true" />
              <span className="text-[10px] leading-none font-medium">{t.label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
