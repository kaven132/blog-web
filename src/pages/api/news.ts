import type { APIRoute } from "astro";
import { getNews } from "../../lib/news";

export const GET: APIRoute = async ({ url }) => {
  try {
    // ?fresh=1 穿透服务端 10 分钟内存缓存（资讯面板「刷新」按钮用）
    const force = url.searchParams.get("fresh") === "1";
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

    return new Response(JSON.stringify(data), {
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
