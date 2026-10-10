import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface GameModalProps {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * 游戏弹窗外壳，风格对齐站内 LoginModal / JumpConfirm。
 * 注意：刻意不绑定 Esc 关闭——游戏内 Esc 是暂停键；关闭只走右上角 ✕ 与点击遮罩。
 * 打开期间锁 body 滚动（<xl 布局下页面本身会滚）。
 */
export default function GameModal({ title, subtitle, onClose, children }: GameModalProps) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // 必须 portal 到 body：游戏卡片带 slide-up 动画（fill both 永久保留 transform），
  // transform 祖先会把 fixed 改为相对卡片定位并被 overflow-hidden 裁切
  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${title}游戏窗口`}
        className="relative w-full max-w-sm bg-[var(--color-surface)] rounded-2xl shadow-2xl shadow-black/10 overflow-hidden"
        style={{ animation: "scale-in 0.15s ease-out" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1 bg-[var(--color-accent)]" />

        <div className="flex items-center justify-between px-5 pt-3.5 pb-2.5">
          <div className="flex items-baseline gap-2">
            <h3 className="text-base font-bold text-[var(--color-text)] tracking-[-0.01em]">{title}</h3>
            <span className="text-[10px] font-mono tracking-[0.18em] uppercase text-[var(--color-text-subtle)]">
              {subtitle}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="关闭游戏"
            className="w-8 h-8 -mr-1.5 flex items-center justify-center rounded-lg text-[var(--color-text-subtle)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 pb-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}
