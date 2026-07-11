/**
 * ImageUpload.tsx — Drag/paste upload with progress (React Island)
 * client:load
 *
 * Props:
 * - onUploaded: (url: string) => void
 * - currentUrl?: string
 */

import { useState, useCallback, useRef } from "react";
import { useToast } from "./Toast";

interface Props {
  onUploaded: (url: string) => void;
  currentUrl?: string;
}

export default function ImageUpload({ onUploaded, currentUrl }: Props) {
  const [preview, setPreview] = useState<string | null>(currentUrl || null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const uploadFile = useCallback(
    async (file: File) => {
      // Validate type
      const allowed = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml", "image/avif"];
      if (!allowed.includes(file.type)) {
        showToast("仅支持 PNG / JPG / GIF / WebP / SVG / AVIF 格式", "error");
        return;
      }

      // Validate size (10MB)
      if (file.size > 10 * 1024 * 1024) {
        showToast("文件大小不能超过 10MB", "error");
        return;
      }

      setUploading(true);

      try {
        const formData = new FormData();
        formData.append("image", file);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
          // Auth is via cookie — no need to set Authorization manually
        });

        if (!res.ok) {
          const data = await res.json();
          showToast(data.error || "上传失败", "error");
          return;
        }

        const data = await res.json();
        setPreview(data.url);
        onUploaded(data.url);
        showToast("上传成功", "success");
      } catch {
        showToast("网络错误，上传失败", "error");
      } finally {
        setUploading(false);
      }
    },
    [onUploaded, showToast],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) uploadFile(file);
    },
    [uploadFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) uploadFile(file);
    },
    [uploadFile],
  );

  const removePreview = useCallback(() => {
    setPreview(null);
    onUploaded("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [onUploaded]);

  return (
    <div className="image-upload">
      <div
        className={`image-upload-zone ${dragging ? "dragging" : ""}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        {uploading ? (
          <div className="upload-progress">
            <div className="upload-progress-bar animate-pulse"></div>
            <span>上传中...</span>
          </div>
        ) : preview ? (
          <div className="upload-preview" style={{ display: "block" }}>
            <img src={preview} alt="预览" />
            <button
              type="button"
              className="upload-remove"
              title="移除图片"
              onClick={(e) => {
                e.stopPropagation();
                removePreview();
              }}
            >
              &times;
            </button>
          </div>
        ) : (
          <div className="upload-placeholder">
            <i className="fa-solid fa-cloud-arrow-up"></i>
            <span>点击上传或拖拽图片到此处</span>
            <small>PNG / JPG / GIF / WebP · 最大 10MB</small>
          </div>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp,image/avif"
        hidden
        onChange={handleFileSelect}
      />
    </div>
  );
}
