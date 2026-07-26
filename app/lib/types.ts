export type WeatherCategory =
  | "clear"
  | "cloudy"
  | "light-rain"
  | "heavy-rain"
  | "thunderstorm";

export type HourForecast = {
  date: string; // YYYY-MM-DD (Asia/Tokyo) — 複数日をつなげて表示する際の日付境界の判定に使う
  time: string; // "HH:00" (Asia/Tokyo)
  hourLabel: string; // "6時" など、グラフの横軸表示用
  temp: number;
  humidity: number;
  pop: number; // 0-100 (%)
  weatherId: number; // OpenWeatherMapの天気コード（自転車アドバイス機能でのより細かい判定用）
  windSpeed: number; // m/s
  weatherMain: string;
  weatherDescription: string;
  icon: string;
  category: WeatherCategory;
  categoryLabel: string; // 晴れ / 曇り / 小雨 / 大雨 / 雷雨
};

export type DayForecast = {
  date: string; // YYYY-MM-DD (Asia/Tokyo)
  weekday: string;
  temp: number;
  tempMin: number;
  tempMax: number;
  humidity: number;
  pop: number; // 0-100 (%)
  weatherMain: string;
  weatherDescription: string;
  icon: string;
  category: WeatherCategory;
  categoryLabel: string; // 晴れ / 曇り / 小雨 / 大雨 / 雷雨
  hours: HourForecast[]; // その日の3時間ごとの予報（時間ごとのグラフ用）
};

export type WeatherApiResponse = {
  location: string;
  updatedAt: string;
  days: DayForecast[];
};

export type WeatherApiError = {
  error: string;
};
