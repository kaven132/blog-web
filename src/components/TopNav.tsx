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
  // 设置下拉：深色模式 / 主题色 / TTS 听全文（文章页）整合到一处
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const [darkNow, setDarkNow] = useState(false);
  const [hasTTS, setHasTTS] = useState(false);
  const [ttsLabel, setTtsLabel] = useState("听全文");
  const [ttsRate, setTtsRate] = useState("1x");
  const [ttsVoices, setTtsVoices] = useState([]);
  const [ttsVoice, setTtsVoice] = useState("");
  // 阅读偏好：正文字号 / 字体风格 / 护眼模式
  const [fontSize, setFontSize] = useState("normal");
  const [fontStyle, setFontStyle] = useState("serif");
  const [eyeOn, setEyeOn] = useState(false);

  // 主题色初值（挂载后读，避免 SSR 不一致）
  useEffect(() => {
    try {
      const c = localStorage.getItem("theme-color");
      if (c) setThemeColor(c);
      setDarkNow(document.documentElement.classList.contains("dark"));
      // 阅读偏好与音色选择
      const fs = localStorage.getItem("font-size");
      if (fs) setFontSize(fs);
      const f = localStorage.getItem("font-style");
      if (f) setFontStyle(f);
      setEyeOn(localStorage.getItem("eye-comfort") === "on");
      const v = localStorage.getItem("tts-voice");
      if (v) setTtsVoice(v);
    } catch { /* ignore */ }
  }, []);

  // 音色列表：普通话与粤语各保留一女一男，共四个选项。
  // 按音色名推断性别（微软官方中文音色命名规律），每组优先女声在前。
  const LANG_LABEL = { "zh-cn": "普通话", "zh-hk": "粤语" };
  const FEMALE_RE = /xiaoxiao|huihui|yaoyao|hiumaan|hiugaai|hsiaoyu|meijia/i;
  const MALE_RE = /kangkang|yunxi|yunjian|yunyang|wanlung|danny/i;
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const load = () => {
      const groups = {};
      for (const v of window.speechSynthesis.getVoices()) {
        const langKey = v.lang.toLowerCase().replace("_", "-").split("-")[0] === "zh" ? v.lang.toLowerCase().replace("_", "-") : "";
        if (!LANG_LABEL[langKey]) continue;
        (groups[langKey] = groups[langKey] || []).push(v);
      }
      const out = [];
      for (const langKey of Object.keys(LANG_LABEL)) {
        const g = (groups[langKey] || []).slice(0, 4);
        const female = g.find((v) => FEMALE_RE.test(v.name));
        const male = g.find((v) => v !== female && !FEMALE_RE.test(v.name));
        [female && { v: female, gd: "女声" }, male && { v: male, gd: "男声" }]
          .filter(Boolean)
          .forEach(({ v, gd }) => {
            out.push({ uri: v.voiceURI || v.name, label: `${LANG_LABEL[langKey]} · ${gd}` });
          });
      }
      setTtsVoices(out.filter((v, i, arr) => arr.findIndex((x) => x.label === v.label) === i));
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
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

  // 打开设置面板时同步各开关状态（TTS 仅文章页存在）
  useEffect(() => {
    if (!settingsOpen) return;
    const ttsBtn = document.getElementById("tts-btn");
    setHasTTS(Boolean(ttsBtn));
    if (ttsBtn) setTtsLabel(cleanTTSLabel(ttsBtn.textContent) || "听全文");
    const rateBtn = document.getElementById("tts-rate");
    if (rateBtn) setTtsRate(rateBtn.textContent || "1x");
    setDarkNow(document.documentElement.classList.contains("dark"));
  }, [settingsOpen]);

  // 面板打开期间轮询 TTS 状态（朗读/暂停按钮文字实时变化）
  useEffect(() => {
    if (!hasTTS || !settingsOpen) return;
    const id = setInterval(() => {
      const b = document.getElementById("tts-btn");
      if (b) setTtsLabel(cleanTTSLabel(b.textContent) || "听全文");
      const r = document.getElementById("tts-rate");
      if (r) setTtsRate(r.textContent || "1x");
    }, 1000);
    return () => clearInterval(id);
  }, [hasTTS, settingsOpen]);

  const applyThemeColor = (c: string) => {
    setThemeColor(c);
    if (c === "coral") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = c;
    try { localStorage.setItem("theme-color", c); } catch { /* ignore */ }
  };

  // 阅读偏好应用：写 html data 属性（Layout 进页前脚本定档同款）+ localStorage
  const applyFontSize = (v: string) => {
    setFontSize(v);
    if (v === "normal") delete document.documentElement.dataset.fontSize;
    else document.documentElement.dataset.fontSize = v;
    try { localStorage.setItem("font-size", v); } catch { /* ignore */ }
  };
  const applyFontStyle = (v: string) => {
    setFontStyle(v);
    if (v === "serif") delete document.documentElement.dataset.font;
    else document.documentElement.dataset.font = v;
    try { localStorage.setItem("font-style", v); } catch { /* ignore */ }
  };
  const applyEye = (on: boolean) => {
    setEyeOn(on);
    if (on) document.documentElement.dataset.eye = "on";
    else delete document.documentElement.dataset.eye;
    try { localStorage.setItem("eye-comfort", on ? "on" : "off"); } catch { /* ignore */ }
  };
  const applyTtsVoice = (uri: string) => {
    setTtsVoice(uri);
    try { localStorage.setItem("tts-voice", uri); } catch { /* ignore */ }
  };

  // 页面 TTS 按钮文字自带 emoji 图标，同步到面板时清洗掉避免重复
  const cleanTTSLabel = (t: string | null | undefined) => (t || "").replace(/[^A-Za-z0-9\u4e00-\u9fa5 ]/g, "").trim();

  // 从页面 TTS 控件同步面板文案（听全文/暂停、语速）
  const syncTTS = () => {
    const b = document.getElementById("tts-btn");
    if (b) setTtsLabel(cleanTTSLabel(b.textContent) || "听全文");
    const r = document.getElementById("tts-rate");
    if (r) setTtsRate(r.textContent || "1x");
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

            {/* 设置：深色模式 / 主题色 / TTS 听全文（文章页）整合到一个下拉 */}
            <div className="relative" ref={settingsRef}>
              <button
                onClick={() => setSettingsOpen((v) => !v)}
                aria-label="显示设置"
                title="显示设置"
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-[var(--color-text-subtle)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-all ${settingsOpen ? "text-[var(--color-accent)] bg-[var(--color-accent-muted)]" : ""}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.38.137.751.43.992l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
              </button>
              {settingsOpen && (
                <div className="absolute right-0 top-full mt-2 z-40 w-60 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-lg p-3 text-sm">
                  <p className="text-[10px] font-semibold tracking-widest uppercase text-[var(--color-text-subtle)] mb-2">显示设置</p>

                  {hasTTS && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          document.getElementById("tts-btn")?.click();
                          setTimeout(syncTTS, 300);
                        }}
                        className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-[var(--color-bg)] transition-colors text-[var(--color-text)]"
                      >
                        <span>🔊</span>
                        <span className="flex-1 text-left font-medium">{cleanTTSLabel(ttsLabel) || "听全文"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          document.getElementById("tts-rate")?.click();
                          setTimeout(syncTTS, 300);
                        }}
                        className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-[var(--color-bg)] transition-colors text-[var(--color-text-muted)]"
                      >
                        <span className="w-[18px] text-center">⏩</span>
                        <span className="flex-1 text-left">朗读语速</span>
                        <span className="text-xs tabular-nums text-[var(--color-text-subtle)]">{ttsRate}</span>
                      </button>
                      <div className="w-full flex items-center gap-2.5 px-2 py-1.5">
                        <span className="w-[18px] text-center">🎙</span>
                        <span className="flex-1 text-left">音色</span>
                        <select
                          value={ttsVoice}
                          onChange={(e) => applyTtsVoice(e.target.value)}
                          className="max-w-[130px] text-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] px-1.5 py-1 focus:outline-none focus:border-[var(--color-accent)]/60"
                          aria-label="朗读音色"
                        >
                          <option value="">系统默认</option>
                          {ttsVoices.map((v) => (
                            <option key={v.uri} value={v.uri}>
                              {v.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="my-2 h-px bg-[var(--color-border)]" />

                      {/* 阅读偏好：字号 / 字体 / 护眼（仅文章页，配合正文生效） */}
                      <div className="mt-2 pt-2 border-t border-[var(--color-border)]">
                        <div className="flex items-center gap-2 mb-2">
                          <span>📖</span>
                          <span className="text-[var(--color-text)] font-medium">阅读</span>
                        </div>

                        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                          <span className="text-[var(--color-text-muted)]">正文字号</span>
                          <div className="flex gap-1">
                            {[
                              { id: "small", label: "A-" },
                              { id: "normal", label: "标" },
                              { id: "large", label: "A+" },
                            ].map((o) => (
                              <button
                                key={o.id}
                                type="button"
                                onClick={() => applyFontSize(o.id)}
                                aria-label={`字号：${o.label}`}
                                className={`px-2 py-0.5 rounded-md text-xs font-medium border transition-colors ${fontSize === o.id ? "bg-[var(--color-accent)] text-white border-[var(--color-accent)]" : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)]/40"}`}
                              >
                                {o.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                          <span className="text-[var(--color-text-muted)]">正文字体</span>
                          <div className="flex gap-1">
                            {[
                              { id: "serif", label: "衬线" },
                              { id: "sans", label: "无衬线" },
                            ].map((o) => (
                              <button
                                key={o.id}
                                type="button"
                                onClick={() => applyFontStyle(o.id)}
                                className={`px-2 py-0.5 rounded-md text-xs font-medium border transition-colors ${fontStyle === o.id ? "bg-[var(--color-accent)] text-white border-[var(--color-accent)]" : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)]/40"}`}
                              >
                                {o.label}
                              </button>
                            ))}
                          </div>
                        </div>

                      </div>
                    </>
                  )}

                  {/* 护眼模式：全站背景色效果，所有页面可用 */}
                  <button
                    type="button"
                    onClick={() => applyEye(!eyeOn)}
                    className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-[var(--color-bg)] transition-colors text-[var(--color-text)]"
                  >
                    <span>🌿</span>
                    <span className="flex-1 text-left font-medium">护眼模式</span>
                    <span className="text-xs text-[var(--color-text-subtle)]">{eyeOn ? "开" : "关"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const dark = document.documentElement.classList.toggle("dark");
                      try {
                        localStorage.setItem("theme", dark ? "dark" : "light");
                      } catch {
                        /* ignore */
                      }
                      setDarkNow(dark);
                    }}
                    className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-[var(--color-bg)] transition-colors text-[var(--color-text)]"
                  >
                    <span>{darkNow ? "🌙" : "☀️"}</span>
                    <span className="flex-1 text-left font-medium">深色模式</span>
                    <span className="text-xs text-[var(--color-text-subtle)]">{darkNow ? "开" : "关"}</span>
                  </button>

                  <div className="px-2 pt-2">
                    <div className="flex items-center gap-2 mb-2">
                      <span>🎨</span>
                      <span className="text-[var(--color-text)] font-medium">主题色</span>
                      <span className="text-xs text-[var(--color-text-subtle)] ml-auto">
                        {palette.find((c) => c.id === themeColor)?.name ?? "珊瑚"}
                      </span>
                    </div>
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
                  </div>
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
