import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { geoNaturalEarth1, geoPath, geoGraticule10 } from "d3-geo";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import { feature, mesh } from "topojson-client";
import worldTopoRaw from "../data/world-110m.json";

/**
 * 旅行地图：文章按城市聚合到真实世界地图（d3-geo Natural Earth 投影）。
 * 数据由服务端按「标题『：』前缀 = 城市名，查 travel-cities 台账取坐标」聚合传入；
 * 地理数据来自 world-110m 拓扑（随仓库自托管，不依赖 CDN）。
 * 交互：点击图钉选中城市、悬浮放大、筛选行淡出未选分类、滚轮/按钮缩放、拖拽平移。
 * 缩放分级显示：k≥1.6 淡入国境线，k≥2.4 淡入国名（线宽不随缩放变粗）。
 */

const worldTopo = worldTopoRaw as any;

export interface TravelCity {
  name: string;
  type: "国内" | "国际";
  lng: number;
  lat: number;
  count: number;
  latest: { title: string; slug: string; date: string; dateISO: string };
}

const W = 1080;
const H = 480;

type TypeFilter = "全部" | "国内" | "国际";

export default function TravelMap({ cities }: { cities: TravelCity[] }) {
  const [filter, setFilter] = useState<TypeFilter>("全部");
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | undefined>(undefined);
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);

  // 投影与路径：按剔除南极洲后的国界范围适配画布
  const { projection, landPath, coastPath, bordersPath, graticulePath, nameLabels } = useMemo(() => {
    const projection = geoNaturalEarth1();
    const pathGen = geoPath(projection);
    const countriesFc = feature(worldTopo, worldTopo.objects.countries) as unknown as {
      features: Array<{ properties: { name?: string; id?: string }; type: "Feature" }>;
    };
    const visible = {
      type: "FeatureCollection" as const,
      features: countriesFc.features.filter((f) => f.properties.id !== "ATA"),
    };
    projection.fitExtent([[6, 6], [W - 6, H - 6]], visible as never);
    return {
      projection,
      landPath: pathGen(feature(worldTopo, worldTopo.objects.land)) ?? "",
      coastPath: pathGen(mesh(worldTopo, worldTopo.objects.countries, (a, b) => a === b)) ?? "",
      bordersPath: pathGen(mesh(worldTopo, worldTopo.objects.countries, (a, b) => a !== b)) ?? "",
      graticulePath: pathGen(geoGraticule10()) ?? "",
      nameLabels: countriesFc.features
        .map((f) => {
          const centroid = pathGen.centroid(f as never);
          const area = pathGen.area(f as never);
          return { name: f.properties.name ?? "", centroid, area };
        })
        .filter((l) => Number.isFinite(l.centroid[0]) && l.area > 140 && l.name),
    };
  }, []);

  // 缩放 / 平移：滚轮、捏合、双击、拖拽（d3-zoom）
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const zb = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 12])
      .on("zoom", (event) => setTransform(event.transform));
    zoomRef.current = zb;
    select(el).call(zb);
    return () => {
      select(el).on(".zoom", null);
    };
  }, []);

  const zoomBy = useCallback((factor: number) => {
    if (svgRef.current && zoomRef.current) select(svgRef.current).call(zoomRef.current.scaleBy, factor);
  }, []);

  const resetZoom = useCallback(() => {
    if (svgRef.current && zoomRef.current) select(svgRef.current).call(zoomRef.current.transform, zoomIdentity);
  }, []);

  const domestic = cities.filter((c) => c.type === "国内").length;
  const international = cities.length - domestic;
  const visible = cities.filter((c) => filter === "全部" || c.type === filter);
  const selected = visible.find((c) => c.name === selectedName) ?? visible[0] ?? null;

  const pin = (c: TravelCity) => {
    const pt = projection([c.lng, c.lat]);
    if (!pt) return null;
    const isSel = selected?.name === c.name;
    return (
      <g
        key={c.name}
        className="travel-pin group"
        transform={`translate(${pt[0]}, ${pt[1]}) scale(${1 / transform.k})`}
        onClick={() => setSelectedName(c.name)}
        role="button"
        aria-label={`${c.name}（${c.count} 篇）`}
        style={{ cursor: "pointer" }}
      >
        <circle className="ring" r="9" fill="none" stroke="var(--accent)" strokeWidth="1.2" opacity={isSel ? 0.9 : 0} />
        <circle
          className="dot transition-all duration-200"
          r={isSel ? 7 : 5}
          fill="var(--color-accent)"
          stroke="var(--color-surface)"
          strokeWidth="1.5"
        />
        <text
          className="lbl"
          x="9"
          y="4"
          fontSize="11"
          fontWeight={isSel ? "700" : "400"}
          fill="var(--color-text)"
          paintOrder="stroke"
          stroke="var(--color-surface)"
          strokeWidth="3"
          style={{ display: isSel ? "block" : undefined }}
        >
          {c.name}
        </text>
      </g>
    );
  };

  return (
    <div>
      {/* 统计 + 筛选 */}
      <div className="flex items-end justify-between gap-4 flex-wrap mb-3">
        <div className="flex gap-2">
          {(["全部", "国内", "国际"] as TypeFilter[]).map((f) => {
            const n = f === "全部" ? cities.length : cities.filter((c) => c.type === f).length;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-full border transition-all ${
                  filter === f
                    ? "bg-[var(--color-accent)] text-white border-[var(--color-accent)]"
                    : "bg-[var(--color-surface)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                }`}
              >
                {f} {n}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2.5">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-2 text-center">
            <b className="block text-lg font-bold tabular-nums text-[var(--color-text)]">{cities.length}</b>
            <span className="text-[11px] text-[var(--color-text-muted)]">座城市</span>
          </div>
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-2 text-center">
            <b className="block text-lg font-bold tabular-nums text-[var(--color-text)]">{domestic}</b>
            <span className="text-[11px] text-[var(--color-text-muted)]">国内</span>
          </div>
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-2 text-center">
            <b className="block text-lg font-bold tabular-nums text-[var(--color-text)]">{international}</b>
            <span className="text-[11px] text-[var(--color-text-muted)]">国际</span>
          </div>
        </div>
      </div>

      {/* 地图（viewport g 承载缩放变换；描边不随缩放变粗） */}
      <div className="relative rounded-2xl border border-[var(--color-border)] overflow-hidden bg-[var(--map-ocean)]">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="block w-full h-auto" role="img" aria-label="旅行城市地图">
          <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
            <path d={graticulePath} fill="none" stroke="var(--map-graticule)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
            <path d={landPath} fill="var(--map-land)" />
            <path d={coastPath} fill="none" stroke="var(--map-border)" strokeWidth="0.6" vectorEffect="non-scaling-stroke" opacity={0.8} />
            <path
              d={bordersPath}
              fill="none"
              stroke="var(--map-country-border, var(--map-border))"
              strokeWidth="0.5"
              vectorEffect="non-scaling-stroke"
              opacity={Math.min(1, Math.max(0, (transform.k - 1.6) / 0.6))}
            />
            {nameLabels.map(
              (l) =>
                transform.k >= 2.2 && (
                  <text
                    key={l.name}
                    x={l.centroid[0]}
                    y={l.centroid[1]}
                    textAnchor="middle"
                    fontSize={11 / transform.k}
                    fill="var(--color-text-muted)"
                    opacity={Math.min(1, Math.max(0, (transform.k - 2.2) / 0.8))}
                    style={{ pointerEvents: "none", textTransform: "uppercase", letterSpacing: "0.08em" }}
                  >
                    {l.name}
                  </text>
                )
            )}
            {visible.map((c) => {
              const pt = projection([c.lng, c.lat]);
              if (!pt) return null;
              const isSel = selected?.name === c.name;
              return (
                <g
                  key={c.name}
                  className="travel-pin"
                  transform={`translate(${pt[0]}, ${pt[1]}) scale(${1 / transform.k})`}
                  onClick={() => setSelectedName(c.name)}
                  role="button"
                  aria-label={`${c.name}（${c.count} 篇）`}
                  style={{ cursor: "pointer" }}
                >
                  <circle r={isSel ? 8 : 5.5} fill="var(--color-accent)" stroke="var(--color-surface)" strokeWidth="2" opacity={0.95} />
                  <text
                    x="9"
                    y="4"
                    fontSize="11"
                    fontWeight={isSel ? "700" : "400"}
                    fill="var(--color-text)"
                    paintOrder="stroke"
                    stroke="var(--color-surface)"
                    strokeWidth="3"
                  >
                    {c.name}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* 选中城市卡 */}
        {selected && (
          <div className="absolute top-4 right-4 w-64 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 shadow-lg">
            <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--color-accent)] text-white mb-1.5">
              {selected.type}
            </span>
            <h3 className="text-base font-bold text-[var(--color-text)]">{selected.name}</h3>
            <p className="text-xs text-[var(--color-text-muted)] leading-snug mt-1">{selected.latest.title}</p>
            <a
              href={`/posts/${encodeURIComponent(selected.latest.slug)}`}
              className="inline-block mt-2 text-xs font-medium text-[var(--color-accent)] hover:underline"
            >
              阅读全文 →
            </a>
          </div>
        )}

        {/* 缩放控制 */}
        <div className="absolute right-3 bottom-8 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => zoomBy(1.5)}
            aria-label="放大"
            className="w-8 h-8 flex items-center justify-center rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)] transition-all text-lg leading-none"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => zoomBy(1 / 1.5)}
            aria-label="缩小"
            className="w-8 h-8 flex items-center justify-center rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)] transition-all text-lg leading-none"
          >
            −
          </button>
          <button
            type="button"
            onClick={resetZoom}
            aria-label="重置缩放"
            className="w-8 h-8 flex items-center justify-center rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)] transition-all text-xs leading-none"
          >
            ⟲
          </button>
        </div>

        <p className="absolute left-3 bottom-2 text-[11px] text-[var(--color-text-subtle)]">
          点击图钉查看对应的城记 · 滚轮缩放 · 拖拽平移
        </p>
      </div>
    </div>
  );
}
