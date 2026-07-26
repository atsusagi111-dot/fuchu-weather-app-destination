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
    minute: shifted.getUTCMinutes(),
    weekdayIndex: shifted.getUTCDay(),
  };
}

type OwmCurrentResponse = {
  dt: number;
  timezone: number;
  main: { temp: number; humidity: number };
  weather: OwmWeather[];
};

// OpenWeatherMapの実況(Current Weather)APIを使って「今」の気温・湿度・天気を取得する。
// forecast APIは未来のスロットしか返さないため、これが無いと当日の現在時刻の天候を
// グラフ上で確認できない。取得できない場合はnullを返し、呼び出し側は既存の予報表示を
// そのまま続ける(グラフから「現在」の点が抜けるだけで、他の機能は壊さない)。
async function fetchCurrentConditions(
  lat: number,
  lon: number,
  apiKey: string
): Promise<(HourForecast & { weekdayIndex: number }) | null> {
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=ja&appid=${apiKey}`;

  let res: Response;
  try {
    res = await fetch(url, { next: { revalidate: 300 } });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  let data: OwmCurrentResponse;
  try {
    data = (await res.json()) as OwmCurrentResponse;
  } catch {
    return null;
  }

  const weather = data.weather?.[0];
  if (!weather) return null;

  const { year, month, day, hour, minute, weekdayIndex } = toLocalParts(data.dt, data.timezone);
  const category = classifyWeather(weather.id);

  return {
    date: `${year}-${pad(month)}-${pad(day)}`,
    time: `${pad(hour)}:${pad(minute)}`,
    hourLabel: "現在",
    temp: Math.round(data.main.temp),
    humidity: data.main.humidity,
    pop: 0, // 実況APIには降水確率が無いため、呼び出し側で直近の予報値に差し替える
    weatherMain: weather.main,
    weatherDescription: weather.description,
    icon: weather.icon,
    category,
    categoryLabel: CATEGORY_LABEL[category],
    weekdayIndex,
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

  // 現在時刻の実況を取得できたら、当日の予報の先頭に「現在」として差し込む。
  const current = await fetchCurrentConditions(lat, lon, apiKey);
  if (current) {
    const fallbackPop = data.list[0] ? Math.round(data.list[0].pop * 100) : 0;
    const { weekdayIndex, ...nowHour } = { ...current, pop: fallbackPop };

    const todayIndex = days.findIndex((d) => d.date === current.date);
    if (todayIndex >= 0) {
      days[todayIndex] = {
        ...days[todayIndex],
        hours: [nowHour, ...days[todayIndex].hours],
      };
    } else {
      // 深夜など、当日の予報スロットが1つも残っていない場合は「現在」だけの日を先頭に追加する。
      days.unshift({
        date: current.date,
        weekday: WEEKDAYS_JA[weekdayIndex],
        temp: nowHour.temp,
        tempMin: nowHour.temp,
        tempMax: nowHour.temp,
        humidity: nowHour.humidity,
        pop: fallbackPop,
        weatherMain: nowHour.weatherMain,
        weatherDescription: nowHour.weatherDescription,
        icon: nowHour.icon,
        category: nowHour.category,
        categoryLabel: nowHour.categoryLabel,
        hours: [nowHour],
      });
    }
  }

  const payload: WeatherApiResponse = {
    location,
    updatedAt: new Date().toISOString(),
    days,
  };

  return { ok: true, data: payload };
}
