import { useState, useEffect, useRef } from "react";
import LoginModal from "./LoginModal";
import ConfirmDialog from "./ConfirmDialog";

const navLinks = [
  { href: "/", label: "首页" },
  { href: "/posts", label: "文章" },
  { href: "/travel", label: "旅行地图" },
  { href: "/games", label: "小游戏" },
  { href: "/about", label: "关于" },
];

interface TopNavProps {
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  /** 服务端下发的登录态与用户名（Layout.astro 读 cookie + 查库），不再客户端请求 */
  authed: boolean;
  userName?: string;
  /** 用户头像（/uploads/xxx 或 dataURL），空则回退首字母圆标 */
  userAvatar?: string;
}

export default function TopNav({ onToggleSidebar, sidebarOpen, authed, userName = "kaven", userAvatar = "" }: TopNavProps) {
  const [loggedIn, setLoggedIn] = useState(authed);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const paletteRef = useRef<HTMLDivElement>(null);
  const [themeColor, setThemeColor] = useState("coral");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 主题色初值（挂载后读，避免 SSR 不一致）
  useEffect(() => {
    try {
      const c = localStorage.getItem("theme-color");
      if (c) setThemeColor(c);
    } catch { /* ignore */ }
  }, []);

  // 点外部收起调色弹层
  useEffect(() => {
    if (!paletteOpen) return;
    const onDown = (e: MouseEvent) => {
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) setPaletteOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [paletteOpen]);

  const applyThemeColor = (c: string) => {
    setThemeColor(c);
    if (c === "coral") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = c;
    try { localStorage.setItem("theme-color", c); } catch { /* ignore */ }
  };

  const palette = [
    { id: "coral", name: "珊瑚", css: "#d94040" },
    { id: "teal", name: "青碧", css: "#0e8f96" },
    { id: "violet", name: "黛紫", css: "#8b5bd6" },
    { id: "amber", name: "琥珀", css: "#d69a2d" },
    { id: "rose", name: "玫红", css: "#d64f6e" },
  ];

  useEffect(() => {
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

            {/* 深色模式切换：图标由 .dark class 驱动自动换形，选择存 localStorage */}
            <button
              onClick={() => {
                const dark = document.documentElement.classList.toggle("dark");
                try {
                  localStorage.setItem("theme", dark ? "dark" : "light");
                } catch {
                  /* ignore */
                }
              }}
              aria-label="切换深色模式"
              title="切换深色模式"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--color-text-subtle)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-all"
            >
              <svg className="w-4 h-4 dark:hidden" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12h2.25m-.386-6.364L7.859 7.859M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
              <svg className="w-4 h-4 hidden dark:block" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
              </svg>
            </button>

            {/* 主题色切换：调色弹层 */}
            <div className="relative" ref={paletteRef}>
              <button
                onClick={() => setPaletteOpen((v) => !v)}
                aria-label="切换主题色"
                title="切换主题色"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--color-text-subtle)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 1 9-9c0 1.657-1.343 3-3 3h-1.5a1.875 1.875 0 0 0-1.4 3.125 1.874 1.874 0 0 1-1.4 3.125A9 9 0 0 1 12 21Zm-4.5-11a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Zm4-1.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Zm4 1.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z" />
                </svg>
              </button>
              {paletteOpen && (
                <div className="absolute right-0 top-full mt-2 z-40 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-lg p-3 w-[168px]">
                  <p className="text-[10px] font-semibold tracking-widest uppercase text-[var(--color-text-subtle)] mb-2">主题色</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {palette.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => applyThemeColor(c.id)}
                        title={c.name}
                        aria-label={`主题色：${c.name}`}
                        className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-transform hover:scale-110 ${themeColor === c.id ? "border-[var(--color-text)] scale-110" : "border-transparent"}`}
                        style={{ background: c.css }}
                      >
                        {themeColor === c.id && (
                          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-[var(--color-text-subtle)] mt-2">
                    {palette.find((c) => c.id === themeColor)?.name ?? "珊瑚"}主题
                  </p>
                </div>
              )}
            </div>

            {loggedIn ? (
              <div className="flex items-center gap-2">
                <a href="/admin" className="px-3 py-1.5 text-sm font-medium rounded-lg bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors">
                  文章管理
                </a>
                <div className="relative" ref={dropdownRef}>
                  {/* 头像按钮：点击弹下拉（账户设置 / 退出登录）；有头像显示头像，无则回退首字母 */}
                  <button
                    onClick={() => setDropdownOpen((v) => !v)}
                    className="w-8 h-8 rounded-full overflow-hidden bg-[var(--color-accent-muted)] text-[var(--color-accent)] flex items-center justify-center text-sm font-bold ring-2 ring-transparent hover:ring-[var(--color-accent)]/30 transition-all"
                    title="账户菜单"
                  >
                    {userAvatar ? (
                      <img src={userAvatar} alt="头像" className="w-full h-full object-cover" />
                    ) : (
                      initial
                    )}
                  </button>
                  {dropdownOpen && (
                    <div className="absolute right-0 top-full mt-2 w-44 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-lg overflow-hidden animate-[scale-in_0.15s_ease-out]">
                      <div className="px-4 py-3 border-b border-[var(--color-border)]">
                        <p className="text-sm font-semibold text-[var(--color-text)]">{userName}</p>
                        <p className="text-[11px] text-[var(--color-text-subtle)] mt-0.5">管理员</p>
                      </div>
                      <a
                        href="/account"
                        onClick={() => setDropdownOpen(false)}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors text-left"
                      >
                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        账户设置
                      </a>
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
