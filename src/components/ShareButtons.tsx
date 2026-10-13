import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

/**
 * 文章分享按钮组（详情页「点赞」旁）。
 * - 复制链接：写剪贴板
 * - 微信：弹二维码（手机扫码后在微信内打开再转发）
 * - 更多：走系统分享面板（仅支持的浏览器显示，移动端 / 新版 Edge-Chrome）
 * 深浅色：二维码白底深码保证可扫，弹层走站点 token。
 */
export default function ShareButtons({ title }: { title: string }) {
  const [qrOpen, setQrOpen] = useState(false);
  const [qrData, setQrData] = useState("");
  const [copied, setCopied] = useState(false);
  const [canWebShare, setCanWebShare] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const pageUrl = useCallback(() => `${location.origin}${location.pathname}`, []);

  // 系统分享能力在客户端探测（SSR 首帧隐藏，避免 hydration 不一致）
  useEffect(() => {
    setCanWebShare(typeof navigator.share === "function");
  }, []);

  // 点外部收起二维码
  useEffect(() => {
    if (!qrOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setQrOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [qrOpen]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(`${pageUrl()}  ${title}`.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 剪贴板不可用（非安全上下文等）：静默
    }
  }, [title]);

  const toggleQr = useCallback(async () => {
    if (!qrOpen && !qrData) {
      setQrData(await QRCode.toDataURL(pageUrl(), { width: 180, margin: 1 }));
    }
    setQrOpen((v) => !v);
  }, [qrOpen, qrData]);

  const webShare = useCallback(async () => {
    try {
      await navigator.share({ title, url: pageUrl() });
    } catch {
      /* 用户取消 */
    }
  }, [title]);

  const btn =
    "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium text-[var(--color-text-muted)] bg-[var(--color-bg)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/40 hover:text-[var(--color-accent)] transition-all";

  return (
    <div className="relative flex items-center gap-2 flex-wrap justify-center" ref={wrapRef}>
      <span className="text-xs text-[var(--color-text-subtle)] uppercase tracking-widest font-semibold">分享</span>

      <button type="button" onClick={copyLink} className={btn} title="复制文章链接">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
        </svg>
        {copied ? "已复制" : "复制链接"}
      </button>

      <div className="relative">
        <button type="button" onClick={toggleQr} className={btn} title="微信扫码分享">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8.694 3C4.907 3 1.836 5.516 1.836 8.622c0 1.76.955 3.325 2.446 4.352l-.612 1.84 2.143-1.076c.614.181 1.267.312 1.947.373a5.26 5.26 0 0 1-.086-.941c0-2.906 2.907-5.263 6.49-5.263.32 0 .635.02.944.058C14.443 4.88 11.846 3 8.694 3Zm-2.28 3.02a.92.92 0 1 1 0 1.84.92.92 0 0 1 0-1.84Zm4.56 0a.92.92 0 1 1 0 1.84.92.92 0 0 1 0-1.84Z" />
            <path d="M15.94 8.627c-3.148 0-5.697 2.023-5.697 4.518 0 2.494 2.55 4.517 5.697 4.517.51 0 1.004-.058 1.474-.164l1.988 1.161-.546-1.757c1.147-.83 1.877-2.015 1.877-3.332v-.456c-.224-2.32-2.638-4.487-5.793-4.487Zm-2.24 2.28a.79.79 0 1 1 0 1.58.79.79 0 0 1 0-1.58Zm4.48 0a.79.79 0 1 1 0 1.58.79.79 0 0 1 0-1.58Z" />
          </svg>
          微信
        </button>
        {qrOpen && (
          <div
            ref={popRef}
            className="absolute z-20 top-full mt-2 left-1/2 -translate-x-1/2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-lg p-3 w-[168px] text-center"
          >
            {qrData ? (
              <img src={qrData} alt="文章二维码" className="w-[140px] h-[140px] rounded-md" />
            ) : (
              <div className="w-[140px] h-[140px] rounded-md bg-[var(--color-bg)] animate-pulse" />
            )}
            <p className="text-[10px] text-[var(--color-text-subtle)] mt-1.5 leading-snug">微信扫码，在手机上打开后分享</p>
          </div>
        )}
      </div>

      {canWebShare && (
        <button type="button" onClick={webShare} className={btn} title="系统分享">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.486 9.566 5.314m0-12.614a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Zm0 12.614a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z" />
          </svg>
          更多
        </button>
      )}

      {copied && (
        <span className="text-xs text-[var(--color-accent)] font-medium">链接已复制 ✓</span>
      )}
    </div>
  );
}
