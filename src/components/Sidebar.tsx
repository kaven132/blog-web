import { useState, useEffect } from "react";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const navLinks = [
  { href: "/", label: "首页", icon: "⌂" },
  { href: "/posts", label: "文章", icon: "☰" },
  { href: "/about", label: "关于", icon: "?" },
];

export default function Sidebar({ open, onClose }: SidebarProps) {
  // Determine current path for active link highlighting
  const [pathname, setPathname] = useState(
    typeof window !== "undefined" ? window.location.pathname : "/"
  );

  useEffect(() => {
    const update = () => setPathname(window.location.pathname);
    document.addEventListener("astro:after-swap", update);
    return () => document.removeEventListener("astro:after-swap", update);
  }, []);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-72 bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 lg:z-30`}
      >
        {/* Profile section */}
        <div className="px-6 pt-10 pb-6 border-b border-[var(--color-border)]">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-2xl bg-[var(--color-accent-muted)] text-[var(--color-accent)] flex items-center justify-center text-2xl font-bold mb-4 ring-1 ring-[var(--color-accent)]/10">
            K
          </div>

          {/* Name & Bio */}
          <h2 className="text-lg font-bold tracking-[-0.01em] text-[var(--color-text)] mb-1">
            Kaven
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed font-serif">
            前端开发者，热爱 Web 技术与开源，在这里记录学习与思考。
          </p>
        </div>

        {/* Navigation */}
        <nav className="px-3 py-5 flex-1">
          <p className="px-3 mb-2 text-[11px] font-semibold tracking-[0.12em] uppercase text-[var(--color-text-subtle)]">
            导航
          </p>
          <div className="space-y-0.5">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                  isActive(link.href)
                    ? "bg-[var(--color-accent-muted)] text-[var(--color-accent)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)]"
                }`}
              >
                <span className="w-5 text-center text-base">{link.icon}</span>
                {link.label}
                {isActive(link.href) && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" />
                )}
              </a>
            ))}
          </div>
        </nav>

        {/* Search */}
        <div className="px-4 pb-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const input = (e.target as HTMLFormElement).querySelector("input");
              if (input?.value.trim()) {
                window.location.href = `/posts?search=${encodeURIComponent(input.value.trim())}`;
              }
            }}
          >
            <input
              type="search"
              placeholder="搜索文章…"
              className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)]/50 focus:outline-none focus:border-[var(--color-accent)] transition-all duration-300"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='%23999' stroke-width='1.5' viewBox='0 0 24 24'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'/%3E%3C/svg%3E\")",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "10px center",
                backgroundSize: "14px",
              }}
            />
          </form>
        </div>

        {/* Footer info */}
        <div className="px-6 pb-8">
          <div className="border-t border-[var(--color-border)] pt-5 space-y-2">
            <p className="text-[11px] text-[var(--color-text-subtle)] font-medium flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-[var(--color-accent)]" />
              Astro SSR + React Islands
            </p>
            <p className="text-[11px] text-[var(--color-text-subtle)] font-medium flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-[var(--color-accent)]" />
              Tailwind CSS v4 + Drizzle ORM
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
