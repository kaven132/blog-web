import { useState, useEffect, useCallback, useRef, type DragEvent } from "react";
import AvatarCropModal, { readFileAsDataURL, uploadImageFile } from "./AvatarCropModal";

interface ProfileData {
  name: string;
  bio: string;
  city: string;
  gender: string;
  avatar: string;
  github: string;
  website: string;
}

const DEFAULTS: ProfileData = {
  name: "kaven",
  bio: "",
  city: "",
  gender: "",
  avatar: "",
  github: "",
  website: "",
};

export default function ProfileCard({ authed }: { authed: boolean }) {
  const [profile, setProfile] = useState<ProfileData>(DEFAULTS);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ProfileData>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [loggedIn, setLoggedIn] = useState(authed);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Crop modal state（裁切交互全在 AvatarCropModal 内部，这里只管开关与结果） ──
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  // Load profile + check auth
  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data?.name) {
          setProfile({ ...DEFAULTS, ...data });
          setForm({ ...DEFAULTS, ...data });
        }
      })
      .catch(() => {});
  }, []);

  const startEdit = useCallback(() => {
    setForm({ ...profile });
    setEditing(true);
  }, [profile]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
    setForm({ ...profile });
  }, [profile]);

  const saveProfile = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const updated = await res.json();
        setProfile({ ...DEFAULTS, ...updated });
        setEditing(false);
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }, [form]);

  // ── File picked → open crop modal ──
  const openCropper = useCallback(
    async (file: File) => {
      // 未登录直接忽略：PUT /api/profile 会 401，静默失败反而让人以为是 bug
      if (!loggedIn) return;
      if (!file.type.startsWith("image/")) return;
      try {
        setCropSrc(await readFileAsDataURL(file));
      } catch {
        // ignore
      }
    },
    [loggedIn]
  );

  // ── Confirm crop：优先上传成文件存 URL（可缓存），失败退回 base64 保证流程不死胡同 ──
  const onCropConfirm = useCallback(
    async (dataUrl: string) => {
      try {
        let avatar: string;
        try {
          avatar = await uploadImageFile(dataUrl);
        } catch {
          avatar = dataUrl;
        }
        if (editing) {
          setForm((f) => ({ ...f, avatar }));
        } else {
          const res = await fetch("/api/profile", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...profile, avatar }),
          });
          if (res.ok) {
            const updated = await res.json();
            setProfile({ ...DEFAULTS, ...updated });
          }
        }
      } catch {
        // ignore
      }
      setCropSrc(null);
    },
    [editing, profile]
  );

  // ── Drag handlers (for avatar area) ──
  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) openCropper(file);
    },
    [openCropper]
  );

  const onDragOverHandler = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeaveHandler = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const avatarSrc = editing ? form.avatar : profile.avatar;
  const initial = (editing ? form.name : profile.name)?.charAt(0)?.toUpperCase() || "?";
  const genderSvg = profile.gender === "male" ? (
    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="14" r="5" />
      <line x1="14" y1="10" x2="20" y2="4" />
      <polyline points="16 4 20 4 20 8" />
    </svg>
  ) : profile.gender === "female" ? (
    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="9" r="5" />
      <line x1="12" y1="14" x2="12" y2="22" />
      <line x1="9" y1="18" x2="15" y2="18" />
    </svg>
  ) : null;

  return (
    <>
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
        {/* ── Display mode ── */}
        {!editing ? (
          <div className="relative">
            {loggedIn && (
              <button
                onClick={startEdit}
                className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg text-[var(--color-text-subtle)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-muted)] transition-all z-10"
                title="编辑资料"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
              </button>
            )}

            <div className="pt-8 pb-4 px-4 flex flex-col items-center">
              <div
                className={`relative size-20 rounded-full mb-3 ring-2 ring-[var(--color-border)] overflow-hidden group ${
                  loggedIn ? "cursor-pointer" : "cursor-default"
                } ${dragOver ? "ring-[var(--color-accent)]" : ""}`}
                onDrop={onDrop}
                onDragOver={onDragOverHandler}
                onDragLeave={onDragLeaveHandler}
                onClick={() => fileInputRef.current?.click()}
                title={loggedIn ? "拖拽或点击更换头像" : undefined}
              >
                {avatarSrc ? (
                  <img src={avatarSrc} alt="头像" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-[var(--color-accent-muted)] text-[var(--color-accent)] flex items-center justify-center text-2xl font-bold">
                    {initial}
                  </div>
                )}
              </div>

              <h2 className="text-lg font-bold text-[var(--color-text)] tracking-[-0.01em] flex items-center justify-center gap-1.5">
                {profile.name}
                {genderSvg && (
                  <span className={profile.gender === "male" ? "text-[#4b9ce8]" : "text-[#e87aaa]"} title={profile.gender === "male" ? "男" : "女"}>
                    {genderSvg}
                  </span>
                )}
              </h2>

              {profile.city && (
                <p className="text-xs text-[var(--color-text-subtle)] mt-0.5">{profile.city}</p>
              )}

              {profile.bio && (
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mt-3 text-center font-serif italic">
                  "{profile.bio}"
                </p>
              )}
            </div>

            {(profile.github || profile.website) && (
              <div className="px-4 pb-5">
                <div className="border-t border-[var(--color-border)] pt-3 space-y-1.5">
                  {profile.github && (
                    <a href={`https://github.com/${profile.github}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs text-[var(--color-text-subtle)] hover:text-[var(--color-accent)] transition-colors py-1">
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                      </svg>
                      <span className="truncate">@{profile.github}</span>
                    </a>
                  )}
                  {profile.website && (
                    <a href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs text-[var(--color-text-subtle)] hover:text-[var(--color-accent)] transition-colors py-1">
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                      </svg>
                      <span className="truncate">{profile.website.replace(/^https?:\/\//, "")}</span>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ── Edit mode ── */
          <div className="p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[var(--color-text-subtle)]">编辑资料</p>
              <button onClick={cancelEdit}
                className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--color-text-subtle)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-all" title="取消">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Avatar */}
            <div className="flex flex-col items-center gap-2">
              <div
                className={`relative size-[72px] rounded-full overflow-hidden ring-2 transition-all cursor-pointer ${
                  dragOver ? "ring-[var(--color-accent)] scale-105" : "ring-[var(--color-border)] hover:ring-[var(--color-accent)]/50"
                }`}
                onDrop={onDrop}
                onDragOver={onDragOverHandler}
                onDragLeave={onDragLeaveHandler}
                onClick={() => fileInputRef.current?.click()}
                title="拖拽或点击更换头像"
              >
                {form.avatar ? (
                  <img src={form.avatar} alt="头像" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-[var(--color-accent-muted)] text-[var(--color-accent)] flex items-center justify-center text-lg font-bold">
                    {initial}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <svg className="w-3.5 h-3.5 text-white mb-0.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <span className="text-[8px] text-white font-medium">更换</span>
                </div>
              </div>
              <p className="text-[10px] text-[var(--color-text-subtle)]">拖拽或点击更换</p>
            </div>

            {/* Name + City */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-medium text-[var(--color-text-subtle)] block mb-1">名字</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  maxLength={16}
                  className="w-full px-2.5 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] transition-all" />
              </div>
              <div>
                <label className="text-[11px] font-medium text-[var(--color-text-subtle)] block mb-1">城市</label>
                <input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="如：上海" maxLength={20}
                  className="w-full px-2.5 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)]/40 focus:outline-none focus:border-[var(--color-accent)] transition-all" />
              </div>
            </div>

            {/* Gender + Bio */}
            <div>
              <label className="text-[11px] font-medium text-[var(--color-text-subtle)] block mb-1">性别</label>
              <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}
                className="w-full px-2.5 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] transition-all">
                <option value="">未设置</option>
                <option value="male">男</option>
                <option value="female">女</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-medium text-[var(--color-text-subtle)] block mb-1">个性签名</label>
              <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })}
                placeholder="写一句介绍自己…" maxLength={80} rows={2}
                className="w-full px-2.5 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)]/40 focus:outline-none focus:border-[var(--color-accent)] transition-all resize-none" />
            </div>

            {/* GitHub + Website */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-medium text-[var(--color-text-subtle)] block mb-1">GitHub</label>
                <input type="text" value={form.github} onChange={(e) => setForm({ ...form, github: e.target.value })}
                  placeholder="用户名" maxLength={40}
                  className="w-full px-2.5 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)]/40 focus:outline-none focus:border-[var(--color-accent)] transition-all" />
              </div>
              <div>
                <label className="text-[11px] font-medium text-[var(--color-text-subtle)] block mb-1">网站</label>
                <input type="text" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })}
                  placeholder="example.com" maxLength={200}
                  className="w-full px-2.5 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)]/40 focus:outline-none focus:border-[var(--color-accent)] transition-all" />
              </div>
            </div>

            <button onClick={saveProfile} disabled={saving}
              className="w-full py-2.5 text-sm font-semibold rounded-lg bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50">
              {saving ? "保存中…" : "保存修改"}
            </button>
          </div>
        )}
      </div>

      {/* 隐藏的 file input：必须放在编辑/展示两个分支之外。
          旧实现只在编辑模式渲染，导致展示模式下 fileInputRef 恒为 null，点击头像毫无反应 */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) openCropper(f); }} />

      {/* ── Crop modal（共享组件） ── */}
      {cropSrc && (
        <AvatarCropModal src={cropSrc} onCancel={() => setCropSrc(null)} onConfirm={onCropConfirm} />
      )}
    </>
  );
}
