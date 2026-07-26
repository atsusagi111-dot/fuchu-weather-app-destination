"use client";

import { useMemo, useState } from "react";
import styles from "@/app/weather.module.css";
import type { HourForecast } from "@/app/lib/types";
import { CATEGORY_EMOJI } from "@/app/lib/ui";

type MetricKey = "temp" | "humidity" | "pop";

const METRICS: { key: MetricKey; label: string; color: string; unit: string }[] = [
  { key: "temp", label: "気温", color: "#e2622a", unit: "°C" },
  { key: "humidity", label: "湿度", color: "#2f6fed", unit: "%" },
  { key: "pop", label: "降水確率", color: "#6c4fd6", unit: "%" },
];

const CHART_WIDTH = 300;
const CHART_HEIGHT = 170;
const PAD_LEFT = 22;
const PAD_RIGHT = 8;
const PAD_TOP = 18;
const PAD_BOTTOM = 20;

export type LocationSeries = {
  label: string;
  hours: HourForecast[];
};

function formatShortDate(dateKey: string): string {
  const [, month, day] = dateKey.split("-");
  return `${parseInt(month, 10)}/${parseInt(day, 10)}`;
}

function hourKey(h: HourForecast): string {
  return `${h.date} ${h.time}`;
}

// 表示するデータ点が多いとき(2日分をつなげた場合など)に、横軸ラベルが
// 詰まって読めなくならないよう、間引いて表示する本数を決める。
function labelStride(n: number): number {
  if (n <= 8) return 1;
  if (n <= 12) return 2;
  return 3;
}

function findDayBoundaryIndex(hours: HourForecast[]): number {
  for (let i = 1; i < hours.length; i++) {
    if (hours[i].date !== hours[i - 1].date) return i;
  }
  return -1;
}

function buildSmoothPath(coords: { x: number; y: number }[]): string {
  if (coords.length === 0) return "";
  if (coords.length === 1) return `M ${coords[0].x} ${coords[0].y}`;

  let d = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i];
    const p1 = coords[i + 1];
    const midX = (p0.x + p1.x) / 2;
    const midY = (p0.y + p1.y) / 2;
    d += ` Q ${p0.x} ${p0.y} ${midX} ${midY}`;
  }
  const last = coords[coords.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

// null (対応データなし)で分断された点列を、連続する区間ごとに分けてパスを作る。
function buildSegments(coords: ({ x: number; y: number } | null)[]): { x: number; y: number }[][] {
  const segments: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];
  for (const c of coords) {
    if (c) {
      current.push(c);
    } else if (current.length) {
      segments.push(current);
      current = [];
    }
  }
  if (current.length) segments.push(current);
  return segments;
}

