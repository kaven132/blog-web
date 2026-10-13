import { useCallback, useEffect, useRef, useState } from "react";
import { CORAL, boardColors } from "./palette";

/**
 * 贪吃蛇（弹窗内对局），渲染风格与 Tetris.tsx 一致（暖白棋盘 + 珊瑚红蛇身）。
 * 高频数据（蛇身/食物/方向/分数）放 ref 供 rAF 循环读写，React state 只存 UI 数字与阶段。
 * 转向走「方向队列」：两次 tick 之间的多次按键按序生效，且禁止 180° 掉头。
 */

const COLS = 20;
const ROWS = 20;

const SNAKE_BODY = CORAL.soft;
const SNAKE_HEAD = CORAL.deep;
const FOOD_COLOR = CORAL.bright;
const FOOD_RING = "rgba(217, 79, 67, 0.3)";

interface Point {
  x: number;
  y: number;
}
type Dir = "up" | "down" | "left" | "right";
type Phase = "running" | "paused" | "over";

const DIRS: Record<Dir, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const OPPOSITE: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };

const HIGH_SCORE_KEY = "snake-high-score-v1";
const BASE_TICK = 200; // 开局步进间隔 ms（放缓起步）
const MIN_TICK = 120;  // 速度下限，保证可反应
const FOODS_PER_LEVEL = 4; // 每吃 4 个提速一档（升档更稀）

