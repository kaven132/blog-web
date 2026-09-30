// 游戏线台账自检：校验 JSON 结构 + 模拟判定流程 + 校验 slug 与库内一致
import fs from 'node:fs';
import Database from 'better-sqlite3';

const st = JSON.parse(fs.readFileSync('scripts/_game-state.json', 'utf8'));
const db = new Database('data/blog.db', { readonly: true });

let fail = 0;
const need = (cond, msg) => {
  console.log((cond ? '  OK   ' : '  FAIL ') + msg);
  if (!cond) fail++;
};

console.log('=== 1. 顶层结构 ===');
need(typeof st.lastRun === 'string', 'lastRun 存在: ' + st.lastRun);
need(st.games && typeof st.games === 'object', 'games 对象存在');
need(Array.isArray(st._history), '_history 数组存在，' + (st._history?.length || 0) + ' 条');
need(st._fields && st._fields.seenPreview, '_fields 文档已补 seenPreview 说明');

console.log('=== 2. 每款游戏字段完整性 ===');
const keys = ['endfield', 'hsr', 'genshin'];
for (const k of keys) {
  const g = st.games[k];
  if (!g) { need(false, k + ' 条目存在'); continue; }
  const must = ['name', 'tag', 'version', 'title', 'releaseDate', 'postSlug', 'postedAt', 'nextVersion', 'lastChecked', 'seenPreview'];
  const missing = must.filter((f) => g[f] === undefined);
  need(missing.length === 0, `${k} 必填字段齐全${missing.length ? '（缺: ' + missing.join(',') + '）' : ''}`);
  need(g.seenPreview && typeof g.seenPreview.hit === 'boolean', `${k}.seenPreview.hit 为布尔: ${g.seenPreview?.hit}`);
}

console.log('=== 3. postSlug 与库内一致性 ===');
for (const k of keys) {
  const g = st.games[k];
  const row = db.prepare('select id,slug,published from posts where slug=?').get(g.postSlug);
  need(!!row, `${k} postSlug=${g.postSlug} 在库中存在${row ? ' (id=' + row.id + ', pub=' + row.published + ')' : ''}`);
  if (row) need(row.published === 1, `${k} 已发布 published=1`);
}

console.log('=== 4. 模拟下次运行判定（版本号比对） ===');
// 用「库里最新一篇 game-<key> 的版本」反推，模拟「最新版本号」输入
for (const k of keys) {
  const latest = db
    .prepare("select slug, title, created_at from posts where slug like ? order by created_at desc limit 1")
    .get('game-' + k + '-%');
  const ledgerVer = st.games[k].version;
  const titleVerMatch = latest ? latest.title.match(/(\d+\.\d+)/) : null;
  const latestVer = titleVerMatch ? titleVerMatch[1] : '?';
  const verdict = latestVer !== ledgerVer ? 'NEEDS_WRITE（版本号不同）' : 'SKIP（版本号相同）';
  console.log(`  ${k}: 库内最新版=${latestVer} / 台账=${ledgerVer} -> ${verdict}`);
}

console.log('=== 5. slug 无重复（-2 后缀检查） ===');
for (const k of keys) {
  const n = db.prepare("select count(*) c from posts where slug like ?").get('game-' + k + '-%-2%').c;
  need(n === 0, `${k} 无 -2 后缀重复行（当前 ${n} 条）`);
}

console.log(fail === 0 ? '\n结果：全部通过 ✅' : `\n结果：${fail} 项失败 ❌`);
process.exit(fail === 0 ? 0 : 1);
