import type {
  DayForecast,
  HourForecast,
  WeatherApiResponse,
  WeatherCategory,
} from "@/app/lib/types";

type OwmWeather = {
  id: number;
  main: string;
  description: string;
  icon: string;
};

type OwmListItem = {
  dt: number;
  main: {
    temp: number;
    temp_min: number;
    temp_max: number;
    humidity: number;
  };
  weather: OwmWeather[];
  pop: number;
  dt_txt: string;
};

type OwmForecastResponse = {
  cod: string;
  message: number | string;
  list: OwmListItem[];
  city: {
    name: string;
    timezone: number;
  };
};

const WEEKDAYS_JA = ["日", "月", "火", "水", "木", "金", "土"];

const CATEGORY_LABEL: Record<WeatherCategory, string> = {
  clear: "晴れ",
  cloudy: "曇り",
  "light-rain": "小雨",
  "heavy-rain": "大雨",
  thunderstorm: "雷雨",
};

// Classify an OpenWeatherMap condition code (see https://openweathermap.org/weather-conditions)
// into the 5 buckets the UI distinguishes: 晴れ/曇り/小雨/大雨/雷雨.
function classifyWeather(id: number): WeatherCategory {
  if (id >= 200 && id <= 232) return "thunderstorm";
  if (id >= 300 && id <= 321) return "light-rain"; // drizzle
  if ([500, 501, 520].includes(id)) return "light-rain";
  if ([502, 503, 504, 511, 521, 522, 531].includes(id)) return "heavy-rain";
  if (id === 800) return "clear";
  if (id >= 801 && id <= 804) return "cloudy";
  // Snow / atmosphere (mist, fog, haze, etc.) fall back to the closest visual bucket.
  return "cloudy";
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

// Convert a UTC unix timestamp + a fixed UTC offset (seconds) into
// {y, m, d, hh} components representing local wall-clock time, without
// letting the server's own timezone leak into the calculation.
function toLocalParts(unixSeconds: number, tzOffsetSeconds: number) {
  const shifted = new Date((unixSeconds + tzOffsetSeconds) * 1000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    weekdayIndex: shifted.getUTCDay(),
  };
}

export type ForecastResult =
  | { ok: true; data: WeatherApiResponse }
  | { ok: false; status: number; error: string };

// Fetch OpenWeatherMap's 5 day / 3 hour forecast for the given coordinates and
// aggregate it into one representative entry per local calendar day.
export async function fetchForecast(
  lat: number,
  lon: number,
  location: string
): Promise<ForecastResult> {
  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!apiKey) {
    return {
      ok: false,
      status: 500,
      error:
        "OPENWEATHER_API_KEY が設定されていません。.env.local (ローカル) または Vercel の環境変数に設定してください。",
    };
  }

  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&lang=ja&appid=${apiKey}`;

  let res: Response;
  try {
    res = await fetch(url, { next: { revalidate: 600 } });
  } catch {
    return {
      ok: false,
      status: 502,
      error: "天気情報の取得に失敗しました(ネットワークエラー)。",
    };
  }

  if (!res.ok) {
    const status = res.status === 401 ? 401 : 502;
    const message =
      status === 401
        ? "OpenWeatherMap の API キーが無効です。キーの値と有効化状態を確認してください。"
        : "天気情報の取得に失敗しました。";
    return { ok: false, status, error: message };
  }

  const data = (await res.json()) as OwmForecastResponse;
  const tz = data.city.timezone;

  const byDate = new Map<string, OwmListItem[]>();
  for (const item of data.list) {
    const { year, month, day } = toLocalParts(item.dt, tz);
    const dateKey = `${year}-${pad(month)}-${pad(day)}`;
    const bucket = byDate.get(dateKey) ?? [];
    bucket.push(item);
    byDate.set(dateKey, bucket);
  }

  const days: DayForecast[] = Array.from(byDate.entries()).map(
    ([dateKey, items]) => {
      // Representative entry: the 3-hour slot closest to local noon.
      let representative = items[0];
      let bestDiff = Infinity;
      for (const item of items) {
        const { hour } = toLocalParts(item.dt, tz);
        const diff = Math.abs(hour - 12);
        if (diff < bestDiff) {
          bestDiff = diff;
          representative = item;
        }
      }

      const tempMin = Math.min(...items.map((i) => i.main.temp_min));
      const tempMax = Math.max(...items.map((i) => i.main.temp_max));
      const maxPop = Math.max(...items.map((i) => i.pop));
      const { weekdayIndex } = toLocalParts(representative.dt, tz);
      const weather = representative.weather[0];
      const category = classifyWeather(weather.id);

      // 3時間ごとの生データも保持し、時間ごとの折れ線グラフに使う。
      const hours: HourForecast[] = [...items]
        .sort((a, b) => a.dt - b.dt)
        .map((item) => {
          const { hour } = toLocalParts(item.dt, tz);
          const itemWeather = item.weather[0];
          const itemCategory = classifyWeather(itemWeather.id);
          return {
            date: dateKey,
            time: `${pad(hour)}:00`,
            hourLabel: `${hour}時`,
            temp: Math.round(item.main.temp),
            humidity: item.main.humidity,
            pop: Math.round(item.pop * 100),
            weatherMain: itemWeather.main,
            weatherDescription: itemWeather.description,
            icon: itemWeather.icon,
            category: itemCategory,
            categoryLabel: CATEGORY_LABEL[itemCategory],
          };
        });

      return {
        date: dateKey,
        weekday: WEEKDAYS_JA[weekdayIndex],
        temp: Math.round(representative.main.temp),
        tempMin: Math.round(tempMin),
        tempMax: Math.round(tempMax),
        humidity: representative.main.humidity,
        pop: Math.round(maxPop * 100),
        weatherMain: weather.main,
        weatherDescription: weather.description,
        icon: weather.icon,
        category,
        categoryLabel: CATEGORY_LABEL[category],
        hours,
      };
    }
  );

  const payload: WeatherApiResponse = {
    location,
    updatedAt: new Date().toISOString(),
    days,
  };

  return { ok: true, data: payload };
}
