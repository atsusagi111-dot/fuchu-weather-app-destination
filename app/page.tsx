"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./weather.module.css";
import type { DayForecast, WeatherApiResponse, WeatherCategory } from "@/app/lib/types";
import { CATEGORY_EMOJI, CATEGORY_RAINDROPS } from "@/app/lib/ui";
import HourlyForecast from "@/app/components/HourlyForecast";
import CyclingAdvice from "@/app/components/CyclingAdvice";

const CATEGORY_BG: Record<WeatherCategory, string> = {
  clear: "bgClear",
  cloudy: "bgCloudy",
  "light-rain": "bgLightRain",
  "heavy-rain": "bgHeavyRain",
  thunderstorm: "bgThunderstorm",
};

function backgroundClassFor(category: WeatherCategory): string {
  return styles[CATEGORY_BG[category]] ?? styles.bgDefault;
}

function formatDateLabel(day: DayForecast): string {
  const [, month, date] = day.date.split("-");
  return `${parseInt(month, 10)}月${parseInt(date, 10)}日（${day.weekday}）`;
}

export default function Home() {
  const [data, setData] = useState<WeatherApiResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [snapNotice, setSnapNotice] = useState<string | null>(null);

  const [destinationInput, setDestinationInput] = useState("");
  const [destinationData, setDestinationData] = useState<WeatherApiResponse | null>(null);
  const [destinationError, setDestinationError] = useState<string | null>(null);
  const [destinationLoading, setDestinationLoading] = useState(false);
  const [hasSearchedDestination, setHasSearchedDestination] = useState(false);

  const [departureTime, setDepartureTime] = useState("");
  const [returnTime, setReturnTime] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/weather");
        const json = await res.json();
        if (cancelled) return;

        if (!res.ok) {
          setErrorMsg(json.error ?? "天気情報の取得に失敗しました。");
          setLoading(false);
          return;
        }

        const payload = json as WeatherApiResponse;
        setData(payload);
        if (payload.days.length > 0) {
          setSelectedDate(payload.days[0].date);
        }
        setLoading(false);
      } catch {
        if (!cancelled) {
          setErrorMsg("天気情報の取得に失敗しました（通信エラー）。");
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedDay = useMemo(
    () => data?.days.find((d) => d.date === selectedDate) ?? null,
    [data, selectedDate]
  );

  // 目的地側も同じ選択日(カレンダー/日別ボタン)に追従させる。
  // 完全一致がなければ最も近い予報日にスナップし、府中市側の挙動と揃える。
  const destinationSelectedDay = useMemo(() => {
    if (!destinationData || destinationData.days.length === 0) return null;

    const exact = destinationData.days.find((d) => d.date === selectedDate);
    if (exact) return exact;
    if (!selectedDate) return destinationData.days[0];

    const targetMs = new Date(selectedDate).getTime();
    let nearest = destinationData.days[0];
    let bestDiff = Infinity;
    for (const day of destinationData.days) {
      const diff = Math.abs(new Date(day.date).getTime() - targetMs);
      if (diff < bestDiff) {
        bestDiff = diff;
        nearest = day;
      }
    }
    return nearest;
  }, [destinationData, selectedDate]);

  // 選択日だけだと（特に当日は残り時間が少なく）折れ線が短くなりすぎるため、
  // 翌日分のデータをつなげて2日分のトレンドを表示する。
  const fuchuHourlyWindow = useMemo(() => {
    if (!data || !selectedDay) return [];
    const idx = data.days.findIndex((d) => d.date === selectedDay.date);
    const nextDay = idx >= 0 ? data.days[idx + 1] : undefined;
    return [...selectedDay.hours, ...(nextDay?.hours ?? [])];
  }, [data, selectedDay]);

  const destinationHourlyWindow = useMemo(() => {
    if (!destinationData || !destinationSelectedDay) return [];
    const idx = destinationData.days.findIndex((d) => d.date === destinationSelectedDay.date);
    const nextDay = idx >= 0 ? destinationData.days[idx + 1] : undefined;
    return [...destinationSelectedDay.hours, ...(nextDay?.hours ?? [])];
  }, [destinationData, destinationSelectedDay]);

  // 自転車アドバイスは、目的地が検索されていればその地点、無ければ府中市を対象にする。
  const adviceLocationLabel = destinationData?.location ?? "府中市";
  const adviceHours = destinationData ? destinationHourlyWindow : fuchuHourlyWindow;
  const adviceTargetDate = destinationData ? destinationSelectedDay?.date ?? null : selectedDay?.date ?? null;

  const bgClass = selectedDay ? backgroundClassFor(selectedDay.category) : styles.bgDefault;
  const showRainOverlay =
    selectedDay?.category === "light-rain" ||
    selectedDay?.category === "heavy-rain" ||
    selectedDay?.category === "thunderstorm";
  const rainDensityClass =
    selectedDay?.category === "light-rain" ? styles.rainLight : styles.rainHeavy;

  function handleDateInputChange(value: string) {
    if (!data || data.days.length === 0) return;
    const exact = data.days.find((d) => d.date === value);
    if (exact) {
      setSnapNotice(null);
      setSelectedDate(value);
      return;
    }

    // Snap to the nearest available forecast day (free tier only covers ~5 days).
    const targetMs = new Date(value).getTime();
    let nearest = data.days[0];
    let bestDiff = Infinity;
    for (const day of data.days) {
      const diff = Math.abs(new Date(day.date).getTime() - targetMs);
      if (diff < bestDiff) {
        bestDiff = diff;
        nearest = day;
      }
    }
    setSelectedDate(nearest.date);
    setSnapNotice(
      `${value} の予報はまだ提供されていないため、直近の予報日（${formatDateLabel(nearest)}）を表示しています。`
    );
  }

  async function handleDestinationSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = destinationInput.trim();

    if (!q) {
      setHasSearchedDestination(false);
      setDestinationData(null);
      setDestinationError(null);
      return;
    }

    setHasSearchedDestination(true);
    setDestinationLoading(true);
    setDestinationError(null);

    try {
      const res = await fetch(`/api/destination-weather?q=${encodeURIComponent(q)}`);
      const json = await res.json();

      if (!res.ok) {
        setDestinationData(null);
        setDestinationError(
          json.error ?? "目的地の天気情報を取得できませんでした。都道府県名や市区町村名を確認してください。"
        );
        setDestinationLoading(false);
        return;
      }

      setDestinationData(json as WeatherApiResponse);
      setDestinationLoading(false);
    } catch {
      setDestinationData(null);
      setDestinationError("目的地の天気情報を取得できませんでした。都道府県名や市区町村名を確認してください。");
      setDestinationLoading(false);
    }
  }

  function handleDestinationClear() {
    setDestinationInput("");
    setDestinationData(null);
    setDestinationError(null);
    setHasSearchedDestination(false);
  }

  return (
    <main className={`${styles.page} ${bgClass}`}>
      {showRainOverlay && <div className={`${styles.rainOverlay} ${rainDensityClass}`} />}
      {selectedDay?.category === "thunderstorm" && (
        <div className={styles.lightningOverlay} />
      )}
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>🚲 自転車お出かけ天気</h1>
          <p className={styles.tagline}>自転車で行ける？帰りは大丈夫？天気から最適な移動を提案。</p>
          <p className={styles.subtitle}>日付を選んで、その日の天気予報を確認できます</p>
        </header>

        {loading && <div className={styles.message}>読み込み中...</div>}

        {errorMsg && (
          <div className={`${styles.message} ${styles.messageError}`}>{errorMsg}</div>
        )}

        {data && data.days.length > 0 && (
          <>
            <div className={styles.dateRow}>
              <input
                type="date"
                className={styles.dateInput}
                value={selectedDate ?? ""}
                min={data.days[0].date}
                max={data.days[data.days.length - 1].date}
                onChange={(e) => handleDateInputChange(e.target.value)}
              />
            </div>

            <div className={styles.dayStrip}>
              {data.days.map((day) => (
                <button
                  key={day.date}
                  type="button"
                  className={`${styles.dayButton} ${
                    day.date === selectedDate ? styles.dayButtonActive : ""
                  }`}
                  onClick={() => {
                    setSnapNotice(null);
                    setSelectedDate(day.date);
                  }}
                >
                  <span>{day.weekday}</span>
                  <span className={styles.dayButtonIcon} role="img" aria-label={day.categoryLabel}>
                    {CATEGORY_EMOJI[day.category]}
                  </span>
                  <span>{Math.round(day.temp)}°</span>
                </button>
              ))}
            </div>

            {snapNotice && <div className={styles.message}>{snapNotice}</div>}

            <section className={styles.destinationSection}>
              <div className={styles.locationLabel}>目的地の天気</div>
              <form className={styles.destinationForm} onSubmit={handleDestinationSearch}>
                <input
                  type="text"
                  className={styles.destinationInput}
                  placeholder="例：東京都渋谷区 / 神奈川県横浜市"
                  value={destinationInput}
                  onChange={(e) => setDestinationInput(e.target.value)}
                />
                <button type="submit" className={styles.destinationButton}>
                  検索
                </button>
                {hasSearchedDestination && (
                  <button
                    type="button"
                    className={styles.destinationClearButton}
                    onClick={handleDestinationClear}
                  >
                    クリア
                  </button>
                )}
              </form>

              <p className={styles.adviceHint}>
                🚲 出発時間と帰宅時間を入力すると、上のカレンダーで選んでいる日付（{selectedDay ? formatDateLabel(selectedDay) : "未選択"}）を対象に、自転車で行くべきかのアドバイスが表示されます。目的地は入力しなくても大丈夫です（未入力の場合は現在地の天気で判断）。
              </p>

              <div className={styles.timeRow}>
                <label className={styles.timeField}>
                  <span className={styles.timeFieldLabel}>出発時間</span>
                  <input
                    type="time"
                    className={styles.timeInput}
                    value={departureTime}
                    onChange={(e) => setDepartureTime(e.target.value)}
                  />
                </label>
                <label className={styles.timeField}>
                  <span className={styles.timeFieldLabel}>帰宅時間</span>
                  <input
                    type="time"
                    className={styles.timeInput}
                    value={returnTime}
                    onChange={(e) => setReturnTime(e.target.value)}
                  />
                </label>
              </div>

              {destinationLoading && (
                <div className={styles.message}>目的地の天気を取得中...</div>
              )}

              {destinationError && (
                <div className={`${styles.message} ${styles.messageError}`}>
                  {destinationError}
                </div>
              )}

              {destinationSelectedDay && destinationData && (
                <section className={styles.card}>
                  <div className={styles.locationLabel}>目的地（{destinationData.location}）</div>
                  <div className={styles.cardDate}>{formatDateLabel(destinationSelectedDay)}</div>
                  <div
                    className={styles.cardIcon}
                    role="img"
                    aria-label={destinationSelectedDay.categoryLabel}
                  >
                    {CATEGORY_EMOJI[destinationSelectedDay.category]}
                  </div>
                  {CATEGORY_RAINDROPS[destinationSelectedDay.category] && (
                    <div className={styles.rainDrops} aria-hidden="true">
                      {CATEGORY_RAINDROPS[destinationSelectedDay.category]}
                    </div>
                  )}
                  <div className={styles.cardTemp}>{destinationSelectedDay.temp}°C</div>
                  <div className={styles.cardDescription}>
                    {destinationSelectedDay.categoryLabel}
                  </div>
                  <div className={styles.cardMinMax}>
                    最高 {destinationSelectedDay.tempMax}° / 最低 {destinationSelectedDay.tempMin}°
                  </div>

                  <div className={styles.statsRow}>
                    <div className={styles.statBox}>
                      <div className={styles.statLabel}>湿度</div>
                      <div className={styles.statValue}>{destinationSelectedDay.humidity}%</div>
                    </div>
                    <div className={styles.statBox}>
                      <div className={styles.statLabel}>降水確率</div>
                      <div className={styles.statValue}>{destinationSelectedDay.pop}%</div>
                    </div>
                  </div>
                </section>
              )}
            </section>

            {selectedDay && (
              <section className={styles.card}>
                <div className={styles.locationLabel}>府中市</div>
                <div className={styles.cardDate}>{formatDateLabel(selectedDay)}</div>
                <div
                  className={styles.cardIcon}
                  role="img"
                  aria-label={selectedDay.categoryLabel}
                >
                  {CATEGORY_EMOJI[selectedDay.category]}
                </div>
                {CATEGORY_RAINDROPS[selectedDay.category] && (
                  <div className={styles.rainDrops} aria-hidden="true">
                    {CATEGORY_RAINDROPS[selectedDay.category]}
                  </div>
                )}
                <div className={styles.cardTemp}>{selectedDay.temp}°C</div>
                <div className={styles.cardDescription}>{selectedDay.categoryLabel}</div>
                <div className={styles.cardMinMax}>
                  最高 {selectedDay.tempMax}° / 最低 {selectedDay.tempMin}°
                </div>

                <div className={styles.statsRow}>
                  <div className={styles.statBox}>
                    <div className={styles.statLabel}>湿度</div>
                    <div className={styles.statValue}>{selectedDay.humidity}%</div>
                  </div>
                  <div className={styles.statBox}>
                    <div className={styles.statLabel}>降水確率</div>
                    <div className={styles.statValue}>{selectedDay.pop}%</div>
                  </div>
                </div>
              </section>
            )}

            <section className={styles.hourlySection}>
              <HourlyForecast
                primary={{ label: "府中市", hours: fuchuHourlyWindow }}
                secondary={
                  destinationSelectedDay && destinationData
                    ? { label: destinationData.location, hours: destinationHourlyWindow }
                    : null
                }
              />
            </section>

            {departureTime && returnTime && (
              <section className={styles.adviceSection}>
                <CyclingAdvice
                  locationLabel={adviceLocationLabel}
                  hours={adviceHours}
                  targetDate={adviceTargetDate}
                  departureTime={departureTime}
                  returnTime={returnTime}
                />
              </section>
            )}

            <p className={styles.footer}>
              最終更新: {data.updatedAt ? new Date(data.updatedAt).toLocaleString("ja-JP") : "-"}
              　/　データ提供: OpenWeatherMap
            </p>
          </>
        )}
      </div>
    </main>
  );
}
