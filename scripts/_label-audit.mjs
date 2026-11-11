// 一次性诊断：镜像 TravelMap.tsx 新版标签逻辑（剔除南极洲 + 最大环质心 + 手工锚点），反查落点经纬度
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { geoNaturalEarth1, geoPath } = require("d3-geo");
const { feature } = require("topojson-client");

const worldTopo = JSON.parse(readFileSync("src/data/world-110m.json", "utf8"));
const W = 1080, H = 480;

const LABEL_ANCHORS = {
  Malaysia: [102.0, 4.2],
};

function largestRingCentroid(pathGen, f) {
  const geom = f.geometry;
  if (geom.type === "Polygon") return pathGen.centroid(f);
  let best = [NaN, NaN];
  let bestArea = -1;
  for (const coords of geom.coordinates) {
    const poly = { type: "Feature", geometry: { type: "Polygon", coordinates: coords } };
    const area = pathGen.area(poly);
    if (area > bestArea) {
      bestArea = area;
      best = pathGen.centroid(poly);
    }
  }
  return best;
}

const projection = geoNaturalEarth1();
const pathGen = geoPath(projection);
const countriesFc = feature(worldTopo, worldTopo.objects.countries);
const visible = {
  type: "FeatureCollection",
  features: countriesFc.features.filter((f) => f.id !== "010"),
};
console.log("南极洲已剔除:", countriesFc.features.length - visible.features.length, "个 (应为 1)");
projection.fitExtent([[6, 6], [W - 6, H - 6]], visible);

const labels = visible.features
  .map((f) => {
    const name = f.properties.name ?? "";
    const anchor = LABEL_ANCHORS[name];
    const centroid = anchor ? projection(anchor) : largestRingCentroid(pathGen, f);
    const area = pathGen.area(f);
    return { name, centroid, area };
  })
  .filter((l) => Number.isFinite(l.centroid[0]) && l.area > 140 && l.name);

console.log("标签总数:", labels.length, "(修复前 86，含 ANTARCTICA)");
console.log("\n--- 多环国家（最大环质心 vs 旧整体质心落点）---");
const multiChecks = ["France", "United States of America", "Malaysia", "Indonesia", "Philippines", "New Zealand", "Japan", "Norway", "Denmark", "Netherlands", "Spain", "Italy", "Vietnam", "India", "China", "Canada", "Russia", "Australia", "Brazil", "Argentina", "Chile", "Thailand", "Myanmar"];
for (const name of multiChecks) {
  const l = labels.find((x) => x.name === name);
  if (!l) { console.log(`${name}: 无标签`); continue; }
  const inv = projection.invert(l.centroid);
  console.log(`${name}: 新落点 (${inv[0].toFixed(1)}, ${inv[1].toFixed(1)})${LABEL_ANCHORS[name] ? " [手工锚点]" : ""}`);
}

// 全量落点快速扫一遍，人工过目是否有明显落在海面/别国的
console.log("\n--- 全量标签落点 ---");
for (const l of labels) {
  const inv = projection.invert(l.centroid);
  console.log(`${l.name}: (${inv[0].toFixed(1)}, ${inv[1].toFixed(1)})`);
}
