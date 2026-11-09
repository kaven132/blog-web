import type { AstroCookies } from "astro";

/** 爬虫/命令行/监控类 UA：这些访问不算浏览量（空/超短 UA 同样视为非人类） */
const BOT_UA =
  /bot|crawl|spider|slurp|curl|wget|python|scrapy|headless|lighthouse|uptime|monitor|fetcher|axios|okhttp|go-http/i;

/**
 * 详情页浏览计数防刷：
 * - UA 黑名单（含空/超短 UA）不计；
 * - 正常浏览器对同一内容 30 分钟内只计一次（cookie 标记，SSR 页直接 Set-Cookie）。
 * 防呆不防狼：认真伪造的流量交给自托管统计核对，这里保证站内热度数据不被脚本一键灌爆。
 */
export function shouldCountView(
  cookies: AstroCookies,
  request: Request,
  kind: "post" | "gallery" | "video",
  id: string | number,
): boolean {
  const ua = (request.headers.get("user-agent") || "").trim();
  if (ua.length < 10 || BOT_UA.test(ua)) return false;

  const key = `vv_${kind}_${id}`;
  if (cookies.get(key)?.value === "1") return false;
  cookies.set(key, "1", { path: "/", maxAge: 1800, httpOnly: true, sameSite: "lax" });
  return true;
}
