"use client";

import { useState } from "react";
import styles from "@/app/weather.module.css";
import type { HourForecast } from "@/app/lib/types";
import { CATEGORY_EMOJI } from "@/app/lib/ui";

type MetricKey = "temp" | "humidity" | "pop";

const METRICS: { key: MetricKey; label: string; color: string; unit: string; fixedDomain?: [number, number] }[] = [
  { key: "temp", label: "気温", color: "#e2622a", unit: "°C" },
  { key: "humidity", label: "湿度", color: "#2f6fed", unit: "%", fixedDomain: [0, 100] },
  { key: "pop", label: "降水確率", color: "#6c4fd6", unit: "%", fixedDomain: [0, 100] },
];

const CHART_WIDTH = 300;
const CHART_HEIGHT = 116;
const PAD_LEFT = 28;
const PAD_RIGHT = 8;
const PAD_TOP = 16;
const PAD_BOTTOM = 18;

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

function MetricChart({
  primaryHours,
  secondaryByKey,
  metricKey,
  color,
  fixedDomain,
  dayBoundaryIndex,
  activeIndex,
  onActive,
}: {
  primaryHours: HourForecast[];
  secondaryByKey: Map<string, HourForecast> | null;
  metricKey: MetricKey;
  color: string;
  fixedDomain?: [number, number];
  dayBoundaryIndex: number;
  activeIndex: number | null;
  onActive: (index: number | null) => void;
}) {
  const n = primaryHours.length;
  if (n === 0) return null;

  const primaryValues = primaryHours.map((h) => h[metricKey]);
  const secondaryValues: (number | null)[] = primaryHours.map((h) => {
    const match = secondaryByKey?.get(hourKey(h));
    return match ? match[metricKey] : null;
  });

  const allValues = [...primaryValues, ...secondaryValues.filter((v): v is number => v !== null)];
  const [rawMin, rawMax] = fixedDomain ?? [Math.min(...allValues), Math.max(...allValues)];
  const span = rawMax - rawMin || 1;
  const min = fixedDomain ? rawMin : rawMin - span * 0.15;
  const max = fixedDomain ? rawMax : rawMax + span * 0.15;
  const range = max - min || 1;

  const xFor = (i: number) =>
    n === 1 ? CHART_WIDTH / 2 : PAD_LEFT + (i * (CHART_WIDTH - PAD_LEFT - PAD_RIGHT)) / (n - 1);
  const yFor = (v: number) => CHART_HEIGHT - PAD_BOTTOM - ((v - min) / range) * (CHART_HEIGHT - PAD_TOP - PAD_BOTTOM);

  const primaryCoords = primaryValues.map((v, i) => ({ x: xFor(i), y: yFor(v) }));
  const primaryPath = buildSmoothPath(primaryCoords);

  const secondaryCoords: ({ x: number; y: number } | null)[] = secondaryValues.map((v, i) =>
    v === null ? null : { x: xFor(i), y: yFor(v) }
  );
  const secondarySegments = buildSegments(secondaryCoords);

  const midValue = fixedDomain ? (fixedDomain[0] + fixedDomain[1]) / 2 : (rawMin + rawMax) / 2;
  const yTicks = Array.from(new Set([rawMin, midValue, rawMax].map((v) => Math.round(v))));

  const stride = labelStride(n);

  function handlePointer(clientX: number, rect: DOMRect) {
    const relX = ((clientX - rect.left) / rect.width) * CHART_WIDTH;
    let nearest = 0;
    let bestDiff = Infinity;
    primaryCoords.forEach((c, i) => {
      const diff = Math.abs(c.x - relX);
      if (diff < bestDiff) {
        bestDiff = diff;
        nearest = i;
      }
    });
    onActive(nearest);
  }

  return (
    <svg
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      className={styles.chartSvg}
      role="img"
      aria-label={`${metricKey}の時間ごとの推移`}
      onMouseMove={(e) => handlePointer(e.clientX, e.currentTarget.getBoundingClientRect())}
      onMouseLeave={() => onActive(null)}
      onClick={(e) => handlePointer(e.clientX, e.currentTarget.getBoundingClientRect())}
    >
      {/* Y軸の目盛り線とラベル */}
      {yTicks.map((tick) => {
        const y = yFor(tick);
        return (
          <g key={tick}>
            <line
              x1={PAD_LEFT}
              y1={y}
              x2={CHART_WIDTH - PAD_RIGHT}
              y2={y}
              stroke="currentColor"
              strokeOpacity={0.15}
              strokeWidth={1}
            />
            <text x={PAD_LEFT - 4} y={y} textAnchor="end" dominantBaseline="middle" fontSize={8.5} fill="currentColor" fillOpacity={0.7}>
              {tick}
            </text>
          </g>
        );
      })}

      {/* X軸・Y軸の軸線 */}
      <line x1={PAD_LEFT} y1={PAD_TOP - 4} x2={PAD_LEFT} y2={CHART_HEIGHT - PAD_BOTTOM} stroke="currentColor" strokeOpacity={0.35} strokeWidth={1} />
      <line x1={PAD_LEFT} y1={CHART_HEIGHT - PAD_BOTTOM} x2={CHART_WIDTH - PAD_RIGHT} y2={CHART_HEIGHT - PAD_BOTTOM} stroke="currentColor" strokeOpacity={0.35} strokeWidth={1} />

      {/* 日付が変わる位置の目印 */}
      {dayBoundaryIndex >= 0 && primaryCoords[dayBoundaryIndex] && (
        <>
          <line
            x1={primaryCoords[dayBoundaryIndex].x}
            y1={PAD_TOP - 4}
            x2={primaryCoords[dayBoundaryIndex].x}
            y2={CHART_HEIGHT - PAD_BOTTOM}
            stroke="currentColor"
            strokeOpacity={0.4}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <text x={primaryCoords[dayBoundaryIndex].x} y={PAD_TOP - 6} textAnchor="middle" fontSize={8.5} fill="currentColor" fillOpacity={0.75}>
            {formatShortDate(primaryHours[dayBoundaryIndex].date)}〜
          </text>
        </>
      )}

      {activeIndex !== null && primaryCoords[activeIndex] && (
        <line
          x1={primaryCoords[activeIndex].x}
          y1={PAD_TOP - 4}
          x2={primaryCoords[activeIndex].x}
          y2={CHART_HEIGHT - PAD_BOTTOM}
          stroke={color}
          strokeOpacity={0.3}
          strokeWidth={1.5}
        />
      )}

      {/* 目的地(2本目)の線: 破線 + やや薄めで、府中市の実線と区別する */}
      {secondaryByKey &&
        secondarySegments.map((seg, i) => (
          <path
            key={i}
            d={buildSmoothPath(seg)}
            fill="none"
            stroke={color}
            strokeOpacity={0.65}
            strokeWidth={2}
            strokeDasharray="5 4"
            strokeLinecap="round"
          />
        ))}
      {secondaryByKey &&
        secondaryCoords.map((c, i) => {
          if (!c) return null;
          if (i !== activeIndex && i % stride !== 0 && i !== n - 1 && i !== dayBoundaryIndex) return null;
          const size = i === activeIndex ? 4.5 : 3;
          return (
            <rect
              key={i}
              x={c.x - size}
              y={c.y - size}
              width={size * 2}
              height={size * 2}
              fill="#ffffff"
              fillOpacity={0.9}
              stroke={color}
              strokeWidth={2}
            />
          );
        })}

      {/* 府中市(1本目)の線: 実線 */}
      <path d={primaryPath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {primaryCoords.map((c, i) => {
        if (i !== activeIndex && i % stride !== 0 && i !== n - 1 && i !== dayBoundaryIndex) return null;
        return (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={i === activeIndex ? 5 : 3}
            fill={i === activeIndex ? color : "#ffffff"}
            stroke={color}
            strokeWidth={2}
          />
        );
      })}
    </svg>
  );
}

export default function HourlyForecast({
  primary,
  secondary,
}: {
  primary: LocationSeries;
  secondary?: LocationSeries | null;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (primary.hours.length === 0) {
    return (
      <div className={styles.hourlyBlock}>
        <div className={styles.locationLabel}>時間ごとの予報</div>
        <div className={styles.message}>この日の時間ごとのデータがありません。</div>
      </div>
    );
  }

  const secondaryByKey = secondary ? new Map(secondary.hours.map((h) => [hourKey(h), h])) : null;
  const active = activeIndex !== null ? primary.hours[activeIndex] : null;
  const activeSecondary = active && secondaryByKey ? secondaryByKey.get(hourKey(active)) ?? null : null;
  const dayBoundaryIndex = findDayBoundaryIndex(primary.hours);
  const stride = labelStride(primary.hours.length);

  return (
    <div className={styles.hourlyBlock}>
      <div className={styles.hourlyHeaderRow}>
        <div className={styles.locationLabel}>時間ごとの天気予報</div>
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

      {METRICS.map((m) => (
        <div key={m.key} className={styles.chartBlock}>
          <div className={styles.chartTitle}>
            <i className={styles.hourlyDot} style={{ background: m.color }} />
            {m.label}
          </div>
          <MetricChart
            primaryHours={primary.hours}
            secondaryByKey={secondaryByKey}
            metricKey={m.key}
            color={m.color}
            fixedDomain={m.fixedDomain}
            dayBoundaryIndex={dayBoundaryIndex}
            activeIndex={activeIndex}
            onActive={setActiveIndex}
          />
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
        </div>
      ))}
    </div>
  );
}
