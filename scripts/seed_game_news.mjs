/**
 * Seed game_news table with data from original index.html hardcoded content.
 * Run: node scripts/seed_game_news.mjs
 */
import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "..", "data.db");
const db = new Database(dbPath);

// Ensure table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS game_news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game TEXT NOT NULL,
    tag TEXT NOT NULL,
    title TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`);

// Clear existing data
db.exec("DELETE FROM game_news");

const now = new Date().toISOString();
const insert = db.prepare(
  "INSERT INTO game_news (game, tag, title, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
);

const news = [
  // ── 原神 (genshin) ──
  { game: "genshin", tag: "新版本", sort: 1, title: "6.7版本「空月之歌·谐谑——映夏! 归乡? 千灵节!」7月1日正式上线 — 维护补偿原石×300" },
  { game: "genshin", tag: "卡池角色", sort: 2, title: "愚人众执行官「木偶」桑多涅 — 冰系大剑主C，星超导反应机制，专属武器「超越之匙」" },
  { game: "genshin", tag: "新活动", sort: 3, title: "千灵节盛典：深海潜水+场馆经营+捕鱼，免费送夏洛蒂+限定衣装「赫尔洛克变奏曲」" },
  { game: "genshin", tag: "前瞻", sort: 4, title: "7.0至冬国篇8月12日上线！冰神+七位新角色登场，告别「月之」系列篇章" },
  { game: "genshin", tag: "福利", sort: 5, title: "新地图「霜月」限时奖励400原石 + 「月谕圣牌」系统：八重神子、赛诺等7位老角色大幅强化" },

  // ── 星铁 (starrail) ──
  { game: "starrail", tag: "新版本", sort: 1, title: "4.4版本「鸣笛于归寂之时」7月15日上线 — SP姬子·启行登场，Fate二期联动同步开启" },
  { game: "starrail", tag: "卡池角色", sort: 2, title: "下半卡池UP：昔涟(记忆·冰) + 白厄(毁灭·物理)，截止7月14日" },
  { game: "starrail", tag: "新活动", sort: 3, title: "Fate/stay night [UBW] 二期联动7月15日上线 — 远坂凛+吉尔伽美什，卡池永久开放" },
  { game: "starrail", tag: "前瞻", sort: 4, title: "4.4前瞻特别节目7月3日已播出，4.5版本千星城度假胜地与翁法罗斯回归预告将至" },
  { game: "starrail", tag: "福利", sort: 5, title: "7月全活动星琼总量近90抽！零氪玩家可获丰厚奖励，限定活动为主要来源" },

  // ── 终末地 (endfield) ──
  { game: "endfield", tag: "新版本", sort: 1, title: "1.4版本「向渊行」7月10日上线 — 新角色李织烟(诀)登场，半周年庆典即将开启" },
  { game: "endfield", tag: "卡池角色", sort: 2, title: "卡缪限定UP进行中！六星近卫弭弗同步UP，武陵城巡卫队队长清波武艺传人" },
  { game: "endfield", tag: "新活动", sort: 3, title: "半周年庆典7月22日 + 终末地嘉年华7月30日-8月2日上海国家会展中心" },
  { game: "endfield", tag: "前瞻", sort: 4, title: "1.4版本下半年内容路线图即将公布，藏剑谷远古机关山谷探索持续开放中" },
  { game: "endfield", tag: "福利", sort: 5, title: "半周年六星角色赠送活动即将开启！全球公测半年累计下载突破3000万" },

  // ── 异环 (nte) ──
  { game: "nte", tag: "新版本", sort: 1, title: "1.2版本「九百九十九夜」7月2日正式上线 — 版本周期42天，持续至8月13日" },
  { game: "nte", tag: "卡池角色", sort: 2, title: "S级光属性主C「真红」龙娘登场！7/23首位限定奶妈「伊洛伊」灵属性治疗" },
  { game: "nte", tag: "新活动", sort: 3, title: "海特洛市郊游乐园全域开放 — 昼夜切换天气系统，嘉年华+过山车+迷宫" },
  { game: "nte", tag: "前瞻", sort: 4, title: "7月8日正式登陆Steam与Epic Games Store！海外营收已超国内，日本成第二主场" },
  { game: "nte", tag: "福利", sort: 5, title: "登录送S级常驻角色自选箱！14套免费时装 + 保时捷918联动盲盒7月8日截止" },
];

const insertMany = db.transaction(() => {
  for (const item of news) {
    insert.run(item.game, item.tag, item.title, item.sort, now, now);
  }
});

insertMany();

console.log(`Seeded ${news.length} game news items.`);

// Verify
const count = db.prepare("SELECT COUNT(*) as cnt FROM game_news").get();
console.log(`Total rows in game_news: ${count.cnt}`);

db.close();
