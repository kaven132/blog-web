import type { APIRoute } from "astro";
import { getNews } from "../../lib/news";

export const GET: APIRoute = async () => {
  try {
    const data = await getNews();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "获取资讯失败" }), {
      status: 502,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
};
