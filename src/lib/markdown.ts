import { optimizeImgSrc } from "./imgsrc";

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface MdHeading {
  level: number;
  text: string;
  id: string;
}

/** 标题文本 → 目录锚点 id：保留中英文与数字，其余折叠为 -；同一 id 自动 -1/-2 去重 */
function headingId(text: string, used: Map<string, number>): string {
  let base =
    text
      .replace(/[`*]/g, "")
      .toLowerCase()
      .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
      .replace(/^-+|-+$/g, "") || "section";
  const n = used.get(base) ?? 0;
  used.set(base, n + 1);
  return n ? `${base}-${n}` : base;
}

/** 提取 h2/h3 生成目录数据；id 生成规则与 renderMarkdown 的标题 id 完全一致 */
export function extractHeadings(src: string): MdHeading[] {
  const used = new Map<string, number>();
  const out: MdHeading[] = [];
  let inCode = false;
  for (const rawLine of src.split("\n")) {
    if (rawLine.startsWith("```")) inCode = !inCode;
    if (inCode) continue;
    const m = rawLine.match(/^(#{2,3})\s+(.*)/);
    if (!m) continue;
    const text = m[2].replace(/[`*]/g, "").trim();
    out.push({ level: m[1].length, text, id: headingId(text, used) });
  }
  return out;
}

function inline(md: string): string {
  const codes: string[] = [];
  let s = escapeHtml(md).replace(/`([^`]+)`/g, (_, code: string) => {
    codes.push(code);
    return `\u0000${codes.length - 1}\u0000`;
  });

  // 链接只放行 http(s)、协议相对地址和 mailto，防 javascript: 伪协议 XSS
  const SAFE_URL = /^(https?:\/\/|\/\/|mailto:)/i;
  s = s
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt: string, url: string) => {
      // 此时 url 已被 escapeHtml 过（& → &amp;），先还原再走代理改写，避免双重编码
      const src = optimizeImgSrc(url.replace(/&amp;/g, "&")) ?? url;
      return `<img src="${src}" alt="${alt}" loading="lazy" />`;
    })
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text: string, url: string) =>
      SAFE_URL.test(url) ? `<a href="${url}" target="_blank" rel="noopener">${text}</a>` : m
    );

  return s.replace(/\u0000(\d+)\u0000/g, (_, i: string) => `<code>${codes[Number(i)]}</code>`);
}

export function renderMarkdown(src: string): string {
  const lines = src.split("\n");
  const out: string[] = [];
  let inCode = false;
  let codeLang = "";
  let codeBuf: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let listBuf: string[] = [];
  let paraBuf: string[] = [];
  const usedIds = new Map<string, number>();

  const closeList = () => {
    if (listType) {
      const tag = listType === "ul" ? "ul" : "ol";
      out.push(`<${tag}>${listBuf.map((l) => `<li>${l}</li>`).join("")}</${tag}>`);
      listType = null;
      listBuf = [];
    }
  };

  const closePara = () => {
    if (paraBuf.length) {
      out.push(`<p>${paraBuf.join("<br />")}</p>`);
      paraBuf = [];
    }
  };

  const flush = () => {
    closeList();
    closePara();
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (inCode) {
      if (line.startsWith("```")) {
        inCode = false;
        const lang = codeLang.replace(/[^a-z0-9_-]/gi, "");
        out.push(`<pre${lang ? ` data-lang="${lang}"` : ""}><code>${escapeHtml(codeBuf.join("\n"))}</code></pre>`);
        codeBuf = [];
        codeLang = "";
      } else {
        codeBuf.push(line);
      }
      continue;
    }

    if (line.startsWith("```")) {
      flush();
      inCode = true;
      codeLang = (line.match(/^```(\S*)/)?.[1] ?? "").toLowerCase();
      codeBuf = [];
      continue;
    }

    if (line.trim() === "") {
      flush();
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)/);
    if (heading) {
      flush();
      const level = heading[1].length;
      const id = level >= 2 && level <= 3 ? ` id="${headingId(heading[2], usedIds)}"` : "";
      out.push(`<h${level}${id}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    if (line.startsWith(">")) {
      flush();
      out.push(`<blockquote>${inline(line.replace(/^>\s?/, ""))}</blockquote>`);
      continue;
    }

    const ul = line.match(/^[-*]\s+(.*)/);
    if (ul) {
      closePara();
      if (listType !== "ul") {
        closeList();
        listType = "ul";
      }
      listBuf.push(inline(ul[1]));
      continue;
    }

    const ol = line.match(/^\d+\.\s+(.*)/);
    if (ol) {
      closePara();
      if (listType !== "ol") {
        closeList();
        listType = "ol";
      }
      listBuf.push(inline(ol[1]));
      continue;
    }

    const img = line.match(/^!\[(.*?)\]\((.*?)\)\s*$/);
    if (img) {
      flush();
      // 独立成行的图：img[2] 是原文（未 escape），直接走代理改写
      const src = optimizeImgSrc(img[2]) ?? escapeHtml(img[2]);
      out.push(`<img src="${src}" alt="${escapeHtml(img[1])}" loading="lazy" />`);
      continue;
    }

    closeList();
    paraBuf.push(inline(line));
  }

  if (inCode) out.push(`<pre><code>${escapeHtml(codeBuf.join("\n"))}</code></pre>`);
  flush();

  return out.join("\n");
}
