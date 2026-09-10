import type { APIRoute } from "astro";
import { getNews } from "../../lib/news";

export const GET: APIRoute = async ({ url }) => {
  try {
    // ?fresh=1 穿透服务端 10 分钟内存缓存（资讯面板「刷新」按钮用）
    const force = url.searchParams.get("fresh") === "1";
    const data = await getNews(force);
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
