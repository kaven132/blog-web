/**
 * Flash 游戏（Ruffle 网页运行）注册表 —— 加新游戏只需：
 * 1. 游戏文件放 data/games/<id>/（main.swf + sub/ 场景，可选 preview.png 卡片预览图）；
 * 2. 本表加一项（id 即 URL 与 game_saves.game 标识；solName 从主程序二进制常量池的 getLocal 附近挖）。
 * 页面 /games/<id> 与端点 /games/<id>/swf/* 均由动态路由按本表驱动，仅登录用户可见。
 */
export interface FlashGame {
  /** URL 与云端存档标识（game_saves.game） */
  id: string;
  title: string;
  /** 原名/副标题（游戏页标题旁小字） */
  orig: string;
  desc: string;
  tags: string[];
  /** 游戏内 SharedObject 名（localStorage 同步键 = 主机名//solName） */
  solName: string;
  /** 卡片左下角小字（首载体积提示） */
  footer: string;
}

export const FLASH_GAMES: FlashGame[] = [
  {
    id: "kakutoumusume",
    title: "红发格斗妹",
    orig: "被误认为仇人 格斗娘",
    desc: "Ruffle 模拟器网页运行的 Flash 格斗游戏 —— 剧情 / 战斗 / 养成要素齐全，鼠标推进剧情、键盘出招，进度自动云同步。",
    tags: ["Flash", "格斗", "Ruffle", "账号存档"],
    solName: "save_data_kakutoumusume",
    footer: "首次加载约 46MB",
  },
  {
    id: "mahou-shoujo",
    title: "魔法少女",
    orig: "魔法少女バスター · JSK 格斗",
    desc: "JSK 战斗模板的魔法少女题材作 —— 迎战来袭的袭击者，特殊技与多结局收集，Ruffle 模拟器网页运行，进度自动云同步。",
    tags: ["Flash", "格斗", "Ruffle", "账号存档"],
    solName: "save_data_mahoumia",
    footer: "首次加载约 73MB",
  },
  {
    id: "koakuma",
    title: "无法抵抗小恶魔",
    orig: "小悪魔からは逃げられない",
    desc: "JSK 对话养成作 —— 与小恶魔的同居日常，好感度推进故事、多结局，Ruffle 模拟器网页运行，进度自动云同步。",
    tags: ["Flash", "对话养成", "Ruffle", "账号存档"],
    solName: "save_data_koakuma",
    footer: "首次加载约 51MB",
  },
  {
    id: "witch-girl",
    title: "魔女女孩",
    orig: "WITCH GIRL · KooooN Soft 横版动作",
    desc: "KooooN Soft 的横版动作探索游戏 —— 操纵魔女闯关救伙伴，AS2 老引擎在 Ruffle 下兼容度最高，进度自动云同步。",
    tags: ["Flash", "横版动作", "Ruffle", "账号存档"],
    solName: "witchgirl_data",
    footer: "首次加载约 37MB · 含语音包",
  },
  {
    id: "shinobi-girl",
    title: "忍者女孩",
    orig: "SHINOBI GIRL · KooooN Soft 横版动作",
    desc: "KooooN Soft 横版动作系列的女忍者篇 —— 潜入魔物巢穴营救被掳的少女们，进度自动云同步。",
    tags: ["Flash", "横版动作", "Ruffle", "账号存档"],
    solName: "shinobigirl_data",
    footer: "首次加载约 15MB",
  },
  {
    id: "kung-fu-girl",
    title: "功夫女孩",
    orig: "KUNG-FU GIRL · KooooN Soft 横版动作",
    desc: "KooooN Soft 横版动作系列的功夫少女篇 —— 中国风舞台连闯七关，支持自定义发色与服装，进度自动云同步。",
    tags: ["Flash", "横版动作", "Ruffle", "账号存档"],
    solName: "kungfugirl_data_v1",
    footer: "首次加载约 17MB",
  },
  {
    id: "angel-girl",
    title: "天使女孩",
    orig: "ANGEL GIRL X · KooooN Soft 单篇小品",
    desc: "KooooN Soft 的单篇小品 —— 天使少女奉命讨伐封印魔物，单文件即点即玩（本作无存档功能）。",
    tags: ["Flash", "小品", "Ruffle"],
    solName: "angelgirl_none",
    footer: "单文件 2MB · 无存档功能",
  },
];

export function getFlashGame(id: string | undefined): FlashGame | undefined {
  return FLASH_GAMES.find((g) => g.id === id);
}
