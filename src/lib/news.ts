export interface NewsItem {
  title: string;
  summary: string;
  link: string;
  date: string;
}

export interface NewsCategory {
  id: string;
  name: string;
  source: string;
  items: NewsItem[];
}

const PER_CATEGORY = 5;
const CACHE_TTL = 10 * 60 * 1000;

const SOURCES: { id: string; name: string; source: string; url: string }[] = [
  { id: "international", name: "国际", source: "俄罗斯卫星通讯社", url: "https://sputniknews.cn/export/rss2/archive/index.xml" },
  { id: "tech", name: "科技", source: "IT之家", url: "https://www.ithome.com/rss/" },
  { id: "games", name: "游戏", source: "机核", url: "https://www.gcores.com/rss/" },
];

interface CacheEntry {
  items: NewsItem[];
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");
}

function stripHtml(s: string): string {
  return decodeEntities(s)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTag(xml: string, tag: string): string | null {
  const start = xml.indexOf(`<${tag}>`);
  if (start === -1) return null;
  const end = xml.indexOf(`</${tag}>`, start);
  if (end === -1) return null;
  return xml
    .slice(start + tag.length + 2, end)
    .trim()
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, "$1")
    .trim();
}

function parseRss(xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(xml)) !== null) {
    const raw = match[1];
    const title = extractTag(raw, "title");
    if (!title) continue;
    const description = extractTag(raw, "description");
    const link = extractTag(raw, "link");
    const date = extractTag(raw, "pubDate");

    items.push({
      title: stripHtml(title),
      summary: description ? stripHtml(description) : "",
      link: link ? stripHtml(link) : "",
      date: date ?? "",
    });
  }

  return items;
}

async function fetchCategory(source: (typeof SOURCES)[number]): Promise<NewsCategory> {
  const cached = cache.get(source.id);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return { id: source.id, name: source.name, source: source.source, items: cached.items };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(source.url, {
      signal: controller.signal,
      headers: { "user-agent": "Mozilla/5.0 (compatible; BlogRSS/1.0)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const items = parseRss(xml).slice(0, PER_CATEGORY);
    cache.set(source.id, { items, fetchedAt: Date.now() });
    return { id: source.id, name: source.name, source: source.source, items };
  } finally {
    clearTimeout(timer);
  }
}

export async function getNews(): Promise<NewsCategory[]> {
  const results = await Promise.allSettled(SOURCES.map(fetchCategory));
  return SOURCES.map((source, i) => {
    const r = results[i];
    return r.status === "fulfilled"
      ? r.value
      : { id: source.id, name: source.name, source: source.source, items: [] };
  });
}
