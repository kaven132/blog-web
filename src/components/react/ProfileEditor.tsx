/**
 * ProfileEditor.tsx — Profile edit modal (React Island)
 * client:load — mounts early so event listener is ready
 */

import { useState, useCallback, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { useToast } from "./Toast";
import ImageUpload from "./ImageUpload";

export default function ProfileEditor() {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", bio: "", email: "", location: "", avatar: "",
    github: "", twitter: "", website: "",
  });
  const [saving, setSaving] = useState(false);
  const { isLoggedIn, login } = useAuth();
  const { showToast } = useToast();
  const [showLogin, setShowLogin] = useState(false);
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  // Load current profile when opening
  useEffect(() => {
    const handleOpen = async () => {
      try {
        const res = await fetch("/api/profile");
        if (res.ok) {
          const data = await res.json();
          setForm({
            name: data.name || "",
            bio: data.bio || "",
            email: data.email || "",
            location: data.location || "",
            avatar: data.avatar || "",
            github: data.social?.github || "",
            twitter: data.social?.twitter || "",
            website: data.social?.website || "",
          });
        }
      } catch { /* ignore */ }
      setShowLogin(false);
      setLoginError("");
      setIsOpen(true);
    };

    document.addEventListener("open-profile-editor", handleOpen);
    return () => document.removeEventListener("open-profile-editor", handleOpen);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setShowLogin(false);
    setLoginError("");
  }, []);

  const handleSave = useCallback(async () => {
    if (!isLoggedIn) {
      showToast("请先登录后再保存", "info");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name, bio: form.bio, email: form.email,
          location: form.location, avatar: form.avatar,
          social: { github: form.github, twitter: form.twitter, website: form.website },
        }),
      });
      if (!res.ok) { showToast("保存失败", "error"); return; }
      showToast("个人资料已保存", "success");
      close();
      setTimeout(() => window.location.reload(), 500);
    } catch {
      showToast("网络错误", "error");
    } finally {
      setSaving(false);
    }
  }, [form, isLoggedIn, showToast, close]);

  const handleLogin = useCallback(async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!loginUser || !loginPass) { setLoginError("请输入账号和密码"); return; }
    setLoggingIn(true);
    setLoginError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUser, password: loginPass }),
      });
      const data = await res.json();
      if (!res.ok) { setLoginError(data.error || "登录失败"); return; }
      login(data.username, data.token);
      setShowLogin(false);
      setLoginError("");
      showToast("登录成功，现在可以保存了", "success");
    } catch {
      setLoginError("网络错误");
    } finally {
      setLoggingIn(false);
    }
  }, [loginUser, loginPass, login, showToast]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [isOpen, close]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay open" id="profile-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal" id="profile-modal">
        <div className="modal-header">
          <h2>编辑个人资料</h2>
          <button className="modal-close" onClick={close}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div className="modal-body">
          {/* Login prompt for unauthenticated users */}
          {!isLoggedIn && !showLogin && (
            <div style={{
              background: "var(--color-primary-light, #eef2ff)",
              border: "1px solid var(--color-primary, #4f46e5)",
              borderRadius: "var(--radius-sm, 6px)",
              padding: "14px 16px",
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
            }}>
              <span style={{ fontSize: "0.88rem", color: "var(--color-text, #1e293b)" }}>
                <i className="fa-solid fa-lock" style={{ marginRight: "6px", color: "var(--color-primary, #4f46e5)" }}></i>
                请先登录后才能编辑个人信息
              </span>
              <button className="btn btn-primary btn-sm"
                onClick={() => setShowLogin(true)}
                style={{ whiteSpace: "nowrap", fontSize: "0.82rem", padding: "6px 14px" }}>
                <i className="fa-solid fa-right-to-bracket"></i> 登录
              </button>
            </div>
          )}

          {/* Inline login form */}
          {showLogin && (
            <form onSubmit={handleLogin} style={{
              background: "var(--color-bg, #f8fafc)",
              border: "1px solid var(--color-border, #e2e8f0)",
              borderRadius: "var(--radius-sm, 6px)",
              padding: "14px 16px",
              marginBottom: "16px",
            }}>
              <div style={{ display: "flex", gap: "10px", marginBottom: "8px", alignItems: "center" }}>
                <input type="text" placeholder="账号" value={loginUser}
                  onChange={(e) => setLoginUser(e.target.value)}
                  style={{ flex: 1, padding: "6px 10px", fontSize: "0.85rem", borderRadius: "4px", border: "1px solid var(--color-border, #e2e8f0)" }}
                />
                <input type="password" placeholder="密码" value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  style={{ flex: 1, padding: "6px 10px", fontSize: "0.85rem", borderRadius: "4px", border: "1px solid var(--color-border, #e2e8f0)" }}
                />
                <button type="submit" className="btn btn-primary btn-sm" disabled={loggingIn}
                  style={{ whiteSpace: "nowrap", fontSize: "0.82rem", padding: "6px 14px" }}>
                  {loggingIn ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-check"></i>} 登录
                </button>
              </div>
              {loginError && <p style={{ color: "var(--color-danger, #ef4444)", fontSize: "0.8rem", margin: 0 }}>{loginError}</p>}
            </form>
          )}

          <div className="form-group">
            <label>姓名</label>
            <input type="text" placeholder="你的名字" maxLength={30} value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>个人简介</label>
            <textarea rows={3} placeholder="介绍一下你自己..." maxLength={200} value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}></textarea>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>邮箱</label>
              <input type="email" placeholder="your@email.com" value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>所在地</label>
              <input type="text" placeholder="城市" maxLength={50} value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label>头像图片</label>
            <ImageUpload currentUrl={form.avatar}
              onUploaded={(url) => setForm((f) => ({ ...f, avatar: url }))} />
            <small>支持本地上传或粘贴图片，也可输入URL链接。留空使用默认图标</small>
          </div>
          <div className="form-group">
            <label>社交链接</label>
            <div className="social-inputs">
              <div className="social-input-row">
                <i className="fa-brands fa-github"></i>
                <input type="url" placeholder="GitHub 主页链接" value={form.github}
                  onChange={(e) => setForm((f) => ({ ...f, github: e.target.value }))} />
              </div>
              <div className="social-input-row">
                <i className="fa-brands fa-twitter"></i>
                <input type="url" placeholder="Twitter / X 链接" value={form.twitter}
                  onChange={(e) => setForm((f) => ({ ...f, twitter: e.target.value }))} />
              </div>
              <div className="social-input-row">
                <i className="fa-solid fa-globe"></i>
                <input type="url" placeholder="个人网站链接" value={form.website}
                  onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} />
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={close}>取消</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-check"></i>} 保存
          </button>
        </div>
      </div>
    </div>
  );
}
