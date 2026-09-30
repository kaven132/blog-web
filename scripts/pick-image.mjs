// 本线专用：loremflickr 全站封锁期间的应急取图
// 从 Bing 图片搜索结果里提取 Pexels / Unsplash 的真实照片直链（免费可商用图库），
// 下载候选供肉眼挑选，或直接把指定候选拷到目标路径。
//
// 用法：
//   抓候选： node scripts/_books/pick-image.mjs --q="chinese small town street" --name=cover --out=scripts/_books/book/cand
//   落盘：   node scripts/_books/pick-image.mjs --pick=3 --from=scripts/_books/book/cand --name=cover --dest=data/uploads/_cover-tmp-book-rec-20260924.jpg
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=?(.*)$/);
    return m ? [m[1], m[2]] : [a, ''];
  })
);

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const md5 = (b) => crypto.createHash('md5').update(b).digest('hex');

function normalize(u) {
  u = u.replace(/\\u002f/gi, '/').replace(/\\\//g, '/').replace(/&amp;/g, '&');
  try {
    const o = new URL(u);
    o.hash = '';
    if (o.hostname === 'images.pexels.com') o.search = '?auto=compress&cs=tinysrgb&w=1400';
    else if (o.hostname === 'images.unsplash.com') o.search = '?w=1400&q=80&fm=jpg';
    return o.toString();
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url, ms = 15000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { redirect: 'follow', signal: ctl.signal, headers: { 'user-agent': UA } });
  } finally {
    clearTimeout(t);
  }
}

// 排除两类来源：
//  1. 付费图库站的预览图（带水印 / 版权不干净）
//  2. AI 生成图库（stockcake 等）—— 本线严禁 AI 生图，2026-09-28 实测 Bing 图搜
//     `antique book wooden desk candle` 前 6 条全落到 stockcake，画面是明显的 AI 插画
//     `波尔图 francesinha 三明治 葡式美食`（2026-09-28，旅游线）前 6 条里 5 条落到 699pic，
//     它的预览图**不带显眼水印**但全是统一风格的商业摆拍图，只能靠肉眼辨认，故按域名拦。
const STOCK_BLOCK =
  /(freepik|dreamstime|alamy|vecteezy|shutterstock|istockphoto|gettyimages|rawpixel|123rf|depositphotos|canstockphoto|stock\.adobe|pinterest|pinimg|etsystatic|lookaside|stockcake|pellinor|openart|lexica\.art|midjourney|nightcafe|lovepik|watermark\.lovepik|58pic|tukuppt|zhituwang|ooopic|699pic|redocn|ntimg|klook)/i;

async function collectUrls(q, want) {
  const qft = args.qft ? '&qft=' + encodeURIComponent(args.qft) : '';
  const endpoints = [
    'https://www.bing.com/images/async?q=' + encodeURIComponent(q) + '&first=0&count=60&mmasync=1' + qft,
    'https://www.bing.com/images/search?q=' + encodeURIComponent(q) + '&form=HDRSC2&first=0&count=60' + qft,
  ];
  const seen = new Set();
  const strict = [];
  const loose = [];
  for (const ep of endpoints) {
    let html = '';
    try {
      const r = await fetchWithTimeout(ep, 20000);
      if (!r.ok) {
        console.log('  [' + r.status + '] ' + ep.slice(0, 60));
        continue;
      }
      html = await r.text();
    } catch (e) {
      console.log('  ERR ' + e.message);
      continue;
    }
    // Bing 把 JSON 片段做成了 HTML 实体（&quot;murl&quot;:&quot;...&quot;），先解实体
    const plain = html.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'");
    const re = /"murl"\s*:\s*"(https?:[^"]+)"/g;
    let m;
    while ((m = re.exec(plain))) {
      const u = normalize(m[1]);
      if (!u || seen.has(u)) continue;
      if (STOCK_BLOCK.test(u)) continue;
      seen.add(u);
      if (/images\.(pexels|unsplash)\.com/.test(u)) strict.push(u);
      else if (/\.(jpe?g|png|webp)(\?|$)/i.test(u)) loose.push(u);
    }
    if (strict.length >= want * 3) break;
  }
  return [...strict, ...loose].slice(0, want);
}

async function grab(url, dest) {
  const r = await fetchWithTimeout(url, 25000);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const ct = r.headers.get('content-type') || '';
  if (!/image\//.test(ct)) throw new Error('not image: ' + ct);
  const b = Buffer.from(await r.arrayBuffer());
  if (b.length < 20 * 1024) throw new Error('too small ' + b.length);
  fs.writeFileSync(dest, b);
  return { size: b.length, md5: md5(b) };
}

(async () => {
  if (args.pick && args.from) {
    const files = fs
      .readdirSync(args.from)
      .filter((f) => f.startsWith(args.name + '-') && /\.(jpg|jpeg|png|webp)$/i.test(f))
      .sort();
    const f = files[Number(args.pick) - 1];
    if (!f) throw new Error('no candidate #' + args.pick + ' in ' + args.from);
    fs.mkdirSync(path.dirname(args.dest), { recursive: true });
    fs.copyFileSync(path.join(args.from, f), args.dest);
    const b = fs.readFileSync(args.dest);
    console.log('PICKED ' + f + ' -> ' + args.dest + ' | ' + b.length + 'B | ' + md5(b).slice(0, 8));
    return;
  }

  const q = args.q;
  const out = args.out || 'scripts/_books/_cand';
  const name = args.name || 'img';
  const want = Number(args.n || 6);
  if (!q) throw new Error('need --q=');
  fs.mkdirSync(out, { recursive: true });
  console.log('QUERY: ' + q);
  const urls = await collectUrls(q, want * 2);
  console.log('urls: ' + urls.length);
  let i = 0;
  for (const u of urls) {
    if (i >= want) break;
    const ext = (u.match(/\.(jpe?g|png|webp)/i) || [, 'jpg'])[1].toLowerCase().replace('jpeg', 'jpg');
    const dest = path.join(out, name + '-' + (i + 1) + '.' + ext);
    try {
      const r = await grab(u, dest);
      i++;
      console.log('  [' + i + '] ' + r.size + 'B ' + r.md5.slice(0, 8) + ' ' + u.slice(0, 110));
    } catch (e) {
      console.log('  skip ' + e.message + ' ' + u.slice(0, 90));
    }
  }
  console.log('saved ' + i + ' candidates to ' + out);
})();
