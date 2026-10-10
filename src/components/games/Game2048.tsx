import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { TILE_2048, CORAL } from "./palette";

/**
 * 2048（弹窗内对局）：4×4 网格，方向键 / WASD / 触屏滑动。
 * 瓦片用绝对定位 + transform 过渡呈现滑动动画；合并块走 pop 缩放。
 * 无游戏循环，全部逻辑在滑动动作里同步完成。
 */

const SIZE = 4;
const HIGH_SCORE_KEY = "2048-high-score-v1";

interface Tile {
  id: number;
  value: number;
  row: number;
  col: number;
  isNew?: boolean;
  merged?: boolean;
}

type Board = (Tile | null)[][];
type Dir = "up" | "down" | "left" | "right";

/** 瓦片配色走共享色板：珊瑚渐深阶梯，2048 为金色毕业块，4096+ 用最深珊瑚 */
const tileStyle = (v: number) => TILE_2048[v] ?? { bg: CORAL.deep, fg: "#fff" };

function emptyBoard(): Board {
  return Array.from({ length: SIZE }, () => Array<Tile | null>(SIZE).fill(null));
}

function cloneBoard(b: Board): Board {
  return b.map((row) => row.map((t) => (t ? { ...t, isNew: false, merged: false } : null)));
}

function emptyCells(b: Board): Array<{ row: number; col: number }> {
  const cells: Array<{ row: number; col: number }> = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!b[r][c]) cells.push({ row: r, col: c });
  return cells;
}

function addRandomTile(b: Board, idRef: { current: number }): void {
  const cells = emptyCells(b);
  if (cells.length === 0) return;
  const { row, col } = cells[Math.floor(Math.random() * cells.length)];
  b[row][col] = { id: idRef.current++, value: Math.random() < 0.9 ? 2 : 4, row, col, isNew: true };
}

/** 是否还有合法动作：有空格，或存在相邻同值 */
function hasMoves(b: Board): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const t = b[r][c];
      if (!t) return true;
      if (c + 1 < SIZE && b[r][c + 1]?.value === t.value) return true;
      if (r + 1 < SIZE && b[r + 1][c]?.value === t.value) return true;
    }
  }
  return false;
}

