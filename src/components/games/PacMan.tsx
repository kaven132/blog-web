import { useCallback, useEffect, useRef, useState } from "react";
import { BOARD_BG, BOARD_GRID, CORAL, DUSTY, GOLD, AMBER } from "./palette";

/**
 * 吃豆人（弹窗内对局）。19×20 迷你迷宫（已脚本验证：全豆可达、无死角、隧道环绕）。
 * 实体用「格子插值」移动：from/to 两个格子 + 进度 t，到格心时才做转向/吃豆/决策，
 * 避免连续坐标下的贴墙抖动。幽灵四只各有性格目标，全局 巡逻↔追击 定时切换，
 * 能量豆触发惊吓（可反吃，链式计分），被吃后回眼返屋复活。
 * 高频数据全走 ref，React state 只留 UI 数字与阶段。
 */

const MAZE = [
  "###################",
  "#........#........#",
  "#o##.###.#.###.##o#",
  "#.................#",
  "#.##.#.#####.#.##.#",
  "#....#...#...#....#",
  "####.###.#.###.####",
  "####.#.......#.####",
  "####.#.## ##.#.####",
  "####.#.#   #.#.####",
  ".....#.#   #.#.....",
  "####.#.#####.#.####",
  "####.#.......#.####",
  "####.#.#####.#.####",
  "#.................#",
  "#.##.#.#####.#.##.#",
  "#o...#.......#...o#",
  "##.#####.#.#####.##",
  "##...............##",
  "###################",
];
const COLS = 19;
const ROWS = 20;
const HOUSE_DOOR = { x: 9, y: 8 };
const HIGH_SCORE_KEY = "pacman-high-score-v1";

const WALL_COLOR = "#e2dbc9";
const PELLET_COLOR = "#d9b48f";

interface Pt {
  x: number;
  y: number;
}
type Dir = Pt;
const DIRS: Record<string, Dir> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const DIR_LIST = [DIRS.up, DIRS.left, DIRS.down, DIRS.right];

/** 鬼门与鬼屋内部：pac 不可入，幽灵按模式放行 */
const GHOST_ONLY = new Set(["9,8", "8,9", "9,9", "10,9", "8,10", "9,10", "10,10"]);

type Phase = "ready" | "running" | "paused" | "dying" | "clear" | "over";

interface Entity {
  x: number;
  y: number;
  from: Pt;
  to: Pt;
  t: number;
  dir: Dir;
}
interface GhostE extends Entity {
  id: 0 | 1 | 2 | 3;
  mode: "house" | "exiting" | "normal" | "frightened" | "eyes" | "revive";
  release: number;
  wp: Pt[]; // 出屋 / 回屋的脚本路径
  color: string;
}

const GHOST_COLORS = [CORAL.bright, DUSTY.rose, DUSTY.blue, AMBER];
const SCATTER_CORNERS: Pt[] = [
  { x: 17, y: 1 },
  { x: 1, y: 1 },
  { x: 17, y: 18 },
  { x: 1, y: 18 },
];
const FRIGHT_BASE = 7;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function key(x: number, y: number) {
  return `${x},${y}`;
}

