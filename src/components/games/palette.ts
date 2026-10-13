/**
 * 四款小游戏共用色板 —— 贴合站点「暖白单色 + 珊瑚红点缀」的主题：
 * 棋盘统一暖白底 + 暖灰网格；方块/数字用低饱和大地色系（沙金 / 琥珀 / 灰蓝 / 灰紫 / 灰绿 / 灰粉），
 * 珊瑚红只做点缀（蛇头、食物、踩中的雷、2048 目标块）。
 * 棋盘底色走 CSS 变量（--game-*，global.css 定义、暗色模式覆盖），其余为与主题无关的固定色。
 */

/** 从 CSS 变量读取棋盘配色（每帧调用一次的开销可忽略；暗色切换自动生效） */
export function boardColors() {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback;
  return {
    bg: v("--game-board-bg", "#faf8f1"),
    grid: v("--game-board-grid", "#eae3d6"),
    wall: v("--game-wall", "#e2dbc9"),
    pellet: v("--game-pellet", "#d9b48f"),
  };
}

/** 扫雷已翻开的格子底色（CSS 变量，暗色模式自动覆盖） */
export const CELL_REVEALED = "var(--game-cell-revealed)";

/** 珊瑚红家族：点缀专用 */
export const CORAL = {
  deep: "#b85a4a", // 最深：贪吃蛇头 / 最高警示
  main: "#d97a6a", // 主珊瑚：Z 块 / 蛇身 / 3 号数字
  bright: "#d94f43", // 亮珊瑚（≈ 站点 accent）：食物 / 踩中的雷 / 2048 里的终目标
  soft: "rgba(217, 122, 106, 0.78)", // 蛇身半透明
};

/** 大地色辅助系：方块 / 数字区分色（全部低饱和） */
export const GOLD = "#d9c06a";
export const AMBER = "#d9a56a";
export const DUSTY = {
  blue: "#8ba3b5",
  violet: "#a294b8",
  sage: "#9cb491",
  rose: "#c99cab",
};

/** 2048 瓦片：同色相珊瑚渐深阶梯，2048 用金色作为「毕业色」 */
export const TILE_2048: Record<number, { bg: string; fg: string }> = {
  2: { bg: "#f0e9dc", fg: "#6b6357" },
  4: { bg: "#e9dcc4", fg: "#6b6357" },
  8: { bg: "#eccfa5", fg: "#fff" },
  16: { bg: "#e8bc85", fg: "#fff" },
  32: { bg: "#e2a468", fg: "#fff" },
  64: { bg: "#db8b50", fg: "#fff" },
  128: { bg: "#d37340", fg: "#fff" },
  256: { bg: "#ca5c36", fg: "#fff" },
  512: { bg: "#bd4830", fg: "#fff" },
  1024: { bg: "#a63b2c", fg: "#fff" },
  2048: { bg: GOLD, fg: "#6b6357" },
};
