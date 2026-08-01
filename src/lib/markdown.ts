export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inline(md: string): string {
  const codes: string[] = [];
  let s = escapeHtml(md).replace(/`([^`]+)`/g, (_, code: string) => {
    codes.push(code);
    return `\u0000${codes.length - 1}\u0000`;
  });

  s = s
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt: string, url: string) => `<img src="${url}" alt="${alt}" loading="lazy" />`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  return s.replace(/\u0000(\d+)\u0000/g, (_, i: string) => `<code>${codes[Number(i)]}</code>`);
}

export function renderMarkdown(src: string): string {
  const lines = src.split("\n");
  const out: string[] = [];
  let inCode = false;
  let codeBuf: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let listBuf: string[] = [];
  let paraBuf: string[] = [];

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
        out.push(`<pre><code>${escapeHtml(codeBuf.join("\n"))}</code></pre>`);
        codeBuf = [];
      } else {
        codeBuf.push(line);
      }
      continue;
    }

    if (line.startsWith("```")) {
      flush();
      inCode = true;
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
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
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
      out.push(`<img src="${escapeHtml(img[2])}" alt="${escapeHtml(img[1])}" loading="lazy" />`);
      continue;
    }

    closeList();
    paraBuf.push(inline(line));
  }

  if (inCode) out.push(`<pre><code>${escapeHtml(codeBuf.join("\n"))}</code></pre>`);
  flush();

  return out.join("\n");
}
