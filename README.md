# 府中市・目的地 天気予報アプリ

東京都府中市の気温・天気・湿度・降水確率を、日付を選んで確認できる Next.js 製の Web アプリです。
天気に応じて背景（晴れ／雨／曇りなど）が切り替わります。
さらに、日本国内の任意の目的地（例: 東京都渋谷区、大阪府大阪市など）を検索して、
府中市の天気と比較しながら確認できます。

データソース:
- 天気情報: [OpenWeatherMap](https://openweathermap.org/) の 5 day / 3 hour forecast API（無料プラン）
- 目的地の住所 → 緯度経度変換: [国土地理院（GSI）住所検索API](https://msearch.gsi.go.jp/address-search/AddressSearch)（APIキー不要）

## セットアップ

### 1. OpenWeatherMap の API キーを取得する

1. https://home.openweathermap.org/users/sign_up でアカウントを作成する
2. https://home.openweathermap.org/api_keys で API キー（Default キーでも可）をコピーする
3. 発行直後はキーが有効になるまで数分〜数十分かかることがあります

### 2. ローカルで動かす

```bash
npm install
cp .env.local.example .env.local
# .env.local を開いて OPENWEATHER_API_KEY=取得したキー に書き換える
npm run dev
```

http://localhost:3000 を開くと確認できます。

### 3. Vercel にデプロイする

環境変数はリポジトリにコミットせず、**Vercel 側の Environment Variables** に設定します。

```bash
npm i -g vercel   # 未インストールの場合
vercel login
vercel link       # プロジェクトを Vercel にリンク
vercel env add OPENWEATHER_API_KEY production
vercel env add OPENWEATHER_API_KEY preview
vercel env add OPENWEATHER_API_KEY development
vercel --prod     # 本番デプロイ
```

もしくは Vercel ダッシュボード → Project → Settings → Environment Variables から
`OPENWEATHER_API_KEY` を追加してもかまいません。

## 主な構成

- `app/lib/weather.ts` — 緯度経度を受け取って OpenWeatherMap の forecast API を呼び出し、
  5 日分の 3 時間ごとの予報を日付単位に集約する共通ロジック（府中市・目的地の両方から利用）。
  API キーはここでのみ使用され、ブラウザには渡りません。
- `app/api/weather/route.ts` — 府中市固定の緯度経度で `fetchForecast` を呼び出すルートハンドラ。
- `app/api/destination-weather/route.ts` — クエリパラメータ `q`（例: `東京都渋谷区`）を
  国土地理院の住所検索APIで緯度経度に変換し、`fetchForecast` を呼び出すルートハンドラ。
  住所が見つからない場合はエラーメッセージを返します。
- `app/page.tsx` — 日付ピッカー（カレンダー）と日別ボタンで予報を切り替えられるクライアント画面。
  選択中の天気（Clear / Rain / Clouds / Snow / Mist など）に応じて背景を切り替えます。
  目的地検索欄では、同じ選択日の目的地の天気を府中市の天気と並べて確認できます。
- `app/weather.module.css` — 背景グラデーションとカードのスタイル。
- `app/lib/types.ts` — API とフロントで共有する型定義。

## 補足

- OpenWeatherMap の無料プランは 5 日先までの予報のため、それより先の日付を選ぶと直近の予報日にスナップします（目的地側も同様）。
- 対象地点は府中市役所付近の緯度経度で固定しています（`app/api/weather/route.ts` の `LAT` / `LON`）。
- 目的地の住所→緯度経度変換には国土地理院の住所検索APIを利用しており、APIキーは不要です。
  存在しない・認識できない住所を入力した場合は、目的地カード側にエラーメッセージのみ表示され、
  府中市側の表示や既存機能には影響しません。
