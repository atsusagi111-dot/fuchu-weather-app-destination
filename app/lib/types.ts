export type WeatherCategory =
  | "clear"
  | "cloudy"
  | "light-rain"
  | "heavy-rain"
  | "thunderstorm";

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
};

export type WeatherApiResponse = {
  location: string;
  updatedAt: string;
  days: DayForecast[];
};

export type WeatherApiError = {
  error: string;
};
