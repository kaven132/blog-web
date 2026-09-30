// 把候选图拼成一张带编号的预览网格，一次 Read 就能全部看完，省上下文。
// node scripts/_books/montage.mjs --dir=scripts/_books/book/cand --out=scripts/_books/book/_preview.jpg [--cols=4]
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=?(.*)$/);
    return m ? [m[1], m[2]] : [a, ''];
  })
);

const dir = args.dir;
const out = args.out;
const cols = Number(args.cols || 4);
if (!dir || !out) throw new Error('need --dir= and --out=');

const files = fs
  .readdirSync(dir)
  .filter((f) => /\.(jpe?g|png|webp)$/i.test(f) && !f.startsWith('_'))
  .sort();
if (!files.length) throw new Error('no images in ' + dir);

const W = 340;
const H = 230;
const rows = Math.ceil(files.length / cols);
const comps = [];
for (let i = 0; i < files.length; i++) {
  const left = (i % cols) * W;
  const top = Math.floor(i / cols) * H;
  try {
    const buf = await sharp(path.join(dir, files[i]))
      .resize(W - 8, H - 8, { fit: 'cover' })
      .jpeg({ quality: 76 })
      .toBuffer();
    comps.push({ input: buf, left: left + 4, top: top + 4 });
  } catch (e) {
    console.log('skip ' + files[i] + ': ' + e.message);
  }
  const label = String(i + 1);
  const svg = Buffer.from(
    '<svg width="64" height="34" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="64" height="34" fill="#000" opacity="0.66" rx="4"/>' +
      '<text x="9" y="25" font-family="Arial,Helvetica,sans-serif" font-size="21" font-weight="bold" fill="#fff">' +
      label +
      '</text></svg>'
  );
  comps.push({ input: svg, left: left + 8, top: top + 8 });
}

await sharp({
  create: { width: W * cols, height: H * rows, channels: 3, background: '#2b2b2b' },
})
  .composite(comps)
  .jpeg({ quality: 82 })
  .toFile(out);

console.log('grid -> ' + out + ' (' + files.length + ' imgs, ' + cols + ' cols)');
files.forEach((f, i) => console.log('  ' + (i + 1) + '  ' + f));
