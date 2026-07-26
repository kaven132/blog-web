import { useEffect } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open, title, message, confirmLabel = "确认", cancelLabel = "取消",
  danger = false, onConfirm, onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-xs bg-[var(--color-surface)] rounded-2xl shadow-2xl shadow-black/10 overflow-hidden"
        style={{ animation: "scale-in 0.15s ease-out" }}
      >
        {/* Decorative top bar */}
        <div className={`h-1 ${danger ? "bg-red-400" : "bg-[var(--color-accent)]"}`} />

        {/* Content */}
        <div className="px-6 pt-6 pb-2 text-center">
          {/* Icon */}
          <div className={`w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center ${
            danger
              ? "bg-red-50 text-red-400"
              : "bg-[var(--color-accent-muted)] text-[var(--color-accent)]"
          }`}>
            {danger ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
              </svg>
            )}
          </div>

          <h3 className="text-lg font-bold text-[var(--color-text)] tracking-[-0.01em] mb-1.5">
            {title}
          </h3>
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed font-serif">
            {message}
          </p>
        </div>

        {/* Actions */}
        <div className="flex border-t border-[var(--color-border)] mt-4">
          <button
            onClick={onCancel}
            className="flex-1 py-3 text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] transition-colors border-r border-[var(--color-border)]"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              danger
                ? "text-red-500 hover:bg-red-50"
                : "text-[var(--color-accent)] hover:bg-[var(--color-accent-muted)]"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
