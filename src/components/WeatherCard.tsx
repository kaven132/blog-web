export interface WeatherProp {
  city: string;
  temp: number;
  max: number;
  min: number;
  code: number;
}

/** WMO 天气码 → 中文与图标（照片级 emoji 与站内资讯/占位风格一致） */
const WMO: Array<[max: number, label: string, icon: string]> = [
  [0, "晴", "☀️"],
  [1, "大致晴朗", "🌤️"],
  [2, "局部多云", "⛅"],
  [3, "阴", "☁️"],
  [45, "雾", "🌫️"],
  [48, "雾凇", "🌫️"],
  [51, "毛毛雨", "🌦️"],
  [61, "小雨", "🌧️"],
  [63, "中雨", "🌧️"],
  [65, "大雨", "🌧️"],
  [66, "冻雨", "🌧️"],
  [71, "小雪", "🌨️"],
  [73, "中雪", "❄️"],
  [75, "大雪", "❄️"],
  [77, "雪粒", "🌨️"],
  [80, "阵雨", "🌦️"],
  [81, "阵雨", "🌧️"],
  [82, "强阵雨", "⛈️"],
  [85, "阵雪", "🌨️"],
  [86, "阵雪", "❄️"],
  [95, "雷暴", "⛈️"],
  [96, "雷暴伴冰雹", "⛈️"],
  [99, "强雷暴", "⛈️"],
];

export function weatherLabel(code: number): { label: string; icon: string } {
  for (const [max, label, icon] of WMO) if (code <= max) return { label, icon };
  return { label: "—", icon: "🌡️" };
}

export default function WeatherCard({ weather }: { weather: WeatherProp }) {
  const { label, icon } = weatherLabel(weather.code);
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4">
      <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[var(--color-text-subtle)] mb-2">
        Weather · {weather.city}
      </p>
      <div className="flex items-center justify-between">
        <p className="text-3xl font-bold tracking-[-0.02em] text-[var(--color-text)] tabular-nums">
          {weather.temp}<span className="text-lg align-top">°C</span>
        </p>
        <div className="text-right">
          <p className="text-sm text-[var(--color-text-muted)] leading-snug">{icon} {label}</p>
          <p className="text-[11px] text-[var(--color-text-subtle)] tabular-nums mt-0.5">
            {weather.min}°~ {weather.max}°
          </p>
        </div>
      </div>
    </div>
  );
}
