/**
 * 天气数据（Open-Meteo，免费无密钥）：城市 → 坐标台账查点，拉当前温度/天气码/当日高低温。
 * 内存缓存 30 分钟；上游失败回退上次缓存，全无则返回 null（调用方整卡隐藏）。
 */

export interface WeatherInfo {
  city: string;
  temp: number;
  max: number;
  min: number;
  /** WMO 天气码（0 晴 / 2 多云 / 61 雨 …），渲染端映射中文与图标 */
  code: number;
}

/** 城市 → 坐标台账（profile.city 精确匹配；未登记的城市不显示天气卡） */
const CITY_COORDS: Record<string, { lat: number; lon: number }> = {
  广州: { lat: 23.13, lon: 113.26 },
  上海: { lat: 31.23, lon: 121.47 },
  北京: { lat: 39.9, lon: 116.4 },
  深圳: { lat: 22.54, lon: 114.06 },
  杭州: { lat: 30.27, lon: 120.16 },
  成都: { lat: 30.57, lon: 104.07 },
  武汉: { lat: 30.59, lon: 114.31 },
  南京: { lat: 32.06, lon: 118.8 },
  西安: { lat: 34.34, lon: 108.94 },
  重庆: { lat: 29.56, lon: 106.55 },
  长沙: { lat: 28.23, lon: 112.94 },
  厦门: { lat: 24.48, lon: 118.09 },
  昆明: { lat: 25.04, lon: 102.71 },
  天津: { lat: 39.08, lon: 117.2 },
  苏州: { lat: 31.3, lon: 120.58 },
};

const CACHE_TTL = 30 * 60 * 1000;
const cache = new Map<string, { data: WeatherInfo; ts: number }>();

export function lookupCity(city: string): { lat: number; lon: number } | null {
  return CITY_COORDS[city?.trim()] ?? null;
}

export async function fetchWeather(city: string): Promise<WeatherInfo | null> {
  const coord = lookupCity(city);
  if (!coord) return null;

  const cached = cache.get(city);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 10_000);
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${coord.lat}&longitude=${coord.lon}` +
      `&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min` +
      `&forecast_days=1&timezone=Asia%2FShanghai`;
    const res = await fetch(url, { signal: ctl.signal, headers: { "user-agent": "BlogWeather/1.0" } });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = (await res.json()) as {
      current?: { temperature_2m?: number; weather_code?: number };
      daily?: { temperature_2m_max?: number[]; temperature_2m_min?: number[] };
    };
    const temp = j.current?.temperature_2m;
    if (typeof temp !== "number") throw new Error("empty payload");
    const data: WeatherInfo = {
      city,
      temp: Math.round(temp),
      max: Math.round(j.daily?.temperature_2m_max?.[0] ?? temp),
      min: Math.round(j.daily?.temperature_2m_min?.[0] ?? temp),
      code: j.current?.weather_code ?? 0,
    };
    cache.set(city, { data, ts: Date.now() });
    return data;
  } catch {
    // 上游失败回退上次缓存（过期也比没有强）；从未成功过则放弃
    return cached?.data ?? null;
  }
}
