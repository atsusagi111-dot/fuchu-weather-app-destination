import { NextResponse } from "next/server";
import type { DayForecast, WeatherApiResponse, WeatherCategory } from "@/app/lib/types";

// Fuchu City Hall, Tokyo
const LAT = 35.6694;
const LON = 139.4776;

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

export async function GET() {
  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "OPENWEATHER_API_KEY が設定されていません。.env.local (ローカル) または Vercel の環境変数に設定してください。",
      },
      { status: 500 }
    );
  }

  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${LAT}&lon=${LON}&units=metric&lang=ja&appid=${apiKey}`;

  let res: Response;
  try {
    res = await fetch(url, { next: { revalidate: 600 } });
  } catch {
    return NextResponse.json(
      { error: "天気情報の取得に失敗しました（ネットワークエラー）。" },
      { status: 502 }
    );
  }

  if (!res.ok) {
    const status = res.status === 401 ? 401 : 502;
    const message =
      status === 401
        ? "OpenWeatherMap の API キーが無効です。キーの値と有効化状態を確認してください。"
        : "天気情報の取得に失敗しました。";
    return NextResponse.json({ error: message }, { status });
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
      };
    }
  );

  const payload: WeatherApiResponse = {
    location: "東京都府中市",
    updatedAt: new Date().toISOString(),
    days,
  };

  return NextResponse.json(payload);
}
