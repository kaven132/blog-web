import { useState, useEffect } from "react";

const navLinks = [
  { href: "/", label: "首页" },
  { href: "/posts", label: "文章" },
  { href: "/about", label: "关于" },
];

export default function TopNav() {
  const [pathname, setPathname] = useState(
    typeof window !== "undefined" ? window.location.pathname : "/"
  );
  const [loggedIn, setLoggedIn] = useState(false);

  const checkAuth = () => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setLoggedIn(d.loggedIn))
      .catch(() => setLoggedIn(false));
  };

  useEffect(() => {
    checkAuth();
    const update = () => setPathname(window.location.pathname);
    document.addEventListener("astro:after-swap", () => {
      update();
      checkAuth();
    });
    return () => document.removeEventListener("astro:after-swap", update);
  }, []);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setLoggedIn(false);
    window.location.href = "/";
  };

  return (
    <header className="sticky top-0 z-50 bg-[var(--color-surface)]/80 backdrop-blur-xl border-b border-[var(--color-border)]">
      <div className="max-w-[var(--spacing-container)] mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        {/* Logo — left */}
        <a
          href="/"
          className="text-base font-bold tracking-tight text-[var(--color-text)] hover:text-[var(--color-accent)] transition-colors flex-shrink-0"
        >
          kaven的个人网页
        </a>

        {/* Nav links + auth button — right */}
        <div className="flex items-center gap-1">
          <nav className="hidden sm:flex items-center gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`relative px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                  isActive(link.href)
                    ? "text-[var(--color-accent)] bg-[var(--color-accent-muted)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)]"
                }`}
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Auth button */}
          {loggedIn ? (
            <div className="flex items-center gap-1">
              <a
                href="/write"
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors"
              >
                写文章
              </a>
              <button
                onClick={handleLogout}
                className="px-2 py-1.5 text-xs text-[var(--color-text-subtle)] hover:text-[var(--color-text)] transition-colors"
                title="退出登录"
              >
                退出
              </button>
            </div>
          ) : (
            <a
              href="/login"
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-hover)] transition-all"
            >
              登录
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