export default function HourlyForecast({
  primary,
  secondary,
}: {
  primary: LocationSeries;
  secondary?: LocationSeries | null;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const secondaryByKey = useMemo(
    () => (secondary ? new Map(secondary.hours.map((h) => [hourKey(h), h])) : null),
    [secondary]
  );

  if (primary.hours.length === 0) {
    return (
      <div className={styles.hourlyBlock}>
        <div className={styles.locationLabel}>時間ごとの予報</div>
        <div className={styles.message}>この日の時間ごとのデータがありません。</div>
      </div>
    );
  }

  const n = primary.hours.length;
  const dayBoundaryIndex = findDayBoundaryIndex(primary.hours);
  const stride = labelStride(n);

  // 気温は℃、湿度・降水確率は%と単位が異なるため、1つのグラフに重ねるにあたって
  // 気温だけ「この期間の中での相対位置」に正規化してスケールを揃える。
  // 実際の数値はツールチップ・アイコン行で必ず確認できるようにする。
  const tempValues = [
    ...primary.hours.map((h) => h.temp),
    ...(secondary?.hours.map((h) => h.temp) ?? []),
  ];
  const tempRawMin = Math.min(...tempValues);
  const tempRawMax = Math.max(...tempValues);
  const tempSpan = tempRawMax - tempRawMin || 1;
  const tempMin = tempRawMin - tempSpan * 0.1;
  const tempMax = tempRawMax + tempSpan * 0.1;

  function normalize(key: MetricKey, value: number): number {
    if (key === "temp") {
      return ((value - tempMin) / (tempMax - tempMin || 1)) * 100;
    }
    return value; // 湿度・降水確率はもともと 0-100
  }

  const xFor = (i: number) =>
    n === 1 ? CHART_WIDTH / 2 : PAD_LEFT + (i * (CHART_WIDTH - PAD_LEFT - PAD_RIGHT)) / (n - 1);
  const yFor = (normValue: number) =>
    CHART_HEIGHT - PAD_BOTTOM - (normValue / 100) * (CHART_HEIGHT - PAD_TOP - PAD_BOTTOM);

  function handlePointer(clientX: number, rect: DOMRect) {
    const relX = ((clientX - rect.left) / rect.width) * CHART_WIDTH;
    let nearest = 0;
    let bestDiff = Infinity;
    for (let i = 0; i < n; i++) {
      const diff = Math.abs(xFor(i) - relX);
      if (diff < bestDiff) {
        bestDiff = diff;
        nearest = i;
      }
    }
    setActiveIndex(nearest);
  }

  const active = activeIndex !== null ? primary.hours[activeIndex] : null;
  const activeSecondary = active && secondaryByKey ? secondaryByKey.get(hourKey(active)) ?? null : null;

  return (
    <div className={styles.hourlyBlock}>
      <div className={styles.hourlyHeaderRow}>
        <div className={styles.locationLabel}>時間ごとの天気予報</div>
      </div>

      <div className={styles.hourlyLegendGroup}>
        <div className={styles.hourlyLegend}>
          {METRICS.map((m) => (
            <span key={m.key} className={styles.legendItem}>
              <i className={styles.hourlyDot} style={{ background: m.color }} />
              {m.label}
            </span>
          ))}
        </div>
        {secondary && (
          <div className={styles.hourlyLegend}>
            <span className={styles.legendItem}>
              <span className={styles.legendLineSolid} /> {primary.label}
            </span>
            <span className={styles.legendItem}>
              <span className={styles.legendLineDashed} /> {secondary.label}
            </span>
          </div>
        )}
      </div>

      <div className={styles.hourlyIconRow}>
        {primary.hours.map((h, i) => {
          const match = secondaryByKey?.get(hourKey(h));
          return (
            <div key={hourKey(h)} className={styles.hourlyIconWrap}>
              {i === dayBoundaryIndex && <span className={styles.hourlyDateBadge}>{formatShortDate(h.date)}</span>}
              <button
                type="button"
                className={`${styles.hourlyIconItem} ${i === activeIndex ? styles.hourlyIconItemActive : ""}`}
                onMouseEnter={() => setActiveIndex(i)}
                onFocus={() => setActiveIndex(i)}
                onClick={() => setActiveIndex(i)}
              >
                <span className={styles.hourlyIconTime}>{h.hourLabel}</span>
                <span role="img" aria-label={h.categoryLabel} className={styles.hourlyIconEmoji}>
                  {CATEGORY_EMOJI[h.category]}
                </span>
                {match && (
                  <span role="img" aria-label={match.categoryLabel} className={styles.hourlyIconEmojiSecondary}>
                    {CATEGORY_EMOJI[match.category]}
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div className={styles.hourlyTooltip}>
        {active ? (
          <div className={styles.hourlyTooltipStack}>
            <strong>
              {formatShortDate(active.date)} {active.time}
            </strong>
            <span className={styles.hourlyTooltipRow}>
              <span className={styles.hourlyTooltipLocation}>{primary.label}</span>
              気温 {active.temp}°C／湿度 {active.humidity}%／降水確率 {active.pop}%（{active.categoryLabel}）
            </span>
            {secondary && (
              <span className={styles.hourlyTooltipRow}>
                <span className={styles.hourlyTooltipLocation}>{secondary.label}</span>
                {activeSecondary
                  ? `気温 ${activeSecondary.temp}°C／湿度 ${activeSecondary.humidity}%／降水確率 ${activeSecondary.pop}%（${activeSecondary.categoryLabel}）`
                  : "この時間のデータがありません"}
              </span>
            )}
          </div>
        ) : (
          "グラフやアイコンにカーソルを合わせる（またはタップする）と、その時間の詳細が表示されます"
        )}
      </div>

      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className={styles.chartSvg}
        role="img"
        aria-label="気温・湿度・降水確率の時間ごとの推移"
        onMouseMove={(e) => handlePointer(e.clientX, e.currentTarget.getBoundingClientRect())}
        onMouseLeave={() => setActiveIndex(null)}
        onClick={(e) => handlePointer(e.clientX, e.currentTarget.getBoundingClientRect())}
      >
        {/* 目安となる横のグリッド線 (0/50/100 の相対位置) */}
        {[0, 50, 100].map((tick) => {
          const y = yFor(tick);
          return (
            <line
              key={tick}
              x1={PAD_LEFT}
              y1={y}
              x2={CHART_WIDTH - PAD_RIGHT}
              y2={y}
              stroke="currentColor"
              strokeOpacity={0.15}
              strokeWidth={1}
            />
          );
        })}

        {/* X軸・Y軸の軸線 */}
        <line x1={PAD_LEFT} y1={PAD_TOP - 4} x2={PAD_LEFT} y2={CHART_HEIGHT - PAD_BOTTOM} stroke="currentColor" strokeOpacity={0.35} strokeWidth={1} />
        <line x1={PAD_LEFT} y1={CHART_HEIGHT - PAD_BOTTOM} x2={CHART_WIDTH - PAD_RIGHT} y2={CHART_HEIGHT - PAD_BOTTOM} stroke="currentColor" strokeOpacity={0.35} strokeWidth={1} />
        <text x={PAD_LEFT - 4} y={yFor(100)} textAnchor="end" dominantBaseline="middle" fontSize={7.5} fill="currentColor" fillOpacity={0.6}>高</text>
        <text x={PAD_LEFT - 4} y={yFor(0)} textAnchor="end" dominantBaseline="middle" fontSize={7.5} fill="currentColor" fillOpacity={0.6}>低</text>

        {/* 日付が変わる位置の目印 */}
        {dayBoundaryIndex >= 0 && (
          <>
            <line
              x1={xFor(dayBoundaryIndex)}
              y1={PAD_TOP - 4}
              x2={xFor(dayBoundaryIndex)}
              y2={CHART_HEIGHT - PAD_BOTTOM}
              stroke="currentColor"
              strokeOpacity={0.4}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <text x={xFor(dayBoundaryIndex)} y={PAD_TOP - 6} textAnchor="middle" fontSize={8.5} fill="currentColor" fillOpacity={0.75}>
              {formatShortDate(primary.hours[dayBoundaryIndex].date)}〜
            </text>
          </>
        )}

        {activeIndex !== null && (
          <line
            x1={xFor(activeIndex)}
            y1={PAD_TOP - 4}
            x2={xFor(activeIndex)}
            y2={CHART_HEIGHT - PAD_BOTTOM}
            stroke="currentColor"
            strokeOpacity={0.3}
            strokeWidth={1.5}
          />
        )}

        {METRICS.map((m) => {
          const primaryCoords = primary.hours.map((h, i) => ({ x: xFor(i), y: yFor(normalize(m.key, h[m.key])) }));
          const primaryPath = buildSmoothPath(primaryCoords);

          const secondaryCoords: ({ x: number; y: number } | null)[] = primary.hours.map((h, i) => {
            const match = secondaryByKey?.get(hourKey(h));
            return match ? { x: xFor(i), y: yFor(normalize(m.key, match[m.key])) } : null;
          });
          const secondarySegments = secondaryByKey ? buildSegments(secondaryCoords) : [];

          return (
            <g key={m.key}>
              {secondarySegments.map((seg, i) => (
                <path
                  key={i}
                  d={buildSmoothPath(seg)}
                  fill="none"
                  stroke={m.color}
                  strokeOpacity={0.6}
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  strokeLinecap="round"
                />
              ))}
              {secondaryCoords.map((c, i) => {
                if (!c) return null;
                if (i !== activeIndex && i % stride !== 0 && i !== n - 1 && i !== dayBoundaryIndex) return null;
                const size = i === activeIndex ? 4 : 2.5;
                return (
                  <rect
                    key={i}
                    x={c.x - size}
                    y={c.y - size}
                    width={size * 2}
                    height={size * 2}
                    fill="#ffffff"
                    fillOpacity={0.9}
                    stroke={m.color}
                    strokeWidth={1.5}
                  />
                );
              })}

              <path d={primaryPath} fill="none" stroke={m.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              {primaryCoords.map((c, i) => {
                if (i !== activeIndex && i % stride !== 0 && i !== n - 1 && i !== dayBoundaryIndex) return null;
                return (
                  <circle
                    key={i}
                    cx={c.x}
                    cy={c.y}
                    r={i === activeIndex ? 4.5 : 2.5}
                    fill={i === activeIndex ? m.color : "#ffffff"}
                    stroke={m.color}
                    strokeWidth={1.5}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>

      <div className={styles.chartAxis}>
        {primary.hours.map((h, i) => (
          <span
            key={hourKey(h)}
            className={i === activeIndex ? styles.chartAxisActive : ""}
            style={
              i % stride !== 0 && i !== primary.hours.length - 1 && i !== dayBoundaryIndex
                ? { visibility: "hidden" }
                : undefined
            }
          >
            {i === dayBoundaryIndex ? `${formatShortDate(h.date)} ${h.hourLabel}` : h.hourLabel}
          </span>
        ))}
      </div>

      <p className={styles.hourlyAxisNote}>
        ※ 縦軸は期間内の相対的な高さの目安です（気温・湿度・降水確率の実際の数値は、カーソルを合わせると確認できます）
      </p>
    </div>
  );
}
