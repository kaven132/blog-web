/**
 * 一次性迁移：给 likes.post_id 加唯一索引
 *
 * 背景：likes 表原本允许同一个 post_id 出现多行，且 /api/like 是「先读再写」，
 * 并发请求会插出重复行 / 丢更新。加了唯一索引后，API 才能用
 * INSERT ... ON CONFLICT(post_id) DO UPDATE 做原子累加。
 *
 * 步骤：备份 → 合并重复行（count 取合计）→ 建唯一索引 → 体检
 * 可重复执行：已建过索引时会直接跳过。
 *
 * 运行：export NODE_OPTIONS= && E:/devtools/nodejs/node.exe node_modules/tsx/dist/cli.mjs scripts/migrate-likes-unique.ts
 */
import { copyFileSync, mkdirSync } from "node:fs";
import Database from "better-sqlite3";

const sqlite = new Database("./data/blog.db");
sqlite.pragma("journal_mode = WAL");

// 1) 备份
const backupDir = "./data/backups";
mkdirSync(backupDir, { recursive: true });
sqlite.pragma("wal_checkpoint(TRUNCATE)");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = `${backupDir}/blog-${stamp}.db`;
copyFileSync("./data/blog.db", backupPath);
console.log(`📦 已备份到 ${backupPath}`);

// 2) 合并重复的 post_id
interface DupGroup {
  post_id: number;
  n: number;
  total: number;
  keep: number;
}

const groups = sqlite
  .prepare(
    `SELECT post_id, COUNT(*) AS n, SUM(count) AS total, MIN(id) AS keep
     FROM likes GROUP BY post_id HAVING n > 1`
  )
  .all() as DupGroup[];

const merge = sqlite.transaction((rows: DupGroup[]) => {
  for (const g of rows) {
    sqlite.prepare("UPDATE likes SET count = ? WHERE id = ?").run(g.total, g.keep);
    sqlite.prepare("DELETE FROM likes WHERE post_id = ? AND id <> ?").run(g.post_id, g.keep);
  }
});
merge(groups);
console.log(`🧹 重复 post_id 分组：${groups.length} 组已合并`);

// 3) 建唯一索引
sqlite.exec("CREATE UNIQUE INDEX IF NOT EXISTS likes_post_id_unique ON likes(post_id)");
const index = sqlite
  .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'likes_post_id_unique'")
  .get();
console.log(index ? "✅ 唯一索引 likes_post_id_unique 已就绪" : "❌ 唯一索引创建失败");

// 4) 体检
const count = (t: string) =>
  (sqlite.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;
console.log(`posts = ${count("posts")}, comments = ${count("comments")}, likes = ${count("likes")}`);

sqlite.close();
