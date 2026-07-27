import { useState, useEffect, useRef } from "react";
import LoginModal from "./LoginModal";
import ConfirmDialog from "./ConfirmDialog";

const navLinks = [
  { href: "/", label: "首页" },
  { href: "/posts", label: "文章" },
  { href: "/about", label: "关于" },
];

interface TopNavProps {
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
}

export default function TopNav({ onToggleSidebar, sidebarOpen }: TopNavProps) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [userName, setUserName] = useState("kaven");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const checkAuth = () => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        setLoggedIn(d.loggedIn);
        if (d.loggedIn) {
          fetch("/api/profile")
            .then((r) => r.json())
            .then((p) => { if (p?.name) setUserName(p.name); })
            .catch(() => {});
        }
      })
      .catch(() => setLoggedIn(false));
  };

  useEffect(() => {
    checkAuth();
    const onOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("click", onOutsideClick);
    return () => document.removeEventListener("click", onOutsideClick);
  }, []);

  const handleLogout = async () => {
    setLogoutConfirmOpen(false);
    setDropdownOpen(false);
    await fetch("/api/auth/logout", { method: "POST" });
    setLoggedIn(false);
    window.location.href = "/";
  };

  const handleLoginSuccess = () => {
    setLoginOpen(false);
    window.location.reload();
  };

  const initial = userName?.charAt(0)?.toUpperCase() || "K";

  return (
    <>
      <header className="sticky top-0 z-50 bg-[var(--color-surface)]/80 backdrop-blur-xl border-b border-[var(--color-border)]">
        <div className="max-w-[var(--spacing-container)] mx-auto px-4 sm:px-5 md:px-6 xl:px-8 flex items-center justify-between h-14">
          {/* Left */}
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleSidebar}
              className="xl:hidden w-8 h-8 flex items-center justify-center rounded-lg text-[var(--color-text-subtle)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-all"
              aria-label="菜单"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <a href="/" className="text-lg font-bold tracking-tight text-[var(--color-text)] hover:text-[var(--color-accent)] transition-colors flex-shrink-0">
              Kaven的个人网页
            </a>
          </div>

          {/* Right */}
          <div className="flex items-center gap-1">
            <nav className="hidden sm:flex items-center gap-1">
              {navLinks.map((link) => (
                <a key={link.href} href={link.href}
                  className="relative px-3 py-1.5 text-sm font-medium rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-all duration-200"
                >
                  {link.label}
                </a>
              ))}
            </nav>

            {loggedIn ? (
              <div className="flex items-center gap-2">
                <a href="/write" className="px-3 py-1.5 text-sm font-medium rounded-lg bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors">
                  写文章
                </a>
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setDropdownOpen((v) => !v)}
                    className="w-8 h-8 rounded-full bg-[var(--color-accent-muted)] text-[var(--color-accent)] flex items-center justify-center text-sm font-bold hover:ring-2 hover:ring-[var(--color-accent)]/30 transition-all"
                  >
                    {initial}
                  </button>
                  {dropdownOpen && (
                    <div className="absolute right-0 top-full mt-2 w-44 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-lg overflow-hidden animate-[scale-in_0.15s_ease-out]">
                      <div className="px-4 py-3 border-b border-[var(--color-border)]">
                        <p className="text-sm font-semibold text-[var(--color-text)]">{userName}</p>
                        <p className="text-[11px] text-[var(--color-text-subtle)] mt-0.5">管理员</p>
                      </div>
                      <button
                        onClick={() => { setLogoutConfirmOpen(true); setDropdownOpen(false); }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-50 transition-colors text-left"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                        </svg>
                        退出登录
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={() => setLoginOpen(true)}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-hover)] transition-all"
              >
                登录
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Login modal */}
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onSuccess={handleLoginSuccess} />

      {/* Logout confirm */}
      <ConfirmDialog
        open={logoutConfirmOpen}
        title="退出登录"
        message="确定要退出当前账号吗？"
        confirmLabel="退出"
        danger
        onConfirm={handleLogout}
        onCancel={() => setLogoutConfirmOpen(false)}
      />
    </>
  );
}