export default function Game2048() {
  const idRef = useRef(1);
  const scoreRef = useRef(0);
  const boardRef = useRef<Board>(emptyBoard());
  const phaseRef = useRef<"running" | "won" | "over">("running");
  const keepPlayingRef = useRef(false);
  const swipeRef = useRef<{ x: number; y: number } | null>(null);

  const [board, setBoard] = useState<Board>(emptyBoard());
  const [score, setScore] = useState(0);
  const [high, setHigh] = useState(0);
  const [newHigh, setNewHigh] = useState(false);
  const [showWin, setShowWin] = useState(false);
  const [maxTile, setMaxTile] = useState(0);

  const phase = phaseRef.current; //won / over 时要盖遮罩

  const commit = useCallback((b: Board) => {
    boardRef.current = b;
    setBoard(b);
  }, []);

  const finishGame = useCallback(() => {
    phaseRef.current = "over";
    const max = Math.max(0, ...boardRef.current.flat().map((t) => t?.value ?? 0));
    setMaxTile(max);
    try {
      const prev = Number(localStorage.getItem(HIGH_SCORE_KEY) || 0);
      if (scoreRef.current > prev) {
        localStorage.setItem(HIGH_SCORE_KEY, String(scoreRef.current));
        setHigh(scoreRef.current);
        setNewHigh(true);
      } else {
        setHigh(Math.max(prev, scoreRef.current));
        setNewHigh(false);
      }
    } catch {
      setNewHigh(false);
    }
  }, []);

  const resetGame = useCallback(() => {
    const b = emptyBoard();
    addRandomTile(b, idRef);
    addRandomTile(b, idRef);
    boardRef.current = b;
    phaseRef.current = "running";
    keepPlayingRef.current = false;
    scoreRef.current = 0;
    setBoard(b);
    setScore(0);
    setShowWin(false);
    setNewHigh(false);
  }, []);

  const move = useCallback(
    (dir: Dir) => {
      if (phaseRef.current === "over") return;
      const src = boardRef.current;
      const b: Board = Array.from({ length: SIZE }, () => Array<Tile | null>(SIZE).fill(null));
      let gained = 0;
      let moved = false;
      let reached2048 = false;

      for (let line = 0; line < SIZE; line++) {
        // 取出这条线上的方块（按运动方向从近到远）
        const tiles: Tile[] = [];
        for (let i = 0; i < SIZE; i++) {
          const r = dir === "up" ? i : dir === "down" ? SIZE - 1 - i : line;
          const c = dir === "left" ? i : dir === "right" ? SIZE - 1 - i : line;
          const t = src[r][c];
          if (t) tiles.push({ ...t, row: dir === "up" || dir === "down" ? r : line, col: dir === "left" || dir === "right" ? c : line });
        }

        // 依次落到最前，相邻同值合并一次
        let write = 0;
        for (let i = 0; i < tiles.length; i++) {
          const t = tiles[i];
          const next = tiles[i + 1];
          let target: { row: number; col: number };
          if (next && next.value === t.value) {
            // 合并：i 与 i+1 合成一个新块
            i++; // 跳过被合并的
            const value = t.value * 2;
            gained += value;
            if (value === 2048) reached2048 = true;
            target = dir === "up" ? { row: write, col: line } : dir === "down" ? { row: SIZE - 1 - write, col: line } : dir === "left" ? { row: line, col: write } : { row: line, col: SIZE - 1 - write };
            b[target.row][target.col] = { id: idRef.current++, value, row: target.row, col: target.col, merged: true };
          } else {
            target = dir === "up" ? { row: write, col: line } : dir === "down" ? { row: SIZE - 1 - write, col: line } : dir === "left" ? { row: line, col: write } : { row: line, col: SIZE - 1 - write };
            b[target.row][target.col] = { ...t, row: target.row, col: target.col };
          }
          write++;
        }
      }

      // 精确判断是否真的动了：任一位置与源不同 / 有合并
      outer: for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          const s = src[r][c];
          const t = b[r][c];
          if (Boolean(s) !== Boolean(t)) { moved = true; break outer; }
          if (s && t && (s.id !== t.id || s.row !== t.row || s.col !== t.col)) { moved = true; break outer; }
        }
      }
      if (!moved) return;

      addRandomTile(b, idRef);
      if (gained > 0) {
        scoreRef.current += gained;
        setScore(scoreRef.current);
        try {
          const prevHigh = Number(localStorage.getItem(HIGH_SCORE_KEY) || 0);
          if (scoreRef.current > prevHigh) localStorage.setItem(HIGH_SCORE_KEY, String(scoreRef.current));
        } catch { /* ignore */ }
      }
      commit(b);

      if (reached2048 && !keepPlayingRef.current) {
        phaseRef.current = "won";
        setShowWin(true);
        return;
      }
      if (!hasMoves(b)) finishGame();
    },
    [commit, finishGame, score]
  );

  // 键盘
  useEffect(() => {
    const KEY_MAP: Record<string, Dir> = {
      ArrowUp: "up", w: "up", W: "up",
      ArrowDown: "down", s: "down", S: "down",
      ArrowLeft: "left", a: "left", A: "left",
      ArrowRight: "right", d: "right", D: "right",
    };
    const onKey = (e: KeyboardEvent) => {
      const dir = KEY_MAP[e.key];
      if (!dir) return;
      e.preventDefault();
      move(dir);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move]);

  // 初始化：读最高分 + 开局
  useEffect(() => {
    try {
      setHigh(Number(localStorage.getItem(HIGH_SCORE_KEY) || 0));
    } catch { /* ignore */ }
    resetGame();
  }, [resetGame]);

  const statClass = "rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 flex-1 text-center";

  const onTouchStart = (e: ReactPointerEvent) => {
    swipeRef.current = { x: e.clientX, y: e.clientY };
  };
  const onTouchEnd = (e: ReactPointerEvent) => {
    const start = swipeRef.current;
    swipeRef.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
    move(Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
  };

  return (
    <div>
      {/* 记分区 */}
      <div className="flex gap-1.5">
        <div className={statClass}>
          <p className="text-[10px] text-[var(--color-text-subtle)]">分数</p>
          <p className="text-sm font-bold tabular-nums text-[var(--color-text)]">{score}</p>
        </div>
        <div className={statClass}>
          <p className="text-[10px] text-[var(--color-text-subtle)]">最高</p>
          <p className="text-sm font-bold tabular-nums text-[var(--color-text)]">{Math.max(high, score)}</p>
        </div>
      </div>

      {/* 棋盘：底格 + 绝对定位瓦片 */}
      <div
        className="relative mt-3 aspect-square w-full select-none touch-none rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-[4%]"
        onPointerDown={onTouchStart}
        onPointerUp={onTouchEnd}
      >
        <div className="grid h-full w-full grid-cols-4 grid-rows-4 gap-[3%]">
          {Array.from({ length: SIZE * SIZE }).map((_, i) => (
            <div key={i} className="rounded-lg bg-[#eae3d6]/70" />
          ))}
        </div>
        {board.flat().map((t) => {
          if (!t) return null;
          const style = tileStyle(t.value);
          return (
            <div
              key={t.id}
              className="absolute left-0 top-0 h-1/4 w-1/4 p-[1.2%] transition-transform duration-100 ease-out"
              style={{ transform: `translate(${t.col * 100}%, ${t.row * 100}%)` }}
            >
              <div
                className={`flex h-full w-full items-center justify-center rounded-lg font-bold ${
                  t.isNew || t.merged ? "animate-[pop_0.18s_ease-out]" : ""
                }`}
                style={{ backgroundColor: style.bg, color: style.fg, fontSize: t.value >= 1024 ? "1.1rem" : t.value >= 128 ? "1.35rem" : "1.6rem" }}
              >
                {t.value}
              </div>
            </div>
          );
        })}

        {/* 胜利 / 结束遮罩 */}
        {(phase === "won" || phase === "over") && (
          <div className="absolute inset-0 z-10 rounded-xl bg-[var(--color-surface)]/85 backdrop-blur-sm flex flex-col items-center justify-center gap-2.5 px-4">
            {phase === "won" ? (
              <>
                <p className="text-sm font-bold text-[var(--color-text)]">🎉 拼出 2048！</p>
                <p className="text-xs text-[var(--color-text-muted)]">当前得分 {score}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { keepPlayingRef.current = true; phaseRef.current = "running"; setShowWin(false); }}
                    className="px-4 py-1.5 text-xs font-medium rounded-lg bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors"
                  >
                    继续挑战
                  </button>
                  <button
                    onClick={resetGame}
                    className="px-4 py-1.5 text-xs font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-hover)] transition-all"
                  >
                    再来一局
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-[var(--color-text)]">没有可动的路了</p>
                <p className="text-xs text-[var(--color-text-muted)] tabular-nums">得分 {score} · 最大方块 {maxTile}</p>
                {newHigh && <p className="text-xs font-semibold text-[var(--color-accent)]">🎉 新的最高分！</p>}
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

      <p className="hidden md:block mt-2.5 text-center text-[10px] leading-relaxed text-[var(--color-text-subtle)]">
        ↑ ↓ ← → / WASD 滑动 · 触屏滑动同样有效 · 相同数字相遇即合并
      </p>
    </div>
  );
}
