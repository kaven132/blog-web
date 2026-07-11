/**
 * ArticleEditor.tsx — Article create/edit modal (React Island)
 * client:only="react" — modal, no SSR needed
 */

import { useState, useCallback, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { useToast } from "./Toast";
import ImageUpload from "./ImageUpload";

interface ArticleData {
  id?: string;
  title: string;
  content: string;
  category: string;
  subcategory: string;
  tags: string[];
  summary: string;
  coverImage: string;
  isPinned: number;
}

export default function ArticleEditor() {
  const [isOpen, setIsOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ArticleData>({
    title: "", content: "", category: "", subcategory: "",
    tags: [], summary: "", coverImage: "", isPinned: 0,
  });
  const [tagsInput, setTagsInput] = useState("");
  const [saving, setSaving] = useState(false);
  const { isLoggedIn } = useAuth();
  const { showToast } = useToast();

  // Listen for open events
  useEffect(() => {
    const handleOpen = (e: Event) => {
      setIsOpen(true);
      const detail = (e as CustomEvent).detail;
      if (detail?.article) {
        setEditId(detail.article.id);
        setForm({
          id: detail.article.id,
          title: detail.article.title || "",
          content: detail.article.content || "",
          category: detail.article.category || "",
          subcategory: detail.article.subcategory || "",
          tags: detail.article.tags || [],
          summary: detail.article.summary || "",
          coverImage: detail.article.coverImage || "",
          isPinned: detail.article.isPinned || 0,
        });
        setTagsInput((detail.article.tags || []).join(", "));
      } else {
        setEditId(null);
        setForm({
          title: "", content: "", category: "", subcategory: "",
          tags: [], summary: "", coverImage: "", isPinned: 0,
        });
        setTagsInput("");
      }
    };

    document.addEventListener("open-article-editor", handleOpen);
    return () => document.removeEventListener("open-article-editor", handleOpen);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setEditId(null);
  }, []);

  // Trigger login if not authenticated
  useEffect(() => {
    if (isOpen && !isLoggedIn) {
      close();
      document.dispatchEvent(new CustomEvent("open-login-modal"));
      showToast("请先登录", "info");
    }
  }, [isOpen, isLoggedIn, close, showToast]);

  const updateField = useCallback(
    (field: keyof ArticleData, value: string | number | string[]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const handleTagsBlur = useCallback(() => {
    const tags = tagsInput
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter(Boolean);
    setForm((prev) => ({ ...prev, tags }));
    setTagsInput(tags.join(", "));
  }, [tagsInput]);

  const handleSubmit = useCallback(async () => {
    if (!form.title.trim()) {
      showToast("标题不能为空", "error");
      return;
    }

    setSaving(true);
    try {
      const url = editId
        ? `/api/articles/${editId}`
        : "/api/articles";
      const method = editId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          tags: form.tags,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        showToast(data.error || "保存失败", "error");
        return;
      }

      showToast(editId ? "文章已更新" : "文章已发布", "success");
      close();
      // Reload to show changes
      setTimeout(() => window.location.reload(), 500);
    } catch {
      showToast("网络错误，保存失败", "error");
    } finally {
      setSaving(false);
    }
  }, [form, editId, showToast, close]);

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
      id="article-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal modal-lg" id="article-modal">
        <div className="modal-header">
          <h2 id="article-modal-title">{editId ? "编辑文章" : "写文章"}</h2>
          <button className="modal-close" onClick={close}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>文章标题 <span className="required">*</span></label>
            <input
              type="text"
              placeholder="输入文章标题..."
              maxLength={100}
              value={form.title}
              onChange={(e) => updateField("title", e.target.value)}
              required
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>分类</label>
              <input
                type="text"
                placeholder="例如：技术、生活、游戏"
                maxLength={30}
                value={form.category}
                onChange={(e) => updateField("category", e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>子分类</label>
              <input
                type="text"
                placeholder="例如：米哈游"
                maxLength={30}
                value={form.subcategory}
                onChange={(e) => updateField("subcategory", e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>标签</label>
              <input
                type="text"
                placeholder="用逗号分隔，例如：JavaScript, CSS"
                maxLength={200}
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                onBlur={handleTagsBlur}
              />
            </div>
          </div>
          <div className="form-group">
            <label>摘要</label>
            <textarea
              rows={2}
              placeholder="简短描述文章内容..."
              maxLength={300}
              value={form.summary}
              onChange={(e) => updateField("summary", e.target.value)}
            ></textarea>
          </div>
          <div className="form-group">
            <label>封面图片</label>
            <ImageUpload
              currentUrl={form.coverImage}
              onUploaded={(url) => updateField("coverImage", url)}
            />
            <input
              type="url"
              placeholder="或输入图片URL https://... (可选)"
              className="image-url-input"
              value={form.coverImage}
              onChange={(e) => updateField("coverImage", e.target.value)}
            />
          </div>
          <div className="form-group form-checkbox">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={form.isPinned === 1}
                onChange={(e) => updateField("isPinned", e.target.checked ? 1 : 0)}
              />
              <span className="checkbox-text">
                <i className="fa-solid fa-thumbtack"></i> 置顶文章
              </span>
            </label>
          </div>
          <div className="form-group">
            <label>文章内容 <span className="required">*</span></label>
            <div className="editor-toolbar" id="editor-toolbar">
              {[
                { tag: "h3", icon: "fa-heading", title: "标题" },
                { tag: "strong", icon: "fa-bold", title: "加粗" },
                { tag: "em", icon: "fa-italic", title: "斜体" },
                { tag: "u", icon: "fa-underline", title: "下划线" },
                { tag: "blockquote", icon: "fa-quote-right", title: "引用" },
                { tag: "code", icon: "fa-code", title: "代码" },
                { tag: "a", icon: "fa-link", title: "链接" },
                { tag: "hr", icon: "fa-minus", title: "分隔线" },
              ].map((btn) => (
                <button
                  key={btn.tag}
                  type="button"
                  className="editor-btn"
                  title={btn.title}
                  onClick={() => {
                    const textarea = document.getElementById("art-content") as HTMLTextAreaElement;
                    if (!textarea) return;
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const text = textarea.value;
                    const before = text.substring(0, start);
                    const selected = text.substring(start, end);
                    const after = text.substring(end);

                    let replacement = "";
                    switch (btn.tag) {
                      case "h3":
                        replacement = `\n<h3>${selected || "标题"}</h3>\n`;
                        break;
                      case "strong":
                        replacement = `<strong>${selected || "加粗文字"}</strong>`;
                        break;
                      case "em":
                        replacement = `<em>${selected || "斜体文字"}</em>`;
                        break;
                      case "u":
                        replacement = `<u>${selected || "下划线文字"}</u>`;
                        break;
                      case "blockquote":
                        replacement = `\n<blockquote>${selected || "引用内容"}</blockquote>\n`;
                        break;
                      case "code":
                        replacement = `<code>${selected || "代码"}</code>`;
                        break;
                      case "a":
                        replacement = `<a href="${selected || "#"}">${selected || "链接文字"}</a>`;
                        break;
                      case "hr":
                        replacement = "\n<hr>\n";
                        break;
                    }

                    const newValue = before + replacement + after;
                    updateField("content", newValue);
                    // Restore cursor position
                    setTimeout(() => {
                      textarea.focus();
                      textarea.setSelectionRange(
                        before.length + replacement.length,
                        before.length + replacement.length,
                      );
                    }, 0);
                  }}
                >
                  <i className={`fa-solid ${btn.icon}`}></i>
                </button>
              ))}
            </div>
            <textarea
              id="art-content"
              rows={12}
              placeholder="开始写作...&#10;&#10;支持 HTML 标签排版。使用上方工具栏快速插入格式。"
              value={form.content}
              onChange={(e) => updateField("content", e.target.value)}
              required
            ></textarea>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={close}>
            取消
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? (
              <i className="fa-solid fa-spinner fa-spin"></i>
            ) : (
              <i className="fa-solid fa-check"></i>
            )}{" "}
            发布
          </button>
        </div>
      </div>
    </div>
  );
}