export default function PacMan() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ── 高频 ref ──
  const wallRef = useRef<Set<string>>(new Set());
  const pelletRef = useRef<Uint8Array>(new Uint8Array(COLS * ROWS));
  const remainRef = useRef(0);
  const pacRef = useRef({ x: 9, y: 12, from: { x: 9, y: 12 }, to: { x: 9, y: 12 }, t: 0, dir: DIRS.left, next: DIRS.left });
  const ghostsRef = useRef<GhostE[]>([]);
  const phaseRef = useRef<Phase>("ready");
  const timerRef = useRef(0); // ready / dying / clear 的阶段计时
  const frightRef = useRef(0); // 惊吓剩余秒
  const chainRef = useRef(0); // 惊吓连吃倍率
  const modeRef = useRef<"scatter" | "chase">("scatter");
  const modeTimerRef = useRef(5);
  const scoreRef = useRef(0);
  const levelRef = useRef(1);
  const livesRef = useRef(3);
  const animRef = useRef(0);

  const [phase, setPhase] = useState<Phase>("ready");
  const [score, setScore] = useState(0);
  const [high, setHigh] = useState(0);
  const [newHigh, setNewHigh] = useState(false);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(3);

  phaseRef.current = phase;

  const setPhaseBoth = useCallback((p: Phase, timer = 0) => {
    phaseRef.current = p;
    timerRef.current = timer;
    setPhase(p);
  }, []);

  // ── 布局与重置 ──
  const resetPellets = useCallback(() => {
    const p = new Uint8Array(COLS * ROWS);
    let remain = 0;
    const walls = new Set<string>();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const ch = MAZE[r][c];
        if (ch === "#") { walls.add(key(c, r)); continue; }
        if (ch === ".") { p[r * COLS + c] = 1; remain++; }
        if (ch === "o") { p[r * COLS + c] = 2; remain++; }
      }
    }
    wallRef.current = walls; // 墙集合：渲染 + 通行判定共用（漏填会导致穿墙）
    pelletRef.current = p;
    remainRef.current = remain;
  }, []);

  const resetActors = useCallback(() => {
    pacRef.current = {
      x: 9, y: 12, from: { x: 9, y: 12 }, to: { x: 9, y: 12 }, t: 0,
      dir: DIRS.left, next: DIRS.left,
    };
    // 出生格的豆直接吃掉（实体从「已到达」状态开始，不会再触发到达判定）
    const spawnIdx = 12 * COLS + 9;
    if (pelletRef.current[spawnIdx]) {
      pelletRef.current[spawnIdx] = 0;
      remainRef.current--;
    }
    ghostsRef.current = [
      { id: 0, x: 9, y: 7, from: { x: 9, y: 7 }, to: { x: 9, y: 7 }, t: 0, dir: DIRS.left, mode: "normal", release: 0, wp: [], color: GHOST_COLORS[0] },
      { id: 1, x: 9, y: 10, from: { x: 9, y: 10 }, to: { x: 9, y: 10 }, t: 0, dir: DIRS.up, mode: "house", release: 1.2, wp: [], color: GHOST_COLORS[1] },
      { id: 2, x: 8, y: 10, from: { x: 8, y: 10 }, to: { x: 8, y: 10 }, t: 0, dir: DIRS.up, mode: "house", release: 3.5, wp: [], color: GHOST_COLORS[2] },
      { id: 3, x: 10, y: 10, from: { x: 10, y: 10 }, to: { x: 10, y: 10 }, t: 0, dir: DIRS.up, mode: "house", release: 7, wp: [], color: GHOST_COLORS[3] },
    ];
    frightRef.current = 0;
    chainRef.current = 0;
    modeRef.current = "scatter";
    modeTimerRef.current = 5;
  }, []);

  const startLevel = useCallback((resetPelletsToo: boolean) => {
    if (resetPelletsToo) resetPellets();
    resetActors();
    setPhaseBoth("ready", 1.4);
  }, [resetPellets, resetActors, setPhaseBoth]);

  const resetGame = useCallback(() => {
    scoreRef.current = 0;
    levelRef.current = 1;
    livesRef.current = 3;
    setScore(0);
    setLevel(1);
    setLives(3);
    setNewHigh(false);
    startLevel(true);
  }, [startLevel]);

  // ── 通行规则 ──
  const passable = useCallback((cx: number, cy: number, isGhost: boolean) => {
    const wrapped = (cx + COLS) % COLS;
    if (cy < 0 || cy >= ROWS) return false;
    if (wallRef.current.has(key(wrapped, cy))) return false;
    if (!isGhost && GHOST_ONLY.has(key(wrapped, cy))) return false;
    return true;
  }, []);

  // ── 渲染 ──
  const draw = useCallback((time: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const w = canvas.clientWidth;
    const cw = w / COLS;
    const ch = canvas.clientHeight / ROWS;
    const p = pacRef.current;

    ctx.fillStyle = BOARD_BG;
    ctx.fillRect(0, 0, w, canvas.clientHeight);

    // 墙体
    ctx.fillStyle = WALL_COLOR;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (wallRef.current.has(key(c, r))) {
          ctx.fillRect(c * cw - 0.5, r * ch - 0.5, cw + 1, ch + 1);
        }
      }
    }
    // 豆子
    ctx.fillStyle = PELLET_COLOR;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const v = pelletRef.current[r * COLS + c];
        if (v === 1) {
          ctx.beginPath();
          ctx.arc((c + 0.5) * cw, (r + 0.5) * ch, Math.max(1.2, cw * 0.08), 0, Math.PI * 2);
          ctx.fill();
        } else if (v === 2) {
          const pulse = 1 + 0.25 * Math.sin(time / 150);
          ctx.beginPath();
          ctx.arc((c + 0.5) * cw, (r + 0.5) * ch, Math.max(2.5, cw * 0.16) * pulse, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // 吃豆人：扇形嘴随动画开合
    const px = (p.x + 0.5) * cw;
    const py = (p.y + 0.5) * ch;
    const pr = Math.min(cw, ch) * 0.42;
    const ang = Math.atan2(p.dir.y, p.dir.x);
    // 常规游走：嘴随动画开合；死亡阶段：从闭合张到完全消失
    let mouth = 0.28 * Math.abs(Math.sin(time / 45));
    if (phaseRef.current === "dying") {
      const progress = 1 - Math.max(0, timerRef.current) / 1.4;
      mouth = 0.28 + progress * 0.72;
    }
    if (phaseRef.current !== "dying" || mouth < 1) {
      ctx.fillStyle = GOLD;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.arc(px, py, pr, ang + mouth * Math.PI, ang - mouth * Math.PI + Math.PI * 2);
      ctx.closePath();
      ctx.fill();
    }

    // 幽灵
    const flash = frightRef.current > 0 && frightRef.current < 1.8 && Math.floor(time / 180) % 2 === 0;
    for (const g of ghostsRef.current) {
      const gx = (g.x + 0.5) * cw;
      const gy = (g.y + 0.5) * ch;
      const s = Math.min(cw, ch);
      const eyesOnly = g.mode === "eyes";
      const frightened = g.mode === "frightened";
      const bodyTop = gy - s * 0.3;
      if (!eyesOnly) {
        ctx.fillStyle = frightened ? (flash ? "#f6f2e8" : "#6e8ba0") : g.color;
        const bw = s * 0.78;
        ctx.beginPath();
        ctx.arc(gx, bodyTop, bw / 2, Math.PI, 0);
        ctx.lineTo(gx + bw / 2, gy + s * 0.28);
        // 三段波浪裙边
        const n = 3;
        const seg = bw / n;
        for (let i = 0; i < n; i++) {
          const x1 = gx + bw / 2 - seg * i;
          ctx.quadraticCurveTo(x1 - seg / 2, gy + s * 0.28 - s * 0.16, x1 - seg, gy + s * 0.28);
        }
        ctx.closePath();
        ctx.fill();
      }
      // 眼睛
      const ex = gx + g.dir.x * s * 0.08;
      const ey = bodyTop - s * 0.04 + g.dir.y * s * 0.08;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(ex - s * 0.14, ey, s * 0.13, 0, Math.PI * 2);
      ctx.arc(ex + s * 0.14, ey, s * 0.13, 0, Math.PI * 2);
      ctx.fill();
      if (!frightened || flash) {
        ctx.fillStyle = "#3b3a66";
        ctx.beginPath();
        ctx.arc(ex - s * 0.14 + g.dir.x * s * 0.06, ey + g.dir.y * s * 0.06, s * 0.07, 0, Math.PI * 2);
        ctx.arc(ex + s * 0.14 + g.dir.x * s * 0.06, ey + g.dir.y * s * 0.06, s * 0.07, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = "#f6f2e8";
        ctx.beginPath();
        ctx.arc(ex - s * 0.14, ey, s * 0.05, 0, Math.PI * 2);
        ctx.arc(ex + s * 0.14, ey, s * 0.05, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // READY 提示
    if (phaseRef.current === "ready") {
      ctx.fillStyle = CORAL.bright;
      ctx.font = `bold ${Math.max(10, cw * 0.7)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("READY!", (COLS / 2) * cw, 12.5 * ch);
    }
  }, []);

  // ── 移动内核 ──
  const wrapPt = (pt: Pt): Pt => ({ x: (pt.x + COLS) % COLS, y: pt.y });

  const advance = useCallback(
    (e: Entity, dist: number, onArrive: (cell: Pt) => Pt | null, isWrap: boolean) => {
      while (dist > 0) {
        const remain = 1 - e.t;
        if (dist < remain) {
          e.t += dist;
          dist = 0;
        } else {
          dist -= remain;
          e.x = e.to.x;
          e.y = e.to.y;
          e.t = 0;
          const fixed = isWrap ? wrapPt(e.to) : e.to;
          e.x = fixed.x;
          e.y = fixed.y;
          e.from = { ...fixed };
          e.to = { ...fixed };
          const next = onArrive({ x: fixed.x, y: fixed.y });
          if (!next) break;
          e.to = next;
        }
      }
      e.x = lerp(e.from.x, e.to.x, e.t);
      e.y = lerp(e.from.y, e.to.y, e.t);
    },
    []
  );

  // ── pac ──
  const eatAt = useCallback((cell: Pt) => {
    const idx = cell.y * COLS + cell.x;
    const v = pelletRef.current[idx];
    if (!v) return;
    pelletRef.current[idx] = 0;
    remainRef.current--;
    scoreRef.current += v === 2 ? 50 : 10;
    setScore(scoreRef.current);
    if (v === 2) {
      frightRef.current = Math.max(3, FRIGHT_BASE - (levelRef.current - 1) * 0.5);
      chainRef.current = 0;
      for (const g of ghostsRef.current) {
        if (g.mode === "normal") {
          g.mode = "frightened";
          const swap = g.from;
          g.from = g.to;
          g.to = swap;
          g.t = 1 - g.t;
          g.dir = { x: -g.dir.x, y: -g.dir.y };
        }
      }
    }
    if (remainRef.current <= 0) {
      levelRef.current += 1;
      setLevel(levelRef.current);
      setPhaseBoth("clear", 1.6);
    }
  }, [setPhaseBoth]);

  const stepPac = useCallback(
    (dt: number) => {
      const p = pacRef.current;
      // 反向可以立即掉头（不用等格心）
      if (p.next.x === -p.dir.x && p.next.y === -p.dir.y && (p.next.x || p.next.y)) {
        const swap = p.from;
        p.from = p.to;
        p.to = swap;
        p.t = 1 - p.t;
        p.dir = p.next;
      }
      const speed = Math.min(8, 5.2 + (levelRef.current - 1) * 0.3);
      advance(
        p,
        speed * dt,
        (cell) => {
          eatAt(cell);
          const nd = p.next;
          if ((nd.x || nd.y) && passable(cell.x + nd.x, cell.y + nd.y, false)) {
            p.dir = nd;
            return { x: cell.x + nd.x, y: cell.y + nd.y };
          }
          if (passable(cell.x + p.dir.x, cell.y + p.dir.y, false)) {
            return { x: cell.x + p.dir.x, y: cell.y + p.dir.y };
          }
          return null; // 撞墙停下
        },
        true
      );
    },
    [eatAt, passable]
  );

  // ── 幽灵 ──
  const ghostSpeed = (g: GhostE) =>
    g.mode === "frightened" ? 2.8 : g.mode === "eyes" ? 9 : Math.min(6.2, 4.4 + (levelRef.current - 1) * 0.25);

  const chaseTarget = useCallback((g: GhostE): Pt => {
    const p = pacRef.current;
    const pacCell = { x: Math.round(p.x), y: Math.round(p.y) };
    if (modeRef.current === "scatter" && Math.random() < 0) return SCATTER_CORNERS[g.id]; // 占位分支
    if (g.id === 0) return pacCell;
    if (g.id === 1) return { x: pacCell.x + p.dir.x * 4, y: pacCell.y + p.dir.y * 4 };
    if (g.id === 2) {
      const b = ghostsRef.current[0];
      return { x: 2 * pacCell.x - Math.round(b.x), y: 2 * pacCell.y - Math.round(b.y) };
    }
    const d2 = (g.x - pacCell.x) ** 2 + (g.y - pacCell.y) ** 2;
    return d2 > 49 ? pacCell : SCATTER_CORNERS[3];
  }, []);

  const stepGhost = useCallback(
    (g: GhostE, dt: number) => {
      if (g.mode === "house") {
        g.release -= dt;
        if (g.release <= 0) {
          g.mode = "exiting";
          g.wp = [{ x: 9, y: 10 }, { x: 9, y: 9 }, { x: 9, y: 8 }, { x: 9, y: 7 }];
        }
        return;
      }
      if (g.mode === "exiting" || g.mode === "revive") {
        const speed = 3.2;
        let dist = speed * dt;
        while (dist > 0 && g.wp.length > 0) {
          const target = g.wp[0];
          const dx = target.x - g.x;
          const dy = target.y - g.y;
          const d = Math.hypot(dx, dy);
          if (d <= dist) {
            g.x = target.x;
            g.y = target.y;
            g.from = { ...target };
            g.to = { ...target };
            g.t = 0;
            dist -= d;
            g.wp.shift();
          } else {
            g.x += (dx / d) * dist;
            g.y += (dy / d) * dist;
            dist = 0;
          }
        }
        if (g.wp.length === 0) {
          if (g.mode === "exiting") {
            g.mode = frightRef.current > 0 ? "frightened" : "normal";
            g.dir = Math.random() < 0.5 ? DIRS.left : DIRS.right;
            g.from = { x: 9, y: 7 };
            g.to = { x: 9, y: 7 };
            g.t = 0;
          } else {
            g.mode = "house";
            g.release = 0.8;
          }
        }
        return;
      }

      const speed = ghostSpeed(g);
      advance(
        g,
        speed * dt,
        (cell) => {
          const target = g.mode === "eyes" ? { x: 9, y: 7 } : chaseTarget(g);
          const opts: Array<{ d: Dir; pt: Pt; dist: number }> = [];
          for (const d of DIR_LIST) {
            if (d.x === -g.dir.x && d.y === -g.dir.y) continue; // 不掉头
            const rawX = cell.x + d.x; // 未环绕目标：隧道出边时是 -1 / COLS，让 advance 滑出边缘再环绕出现
            const wrappedX = (rawX + COLS) % COLS; // 距离计算用环绕后的列
            const ny = cell.y + d.y;
            const ghostOnly = GHOST_ONLY.has(key(wrappedX, ny));
            if (!passable(rawX, ny, true) || (ghostOnly && g.mode !== "eyes" && g.mode !== "revive" && g.mode !== "house")) continue;
            opts.push({ d, pt: { x: rawX, y: ny }, dist: (wrappedX - target.x) ** 2 + (ny - target.y) ** 2 });
          }
          if (opts.length === 0) {
            return { x: cell.x - g.dir.x, y: cell.y - g.dir.y }; // 死路掉头（同样未环绕）
          }
          let best = opts[0];
          if (g.mode === "frightened") {
            best = opts[Math.floor(Math.random() * opts.length)];
          } else {
            for (const o of opts) if (o.dist < best.dist) best = o;
          }
          g.dir = best.d;
          return best.pt;
        },
        true
      );

      // 回到门口 → 进屋复活
      if (g.mode === "eyes" && g.x === HOUSE_DOOR.x && Math.abs(g.y - HOUSE_DOOR.y) < 0.05) {
        g.mode = "revive";
        g.wp = [{ x: 9, y: 9 }, { x: 9, y: 10 }];
      }
    },
    [passable, chaseTarget]
  );

  // ── 碰撞与主循环 ──
  const finishGame = useCallback(() => {
    phaseRef.current = "over";
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

  const die = useCallback(() => {
    livesRef.current -= 1;
    setLives(livesRef.current);
    setPhaseBoth("dying", 1.4);
  }, [setPhaseBoth]);

  const stepOnce = useCallback(
    (dt: number) => {
      // 阶段计时
      if (phaseRef.current === "ready" || phaseRef.current === "dying" || phaseRef.current === "clear") {
        timerRef.current -= dt;
        if (timerRef.current <= 0) {
          if (phaseRef.current === "ready") {
            phaseRef.current = "running";
            setPhase("running");
          } else if (phaseRef.current === "dying") {
            if (livesRef.current <= 0) finishGame();
            else {
              resetActors();
              setPhaseBoth("ready", 1.2);
            }
          } else {
            startLevel(true); // 过关：豆子重置、速度提升
          }
        }
        return;
      }
      if (phaseRef.current !== "running") return;

      // 惊吓倒计时
      if (frightRef.current > 0) {
        frightRef.current -= dt;
        if (frightRef.current <= 0) {
          frightRef.current = 0;
          for (const g of ghostsRef.current) if (g.mode === "frightened") g.mode = "normal";
        }
      }
      // 巡逻 ↔ 追击
      modeTimerRef.current -= dt;
      if (modeTimerRef.current <= 0) {
        modeRef.current = modeRef.current === "scatter" ? "chase" : "scatter";
        modeTimerRef.current = modeRef.current === "scatter" ? 5 : 20;
        for (const g of ghostsRef.current) {
          if (g.mode === "normal") {
            const swap = g.from;
            g.from = g.to;
            g.to = swap;
            g.t = 1 - g.t;
            g.dir = { x: -g.dir.x, y: -g.dir.y };
          }
        }
      }

      stepPac(dt);
      for (const g of ghostsRef.current) stepGhost(g, dt);

      // 碰撞（隧道环绕下取最短环绕距离）
      const p = pacRef.current;
      for (const g of ghostsRef.current) {
        if (g.mode === "eyes" || g.mode === "house" || g.mode === "revive") continue;
        let dx = g.x - p.x;
        if (Math.abs(dx) > COLS / 2) dx -= Math.sign(dx) * COLS;
        if (Math.hypot(dx, g.y - p.y) < 0.6) {
          if (g.mode === "frightened") {
            chainRef.current = Math.min(3, chainRef.current);
            scoreRef.current += 200 * 2 ** chainRef.current;
            chainRef.current++;
            setScore(scoreRef.current);
            g.mode = "eyes";
            g.wp = [];
          } else {
            die();
            return;
          }
        }
      }
    },
    [stepPac, stepGhost, die, finishGame, resetActors, startLevel, setPhaseBoth]
  );

  const togglePause = useCallback(() => {
    if (phaseRef.current === "running") setPhase("paused");
    else if (phaseRef.current === "paused") setPhase("running");
  }, []);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // 主 rAF 循环
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (phaseRef.current === "running" || phaseRef.current === "ready" || phaseRef.current === "dying" || phaseRef.current === "clear") {
        stepOnce(dt);
      }
      draw(now);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [stepOnce, draw]);

  // 键盘
  useEffect(() => {
    const KEY_MAP: Record<string, Dir> = {
      ArrowUp: DIRS.up, w: DIRS.up, W: DIRS.up,
      ArrowDown: DIRS.down, s: DIRS.down, S: DIRS.down,
      ArrowLeft: DIRS.left, a: DIRS.left, A: DIRS.left,
      ArrowRight: DIRS.right, d: DIRS.right, D: DIRS.right,
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "p" || e.key === "P" || e.key === "Escape") {
        e.preventDefault();
        togglePause();
        return;
      }
      const dir = KEY_MAP[e.key];
      if (!dir) return;
      e.preventDefault();
      pacRef.current.next = dir;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePause]);

  useEffect(() => {
    const onVis = () => {
      if (document.hidden && phaseRef.current === "running") setPhase("paused");
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // 画布分辨率 + 初始化
  useEffect(() => {
    const setup = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      canvas.getContext("2d")!.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(performance.now());
    };
    setup();
    window.addEventListener("resize", setup);
    return () => window.removeEventListener("resize", setup);
  }, [draw]);

  useEffect(() => {
    try {
      setHigh(Number(localStorage.getItem(HIGH_SCORE_KEY) || 0));
    } catch { /* ignore */ }
    resetGame();
  }, [resetGame]);

  const statClass = "rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-center";

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
          <p className="text-sm font-bold tabular-nums text-[var(--color-text)]">{Math.max(high, score)}</p>
        </div>
        <div className={statClass}>
          <p className="text-[10px] text-[var(--color-text-subtle)]">关卡</p>
          <p className="text-sm font-bold tabular-nums text-[var(--color-text)]">{level}</p>
        </div>
        <div className={statClass}>
          <p className="text-[10px] text-[var(--color-text-subtle)]">生命</p>
          <p className="text-sm font-bold text-[var(--color-accent)] tracking-tight">{"♥".repeat(Math.max(0, lives))}</p>
        </div>
      </div>

      {/* 迷宫 */}
      <div className="relative mt-3">
        <canvas
          ref={canvasRef}
          className="block w-full aspect-[19/20] rounded-xl border border-[var(--color-border)]"
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
                <p className="text-xs text-[var(--color-text-muted)] tabular-nums">得分 {score} · 关卡 {level}</p>
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

      {/* 键盘提示（桌面端） */}
      <p className="hidden md:block mt-2.5 text-center text-[10px] leading-relaxed text-[var(--color-text-subtle)]">
        ↑ ↓ ← → / WASD 转向 · P/Esc 暂停 · 能量豆可反吃幽灵（连吃翻倍）
      </p>

      {/* 触屏方向键（小屏） */}
      <div className="mt-3 grid grid-cols-3 gap-2 md:hidden">
        <span />
        {([["↑", "up"]] as const).map(([label, name]) => (
          <button
            key={label}
            onPointerDown={(e) => {
              e.preventDefault();
              pacRef.current.next = DIRS[name];
            }}
            className="h-11 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-base text-[var(--color-text-muted)] active:bg-[var(--color-bg)] active:text-[var(--color-accent)] select-none touch-none"
          >
            {label}
          </button>
        ))}
        <span />
        {([["←", "left"], ["↓", "down"], ["→", "right"]] as const).map(([label, name]) => (
          <button
            key={label}
            onPointerDown={(e) => {
              e.preventDefault();
              pacRef.current.next = DIRS[name];
            }}
            className="h-11 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-base text-[var(--color-text-muted)] active:bg-[var(--color-bg)] active:text-[var(--color-accent)] select-none touch-none"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
