import { useCallback, useRef, useState, type DragEvent } from "react";
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

const cardClass = "bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 sm:p-6";
const sectionTitle = "text-[11px] font-semibold tracking-[0.12em] uppercase text-[var(--color-text-subtle)]";
const inputClass =
  "w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)]/40 focus:outline-none focus:border-[var(--color-accent)] transition-all";

export default function AccountPanel({ initial }: { initial: ProfileData }) {
  const [profile, setProfile] = useState(initial);
  const [form, setForm] = useState(initial);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  // ── 头像 ──
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── 密码 ──
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const openCropper = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    try {
      setCropSrc(await readFileAsDataURL(file));
    } catch {
      /* ignore */
    }
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) openCropper(file);
    },
    [openCropper]
  );

  // 裁切确认：上传成文件 → 写库 → 刷新整页（导航栏 / 侧边卡的头像和昵称同步）
  const onCropConfirm = useCallback(async (dataUrl: string) => {
    setAvatarBusy(true);
    try {
      let avatar: string;
      try {
        avatar = await uploadImageFile(dataUrl);
      } catch {
        avatar = dataUrl;
      }
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...profile, avatar }),
      });
      if (res.ok) {
        window.location.reload();
        return;
      }
    } catch {
      /* 掩盖不了就关弹窗 */
    }
    setAvatarBusy(false);
    setCropSrc(null);
  }, [profile]);

  const saveProfile = useCallback(async () => {
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.status === 401) {
        window.location.href = "/login?next=/account";
        return;
      }
      if (res.ok) {
        // 名字在导航栏 / 侧边卡都有展示，整页刷新一次性同步
        window.location.reload();
        return;
      }
      setProfileMsg("保存失败，请稍后再试");
    } catch {
      setProfileMsg("保存失败，请稍后再试");
    } finally {
      setSavingProfile(false);
    }
  }, [form]);

  const changePassword = useCallback(async () => {
    setPwMsg(null);
    if (pw.next.length < 6 || pw.next.length > 64) {
      setPwMsg({ ok: false, text: "新密码长度需在 6~64 位之间" });
      return;
    }
    if (pw.next !== pw.confirm) {
      setPwMsg({ ok: false, text: "两次输入的新密码不一致" });
      return;
    }
    setPwSaving(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pw.current, newPassword: pw.next }),
      });
      if (res.status === 401) {
        window.location.href = "/login?next=/account";
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPwMsg({ ok: true, text: "密码已修改，下次登录请使用新密码" });
        setPw({ current: "", next: "", confirm: "" });
      } else {
        setPwMsg({ ok: false, text: data.error || "修改失败，请稍后再试" });
      }
    } catch {
      setPwMsg({ ok: false, text: "修改失败，请稍后再试" });
    } finally {
      setPwSaving(false);
    }
  }, [pw]);

  const avatarBlock = (
    <div
      className={`relative size-24 rounded-full overflow-hidden ring-2 ring-[var(--color-border)] cursor-pointer transition-all ${
        dragOver ? "ring-[var(--color-accent)] scale-105" : "hover:ring-[var(--color-accent)]/50"
      }`}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) openCropper(f);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setDragOver(false);
      }}
      onClick={() => fileInputRef.current?.click()}
      title="拖拽或点击更换头像"
    >
      {profile.avatar ? (
        <img src={profile.avatar} alt="头像" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-[var(--color-accent-muted)] text-[var(--color-accent)] flex items-center justify-center text-3xl font-bold">
          {profile.name?.charAt(0)?.toUpperCase() || "?"}
        </div>
      )}
      <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
        <svg className="w-4 h-4 text-white mb-0.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        <span className="text-[9px] text-white font-medium">更换</span>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) openCropper(f);
          e.target.value = "";
        }}
      />

      {/* ── 头像 + 账号概览 ── */}
      <div className={`${cardClass} flex flex-col sm:flex-row items-center gap-5`}>
        {avatarBlock}
        <div className="flex-1 text-center sm:text-left">
          <h2 className="text-lg font-bold text-[var(--color-text)]">{profile.name}</h2>
          <p className="text-xs text-[var(--color-text-subtle)] mt-0.5">管理员 · {profile.city || "未设置城市"}</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarBusy}
            className="mt-3 px-3.5 py-1.5 text-xs font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-hover)] transition-all disabled:opacity-50"
          >
            {avatarBusy ? "上传中…" : "更换头像"}
          </button>
          <p className="text-[10px] text-[var(--color-text-subtle)] mt-1.5">支持拖拽 / 点击上传，裁切后自动保存</p>
        </div>
      </div>

      {/* ── 基本资料 ── */}
      <div className={cardClass}>
        <p className={`${sectionTitle} mb-4`}>基本资料</p>
        <div className="space-y-3.5">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-[var(--color-text-subtle)] block mb-1">名字</label>
              <input type="text" value={form.name} maxLength={16}
                onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[var(--color-text-subtle)] block mb-1">城市</label>
              <input type="text" value={form.city} placeholder="如：上海" maxLength={20}
                onChange={(e) => setForm({ ...form, city: e.target.value })} className={inputClass} />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-[var(--color-text-subtle)] block mb-1">性别</label>
            <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className={inputClass}>
              <option value="">未设置</option>
              <option value="male">男</option>
              <option value="female">女</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] font-medium text-[var(--color-text-subtle)] block mb-1">个性签名</label>
            <textarea value={form.bio} placeholder="写一句介绍自己…" maxLength={80} rows={2}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              className={`${inputClass} resize-none`} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-[var(--color-text-subtle)] block mb-1">GitHub</label>
              <input type="text" value={form.github} placeholder="用户名" maxLength={40}
                onChange={(e) => setForm({ ...form, github: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[var(--color-text-subtle)] block mb-1">网站</label>
              <input type="text" value={form.website} placeholder="example.com" maxLength={200}
                onChange={(e) => setForm({ ...form, website: e.target.value })} className={inputClass} />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={saveProfile}
              disabled={savingProfile}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50"
            >
              {savingProfile ? "保存中…" : "保存资料"}
            </button>
            {profileMsg && <span className="text-xs text-red-500">{profileMsg}</span>}
          </div>
        </div>
      </div>

      {/* ── 修改密码 ── */}
      <div className={cardClass}>
        <p className={`${sectionTitle} mb-4`}>修改密码</p>
        <div className="space-y-3.5">
          <div>
            <label className="text-[11px] font-medium text-[var(--color-text-subtle)] block mb-1">当前密码</label>
            <input type="password" value={pw.current} autoComplete="current-password"
              onChange={(e) => setPw({ ...pw, current: e.target.value })} className={inputClass} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-[var(--color-text-subtle)] block mb-1">新密码（6~64 位）</label>
              <input type="password" value={pw.next} autoComplete="new-password"
                onChange={(e) => setPw({ ...pw, next: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[var(--color-text-subtle)] block mb-1">确认新密码</label>
              <input type="password" value={pw.confirm} autoComplete="new-password"
                onChange={(e) => setPw({ ...pw, confirm: e.target.value })} className={inputClass} />
            </div>
          </div>
          {pwMsg && (
            <p className={`text-xs ${pwMsg.ok ? "text-[var(--color-accent)] font-medium" : "text-red-500"}`}>{pwMsg.text}</p>
          )}
          <button
            onClick={changePassword}
            disabled={pwSaving || !pw.current || !pw.next}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50"
          >
            {pwSaving ? "提交中…" : "确认修改"}
          </button>
        </div>
      </div>
    </div>
  );
}
