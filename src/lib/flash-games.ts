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
  /** 设备字体注册源（可选）：游戏对话用设备字体而非内嵌字体时，把含中文字形的 TTF 交给 Ruffle 注册 */
  fonts?: string[];
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
    id: "oyajigari",
    title: "狩猎大叔少女与超能力大叔",
    orig: "オヤジ狩り · JSK 格斗",
    desc: "JSK 战斗作 —— 猎大叔少女与超能力大叔的攻防战，战斗压制推进剧情、多结局，Ruffle 模拟器网页运行，进度自动云同步。",
    tags: ["Flash", "格斗", "Ruffle", "账号存档"],
    solName: "save_data_oyajigarigarl",
    footer: "首次加载约 54MB",
  },
  {
    id: "seifuku-senshi",
    title: "制服剑士",
    orig: "制服剣士 · JSK 格斗",
    desc: "JSK 战斗作 —— 制服剑士的斩击对决，出招连段与结局收集，Ruffle 模拟器网页运行，进度自动云同步。",
    tags: ["Flash", "格斗", "Ruffle", "账号存档"],
    solName: "save_data_kenshi",
    footer: "首次加载约 74MB",
  },
  {
    id: "maisa",
    title: "封魔少女真衣纱",
    orig: "封魔少女マイサ · JSK 格斗",
    desc: "JSK 战斗作 —— 封魔少女以符咒之力的驱魔之战，战斗与剧情双线推进、多结局，Ruffle 模拟器网页运行，进度自动云同步。",
    tags: ["Flash", "格斗", "Ruffle", "账号存档"],
    solName: "save_data_maisa",
    footer: "首次加载约 15MB",
    // 对话文本是 HTML 设备字体（face="DFGothic-EB"，字体替换式汉化）：
    // 不注册含中文字形的同名字体，Ruffle 渲染不出文字（对话框空白）
    fonts: ["/games/maisa/swf/fonts/DFGothic-EB.ttf"],
  },
  {
    id: "elf-knight",
    title: "精灵女骑士",
    orig: "エルフの騎士 · JSK 格斗",
    desc: "JSK 战斗作 —— 精灵族女骑士的陷落之战，战斗败北走向多结局分支，Ruffle 模拟器网页运行，进度自动云同步。",
    tags: ["Flash", "格斗", "Ruffle", "账号存档"],
    solName: "save_data_elfknight",
    footer: "首次加载约 52MB",
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
    id: "cheat-girl",
    title: "作弊少女的威逼方法",
    orig: "JSK Studio · RJ090461",
    desc: "JSK 对话养成作 —— 抓住作弊少女的把柄展开的威逼剧情，多结局收集，Ruffle 模拟器网页运行，进度自动云同步。",
    tags: ["Flash", "对话养成", "Ruffle", "账号存档"],
    solName: "save_data4",
    footer: "首次加载约 15MB",
  },
  {
    id: "thief-girl",
    title: "偷窃少女的教育方法",
    orig: "万引き少女のしつけかた",
    desc: "JSK 对话养成作 —— 当场抓获的偷窃少女该如何「教育」，好感与堕落双线推进、多结局，Ruffle 模拟器网页运行，进度自动云同步。",
    tags: ["Flash", "对话养成", "Ruffle", "账号存档"],
    solName: "save_data_idol",
    footer: "首次加载约 35MB",
  },
  {
    id: "kadoona",
    title: "濑南里绪",
    orig: "KADOONA · JSK 汉化组",
    desc: "JSK 对话养成作 —— 篇幅最大的多线剧情作，章节式推进、三结局分支，Ruffle 模拟器网页运行，进度自动云同步。",
    tags: ["Flash", "对话养成", "Ruffle", "账号存档"],
    solName: "save_data_kadoona",
    footer: "首次加载约 138MB",
  },
  {
    id: "irina",
    title: "皇女伊莉娜",
    orig: "皇女イリーナ · JSK",
    desc: "JSK 对话养成作 —— 拘束审问高傲皇女的调教剧本，态度值养成、多结局，Ruffle 模拟器网页运行，进度自动云同步。",
    tags: ["Flash", "对话养成", "Ruffle", "账号存档"],
    solName: "save_data_kousoku",
    footer: "首次加载约 39MB",
  },
  {
    id: "niece",
    title: "不高兴的侄女",
    orig: "不機嫌な姪は取扱注意 · JSK",
    desc: "JSK 对话养成作 —— 与闹别扭的侄女同住一个屋檐下的日常攻略，剧情分量十足、四结局，Ruffle 模拟器网页运行，进度自动云同步。",
    tags: ["Flash", "对话养成", "Ruffle", "账号存档"],
    solName: "save_data_toriatukai",
    footer: "首次加载约 176MB",
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
