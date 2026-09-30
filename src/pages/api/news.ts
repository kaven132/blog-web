import type { APIRoute } from "astro";
import { getNews, NEWS_TABS } from "../../lib/news";

/**
 * fresh=1（穿透服务端 10 分钟缓存）按 IP 限流：每分钟最多 6 次。
 * 超限后不报错，静默降级为读缓存 —— 避免「刷新」按钮被刷爆后反复去打上游 RSS。
 */
const FORCE_WINDOW_MS = 60_000;
const FORCE_MAX_PER_WINDOW = 6;
const forceHits = new Map<string, number[]>();

function pruneForceHits(now: number) {
  if (forceHits.size < 500) return;
  for (const [ip, ts] of forceHits) {
    const alive = ts.filter((t) => now - t < FORCE_WINDOW_MS);
    if (alive.length === 0) forceHits.delete(ip);
    else forceHits.set(ip, alive);
  }
}

export const GET: APIRoute = async ({ url, clientAddress }) => {
  try {
    const ip = clientAddress || "unknown";
    const now = Date.now();
    let force = url.searchParams.get("fresh") === "1";

    if (force) {
      const hits = (forceHits.get(ip) ?? []).filter((t) => now - t < FORCE_WINDOW_MS);
      if (hits.length >= FORCE_MAX_PER_WINDOW) {
        force = false; // 超限：静默降级，返回缓存内容
      } else {
        hits.push(now);
        forceHits.set(ip, hits);
        pruneForceHits(now);
      }
    }

    // ?sources=a,b 只取指定来源（资讯面板切换「来源」用），不传则取各分类默认来源
    const ids = (url.searchParams.get("sources") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const data = await getNews(force, ids.length ? ids : undefined);

    // 传了来源却一个都没匹配上，说明 id 写错了，直接 400 而不是返回空数组
    if (ids.length > 0 && data.length === 0) {
      return new Response(JSON.stringify({ error: "未知来源" }), {
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    // 响应带上 tabs：栏目结构以服务端为唯一事实来源，前端不再硬编码
    return new Response(JSON.stringify({ tabs: NEWS_TABS, categories: data }), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: "获取资讯失败" }), {
      status: 502,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
};
