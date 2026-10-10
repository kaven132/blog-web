import { useCallback, useEffect, useRef, useState, type DragEvent as ReactDragEvent, type MouseEvent as ReactMouseEvent, type WheelEvent as ReactWheelEvent } from "react";

/**
 * 头像裁切弹窗（ProfileCard 侧边卡与 /account 账户页共用）。
 * 父组件只负责：选文件 → readFileAsDataURL → <AvatarCropModal src={dataUrl} .../>，
 * 确认后拿到方形 dataUrl（默认 200px JPEG）自行上传 / 写库。
 * 平移 / 缩放 / 导出坐标系的历史坑都写在对应函数注释里，改动前先读。
 */

export const CROP_SIZE = 250; // px — 裁切框边长

// Load image from File → data URL
export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// 裁切结果上传成文件（浏览器可缓存），返回 /uploads/xxx；失败时调用方退回 dataURL
export async function uploadImageFile(dataUrl: string): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob();
  const fd = new FormData();
  fd.append("file", blob, "avatar.jpg");
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "上传失败");
  return data.url as string;
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

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

interface AvatarCropModalProps {
  src: string;
  onCancel: () => void;
  onConfirm: (dataUrl: string) => void;
}

export default function AvatarCropModal({ src, onCancel, onConfirm }: AvatarCropModalProps) {
  const [nat, setNat] = useState({ w: CROP_SIZE, h: CROP_SIZE });
  const [scale, setScale] = useState(1);
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, cx: 0, cy: 0 });

  // 裁切框内图片的基准显示尺寸（依赖原图宽高比）
  const base = baseSizeOf(nat.w, nat.h);

  // 换图时重置原始尺寸
  useEffect(() => {
    readImageSize(src)
      .then(setNat)
      .catch(() => onCancel());
  }, [src, onCancel]);

  const cropMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      setDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY, cx: x, cy: y };
    },
    [x, y]
  );

  const cropMouseMove = useCallback(
    (e: ReactMouseEvent) => {
      if (!dragging) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      // 拖图手感：鼠标往右拖，图片跟着往右走（露出更靠左的部分），平移量取负。
      // 旧实现用 +dx，方向是反的，像在拖取景框而不是拖图；且 maxPan 公式少乘了一个 scale。
      const limit = panLimitOf(nat.w, nat.h, scale);
      setX(clamp(dragStart.current.cx - dx, 0, limit.x));
      setY(clamp(dragStart.current.cy - dy, 0, limit.y));
    },
    [dragging, scale, nat]
  );

  const cropMouseUp = useCallback(() => setDragging(false), []);

  // 缩放到指定倍数，并以裁切框中心为锚点重新夹取平移量
  const zoomTo = useCallback(
    (next: number) => {
      const nextScale = clamp(next, 1, 3);
      if (nextScale === scale) return;
      const k = nextScale / scale;
      const limit = panLimitOf(nat.w, nat.h, nextScale);
      setX((prev) => clamp((prev + CROP_SIZE / 2) * k - CROP_SIZE / 2, 0, limit.x));
      setY((prev) => clamp((prev + CROP_SIZE / 2) * k - CROP_SIZE / 2, 0, limit.y));
      setScale(nextScale);
    },
    [scale, nat]
  );

  const cropWheel = useCallback(
    (e: ReactWheelEvent) => {
      e.preventDefault();
      zoomTo(scale + (e.deltaY > 0 ? -0.1 : 0.1));
    },
    [scale, zoomTo]
  );

  const confirm = useCallback(async () => {
    const dataUrl = await cropToAvatar(src, nat.w, nat.h, scale, x, y, 200);
    onConfirm(dataUrl);
  }, [src, nat, scale, x, y, onConfirm]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onMouseMove={cropMouseMove}
      onMouseUp={cropMouseUp}
      onMouseLeave={cropMouseUp}
    >
      <div className="bg-[var(--color-surface)] rounded-2xl shadow-2xl overflow-hidden max-w-sm w-full">
        {/* Modal header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">裁切头像</h3>
          <button
            onClick={onCancel}
            className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--color-text-subtle)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-all"
          >
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
              src={src}
              alt="裁切"
              draggable={false}
              className="absolute origin-top-left max-w-none"
              style={{
                width: base.w,
                height: base.h,
                transform: `translate(${-x}px, ${-y}px) scale(${scale})`,
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
              value={scale}
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
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 text-sm font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-all"
          >
            取消
          </button>
          <button
            onClick={confirm}
            className="flex-1 py-2.5 text-sm font-semibold rounded-lg bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors"
          >
            确认
          </button>
        </div>
      </div>
    </div>
  );
}

/** 拖拽事件的通用工具：取出首个图片文件（供父组件复用） */
export function imageFileFromDrag(e: ReactDragEvent): File | null {
  e.preventDefault();
  const file = e.dataTransfer.files?.[0];
  return file && file.type.startsWith("image/") ? file : null;
}
