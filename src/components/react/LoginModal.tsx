/**
 * LoginModal.tsx — Admin login modal (React Island)
 * client:only="react" — modal, no SSR needed
 */

import { useState, useCallback, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { useToast } from "./Toast";

export default function LoginModal() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { login } = useAuth();
  const { showToast } = useToast();

  // Listen for open events from other components
  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    document.addEventListener("open-login-modal", handleOpen);
    return () => document.removeEventListener("open-login-modal", handleOpen);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setError("");
    setUsername("");
    setPassword("");
  }, []);

  const handleSubmit = useCallback(
    async (e: React.SyntheticEvent) => {
      e.preventDefault();

      if (!username || !password) {
        setError("请输入账号和密码");
        return;
      }

      setLoading(true);
      setError("");

      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "登录失败");
          return;
        }

        login(data.username, data.token);
        showToast("登录成功", "success");
        close();
      } catch {
        setError("网络错误，请重试");
      } finally {
        setLoading(false);
      }
    },
    [username, password, login, showToast, close],
  );

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isOpen, close]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay open"
      id="login-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal modal-sm" id="login-modal">
        <div className="modal-header">
          <h2>
            <i className="fa-solid fa-lock"></i> 管理员登录
          </h2>
          <button className="modal-close" onClick={close}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div className="modal-body">
          <form id="login-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="login-username">账号</label>
              <input
                type="text"
                id="login-username"
                placeholder="请输入账号"
                maxLength={30}
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
            </div>
            <div className="form-group">
              <label htmlFor="login-password">密码</label>
              <input
                type="password"
                id="login-password"
                placeholder="请输入密码"
                maxLength={50}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <p className="login-error" style={{ color: "var(--color-danger)", fontSize: "0.88rem" }}>
                {error}
              </p>
            )}
          </form>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={close}>
            取消
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <i className="fa-solid fa-spinner fa-spin"></i>
            ) : (
              <i className="fa-solid fa-right-to-bracket"></i>
            )}{" "}
            登录
          </button>
        </div>
      </div>
    </div>
  );
}
