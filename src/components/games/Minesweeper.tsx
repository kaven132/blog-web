import { useCallback, useEffect, useRef, useState } from "react";
import { CELL_REVEALED, CORAL, DUSTY, AMBER } from "./palette";

/**
 * 扫雷（弹窗内对局）：9×9 / 10 雷的经典入门盘。
 * 首次点击才布雷且保底避开点击处及其八邻域；0 格泛洪展开。
 * 桌面：右键插旗；触屏：长按 350ms 插旗（插旗后吞掉同一次点击）。
 */

const SIZE = 9;
const MINES = 10;
const BEST_TIME_KEY = "mines-best-time-v1";

interface Cell {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  count: number; // 周边雷数（布雷后计算）
}
type Phase = "ready" | "running" | "won" | "lost";

/** 数字区分色沿用共享色板的低饱和辅助系（1~8 由浅入深） */
const NUM_COLOR: Record<number, string> = {
  1: DUSTY.blue,
  2: DUSTY.sage,
  3: CORAL.main,
  4: DUSTY.violet,
  5: AMBER,
  6: "#6e8ba0",
  7: DUSTY.rose,
  8: CORAL.deep,
};

/** 插旗 / 地雷的小图形，配色与卡片预览图同款；绘制内容以 viewBox 中心对齐 */
function FlagIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-[60%] h-[60%]" aria-hidden="true">
      <line x1="7" y1="3" x2="7" y2="21" stroke="var(--color-text-subtle)" strokeWidth="2" strokeLinecap="round" />
      <path d="M7 3 L17 7.5 L7 12 Z" fill="var(--color-accent)" />
    </svg>
  );
}

function MineIcon({ exploded }: { exploded: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="w-[60%] h-[60%]" aria-hidden="true">
      <circle cx="12" cy="12" r="7.5" fill={exploded ? "#fff" : CORAL.deep} />
      <circle cx="9.2" cy="9.2" r="2.1" fill="#fff" opacity={exploded ? 0.9 : 0.7} />
    </svg>
  );
}

function neighbors(r: number, c: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) out.push([nr, nc]);
    }
  }
  return out;
}

function emptyBoard(): Cell[][] {
  return Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => ({ mine: false, revealed: false, flagged: false, count: 0 }))
  );
}

