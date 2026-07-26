import { NextResponse } from "next/server";
import { fetchForecast } from "@/app/lib/weather";

// Fuchu City Hall, Tokyo
const LAT = 35.6694;
const LON = 139.4776;

export async function GET() {
  const result = await fetchForecast(LAT, LON, "東京都府中市");

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
