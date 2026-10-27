/**
 * RPG Maker 网页游戏注册表（RPG Maker MV/MZ 本身就是 HTML5 引擎，www/ 目录静态托管 + iframe 嵌入）。
 * 加新游戏：data/games/<id>/ 放 www/ 目录（可选 preview.png 卡片预览图）+ 本表加一项。
 * ⚠️ 同源下多款 RPG Maker 游戏的存档键会互相覆盖：复制后必须给 www/js/rpg_managers.js 的
 *    StorageManager.webStorageKey 打上游戏专属前缀补丁（如 'RPG ' → 'DL_RPG '），savePrefix 与之一致。
 */
export interface RpgGame {
  /** URL 与云端存档标识（game_saves.game） */
  id: string;
  title: string;
  orig: string;
  desc: string;
  tags: string[];
  /** 游戏存档的 localStorage 键前缀（rpg_managers.js 补丁后实际使用的值） */
  savePrefix: string;
  /** www/ 内入口文件 */
  entry: string;
  footer: string;
}

export const RPG_GAMES: RpgGame[] = [
  {
    id: "daily-lives",
    title: "乡间日常",
    orig: "Daily Lives of My Countryside · RPG Maker MV",
    desc: "RPG Maker MV 田园生活题材作 —— 经营乡间日常、与邻里互动推进剧情，中文版即点即玩，进度自动云同步。",
    tags: ["RPG Maker", "田园生活", "账号存档"],
    savePrefix: "DL_RPG",
    entry: "index.html",
    footer: "首次加载约 1.9GB · 按需流式",
  },
];

export function getRpgGame(id: string | undefined): RpgGame | undefined {
  return RPG_GAMES.find((g) => g.id === id);
}