export default function Minesweeper() {
  const longPressRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);
  const [board, setBoard] = useState<Cell[][]>(emptyBoard);
  const [phase, setPhase] = useState<Phase>("ready");
  const [seconds, setSeconds] = useState(0);
  const [flags, setFlags] = useState(0);
  const [bestTime, setBestTime] = useState<number | null>(null);
  const [newRecord, setNewRecord] = useState(false);
  const [explodedAt, setExplodedAt] = useState<{ r: number; c: number } | null>(null);
  const phaseRef = useRef<Phase>("ready");
  phaseRef.current = phase;

  const remainingMines = MINES - flags;

  // 计时器：首踩后开始
  useEffect(() => {
    if (phase !== "running") return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(BEST_TIME_KEY) || 0);
      setBestTime(v > 0 ? v : null);
    } catch { /* ignore */ }
  }, []);

  const placeMines = useCallback((safeR: number, safeC: number): Cell[][] => {
    const b = emptyBoard();
    // 安全区 = 首踩格 + 八邻域
    const safe = new Set<string>([`${safeR}:${safeC}`]);
    for (const [r, c] of neighbors(safeR, safeC)) safe.add(`${r}:${c}`);
    let placed = 0;
    while (placed < MINES) {
      const r = Math.floor(Math.random() * SIZE);
      const c = Math.floor(Math.random() * SIZE);
      if (safe.has(`${r}:${c}`) || b[r][c].mine) continue;
      b[r][c].mine = true;
      placed++;
    }
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        b[r][c].count = neighbors(r, c).filter(([nr, nc]) => b[nr][nc].mine).length;
      }
    }
    return b;
  }, []);

  const checkWin = useCallback((b: Cell[][], secondsAtWin: number) => {
    const revealed = b.flat().filter((cell) => cell.revealed).length;
    if (revealed < SIZE * SIZE - MINES) return false;
    // 胜利：剩余雷自动插旗
    b.forEach((row) => row.forEach((cell) => { if (cell.mine && !cell.flagged) cell.flagged = true; }));
    setFlags(MINES);
    setPhase("won");
    phaseRef.current = "won";
    try {
      const prev = Number(localStorage.getItem(BEST_TIME_KEY) || 0);
      if (!prev || secondsAtWin < prev) {
        localStorage.setItem(BEST_TIME_KEY, String(secondsAtWin));
        setBestTime(secondsAtWin);
        setNewRecord(true);
      }
    } catch { /* ignore */ }
    return true;
  }, []);

  const reveal = useCallback(
    (r: number, c: number) => {
      if (phaseRef.current === "won" || phaseRef.current === "lost") return;
      let b = board.map((row) => row.map((cell) => ({ ...cell })));

      if (phaseRef.current === "ready") {
        b = placeMines(r, c);
        setPhase("running");
        phaseRef.current = "running";
      }

      const cell = b[r][c];
      if (cell.revealed || cell.flagged) { setBoard(b); return; }

      if (cell.mine) {
        // 踩雷：翻开所有雷，标出踩中的那颗
        b.forEach((row) => row.forEach((cc) => { if (cc.mine) cc.revealed = true; }));
        cell.flagged = false;
        setExplodedAt({ r, c });
        setBoard(b);
        setPhase("lost");
        phaseRef.current = "lost";
        return;
      }

      // 泛洪展开 0 格
      const queue: Array<[number, number]> = [[r, c]];
      while (queue.length > 0) {
        const [cr, cc] = queue.shift()!;
        const target = b[cr][cc];
        if (target.revealed || target.flagged || target.mine) continue;
        target.revealed = true;
        if (target.count === 0) {
          for (const [nr, nc] of neighbors(cr, cc)) {
            if (!b[nr][nc].revealed && !b[nr][nc].flagged) queue.push([nr, nc]);
          }
        }
      }
      setBoard(b);
      const secs = seconds;
      checkWin(b, secs);
    },
    [board, phase, placeMines, checkWin, seconds]
  );

  const toggleFlag = useCallback(
    (r: number, c: number) => {
      if (phaseRef.current === "won" || phaseRef.current === "lost") return;
      setBoard((prev) => {
        const b = prev.map((row) => row.map((cell) => ({ ...cell })));
        const cell = b[r][c];
        if (cell.revealed) return prev;
        cell.flagged = !cell.flagged;
        setFlags(b.flat().filter((cc) => cc.flagged).length);
        return b;
      });
    },
    []
  );

  const resetGame = useCallback(() => {
    setBoard(emptyBoard());
    setPhase("ready");
    phaseRef.current = "ready";
    setSeconds(0);
    setFlags(0);
    setExplodedAt(null);
    setNewRecord(false);
  }, []);

  // 长按插旗（触屏）：pointerdown 起 350ms 计时
  const onCellPointerDown = (r: number, c: number) => {
    longPressFiredRef.current = false;
    longPressRef.current = window.setTimeout(() => {
      longPressFiredRef.current = true;
      toggleFlag(r, c);
    }, 350);
  };
  const onCellPointerUp = () => {
    if (longPressRef.current !== null) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  };
  const onCellClick = (r: number, c: number) => {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false; // 长按已插旗，吞掉随后那次 click
      return;
    }
    reveal(r, c);
  };

  return (
    <div>
      {/* 状态条：剩余雷数 / 计时 / 最佳 */}
      <div className="grid grid-cols-3 gap-1.5">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-center">
          <p className="text-[10px] text-[var(--color-text-subtle)]">剩余雷数</p>
          <p className="text-sm font-bold tabular-nums text-[var(--color-text)] flex items-center justify-center gap-1">
            <span className="w-3.5 h-3.5 inline-block">
              <FlagIcon />
            </span>
            {remainingMines}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-center">
          <p className="text-[10px] text-[var(--color-text-subtle)]">用时</p>
          <p className="text-sm font-bold tabular-nums text-[var(--color-text)]">{seconds}s</p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-center">
          <p className="text-[10px] text-[var(--color-text-subtle)]">最佳用时</p>
          <p className="text-sm font-bold tabular-nums text-[var(--color-text)]">{bestTime !== null ? `${bestTime}s` : "—"}</p>
        </div>
      </div>

      {/* 雷区 */}
      <div className="relative mt-3">
        <div
          className="grid gap-[3px] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-[3px] select-none"
          style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))` }}
        >
          {board.map((row, r) =>
            row.map((cell, c) => {
              const exploded = explodedAt?.r === r && explodedAt?.c === c;
              return (
                <button
                  key={`${r}-${c}`}
                  onClick={() => onCellClick(r, c)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    toggleFlag(r, c);
                  }}
                  onPointerDown={() => onCellPointerDown(r, c)}
                  onPointerUp={onCellPointerUp}
                  onPointerLeave={onCellPointerUp}
                  className={`aspect-square rounded-md flex items-center justify-center text-sm font-bold tabular-nums transition-colors ${
                    cell.revealed
                      ? cell.mine
                        ? exploded
                          ? "bg-[var(--color-accent)]"
                          : "bg-[#e8b0a4]/60"
                        : "cursor-default"
                      : "bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] active:bg-[var(--color-bg)]"
                  }`}
                  style={
                    cell.revealed
                      ? {
                          ...(cell.mine ? {} : { backgroundColor: CELL_REVEALED }),
                          ...(cell.count > 0 ? { color: NUM_COLOR[cell.count] } : {}),
                        }
                      : undefined
                  }
                >
                  {cell.flagged && !cell.revealed ? (
                    <FlagIcon />
                  ) : cell.revealed && cell.mine ? (
                    <MineIcon exploded={exploded} />
                  ) : cell.revealed && cell.count > 0 ? (
                    cell.count
                  ) : (
                    ""
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* 胜利 / 失败遮罩 */}
        {(phase === "won" || phase === "lost") && (
          <div className="absolute inset-0 rounded-xl bg-[var(--color-surface)]/85 backdrop-blur-sm flex flex-col items-center justify-center gap-2.5 px-4">
            {phase === "won" ? (
              <>
                <p className="text-sm font-bold text-[var(--color-text)]">🎉 全部安全格已翻开！</p>
                <p className="text-xs text-[var(--color-text-muted)] tabular-nums">用时 {seconds}s</p>
                {newRecord && <p className="text-xs font-semibold text-[var(--color-accent)]">🏆 新的最佳用时！</p>}
                <button
                  onClick={resetGame}
                  className="px-4 py-1.5 text-xs font-medium rounded-lg bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors"
                >
                  再来一局
                </button>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-[var(--color-text)]">💥 踩到地雷了</p>
                <p className="text-xs text-[var(--color-text-muted)]">排雷失败，再试一次？</p>
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
        点击翻开 · 右键 / 长按插旗 · 首踩必定安全 · 数字 = 周边雷数
      </p>
    </div>
  );
}
