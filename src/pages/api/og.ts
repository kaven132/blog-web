import type { APIRoute } from "astro";
import { Resvg } from "@resvg/resvg-js";
import { existsSync } from "node:fs";

export const prerender = false;

/**
 * OG 分享卡端点：/api/og?t=<标题>&tag=<分类标签> → 1200×630 PNG。
 * 社交平台（微信/Telegram/Twitter 等）抓链接时渲染的预览大图；Layout 里未显式传
 * ogImage 时全站默认指向本端点，文章封面图仍优先用封面。
 *
 * - 文字排版手排 SVG（CJK 等宽按 fontSize、ASCII 按 0.52 倍宽估算换行），
 *   经 resvg 栅格化——不引 Satori，省一套 JSX/字体子集链路。
 * - 字体：data/fonts/og-cjk.ttf（gitignored 本地资产，服务端独用不进浏览器）；
 *   本地开发用 Windows 黑体拷贝，公网部署建议换 Noto Sans SC（OFL 许可无争议）。
 *   字体缺失时降级出纯底图（无文字），卡片链路不 5xx。
 * - 卡图内容只依赖 URL 参数：Cache-Control immutable 长缓存，社交平台抓一次即可。
 */

const FONT_PATH = process.env.OG_FONT || "data/fonts/og-cjk.ttf";
const W = 1200;
const H = 630;
const PAD = 88;
const TITLE_FONT = 60;
const TITLE_MAX_LINES = 3;
const SITE_NAME = "kaven的个人网页";

/** XML 转义（标题来自查询参数，不可信任） */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** CJK 字宽 ≈ fontSize，ASCII ≈ 0.52 倍 —— 按像素宽估算换行，超出行数截断加省略号 */
function wrapTitle(title: string): string[] {
  const maxWidth = W - PAD * 2;
  const charW = (ch: string) => (ch.codePointAt(0)! > 0x2e7f ? TITLE_FONT : TITLE_FONT * 0.52);
  const lines: string[] = [];
  let cur = "";
  let curW = 0;
  for (const ch of title) {
    if (curW + charW(ch) > maxWidth && cur) {
      lines.push(cur);
      cur = "";
      curW = 0;
      if (lines.length === TITLE_MAX_LINES) {
        // 已满 N 行：把最后一行末尾换成省略号，剩余内容丢弃
        const last = lines[TITLE_MAX_LINES - 1];
        let w = 0;
        let cut = last.length;
        const ellW = charW("…");
        for (let i = last.length - 1; i >= 0; i--) {
          w += charW(last[i]);
          if (w + ellW > maxWidth) {
            cut = i;
            break;
          }
        }
        lines[TITLE_MAX_LINES - 1] = last.slice(0, cut) + "…";
        return lines;
      }
    }
    cur += ch;
    curW += charW(ch);
  }
  if (cur) lines.push(cur);
  return lines.slice(0, TITLE_MAX_LINES);
}

function buildSvg(title: string, tag: string, hasFont: boolean): string {
  const lines = hasFont ? wrapTitle(title) : [];
  const titleY = tag ? 320 : 300;
  const titleText = lines
    .map(
      (line, i) =>
        `<text x="${PAD}" y="${titleY + i * (TITLE_FONT + 18)}" font-family="SimHei" font-size="${TITLE_FONT}" font-weight="bold" fill="#f5f1ea">${esc(line)}</text>`,
    )
    .join("\n  ");
  const tagChip = tag
    ? `<rect x="${PAD}" y="196" rx="8" width="${tag.length * 26 + 36}" height="44" fill="none" stroke="#e2543e" stroke-width="2" />
  <text x="${PAD + 18}" y="226" font-family="SimHei" font-size="24" fill="#e2543e">${esc(tag)}</text>`
    : "";
  const siteText = hasFont
    ? `<text x="${PAD + 22}" y="${H - 62}" font-family="SimHei" font-size="26" fill="#a89f96">${esc(SITE_NAME)}</text>`
    : "";
  const siteBar = `<rect x="${PAD}" y="${H - 86}" width="8" height="34" rx="3" fill="#e2543e" />`;

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#211e1c" />
      <stop offset="1" stop-color="#302019" />
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)" />
  <circle cx="1096" cy="72" r="230" fill="#e2543e" opacity="0.13" />
  <circle cx="64" cy="${H + 30}" r="180" fill="#e2543e" opacity="0.09" />
  <rect x="${PAD}" y="150" width="64" height="6" rx="3" fill="#e2543e" />
  ${tagChip}
  ${titleText}
  ${siteBar}
  ${siteText}
</svg>`;
}

export const GET: APIRoute = async ({ url }) => {
  const title = (url.searchParams.get("t") || SITE_NAME).slice(0, 120);
  const tag = (url.searchParams.get("tag") || "").slice(0, 16).trim();
  const hasFont = existsSync(FONT_PATH);

  const svg = buildSvg(title, tag, hasFont);
  const resvg = new Resvg(svg, {
    fitTo: { mode: "original" },
    font: hasFont
      ? { fontFiles: [FONT_PATH], loadSystemFonts: false, defaultFontFamily: "SimHei" }
      : { loadSystemFonts: false },
  });
  const png = resvg.render().asPng();

  return new Response(png as unknown as BodyInit, {
    headers: {
      "Content-Type": "image/png",
      // 卡图只依赖 URL 参数，内容稳定可永久缓存（平台抓取一次后不再回源）
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};
