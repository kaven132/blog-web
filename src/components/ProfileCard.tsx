import { useState, useEffect, useCallback, useRef, type DragEvent, type MouseEvent, type WheelEvent } from "react";

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

const CROP_SIZE = 250; // px — crop area dimension

// Load image from File → data URL
function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// 读取图片原始像素尺寸
function readImageSize(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = reject;
    img.src = src;
  });
}

// 图片在裁切框里「铺满」时的基准显示尺寸：短边对齐 CROP_SIZE
// （原实现把宽固定成 CROP_SIZE，横图会出现上下留白、圆形头像里能看到空档）
function baseSizeOf(natW: number, natH: number) {
  const cover = CROP_SIZE / Math.max(1, Math.min(natW, natH));
  return { w: natW * cover, h: natH * cover };
}

// 平移上限：放大后的图片超出裁切框的那部分
function panLimitOf(natW: number, natH: number, scale: number) {
  const base = baseSizeOf(natW, natH);
  return {
    x: Math.max(0, base.w * scale - CROP_SIZE),
    y: Math.max(0, base.h * scale - CROP_SIZE),
  };
}

// Final crop: 把裁切框里的可见区域原样画到方形 canvas
//
// 预览用的 transform 是 `translate(-x, -y) scale(s)` 且 origin 为 top-left，
// 即图片局部坐标 p 显示在 s*p - (x, y) 处。反解裁切框坐标 d 对应的原图坐标：
//   src = (d + 平移量) / (cover * scale)
// 旧实现写成 sx = -x * ratio，负号与漏掉的 scale 会让「放大 + 拖动」后
// 导出的区域和预览里看到的完全不是同一块。
function cropToAvatar(
  imgSrc: string,
  natW: number,
  natH: number,
  scale: number,
  x: number,
  y: number,
  outSize: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = outSize;
      canvas.height = outSize;
      const ctx = canvas.getContext("2d")!;

      // 1 个裁切框像素对应多少原图像素
      const cover = CROP_SIZE / Math.max(1, Math.min(natW, natH));
      const unit = 1 / (cover * scale);

      const sx = x * unit;
      const sy = y * unit;
      const sw = CROP_SIZE * unit;
      const sh = CROP_SIZE * unit;

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outSize, outSize);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = reject;
    img.src = imgSrc;
  });
}

