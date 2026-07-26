"use client";

import styles from "@/app/weather.module.css";
import type { HourForecast } from "@/app/lib/types";
import {
  ADVICE_INFO,
  MAX_RELIABLE_DIFF_MINUTES,
  buildRecommendation,
  classifyAdvice,
  findNearestHour,
} from "@/app/lib/advice";

const INSUFFICIENT_DATA_MESSAGE =
  "十分な天気予報データを取得できないため、最新の天気予報を確認してください。";

function formatDateShort(dateStr: string): string {
  const [, month, day] = dateStr.split("-");
  return `${parseInt(month, 10)}月${parseInt(day, 10)}日`;
}

export default function CyclingAdvice({
  locationLabel,
  hours,
  targetDate,
  departureTime,
  returnTime,
}: {
  locationLabel: string;
  hours: HourForecast[];
  targetDate: string | null;
  departureTime: string;
  returnTime: string;
}) {
  if (!targetDate || hours.length === 0) {
    return (
      <div className={styles.adviceBlock}>
        <div className={styles.locationLabel}>🚲 天気からのおすすめ</div>
        <div className={styles.message}>{INSUFFICIENT_DATA_MESSAGE}</div>
      </div>
    );
  }

  const departureLookup = findNearestHour(hours, targetDate, departureTime);
  const returnLookup = findNearestHour(hours, targetDate, returnTime);

  const isUnreliable =
    !departureLookup ||
    !returnLookup ||
    departureLookup.diffMinutes > MAX_RELIABLE_DIFF_MINUTES ||
    returnLookup.diffMinutes > MAX_RELIABLE_DIFF_MINUTES;

  if (isUnreliable) {
    return (
      <div className={styles.adviceBlock}>
        <div className={styles.locationLabel}>🚲 天気からのおすすめ</div>
        <div className={styles.adviceSubLabel}>
          対象日: {formatDateShort(targetDate)}（{locationLabel}）
        </div>
        <div className={styles.message}>{INSUFFICIENT_DATA_MESSAGE}</div>
        <p className={styles.adviceNote}>
          ※ {formatDateShort(targetDate)}の予報データが、入力した時間から離れすぎているため判断できませんでした。
          上のカレンダーで日付を変更するか、出発・帰宅時間を予報のある時間帯に近づけてみてください。
        </p>
      </div>
    );
  }

  const departureCategory = classifyAdvice(departureLookup.hour);
  const returnCategory = classifyAdvice(returnLookup.hour);
  const departureInfo = ADVICE_INFO[departureCategory];
  const returnInfo = ADVICE_INFO[returnCategory];
  const recommendation = buildRecommendation(departureCategory, returnCategory);

  return (
    <div className={styles.adviceBlock}>
      <div className={styles.adviceTitle}>
        {recommendation.icon} 今日の移動アドバイス
      </div>
      <div className={styles.adviceSubLabel}>
        対象日: {formatDateShort(targetDate)}（{locationLabel}への移動をもとに判断）
      </div>

      <div className={styles.adviceLegRow}>
        <div className={styles.adviceLeg}>
          <div className={styles.adviceLegHeader}>
            行き（{departureLookup.hour.time}頃）：{departureInfo.emoji} {departureInfo.label}
          </div>
          <div className={styles.adviceLegBody}>→ {departureInfo.message}</div>
        </div>
        <div className={styles.adviceLeg}>
          <div className={styles.adviceLegHeader}>
            帰り（{returnLookup.hour.time}頃）：{returnInfo.emoji} {returnInfo.label}
          </div>
          <div className={styles.adviceLegBody}>→ {returnInfo.message}</div>
        </div>
      </div>

      <div className={styles.adviceRecommendation}>
        💡 おすすめ
        <div className={styles.adviceRecommendationText}>{recommendation.message}</div>
      </div>

      <p className={styles.adviceNote}>
        ※ この判断は天気予報に基づく参考情報です。出発前に最新の天気予報もあわせてご確認ください。
      </p>
    </div>
  );
}
