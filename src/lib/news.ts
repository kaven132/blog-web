export interface NewsItem {
  title: string;
  summary: string;
  link: string;
  date: string;
}

/** 同一分类下可互相切换的来源，用于「来源」右侧的切换按钮 */
export interface NewsSibling {
  id: string;
  label: string;
}

export interface NewsCategory {
  id: string;
  /** 所属分类（tab）id，多个来源可共用同一个 group */
  group: string;
  name: string;
  source: string;
  items: NewsItem[];
  siblings: NewsSibling[];
}

const PER_CATEGORY = 5;
const CACHE_TTL = 10 * 60 * 1000;

interface NewsSource {
  id: string;
  group: string;
  name: string;
  source: string;
  url: string;
  /** 链接里含该子串的条目直接丢弃（机核 feed 混入 /radios/ 播客） */
  exclude?: string;
}

const SOURCES: NewsSource[] = [
  { id: "domestic", group: "domestic", name: "国内", source: "中国新闻网", url: "https://www.chinanews.com.cn/rss/scroll-news.xml" },
  { id: "world", group: "world", name: "国外", source: "中新网·国际", url: "https://www.chinanews.com.cn/rss/world.xml" },
  { id: "world-un", group: "world", name: "国外", source: "联合国新闻", url: "https://news.un.org/feed/subscribe/zh/news/all/rss.xml" },
  { id: "tech", group: "tech", name: "科技", source: "极客公园", url: "https://www.geekpark.net/rss" },
  { id: "tech-ithome", group: "tech", name: "科技", source: "IT 之家", url: "https://www.ithome.com/rss/" },
  { id: "games", group: "games", name: "游戏", source: "游戏茶馆", url: "https://www.youxichaguan.com/feed" },
  { id: "games-youyan", group: "games", name: "游戏", source: "游研社", url: "https://www.yystv.cn/rss/feed" },
  {
    id: "games-gcores",
    group: "games",
    name: "游戏",
    source: "机核",
    url: "https://www.gcores.com/rss",
    exclude: "/radios/",
  },
];

/** 每个分类的默认来源：SOURCES 里该 group 的第一条 */
const DEFAULT_IDS = [...new Set(SOURCES.map((s) => s.group))].map(
  (g) => SOURCES.find((s) => s.group === g)!.id
);

function siblingsOf(group: string): NewsSibling[] {
  return SOURCES.filter((s) => s.group === group).map((s) => ({ id: s.id, label: s.source }));
}

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

function buildCategory(source: NewsSource, items: NewsItem[]): NewsCategory {
  return {
    id: source.id,
    group: source.group,
    name: source.name,
    source: source.source,
    items,
    siblings: siblingsOf(source.group),
  };
}

async function fetchCategory(source: NewsSource, force = false): Promise<NewsCategory> {
  const cached = cache.get(source.id);
  if (!force && cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return buildCategory(source, cached.items);
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
    const items = parseRss(xml)
      .filter((it) => !(source.exclude && it.link.includes(source.exclude)))
      .slice(0, PER_CATEGORY);
    cache.set(source.id, { items, fetchedAt: Date.now() });
    return buildCategory(source, items);
  } catch (err) {
    // 强制刷新失败时退回上一次缓存，避免「刷新」把已有内容清空
    if (cached) return buildCategory(source, cached.items);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param force 穿透 10 分钟内存缓存（资讯面板「刷新」按钮用）
 * @param ids   只抓取指定来源；不传则抓每个分类的默认来源
 */
export async function getNews(force = false, ids?: string[]): Promise<NewsCategory[]> {
  const targets = ids?.length
    ? ids
        .map((id) => SOURCES.find((s) => s.id === id))
        .filter((s): s is NewsSource => Boolean(s))
    : DEFAULT_IDS.map((id) => SOURCES.find((s) => s.id === id)!);

  const results = await Promise.allSettled(targets.map((s) => fetchCategory(s, force)));
  return targets.map((source, i) => {
    const r = results[i];
    return r.status === "fulfilled" ? r.value : buildCategory(source, []);
  });
}
