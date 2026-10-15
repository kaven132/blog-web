/**
 * 旅行线城市坐标台账：城市名 → 分类与经纬度。
 * 数据在 src/data/travel-cities.json —— 自动化发文线发布新城市文后，
 * 在该 JSON 追加一行坐标即可自动上图（无需改代码）。
 */
import citiesJson from "../data/travel-cities.json";

export interface TravelCityCoord {
  type: "国内" | "国际";
  lng: number;
  lat: number;
}

export const TRAVEL_CITIES: Record<string, TravelCityCoord> = citiesJson as Record<
  string,
  TravelCityCoord
>;
