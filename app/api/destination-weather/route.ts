import { NextRequest, NextResponse } from "next/server";
import { fetchForecast } from "@/app/lib/weather";

// 国土地理院(GSI)の住所検索API。APIキー不要で日本国内の住所を緯度経度に変換できる。
// https://msearch.gsi.go.jp/address-search/AddressSearch?q=<address>
const GSI_GEOCODE_URL = "https://msearch.gsi.go.jp/address-search/AddressSearch";

const NOT_FOUND_MESSAGE =
  "目的地の天気情報を取得できませんでした。都道府県名や市区町村名を確認してください。";

type GsiFeature = {
  geometry: { coordinates: [number, number] };
  properties: { title: string };
};

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();

  if (!q) {
    return NextResponse.json({ error: "目的地を入力してください。" }, { status: 400 });
  }

  let geoRes: Response;
  try {
    geoRes = await fetch(`${GSI_GEOCODE_URL}?q=${encodeURIComponent(q)}`, {
      next: { revalidate: 3600 },
    });
  } catch {
    return NextResponse.json({ error: NOT_FOUND_MESSAGE }, { status: 502 });
  }

  if (!geoRes.ok) {
    return NextResponse.json({ error: NOT_FOUND_MESSAGE }, { status: 502 });
  }

  let geoData: GsiFeature[];
  try {
    geoData = (await geoRes.json()) as GsiFeature[];
  } catch {
    return NextResponse.json({ error: NOT_FOUND_MESSAGE }, { status: 502 });
  }

  if (!Array.isArray(geoData) || geoData.length === 0) {
    return NextResponse.json({ error: NOT_FOUND_MESSAGE }, { status: 404 });
  }

  const [lon, lat] = geoData[0].geometry.coordinates;
  const location = geoData[0].properties.title || q;

  const result = await fetchForecast(lat, lon, location);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
