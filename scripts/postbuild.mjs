/**
 * 构建后处理（build 命令自动执行）：
 *   A. 删 dist 里 CSS 从未引用的孤儿 .woff（fontsource v5 声明只写 woff2，woff 是 Vite 全量拷贝的死重，-21MB）
 *   B. 把 Layout.*.css 里的 @font-face 声明（626 个 unicode-range 表，732KB，占主 CSS 92%）
 *      抽到独立的 /fonts.css，由 Layout.astro 的非阻塞 <link> 加载——
 *      主 CSS 从 791KB 降到 59KB，首屏文字渲染不再等字体声明；字体本身 display:swap 异步，晚到无妨。
 * 幂等：重复执行无副作用（抽完的 CSS 里已无 @font-face 段）。
 */
import { readdirSync, readFileSync, writeFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const CSS_DIR = "dist/client/_astro";
const kb = (n) => (n / 1024).toFixed(0);

// ── B：抽 @font-face → /fonts.css ──
const layoutCss = readdirSync(CSS_DIR).find((f) => /^Layout\..+\.css$/.test(f));
if (!layoutCss) {
  console.error("postbuild: 找不到 Layout.*.css，跳过字体拆分");
  process.exit(0); // 不让构建失败——大不了回到拆分前的形态
}
const cssPath = join(CSS_DIR, layoutCss);
const css = readFileSync(cssPath, "utf8");
const faces = css.match(/@font-face\{[^}]*\}/g) ?? [];

if (faces.length > 0) {
  writeFileSync("dist/client/fonts.css", faces.join(""));
  writeFileSync(cssPath, css.replace(/@font-face\{[^}]*\}/g, ""));
  console.log(
    `postbuild: 字体声明拆分 ${faces.length} 段 -> /fonts.css；` +
      `主 CSS ${kb(statSync(cssPath).size)}KB（gzip ${kb(gzipSync(readFileSync(cssPath)).length)}KB）`
  );
} else {
  console.log("postbuild: 主 CSS 已无 @font-face 段，跳过拆分");
}

// ── A：删孤儿 woff（fontsource CSS 只引用 woff2；woff2 保留） ──
let woffBytes = 0;
let woffCount = 0;
const walk = (dir) => {
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, f.name);
    if (f.isDirectory()) walk(p);
    else if (/\.(woff|ttf|eot)$/i.test(f.name)) {
      woffBytes += statSync(p).size;
      woffCount++;
      rmSync(p);
    }
  }
};
walk("dist/client");
console.log(`postbuild: 删除孤儿字体文件 ${woffCount} 个（-${kb(woffBytes)}MB 之外按字节即 ${kb(woffBytes)}KB）`);
