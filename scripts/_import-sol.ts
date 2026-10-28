/**
 * 一次性导入：把本地 .sol 存档文件写入 kaven（user_id=1）的云端存档（game_saves）。
 * 与 /api/game-save 同一套校验（game 标识、TCSO 魔数），已存在的存档直接覆盖。
 *
 * 用法：node_modules/.bin/tsx scripts/_import-sol.ts <game-id>=<sol路径> ...
 * 示例：tsx scripts/_import-sol.ts kadoona=E:/path/save_data_kadoona.sol irina=E:/path/save_data_kousoku.sol
 */
import { readFileSync } from "node:fs";
import { db } from "../src/db";
import { gameSaves } from "../src/db/schema";
import { eq, and } from "drizzle-orm";

const USER_ID = 1;
const GAME_ID = /^[a-z0-9_-]{1,40}$/i;

let ok = 0;
for (const arg of process.argv.slice(2)) {
  const eqIdx = arg.indexOf("=");
  const game = arg.slice(0, eqIdx).trim();
  const file = arg.slice(eqIdx + 1).trim();
  if (!GAME_ID.test(game) || !file) {
    console.error(`❌ 参数格式错误：${arg}`);
    process.exit(1);
  }
  const buf = readFileSync(file);
  const head = buf.subarray(0, 16).toString("latin1");
  if (!head.includes("TCSO")) {
    console.error(`❌ ${file} 不是有效的 .sol（无 TCSO 魔数）`);
    process.exit(1);
  }
  const data = buf.toString("base64");
  const existing = db
    .select()
    .from(gameSaves)
    .where(and(eq(gameSaves.userId, USER_ID), eq(gameSaves.game, game)))
    .get();
  if (existing) {
    db.update(gameSaves).set({ data, size: buf.length, updatedAt: new Date().toISOString().replace("T", " ").slice(0, 19) })
      .where(and(eq(gameSaves.userId, USER_ID), eq(gameSaves.game, game)))
      .run();
    console.log(`♻️  覆盖 ${game}（${existing.size}B -> ${buf.length}B）`);
  } else {
    db.insert(gameSaves).values({ userId: USER_ID, game, data, size: buf.length }).run();
    console.log(`✅ 导入 ${game}（${buf.length}B）`);
  }
  ok++;
}
console.log(`完成：${ok} 个存档已写入 user_id=${USER_ID}`);
