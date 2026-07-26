import { useState, useEffect, useRef } from "react";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function LoginModal({ open, onClose, onSuccess }: LoginModalProps) {
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setAccount("");
      setPassword("");
      setError("");
      setShowPwd(false);
      setTimeout(() => firstInputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account, password }),
      });
      const data = await res.json();
      if (data.ok) {
        onSuccess();
      } else {
        setError(data.error || "账号或密码错误");
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
        className="relative w-full max-w-sm bg-[var(--color-surface)] rounded-2xl shadow-2xl shadow-black/10 overflow-hidden"
        style={{ animation: "scale-in 0.2s ease-out" }}
      >
        {/* Decorative top accent bar */}
        <div className="h-1 bg-[var(--color-accent)]" />

        {/* Header */}
        <div className="px-6 pt-6 pb-2">
          <h2 id="login-title" className="text-xl font-bold text-[var(--color-text)] tracking-[-0.01em]">
            欢迎回来
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-1 font-serif">
            登录以管理博客内容
          </p>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg text-[var(--color-text-subtle)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-all"
          aria-label="关闭"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 pb-6 pt-4 space-y-4">
          {/* Account */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--color-text-subtle)] uppercase tracking-wider">
              账号
            </label>
            <input
              ref={firstInputRef}
              type="text"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="请输入账号"
              required
              className="w-full px-4 py-2.5 text-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)]/40 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20 focus:border-[var(--color-accent)] transition-all duration-200"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--color-text-subtle)] uppercase tracking-wider">
              密码
            </label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                required
                className="w-full px-4 py-2.5 pr-11 text-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)]/40 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20 focus:border-[var(--color-accent)] transition-all duration-200"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg text-[var(--color-text-subtle)] hover:text-[var(--color-text)] hover:bg-[var(--color-border)] transition-all"
                tabIndex={-1}
              >
                {showPwd ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 border border-red-100">
              <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 text-sm font-semibold rounded-xl bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-[var(--color-accent)]/20"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                登录中…
              </span>
            ) : "登 录"}
          </button>
        </form>
      </div>
    </div>
  );
}
