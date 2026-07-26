import type { HourForecast } from "@/app/lib/types";

export type AdviceCategory =
  | "clear"
  | "cloudy"
  | "shower"
  | "light-rain"
  | "heavy-rain"
  | "strong-wind"
  | "thunderstorm"
  | "typhoon";

// 安全側の判断をするための重大度順（左ほど軽い）。
const SEVERITY: AdviceCategory[] = [
  "clear",
  "cloudy",
  "shower",
  "light-rain",
  "heavy-rain",
  "strong-wind",
  "thunderstorm",
  "typhoon",
];

export const ADVICE_INFO: Record<
  AdviceCategory,
  { emoji: string; label: string; message: string; avoidBicycle: boolean }
> = {
  clear: {
    emoji: "☀️",
    label: "晴れ",
    message: "自転車で行っても問題ありません。快適な自転車移動ができそうです。",
    avoidBicycle: false,
  },
  cloudy: {
    emoji: "☁️",
    label: "曇り",
    message: "自転車で行っても問題ありません。念のため天気の変化を確認しておきましょう。",
    avoidBicycle: false,
  },
  shower: {
    emoji: "🌦️",
    label: "にわか雨・一時的な雨",
    message: "途中で雨が降る可能性があります。カッパやレインウェアを携帯することをおすすめします。",
    avoidBicycle: false,
  },
  "light-rain": {
    emoji: "🌧️",
    label: "小雨",
    message: "雨が降る可能性があります。カッパやレインウェアを着用して出発することをおすすめします。",
    avoidBicycle: false,
  },
  "heavy-rain": {
    emoji: "🌧️",
    label: "大雨",
    message:
      "強い雨が予想されます。十分な雨具を準備してください。可能であれば徒歩や電車など、自転車以外の移動手段も検討してください。",
    avoidBicycle: true,
  },
  "strong-wind": {
    emoji: "💨",
    label: "強風",
    message:
      "強風が予想されます。自転車の運転は危険になる可能性があります。外出を控えるか、電車や徒歩など別の移動手段をおすすめします。",
    avoidBicycle: true,
  },
  thunderstorm: {
    emoji: "⛈️",
    label: "雷雨",
    message: "雷雨が予想されます。安全のため自転車での移動は避け、電車や徒歩など別の移動手段をおすすめします。",
    avoidBicycle: true,
  },
  typhoon: {
    emoji: "🌀",
    label: "台風・非常に危険な天候",
    message: "非常に危険な天候が予想されます。不要不急の外出は控え、自転車での移動は避けてください。",
    avoidBicycle: true,
  },
};

// 強風・台風レベルとみなす風速のしきい値 (m/s)。
const STRONG_WIND_MPS = 10;
const TYPHOON_WIND_MPS = 20;

function severityIndex(category: AdviceCategory): number {
  return SEVERITY.indexOf(category);
}

export function worseOf(a: AdviceCategory, b: AdviceCategory): AdviceCategory {
  return severityIndex(a) >= severityIndex(b) ? a : b;
}

// OpenWeatherMapの天気コード(id)を、背景切り替えに使う既存の5分類とは別に、
// 自転車アドバイス用の8分類に振り分ける。既存のWeatherCategory判定(classifyWeather)
// には手を加えず、こちらは独立したロジックとして扱う。
function classifyRain(weatherId: number): AdviceCategory {
  if (weatherId >= 200 && weatherId <= 232) return "thunderstorm";
  if (weatherId === 522) return "heavy-rain"; // heavy intensity shower rain
  if (weatherId === 520 || weatherId === 521 || weatherId === 531) return "shower"; // にわか雨
  if (weatherId >= 300 && weatherId <= 321) return "light-rain"; // drizzle
  if (weatherId === 500 || weatherId === 501) return "light-rain";
  if (weatherId === 502 || weatherId === 503 || weatherId === 504 || weatherId === 511) return "heavy-rain";
  if (weatherId >= 600 && weatherId <= 622) return "heavy-rain"; // 雪も自転車には危険なため大雨相当で扱う
  if (weatherId === 771 || weatherId === 781) return "typhoon"; // 突風・竜巻
  if (weatherId === 800) return "clear";
  if (weatherId >= 801 && weatherId <= 804) return "cloudy";
  return "cloudy"; // 霧・もやなど、判断がつかない場合は安全側の曖昧値
}

function classifyWind(windSpeedMps: number): AdviceCategory {
  if (windSpeedMps >= TYPHOON_WIND_MPS) return "typhoon";
  if (windSpeedMps >= STRONG_WIND_MPS) return "strong-wind";
  return "clear";
}

// 天気コードと風速の両方を見て、より重大な方の分類を採用する。
export function classifyAdvice(hour: HourForecast): AdviceCategory {
  const rain = classifyRain(hour.weatherId);
  const wind = classifyWind(hour.windSpeed);
  return worseOf(rain, wind);
}

export type NearestHourResult = {
  hour: HourForecast;
  diffMinutes: number;
};

// 指定した日付+時刻に最も近い時間別予報を探す。データが1件も無ければnull。
export function findNearestHour(
  hours: HourForecast[],
  dateStr: string,
  timeHHMM: string
): NearestHourResult | null {
  if (hours.length === 0) return null;

  const targetMs = new Date(`${dateStr}T${timeHHMM}:00`).getTime();
  let best = hours[0];
  let bestDiff = Infinity;
  for (const h of hours) {
    const ms = new Date(`${h.date}T${h.time}:00`).getTime();
    const diff = Math.abs(ms - targetMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = h;
    }
  }
  return { hour: best, diffMinutes: bestDiff / 60000 };
}

// 前後の予報とどれだけ離れていたら「参考にならない」とみなすか。
export const MAX_RELIABLE_DIFF_MINUTES = 180;

export type Recommendation = {
  icon: string;
  message: string;
};

// 出発時・帰宅時、両方の天候から自転車移動の総合的なおすすめを組み立てる。
export function buildRecommendation(
  departure: AdviceCategory,
  arrival: AdviceCategory
): Recommendation {
  const worse = worseOf(departure, arrival);
  const worseInfo = ADVICE_INFO[worse];

  if (worseInfo.avoidBicycle) {
    return { icon: "🚆", message: worseInfo.message };
  }

  const isRainy = (c: AdviceCategory) => c === "shower" || c === "light-rain";
  const departureRainy = isRainy(departure);
  const arrivalRainy = isRainy(arrival);

  if (departureRainy && arrivalRainy) {
    return {
      icon: "🚲",
      message: "行き帰りとも雨が降る可能性があります。カッパ（レインウェア）を持って出発することをおすすめします。",
    };
  }
  if (arrivalRainy) {
    return { icon: "🚲", message: "帰宅時に雨が予想されます。カッパを持って出発することをおすすめします。" };
  }
  if (departureRainy) {
    return { icon: "🚲", message: "出発時に雨が予想されます。カッパを持って出発することをおすすめします。" };
  }

  return { icon: "🚲", message: worseInfo.message };
}
