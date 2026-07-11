/**
 * ProfileEditor.tsx — Profile edit modal (React Island)
 * client:only="react" — modal, no SSR needed
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
  const { isLoggedIn } = useAuth();
  const { showToast } = useToast();

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
      } catch {
        // Ignore
      }
      setIsOpen(true);
    };

    document.addEventListener("open-profile-editor", handleOpen);
    return () => document.removeEventListener("open-profile-editor", handleOpen);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  // Trigger login if not authenticated
  useEffect(() => {
    if (isOpen && !isLoggedIn) {
      close();
      document.dispatchEvent(new CustomEvent("open-login-modal"));
      showToast("请先登录", "info");
    }
  }, [isOpen, isLoggedIn, close, showToast]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          bio: form.bio,
          email: form.email,
          location: form.location,
          avatar: form.avatar,
          social: {
            github: form.github,
            twitter: form.twitter,
            website: form.website,
          },
        }),
      });

      if (!res.ok) {
        showToast("保存失败", "error");
        return;
      }

      showToast("个人资料已保存", "success");
      close();
      setTimeout(() => window.location.reload(), 500);
    } catch {
      showToast("网络错误", "error");
    } finally {
      setSaving(false);
    }
  }, [form, showToast, close]);

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
      id="profile-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal" id="profile-modal">
        <div className="modal-header">
          <h2>编辑个人资料</h2>
          <button className="modal-close" onClick={close}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>姓名</label>
            <input
              type="text"
              placeholder="你的名字"
              maxLength={30}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>个人简介</label>
            <textarea
              rows={3}
              placeholder="介绍一下你自己..."
              maxLength={200}
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            ></textarea>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>邮箱</label>
              <input
                type="email"
                placeholder="your@email.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>所在地</label>
              <input
                type="text"
                placeholder="城市"
                maxLength={50}
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              />
            </div>
          </div>
          <div className="form-group">
            <label>头像图片</label>
            <ImageUpload
              currentUrl={form.avatar}
              onUploaded={(url) => setForm((f) => ({ ...f, avatar: url }))}
            />
            <small>支持本地上传或粘贴图片，也可输入URL链接。留空使用默认图标</small>
          </div>
          <div className="form-group">
            <label>社交链接</label>
            <div className="social-inputs">
              <div className="social-input-row">
                <i className="fa-brands fa-github"></i>
                <input
                  type="url"
                  placeholder="GitHub 主页链接"
                  value={form.github}
                  onChange={(e) => setForm((f) => ({ ...f, github: e.target.value }))}
                />
              </div>
              <div className="social-input-row">
                <i className="fa-brands fa-twitter"></i>
                <input
                  type="url"
                  placeholder="Twitter / X 链接"
                  value={form.twitter}
                  onChange={(e) => setForm((f) => ({ ...f, twitter: e.target.value }))}
                />
              </div>
              <div className="social-input-row">
                <i className="fa-solid fa-globe"></i>
                <input
                  type="url"
                  placeholder="个人网站链接"
                  value={form.website}
                  onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={close}>
            取消
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <i className="fa-solid fa-spinner fa-spin"></i>
            ) : (
              <i className="fa-solid fa-check"></i>
            )}{" "}
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
