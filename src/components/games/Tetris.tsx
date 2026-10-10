import { useCallback, useEffect, useRef, useState } from "react";
import { BOARD_BG, BOARD_GRID, CORAL, DUSTY, GOLD, AMBER } from "./palette";

/**
 * 俄罗斯方块（弹窗内对局）。
 * 状态分两层：棋盘/当前块/回合数等高频数据放 ref，rAF 循环里直接读写；
 * React state 只存 UI 需要的分数、行数、等级、下一个块与游戏阶段。
 * 色值镜像 global.css 的暖白基调（BOARD_*），方块用一组与珊瑚红点缀协调的低饱和色。
 */

const COLS = 10;
const ROWS = 20;

type PieceKey = "I" | "J" | "L" | "O" | "S" | "T" | "Z";

const PIECES: Record<PieceKey, { color: string; matrix: number[][] }> = {
  I: { color: DUSTY.blue, matrix: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]] },
  J: { color: DUSTY.violet, matrix: [[1, 0, 0], [1, 1, 1], [0, 0, 0]] },
  L: { color: AMBER, matrix: [[0, 0, 1], [1, 1, 1], [0, 0, 0]] },
  O: { color: GOLD, matrix: [[1, 1], [1, 1]] },
  S: { color: DUSTY.sage, matrix: [[0, 1, 1], [1, 1, 0], [0, 0, 0]] },
  T: { color: DUSTY.rose, matrix: [[0, 1, 0], [1, 1, 1], [0, 0, 0]] },
  Z: { color: CORAL.main, matrix: [[1, 1, 0], [0, 1, 1], [0, 0, 0]] },
};

const LINE_SCORES = [0, 100, 300, 500, 800];
const HIGH_SCORE_KEY = "tetris-high-score-v1";

type Board = (PieceKey | null)[][];
interface ActivePiece {
  key: PieceKey;
  matrix: number[][];
  x: number;
  y: number;
}
type Phase = "running" | "paused" | "over";

function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<PieceKey | null>(COLS).fill(null));
}

function rotateCW(m: number[][]): number[][] {
  return m.map((_, i) => m.map((row) => row[i]).reverse());
}

