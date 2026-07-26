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

function formatShortDate(dateKey: string): string {
  const [, month, day] = dateKey.split("-");
  return `${parseInt(month, 10)}/${parseInt(day, 10)}`;
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

function MetricChart({
  hours,
  metricKey,
  color,
  fixedDomain,
  dayBoundaryIndex,
  activeIndex,
  onActive,
}: {
  hours: HourForecast[];
  metricKey: MetricKey;
  color: string;
  fixedDomain?: [number, number];
  dayBoundaryIndex: number;
  activeIndex: number | null;
  onActive: (index: number | null) => void;
}) {
  const values = hours.map((h) => h[metricKey]);
  const n = values.length;
  if (n === 0) return null;

  const [rawMin, rawMax] = fixedDomain ?? [Math.min(...values), Math.max(...values)];
  const span = rawMax - rawMin || 1;
  // データ変化が小さい日でも線が潰れないよう、自動スケールの場合は少し余白を持たせる。
  const min = fixedDomain ? rawMin : rawMin - span * 0.15;
  const max = fixedDomain ? rawMax : rawMax + span * 0.15;
  const range = max - min || 1;

  const xFor = (i: number) =>
    n === 1 ? CHART_WIDTH / 2 : PAD_LEFT + (i * (CHART_WIDTH - PAD_LEFT - PAD_RIGHT)) / (n - 1);
  const yFor = (v: number) => CHART_HEIGHT - PAD_BOTTOM - ((v - min) / range) * (CHART_HEIGHT - PAD_TOP - PAD_BOTTOM);

  const coords = values.map((v, i) => ({ x: xFor(i), y: yFor(v) }));
  const path = buildSmoothPath(coords);

  const midValue = fixedDomain ? (fixedDomain[0] + fixedDomain[1]) / 2 : (rawMin + rawMax) / 2;
  const yTicks = Array.from(new Set([rawMin, midValue, rawMax].map((v) => Math.round(v))));

  const stride = labelStride(n);

  function handlePointer(clientX: number, rect: DOMRect) {
    const relX = ((clientX - rect.left) / rect.width) * CHART_WIDTH;
    let nearest = 0;
    let bestDiff = Infinity;
    coords.forEach((c, i) => {
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
      aria-label={`${hours[0]?.date ?? ""}以降の${metricKey}の推移`}
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
      <line
        x1={PAD_LEFT}
        y1={PAD_TOP - 4}
        x2={PAD_LEFT}
        y2={CHART_HEIGHT - PAD_BOTTOM}
        stroke="currentColor"
        strokeOpacity={0.35}
        strokeWidth={1}
      />
      <line
        x1={PAD_LEFT}
        y1={CHART_HEIGHT - PAD_BOTTOM}
        x2={CHART_WIDTH - PAD_RIGHT}
        y2={CHART_HEIGHT - PAD_BOTTOM}
        stroke="currentColor"
        strokeOpacity={0.35}
        strokeWidth={1}
      />

      {/* 日付が変わる位置の目印 */}
      {dayBoundaryIndex >= 0 && coords[dayBoundaryIndex] && (
        <>
          <line
            x1={coords[dayBoundaryIndex].x}
            y1={PAD_TOP - 4}
            x2={coords[dayBoundaryIndex].x}
            y2={CHART_HEIGHT - PAD_BOTTOM}
            stroke="currentColor"
            strokeOpacity={0.4}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <text
            x={coords[dayBoundaryIndex].x}
            y={PAD_TOP - 6}
            textAnchor="middle"
            fontSize={8.5}
            fill="currentColor"
            fillOpacity={0.75}
          >
            {formatShortDate(hours[dayBoundaryIndex].date)}〜
          </text>
        </>
      )}

      {activeIndex !== null && coords[activeIndex] && (
        <line
          x1={coords[activeIndex].x}
          y1={PAD_TOP - 4}
          x2={coords[activeIndex].x}
          y2={CHART_HEIGHT - PAD_BOTTOM}
          stroke={color}
          strokeOpacity={0.3}
          strokeWidth={1.5}
        />
      )}
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((c, i) => {
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

export default function HourlyForecast({ title, hours }: { title: string; hours: HourForecast[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (hours.length === 0) {
    return (
      <div className={styles.hourlyBlock}>
        <div className={styles.locationLabel}>{title}の時間ごとの予報</div>
        <div className={styles.message}>この日の時間ごとのデータがありません。</div>
      </div>
    );
  }

  const active = activeIndex !== null ? hours[activeIndex] : null;
  const dayBoundaryIndex = findDayBoundaryIndex(hours);
  const stride = labelStride(hours.length);

  return (
    <div className={styles.hourlyBlock}>
      <div className={styles.locationLabel}>{title}の時間ごとの予報</div>

      <div className={styles.hourlyIconRow}>
        {hours.map((h, i) => (
          <div key={h.date + h.time} className={styles.hourlyIconWrap}>
            {i === dayBoundaryIndex && (
              <span className={styles.hourlyDateBadge}>{formatShortDate(h.date)}</span>
            )}
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
            </button>
          </div>
        ))}
      </div>

      <div className={styles.hourlyTooltip}>
        {active ? (
          <>
            <strong>
              {formatShortDate(active.date)} {active.time}
            </strong>
            <span className={styles.hourlyTooltipItem}>
              <i className={styles.hourlyDot} style={{ background: METRICS[0].color }} />
              気温 {active.temp}°C
            </span>
            <span className={styles.hourlyTooltipItem}>
              <i className={styles.hourlyDot} style={{ background: METRICS[1].color }} />
              湿度 {active.humidity}%
            </span>
            <span className={styles.hourlyTooltipItem}>
              <i className={styles.hourlyDot} style={{ background: METRICS[2].color }} />
              降水確率 {active.pop}%
            </span>
            <span className={styles.hourlyTooltipItem}>{active.categoryLabel}</span>
          </>
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
            hours={hours}
            metricKey={m.key}
            color={m.color}
            fixedDomain={m.fixedDomain}
            dayBoundaryIndex={dayBoundaryIndex}
            activeIndex={activeIndex}
            onActive={setActiveIndex}
          />
          <div className={styles.chartAxis}>
            {hours.map((h, i) => (
              <span
                key={h.date + h.time}
                className={i === activeIndex ? styles.chartAxisActive : ""}
                style={
                  i % stride !== 0 && i !== hours.length - 1 && i !== dayBoundaryIndex
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
