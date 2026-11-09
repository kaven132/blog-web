/**
 * 旅行线城市坐标台账：城市名 → 分类与经纬度。
 * 数据在 src/data/travel-cities.json —— 本地台账（gitignored，不进仓库）：
 * 自动化发文线发布新城市文后，在该 JSON 追加一行坐标即可自动上图（无需改代码）。
 * 文件缺失（fresh clone）时回落空台账：地图底图（world-110m.json 仍跟踪）正常渲染，只是没有城市点。
 */
import { readFileSync } from "node:fs";

export interface TravelCityCoord {
  type: "国内" | "国际";
  lng: number;
  lat: number;
}

export const TRAVEL_CITIES: Record<string, TravelCityCoord> = (() => {
  try {
    return JSON.parse(readFileSync("src/data/travel-cities.json", "utf8"));
  } catch {
    return {};
  }
})();
