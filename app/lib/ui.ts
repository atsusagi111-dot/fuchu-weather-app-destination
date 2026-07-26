import type { WeatherCategory } from "@/app/lib/types";

export const CATEGORY_EMOJI: Record<WeatherCategory, string> = {
  clear: "🌤️",
  cloudy: "🌥️",
  "light-rain": "☔",
  "heavy-rain": "☔",
  thunderstorm: "⚡☔",
};

export const CATEGORY_RAINDROPS: Partial<Record<WeatherCategory, string>> = {
  "light-rain": "💧",
  "heavy-rain": "💧💧💧",
  thunderstorm: "💧💧💧",
};
