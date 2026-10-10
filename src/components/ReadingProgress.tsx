import { useState, useEffect, useRef } from "react";

/**
 * 阅读进度条。
 * AppShell 在 ≥xl 下是「双列独立滚动」布局，文章在右列自己的滚动容器里，
 * window 不再产生滚动事件 —— 所以这里从自身位置向上找第一个可滚动祖先来算进度，
 * 找不到（<xl 整页滚动 / 常规文档流）时回退到 window。
 * scroll 事件不冒泡但会经过捕获阶段，因此监听 document 捕获即可同时覆盖两种容器。
 */
export default function ReadingProgress() {
  const [progress, setProgress] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const findScroller = (): HTMLElement | null => {
      let el = rootRef.current?.parentElement;
      while (el) {
        const { overflowY } = getComputedStyle(el);
        if ((overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight) {
          return el;
        }
        el = el.parentElement;
      }
      return null;
    };
    const onScroll = () => {
      if (raf) return; // 滚动事件高频触发，合成帧级别更新即可
      raf = requestAnimationFrame(() => {
        raf = 0;
        const scroller = findScroller();
        const scrollTop = scroller ? scroller.scrollTop : window.scrollY;
        const maxScroll = scroller
          ? scroller.scrollHeight - scroller.clientHeight
          : document.documentElement.scrollHeight - window.innerHeight;
        setProgress(maxScroll > 0 ? Math.min((scrollTop / maxScroll) * 100, 100) : 0);
      });
    };
    // capture: true 才能收到内部滚动容器（不冒泡）的 scroll 事件
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll, { capture: true } as EventListenerOptions);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // 始终挂载根节点（findScroller 依赖它定位），未开始阅读时仅视觉隐藏
  return (
    <div
      ref={rootRef}
      className={`fixed top-0 left-0 right-0 z-[100] h-[2px] ${progress < 0.5 ? "invisible" : ""}`}
    >
      <div
        className="h-full bg-[var(--color-accent)] transition-[width] duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