export default function ProfileCard() {
  const [profile, setProfile] = useState<ProfileData>(DEFAULTS);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ProfileData>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Crop modal state ──
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropNat, setCropNat] = useState({ w: CROP_SIZE, h: CROP_SIZE });
  const [cropScale, setCropScale] = useState(1);
  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, cx: 0, cy: 0 });

  // 裁切框内图片的基准显示尺寸（依赖原图宽高比）
  const cropBase = baseSizeOf(cropNat.w, cropNat.h);

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
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setLoggedIn(d.loggedIn))
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
        const dataUrl = await readFileAsDataURL(file);
        const { w, h } = await readImageSize(dataUrl);
        setCropSrc(dataUrl);
        setCropNat({ w, h });
        setCropScale(1);
        setCropX(0);
        setCropY(0);
      } catch {
        // ignore
      }
    },
    [loggedIn]
  );

  // ── Confirm crop ──
  const confirmCrop = useCallback(async () => {
    if (!cropSrc) return;
    try {
      const avatar = await cropToAvatar(cropSrc, cropNat.w, cropNat.h, cropScale, cropX, cropY, 200);
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
  }, [cropSrc, cropNat, cropScale, cropX, cropY, editing, profile]);

  const cancelCrop = useCallback(() => setCropSrc(null), []);

  // ── Drag handlers (for avatar area & crop modal) ──
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

  // ── Crop drag / zoom ──
  const cropMouseDown = useCallback(
    (e: MouseEvent) => {
      setDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY, cx: cropX, cy: cropY };
    },
    [cropX, cropY]
  );

  const cropMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      // 拖图手感：鼠标往右拖，图片跟着往右走（露出更靠左的部分），平移量取负。
      // 旧实现用 +dx，方向是反的，像在拖取景框而不是拖图；且 maxPan 公式少乘了一个 scale。
      const limit = panLimitOf(cropNat.w, cropNat.h, cropScale);
      setCropX(clamp(dragStart.current.cx - dx, 0, limit.x));
      setCropY(clamp(dragStart.current.cy - dy, 0, limit.y));
    },
    [dragging, cropScale, cropNat]
  );

  const cropMouseUp = useCallback(() => setDragging(false), []);

  // 缩放到指定倍数，并以裁切框中心为锚点重新夹取平移量
  const zoomTo = useCallback(
    (next: number) => {
      const scale = clamp(next, 1, 3);
      if (scale === cropScale) return;
      const k = scale / cropScale;
      const limit = panLimitOf(cropNat.w, cropNat.h, scale);
      setCropX((x) => clamp((x + CROP_SIZE / 2) * k - CROP_SIZE / 2, 0, limit.x));
      setCropY((y) => clamp((y + CROP_SIZE / 2) * k - CROP_SIZE / 2, 0, limit.y));
      setCropScale(scale);
    },
    [cropScale, cropNat]
  );

  const cropWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      zoomTo(cropScale + (e.deltaY > 0 ? -0.1 : 0.1));
    },
    [cropScale, zoomTo]
  );

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

  const imgScaleStr = `scale(${cropScale})`;
  const imgTranslateStr = `translate(${-cropX}px, ${-cropY}px)`;

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

      {/* ── Crop modal ── */}
      {cropSrc && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onMouseMove={cropMouseMove} onMouseUp={cropMouseUp} onMouseLeave={cropMouseUp}>
          <div className="bg-[var(--color-surface)] rounded-2xl shadow-2xl overflow-hidden max-w-sm w-full">
            {/* Modal header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
              <h3 className="text-sm font-semibold text-[var(--color-text)]">裁切头像</h3>
              <button onClick={cancelCrop}
                className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--color-text-subtle)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Crop area */}
            <div className="p-4 flex flex-col items-center gap-4">
              <div
                className="relative rounded-full overflow-hidden bg-[var(--color-bg)] border-2 border-[var(--color-border)] select-none cursor-grab active:cursor-grabbing"
                style={{ width: CROP_SIZE, height: CROP_SIZE }}
                onMouseDown={cropMouseDown}
                onWheel={cropWheel}
              >
                {/* Grid overlay */}
                <div className="absolute inset-0 rounded-full pointer-events-none z-10 border-[3px] border-white/40 shadow-[inset_0_0_0_999px_rgba(0,0,0,0.15)]" />
                {/* Image */}
                <img
                  src={cropSrc}
                  alt="裁切"
                  draggable={false}
                  className="absolute origin-top-left max-w-none"
                  style={{
                    width: cropBase.w,
                    height: cropBase.h,
                    transform: `${imgTranslateStr} ${imgScaleStr}`,
                  }}
                />
              </div>

              {/* Zoom slider */}
              <div className="flex items-center gap-2 w-full">
                <svg className="w-3.5 h-3.5 text-[var(--color-text-subtle)] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.01"
                  value={cropScale}
                  onChange={(e) => zoomTo(parseFloat(e.target.value))}
                  className="flex-1 h-1.5 rounded-full appearance-none bg-[var(--color-border)] accent-[var(--color-accent)] cursor-pointer"
                />
                <svg className="w-4 h-4 text-[var(--color-text-subtle)] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex gap-2.5 px-4 py-3 border-t border-[var(--color-border)]">
              <button onClick={cancelCrop}
                className="flex-1 py-2.5 text-sm font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-all">
                取消
              </button>
              <button onClick={confirmCrop}
                className="flex-1 py-2.5 text-sm font-semibold rounded-lg bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors">
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}