export default function Snake() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const snakeRef = useRef<Point[]>([]);
  const foodRef = useRef<Point>({ x: 0, y: 0 });
  const dirRef = useRef<Dir>("right");
  const queueRef = useRef<Dir[]>([]);
  const scoreRef = useRef(0);
  const eatenRef = useRef(0);
  const levelRef = useRef(1);
  const phaseRef = useRef<Phase>("running");

  const [phase, setPhase] = useState<Phase>("running");
  const [score, setScore] = useState(0);
  const [length, setLength] = useState(3);
  const [level, setLevel] = useState(1);
  const [high, setHigh] = useState(0);
  const [newHigh, setNewHigh] = useState(false);

  phaseRef.current = phase;

  const tickInterval = () => Math.max(MIN_TICK, BASE_TICK - (levelRef.current - 1) * 10);

  const spawnFood = useCallback(() => {
    const snake = snakeRef.current;
    let p: Point;
    do {
      p = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    } while (snake.some((s) => s.x === p.x && s.y === p.y));
    foodRef.current = p;
  }, []);

  // ── 绘制 ──
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const w = canvas.clientWidth;
    const cw = w / COLS;
    const ch = canvas.clientHeight / ROWS;

    ctx.fillStyle = boardColors().bg;
    ctx.fillRect(0, 0, w, canvas.clientHeight);
    ctx.strokeStyle = boardColors().grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 1; c < COLS; c++) {
      ctx.moveTo(c * cw, 0);
      ctx.lineTo(c * cw, canvas.clientHeight);
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.moveTo(0, r * ch);
      ctx.lineTo(w, r * ch);
    }
    ctx.stroke();

    // 食物：实心圆 + 外圈
    const food = foodRef.current;
    ctx.fillStyle = FOOD_RING;
    ctx.beginPath();
    ctx.arc((food.x + 0.5) * cw, (food.y + 0.5) * ch, cw * 0.44, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = FOOD_COLOR;
    ctx.beginPath();
    ctx.arc((food.x + 0.5) * cw, (food.y + 0.5) * ch, cw * 0.28, 0, Math.PI * 2);
    ctx.fill();

    // 蛇身：圆角方块，头最实
    const seg = (p: Point, color: string, inset: number) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(p.x * cw + inset, p.y * ch + inset, cw - inset * 2, ch - inset * 2, 4);
      ctx.fill();
    };
    const snake = snakeRef.current;
    snake.forEach((p, i) => seg(p, i === 0 ? SNAKE_HEAD : SNAKE_BODY, i === 0 ? 1 : 1.8));

    // 蛇头眼睛：按当前朝向定位
    const head = snake[0];
    if (head) {
      const d = DIRS[dirRef.current];
      const cx = (head.x + 0.5) * cw;
      const cy = (head.y + 0.5) * ch;
      // 垂直于运动方向的偏移 + 沿运动方向的前移
      const px = d.y !== 0 ? 1 : d.x;
      const py = d.x !== 0 ? 1 : d.y;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(cx + px * cw * 0.18 + d.x * cw * 0.12, cy + py * ch * 0.18 + d.y * ch * 0.12, Math.max(1.4, cw * 0.07), 0, Math.PI * 2);
      ctx.arc(cx - px * cw * 0.18 + d.x * cw * 0.12, cy - py * ch * 0.18 + d.y * ch * 0.12, Math.max(1.4, cw * 0.07), 0, Math.PI * 2);
      ctx.fill();
    }
  }, []);

  // ── 游戏逻辑 ──
  const finishGame = useCallback(() => {
    setPhase("over");
    try {
      const prev = Number(localStorage.getItem(HIGH_SCORE_KEY) || 0);
      if (scoreRef.current > prev) {
        localStorage.setItem(HIGH_SCORE_KEY, String(scoreRef.current));
        setHigh(scoreRef.current);
        setNewHigh(true);
      } else {
        setNewHigh(false);
      }
    } catch {
      setNewHigh(false);
    }
  }, []);

  const step = useCallback(() => {
    // 从队列取下一个方向，跳过与当前相反的
    while (queueRef.current.length > 0) {
      const next = queueRef.current.shift()!;
      if (next !== dirRef.current && next !== OPPOSITE[dirRef.current]) {
        dirRef.current = next;
        break;
      }
    }

    const snake = snakeRef.current;
    const d = DIRS[dirRef.current];
    const head: Point = { x: snake[0].x + d.x, y: snake[0].y + d.y };

    // 撞墙
    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
      finishGame();
      return;
    }

    // 吃到食物：蛇变长（尾部不动），否则尾部挪走 —— 自撞判定按「尾部将离开」放宽一格
    const eating = head.x === foodRef.current.x && head.y === foodRef.current.y;
    const body = eating ? snake : snake.slice(0, -1);
    if (body.some((p) => p.x === head.x && p.y === head.y)) {
      finishGame();
      return;
    }

    snake.unshift(head);
    if (eating) {
      scoreRef.current += 10;
      eatenRef.current += 1;
      levelRef.current = Math.floor(eatenRef.current / FOODS_PER_LEVEL) + 1;
      setScore(scoreRef.current);
      setLength(snake.length);
      setLevel(levelRef.current);
      spawnFood();
    } else {
      snake.pop();
    }
    draw();
  }, [draw, finishGame, spawnFood]);

  const resetGame = useCallback(() => {
    const cy = Math.floor(ROWS / 2);
    snakeRef.current = [
      { x: 8, y: cy },
      { x: 7, y: cy },
      { x: 6, y: cy },
    ];
    dirRef.current = "right";
    queueRef.current = [];
    scoreRef.current = 0;
    eatenRef.current = 0;
    levelRef.current = 1;
    setScore(0);
    setLength(3);
    setLevel(1);
    setNewHigh(false);
    spawnFood();
    setPhase("running");
    draw();
  }, [spawnFood, draw]);

  const turn = useCallback((dir: Dir) => {
    if (phaseRef.current !== "running") return;
    const last = queueRef.current[queueRef.current.length - 1] ?? dirRef.current;
    if (dir === last || dir === OPPOSITE[last] || queueRef.current.length >= 3) return;
    queueRef.current.push(dir);
  }, []);

  const togglePause = useCallback(() => {
    setPhase((p) => (p === "running" ? "paused" : p === "paused" ? "running" : p));
  }, []);

  // ── 副作用 ──
  useEffect(() => {
    const setup = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      canvas.getContext("2d")!.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };
    setup();
    window.addEventListener("resize", setup);
    return () => window.removeEventListener("resize", setup);
  }, [draw]);

  // 步进循环：rAF + 时间累积，速度跟随 levelRef
  useEffect(() => {
    if (phase !== "running") return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const frame = (now: number) => {
      acc += now - last;
      last = now;
      while (acc >= tickInterval()) {
        acc -= tickInterval();
        if (phaseRef.current !== "running") break;
        step();
      }
      draw();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phase, step, draw]);

  // 键盘：方向键 / WASD 转向，P/Esc 暂停
  useEffect(() => {
    const KEY_MAP: Record<string, Dir> = {
      ArrowUp: "up", w: "up", W: "up",
      ArrowDown: "down", s: "down", S: "down",
      ArrowLeft: "left", a: "left", A: "left",
      ArrowRight: "right", d: "right", D: "right",
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "p" || e.key === "P" || e.key === "Escape") {
        e.preventDefault();
        togglePause();
        return;
      }
      const dir = KEY_MAP[e.key];
      if (!dir || phaseRef.current !== "running") return;
      e.preventDefault();
      turn(dir);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [turn, togglePause]);

  // 切走标签页自动暂停
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && phaseRef.current === "running") setPhase("paused");
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // 初始化
  useEffect(() => {
    try {
      setHigh(Number(localStorage.getItem(HIGH_SCORE_KEY) || 0));
    } catch {
      /* 拿不到就算了 */
    }
    resetGame();
  }, [resetGame]);

  const statClass = "rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5";

  return (
    <div>
      {/* 记分区 */}
      <div className="grid grid-cols-4 gap-1.5">
        <div className={statClass}>
          <p className="text-[10px] text-[var(--color-text-subtle)]">分数</p>
          <p className="text-sm font-bold tabular-nums text-[var(--color-text)]">{score}</p>
        </div>
        <div className={statClass}>
          <p className="text-[10px] text-[var(--color-text-subtle)]">最高</p>
          <p className="text-sm font-bold tabular-nums text-[var(--color-text)]">{high}</p>
        </div>
        <div className={statClass}>
          <p className="text-[10px] text-[var(--color-text-subtle)]">长度</p>
          <p className="text-sm font-bold tabular-nums text-[var(--color-text)]">{length}</p>
        </div>
        <div className={statClass}>
          <p className="text-[10px] text-[var(--color-text-subtle)]">速度</p>
          <p className="text-sm font-bold tabular-nums text-[var(--color-text)]">{level}</p>
        </div>
      </div>

      {/* 棋盘 */}
      <div className="relative mt-3">
        <canvas
          ref={canvasRef}
          className="block w-full aspect-square rounded-xl border border-[var(--color-border)]"
        />
        {(phase === "paused" || phase === "over") && (
          <div className="absolute inset-0 rounded-xl bg-[var(--color-surface)]/85 backdrop-blur-sm flex flex-col items-center justify-center gap-2.5 px-4">
            {phase === "paused" ? (
              <>
                <p className="text-sm font-bold text-[var(--color-text)]">已暂停</p>
                <p className="text-[11px] text-[var(--color-text-subtle)]">按 P 或 Esc 继续</p>
                <button
                  onClick={togglePause}
                  className="px-4 py-1.5 text-xs font-medium rounded-lg bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors"
                >
                  继续游戏
                </button>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-[var(--color-text)]">游戏结束</p>
                <p className="text-xs text-[var(--color-text-muted)] tabular-nums">
                  得分 {score} · 长度 {length}
                </p>
                {newHigh && (
                  <p className="text-xs font-semibold text-[var(--color-accent)]">🎉 新的最高分！</p>
                )}
                <button
                  onClick={resetGame}
                  className="px-4 py-1.5 text-xs font-medium rounded-lg bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors"
                >
                  再来一局
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* 键盘提示（桌面端） */}
      <p className="hidden md:block mt-2.5 text-center text-[10px] leading-relaxed text-[var(--color-text-subtle)]">
        ↑ ↓ ← → / WASD 转向 · P/Esc 暂停 · 每吃 4 个食物提速
      </p>

      {/* 触屏方向键（小屏） */}
      <div className="mt-3 grid grid-cols-3 gap-2 md:hidden">
        <span />
        {[
          { label: "↑", dir: "up" as Dir },
        ].map((b) => (
          <button
            key={b.label}
            onPointerDown={(e) => {
              e.preventDefault();
              turn(b.dir);
            }}
            className="h-11 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-base text-[var(--color-text-muted)] active:bg-[var(--color-bg)] active:text-[var(--color-accent)] select-none touch-none"
          >
            {b.label}
          </button>
        ))}
        <span />
        {([
          { label: "←", dir: "left" as Dir },
          { label: "↓", dir: "down" as Dir },
          { label: "→", dir: "right" as Dir },
        ]).map((b) => (
          <button
            key={b.label}
            onPointerDown={(e) => {
              e.preventDefault();
              turn(b.dir);
            }}
            className="h-11 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-base text-[var(--color-text-muted)] active:bg-[var(--color-bg)] active:text-[var(--color-accent)] select-none touch-none"
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}
