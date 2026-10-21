import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

/**
 * 文章分享按钮组（详情页「点赞」旁）。
 * - 复制链接：写剪贴板
 * - 微信：弹二维码（手机扫码后在微信内打开再转发）
 * - 更多：走系统分享面板（仅支持的浏览器显示，移动端 / 新版 Edge-Chrome）
 * 深浅色：二维码白底深码保证可扫，弹层走站点 token。
 */
interface ShareButtonsProps {
  title: string;
  /** 封面图（应传入同源 URL——远程图先经 /api/img 代理，避免 Canvas 跨域污染） */
  coverImage?: string;
  /** 发布日期（展示用中文日期） */
  date?: string;
}

export default function ShareButtons({ title, coverImage, date }: ShareButtonsProps) {
  const [qrOpen, setQrOpen] = useState(false);
  const [qrData, setQrData] = useState("");
  const [copied, setCopied] = useState(false);
  const [canWebShare, setCanWebShare] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [cardData, setCardData] = useState("");
  const [cardBusy, setCardBusy] = useState(false);
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

  /** 分享卡片：Canvas 绘制 900x1200 竖版（封面 + 标题 + 日期作者 + 二维码） */
  const generateCard = useCallback(async () => {
    if (cardBusy) return;
    setCardBusy(true);
    try {
      const W = 900, H = 1200;
      const cv = document.createElement("canvas");
      cv.width = W; cv.height = H;
      const ctx = cv.getContext("2d");
      if (!ctx) throw new Error("no 2d context");

      // 底色与内容区留白
      ctx.fillStyle = "#faf6f0";
      ctx.fillRect(0, 0, W, H);

      // 封面（900x500 cover 裁剪）；无封面或加载失败 → 主题色渐变 + 站名
      const coverH = 500;
      let coverDrawn = false;
      if (coverImage) {
        try {
          const img = await new Promise<HTMLImageElement>((res, rej) => {
            const im = new Image();
            im.onload = () => res(im);
            im.onerror = () => rej(new Error("cover failed"));
            im.src = coverImage;
          });
          const scale = Math.max(W / img.width, coverH / img.height);
          const dw = img.width * scale, dh = img.height * scale;
          ctx.drawImage(img, (W - dw) / 2, (coverH - dh) / 2, dw, dh);
          coverDrawn = true;
        } catch { /* 回退渐变 */ }
      }
      if (!coverDrawn) {
        const grad = ctx.createLinearGradient(0, 0, W, coverH);
        grad.addColorStop(0, "#e8907a");
        grad.addColorStop(1, "#d94040");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, coverH);
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.font = "700 64px 'DM Sans', 'Noto Sans SC', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Kaven", W / 2, coverH / 2 + 22);
        ctx.textAlign = "left";
      }

      // 标题：最多 3 行，超出省略
      ctx.fillStyle = "#1d1c1a";
      ctx.font = "700 46px 'Noto Sans SC', sans-serif";
      let line = "", lines: string[] = [];
      for (const ch of title) {
        if (ctx.measureText(line + ch).width > W - 120) {
          lines.push(line);
          line = ch;
          if (lines.length === 3) break;
        } else line += ch;
      }
      if (lines.length < 3 && line) lines.push(line);
      if (lines.length === 3) { const l3 = lines[2]; while (l3 && ctx.measureText(l3 + "…").width > W - 120) lines[2] = lines[2].slice(0, -1); lines[2] += "…"; }
      let ty = coverH + 100;
      for (const l of lines) { ctx.fillText(l, 60, ty); ty += 64; }

      // 日期与作者
      ctx.font = "26px 'Noto Sans SC', sans-serif";
      ctx.fillStyle = "#8a857c";
      ctx.fillText(`${date ? date + "  ·  " : ""}Kaven 的个人网页`, 60, ty + 24);

      // 分隔线
      ctx.strokeStyle = "#e5ded2";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(60, H - 280); ctx.lineTo(W - 60, H - 280); ctx.stroke();

      // 二维码 + 扫码提示
      const qr = await QRCode.toDataURL(pageUrl(), { width: 340, margin: 1, color: { dark: "#1d1c1a" } });
      const qimg = await new Promise<HTMLImageElement>((res) => { const im = new Image(); im.onload = () => res(im); im.src = qr; });
      ctx.drawImage(qimg, 60, H - 240, 180, 180);
      ctx.fillStyle = "#1d1c1a";
      ctx.font = "600 30px 'Noto Sans SC', sans-serif";
      ctx.fillText("扫码阅读全文", 275, H - 130);
      ctx.font = "24px 'Noto Sans SC', sans-serif";
      ctx.fillStyle = "#8a857c";
      ctx.fillText("Kaven 的个人网页", 275, H - 88);

      setCardData(cv.toDataURL("image/png"));
      setCardOpen(true);
    } catch {
      alert("分享图生成失败，请重试");
    } finally {
      setCardBusy(false);
    }
  }, [title, coverImage, date]);

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

      <button type="button" onClick={generateCard} className={btn} title="生成分享卡片" disabled={cardBusy}>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
        </svg>
        {cardBusy ? "生成中…" : "分享图"}
      </button>

      {cardOpen && cardData && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setCardOpen(false)}>
          <div className="max-h-[92vh] flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <img src={cardData} alt="文章分享卡片" className="max-h-[76vh] w-auto rounded-xl shadow-2xl" />
            <div className="flex items-center gap-3">
              <a href={cardData} download="kaven-blog-share.png" className="px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors">
                保存图片
              </a>
              <button type="button" onClick={() => setCardOpen(false)} className="px-4 py-2 text-sm font-medium rounded-lg bg-white/10 text-white border border-white/30 hover:bg-white/20 transition-colors">
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {copied && (
        <span className="text-xs text-[var(--color-accent)] font-medium">链接已复制 ✓</span>
      )}
    </div>
  );
}
