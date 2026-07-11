/**
 * GameNewsEditor.tsx — Admin game news editor (React Island)
 * client:only="react" — admin-only modal, no SSR needed
 *
 * For managing game_news table entries (CRUD).
 * This is a new feature — the Express version had hardcoded HTML for game news.
 */

import { useState, useCallback, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { useToast } from "./Toast";

const GAMES = [
  { key: "genshin", label: "原神" },
  { key: "starrail", label: "星铁" },
  { key: "endfield", label: "终末地" },
  { key: "nte", label: "异环" },
];

export default function GameNewsEditor() {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({ game: "genshin", tag: "", title: "", sortOrder: 0 });
  const { isLoggedIn } = useAuth();
  const { showToast } = useToast();

  const fetchItems = useCallback(async () => {
    try {
      // The game news API is not yet created — for now it's managed via the DB directly.
      // This component provides UI scaffolding for the future /api/game-news endpoint.
      showToast("游戏新闻管理功能将在后续版本中完善", "info");
    } catch {
      // Ignore
    }
  }, [showToast]);

  useEffect(() => {
    const handleOpen = () => {
      if (!isLoggedIn) {
        document.dispatchEvent(new CustomEvent("open-login-modal"));
        showToast("请先登录", "info");
        return;
      }
      setIsOpen(true);
      fetchItems();
    };

    document.addEventListener("open-game-news-editor", handleOpen);
    return () => document.removeEventListener("open-game-news-editor", handleOpen);
  }, [isLoggedIn, fetchItems, showToast]);

  const close = useCallback(() => setIsOpen(false), []);

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
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal modal-lg">
        <div className="modal-header">
          <h2>
            <i className="fa-solid fa-gamepad"></i> 游戏新闻管理
          </h2>
          <button className="modal-close" onClick={close}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div className="modal-body">
          <p className="text-text-secondary text-sm mb-4">
            管理侧边栏游戏新闻速递的内容。按游戏分组，支持排序。
          </p>

          {/* Add/Edit form */}
          <div className="bg-bg rounded-default p-4 mb-5 border border-border">
            <h4 className="font-semibold text-text mb-3">
              {"添加新闻"}
            </h4>
            <div className="form-row mb-3">
              <div className="form-group">
                <label>游戏</label>
                <select
                  value={form.game}
                  onChange={(e) => setForm((f) => ({ ...f, game: e.target.value }))}
                >
                  {GAMES.map((g) => (
                    <option key={g.key} value={g.key}>{g.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>标签</label>
                <input
                  type="text"
                  placeholder="新版本 / 活动 / 角色 / 福利"
                  value={form.tag}
                  onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>排序</label>
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm((f) => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>
            <div className="form-group">
              <label>标题</label>
              <input
                type="text"
                placeholder="新闻标题..."
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
          </div>

          {/* Items list */}
          <div className="text-text-muted text-center py-4 text-sm">
            <i className="fa-solid fa-info-circle"></i> 游戏新闻管理 API 将在后续完善
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={close}>关闭</button>
        </div>
      </div>
    </div>
  );
}