function collides(board: Board, matrix: number[][], x: number, y: number): boolean {
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (!matrix[r][c]) continue;
      const nx = x + c;
      const ny = y + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function shuffledBag(): PieceKey[] {
  const keys: PieceKey[] = ["I", "J", "L", "O", "S", "T", "Z"];
  for (let i = keys.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [keys[i], keys[j]] = [keys[j], keys[i]];
  }
  return keys;
}

/** 每 10 行升一级，重力间隔随之缩短 */
const dropInterval = (level: number) => Math.max(80, 620 - (level - 1) * 55);

export default function Tetris() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nextCanvasRef = useRef<HTMLCanvasElement>(null);
  const boardRef = useRef<Board>(emptyBoard());
  const pieceRef = useRef<ActivePiece | null>(null);
  const bagRef = useRef<PieceKey[]>([]);
  const nextKeyRef = useRef<PieceKey>("I");
  const scoreRef = useRef(0);
  const linesRef = useRef(0);
  const levelRef = useRef(1);
  const phaseRef = useRef<Phase>("running");

  const [phase, setPhase] = useState<Phase>("running");
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [nextKey, setNextKey] = useState<PieceKey>("I");
  const [high, setHigh] = useState(0);
  const [newHigh, setNewHigh] = useState(false);

  phaseRef.current = phase;

  // ── 绘制 ──
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const cw = w / COLS;
    const ch = h / ROWS;

    ctx.fillStyle = BOARD_BG;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = BOARD_GRID;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 1; c < COLS; c++) {
      ctx.moveTo(c * cw, 0);
      ctx.lineTo(c * cw, h);
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.moveTo(0, r * ch);
      ctx.lineTo(w, r * ch);
    }
    ctx.stroke();

    const cell = (x: number, y: number, key: PieceKey, alpha = 1) => {
      if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = PIECES[key].color;
      ctx.beginPath();
      ctx.roundRect(x * cw + 1.5, y * ch + 1.5, cw - 3, ch - 3, 4);
      ctx.fill();
      ctx.globalAlpha = 1;
    };

    boardRef.current.forEach((row, r) => row.forEach((k, c) => k && cell(c, r, k, 0.92)));

    const piece = pieceRef.current;
    if (piece) {
      // 幽灵投影：当前块一路到底的位置
      let gy = piece.y;
      while (!collides(boardRef.current, piece.matrix, piece.x, gy + 1)) gy++;
      if (gy !== piece.y) {
        piece.matrix.forEach((row, r) =>
          row.forEach((v, c) => v && cell(piece.x + c, gy + r, piece.key, 0.18))
        );
      }
      piece.matrix.forEach((row, r) =>
        row.forEach((v, c) => v && cell(piece.x + c, piece.y + r, piece.key))
      );
    }
  }, []);

  const drawNext = useCallback(() => {
    const canvas = nextCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);
    const matrix = PIECES[nextKeyRef.current].matrix;
    const cell = Math.min(w, h) / 4.5;
    const ox = (w - matrix.length * cell) / 2;
    const oy = (h - matrix.length * cell) / 2;
    ctx.fillStyle = PIECES[nextKeyRef.current].color;
    matrix.forEach((row, r) =>
      row.forEach((v, c) => {
        if (!v) return;
        ctx.beginPath();
        ctx.roundRect(ox + c * cell + 1, oy + r * cell + 1, cell - 2, cell - 2, 3);
        ctx.fill();
      })
    );
  }, []);

  // ── 游戏逻辑 ──
  const takeNext = (): PieceKey => {
    if (bagRef.current.length === 0) bagRef.current = shuffledBag();
    return bagRef.current.pop()!;
  };

  const spawnPiece = useCallback((): boolean => {
    const key = nextKeyRef.current;
    nextKeyRef.current = takeNext();
    setNextKey(nextKeyRef.current);
    const matrix = PIECES[key].matrix.map((row) => [...row]);
    const piece: ActivePiece = { key, matrix, x: ((COLS - matrix.length) / 2) | 0, y: 0 };
    pieceRef.current = piece;
    drawNext();
    // 出生点就被堵 → 游戏结束
    return !collides(boardRef.current, matrix, piece.x, piece.y);
  }, [drawNext]);

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

  const lockPiece = useCallback(() => {
    const piece = pieceRef.current;
    if (!piece) return;
    const board = boardRef.current;
    piece.matrix.forEach((row, r) =>
      row.forEach((v, c) => {
        if (v && piece.y + r >= 0) board[piece.y + r][piece.x + c] = piece.key;
      })
    );

    // 消行：把非满行留下，顶部补空行
    const kept = board.filter((row) => row.some((cell) => !cell));
    const cleared = ROWS - kept.length;
    if (cleared > 0) {
      while (kept.length < ROWS) kept.unshift(Array<PieceKey | null>(COLS).fill(null));
      boardRef.current = kept;
      linesRef.current += cleared;
      levelRef.current = Math.floor(linesRef.current / 10) + 1;
      scoreRef.current += LINE_SCORES[cleared] * levelRef.current;
      setLines(linesRef.current);
      setLevel(levelRef.current);
      setScore(scoreRef.current);
    }

    if (!spawnPiece()) finishGame();
    draw();
  }, [spawnPiece, finishGame, draw]);

  const resetGame = useCallback(() => {
    boardRef.current = emptyBoard();
    bagRef.current = shuffledBag();
    nextKeyRef.current = takeNext();
    scoreRef.current = 0;
    linesRef.current = 0;
    levelRef.current = 1;
    setScore(0);
    setLines(0);
    setLevel(1);
    setNewHigh(false);
    spawnPiece();
    setPhase("running");
    draw();
  }, [spawnPiece, draw]);

  const move = useCallback(
    (dir: number) => {
      const piece = pieceRef.current;
      if (!piece || phaseRef.current !== "running") return;
      if (!collides(boardRef.current, piece.matrix, piece.x + dir, piece.y)) {
        piece.x += dir;
        draw();
      }
    },
    [draw]
  );

  const rotatePiece = useCallback(() => {
    const piece = pieceRef.current;
    if (!piece || phaseRef.current !== "running") return;
    const rotated = rotateCW(piece.matrix);
    // 简易踢墙：依次尝试原位 / 左移 / 右移 / 远左 / 远右
    for (const kick of [0, -1, 1, -2, 2]) {
      if (!collides(boardRef.current, rotated, piece.x + kick, piece.y)) {
        piece.matrix = rotated;
        piece.x += kick;
        draw();
        return;
      }
    }
  }, [draw]);

  const softDrop = useCallback(() => {
    const piece = pieceRef.current;
    if (!piece || phaseRef.current !== "running") return;
    if (!collides(boardRef.current, piece.matrix, piece.x, piece.y + 1)) {
      piece.y += 1;
      scoreRef.current += 1;
      setScore(scoreRef.current);
      draw();
    } else {
      lockPiece();
    }
  }, [draw, lockPiece]);

  const hardDrop = useCallback(() => {
    const piece = pieceRef.current;
    if (!piece || phaseRef.current !== "running") return;
    let dist = 0;
    while (!collides(boardRef.current, piece.matrix, piece.x, piece.y + 1)) {
      piece.y += 1;
      dist++;
    }
    if (dist > 0) {
      scoreRef.current += dist * 2;
      setScore(scoreRef.current);
    }
    lockPiece();
  }, [lockPiece]);

  const togglePause = useCallback(() => {
    setPhase((p) => (p === "running" ? "paused" : p === "paused" ? "running" : p));
  }, []);

  // ── 副作用 ──
  // 画布按 devicePixelRatio 建分辨率，保证高分屏清晰；窗口尺寸变化时重设
  useEffect(() => {
    const setup = () => {
      for (const canvas of [canvasRef.current, nextCanvasRef.current]) {
        if (!canvas) continue;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(canvas.clientWidth * dpr);
        canvas.height = Math.round(canvas.clientHeight * dpr);
        canvas.getContext("2d")!.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      draw();
      drawNext();
    };
    setup();
    window.addEventListener("resize", setup);
    return () => window.removeEventListener("resize", setup);
  }, [draw, drawNext]);

  // 重力循环：rAF + 时间累积，速度跟随 levelRef，无需因升级重绑
  useEffect(() => {
    if (phase !== "running") return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const tick = (now: number) => {
      acc += now - last;
      last = now;
      const interval = dropInterval(levelRef.current);
      while (acc >= interval) {
        acc -= interval;
        const piece = pieceRef.current;
        if (!piece) break;
        if (!collides(boardRef.current, piece.matrix, piece.x, piece.y + 1)) {
          piece.y += 1;
        } else {
          lockPiece();
          break;
        }
      }
      draw();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, lockPiece, draw]);

  // 键盘操作（挂在 window 上，弹窗内直接可玩）；处理到的键一律 preventDefault 防页面滚动
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "p" || e.key === "P" || e.key === "Escape") {
        e.preventDefault();
        togglePause();
        return;
      }
      if (phaseRef.current !== "running") return;
      switch (e.key) {
        case "ArrowLeft": move(-1); break;
        case "ArrowRight": move(1); break;
        case "ArrowDown": softDrop(); break;
        case "ArrowUp": case "x": case "X": rotatePiece(); break;
        case "z": case "Z": {
          // 反转 = 连转三次
          rotatePiece(); rotatePiece(); rotatePiece();
          break;
        }
        case " ": hardDrop(); break;
        default: return;
      }
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move, softDrop, rotatePiece, hardDrop, togglePause]);

  // 切走标签页自动暂停，防止回来时方块已经堆死
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && phaseRef.current === "running") setPhase("paused");
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // 初始化：读最高分 + 开局
  useEffect(() => {
    try {
      setHigh(Number(localStorage.getItem(HIGH_SCORE_KEY) || 0));
    } catch {
      /* 隐私模式等拿不到就算了 */
    }
    resetGame();
  }, [resetGame]);

  const statClass = "rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5";

  return (
    <div>
      {/* 记分区 + 预览 */}
      <div className="flex gap-3">
        <div className="flex-1 grid grid-cols-2 gap-1.5 min-w-0">
          <div className={statClass}>
            <p className="text-[10px] text-[var(--color-text-subtle)]">分数</p>
            <p className="text-sm font-bold tabular-nums text-[var(--color-text)]">{score}</p>
          </div>
          <div className={statClass}>
            <p className="text-[10px] text-[var(--color-text-subtle)]">最高</p>
            <p className="text-sm font-bold tabular-nums text-[var(--color-text)]">{high}</p>
          </div>
          <div className={statClass}>
            <p className="text-[10px] text-[var(--color-text-subtle)]">行数</p>
            <p className="text-sm font-bold tabular-nums text-[var(--color-text)]">{lines}</p>
          </div>
          <div className={statClass}>
            <p className="text-[10px] text-[var(--color-text-subtle)]">等级</p>
            <p className="text-sm font-bold tabular-nums text-[var(--color-text)]">{level}</p>
          </div>
        </div>
        <div className="w-[76px] flex-shrink-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] flex flex-col items-center justify-center gap-0.5 py-1.5">
          <p className="text-[10px] text-[var(--color-text-subtle)]">下一个</p>
          <canvas ref={nextCanvasRef} className="w-14 h-14" />
        </div>
      </div>

      {/* 棋盘 */}
      <div className="relative w-full max-w-[240px] mx-auto mt-3">
        <canvas
          ref={canvasRef}
          className="block w-full aspect-[1/2] rounded-xl border border-[var(--color-border)]"
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
                  得分 {score} · 消行 {lines} · 等级 {level}
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
        ← → 移动 · ↑/X 旋转 · Z 反转 · ↓ 软降 · 空格 落底 · P/Esc 暂停
      </p>

      {/* 触屏操作（小屏） */}
      <div className="mt-3 grid grid-cols-5 gap-2 md:hidden">
        {[
          { label: "←", act: () => move(-1) },
          { label: "↻", act: rotatePiece },
          { label: "→", act: () => move(1) },
          { label: "↓", act: softDrop },
          { label: "⤓", act: hardDrop },
        ].map((b) => (
          <button
            key={b.label}
            onPointerDown={(e) => {
              e.preventDefault();
              b.act();
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
