# 府中市 天気予報アプリ

東京都府中市の気温・天気・湿度・降水確率を、日付を選んで確認できる Next.js 製の Web アプリです。
天気に応じて背景（晴れ／雨／曇りなど）が切り替わります。

データソース: [OpenWeatherMap](https://openweathermap.org/) の 5 day / 3 hour forecast API（無料プラン）。

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

- `app/api/weather/route.ts` — OpenWeatherMap の forecast API を呼び出すサーバー側のルートハンドラ。
  API キーはここでのみ使用され、ブラウザには渡りません。5 日分の 3 時間ごとの予報を日付単位に集約し、
  代表値（気温・天気・湿度・最大降水確率）を返します。
- `app/page.tsx` — 日付ピッカー（カレンダー）と日別ボタンで予報を切り替えられるクライアント画面。
  選択中の天気（Clear / Rain / Clouds / Snow / Mist など）に応じて背景を切り替えます。
- `app/weather.module.css` — 背景グラデーションとカードのスタイル。
- `app/lib/types.ts` — API とフロントで共有する型定義。

## 補足

- OpenWeatherMap の無料プランは 5 日先までの予報のため、それより先の日付を選ぶと直近の予報日にスナップします。
- 対象地点は府中市役所付近の緯度経度で固定しています（`app/api/weather/route.ts` の `LAT` / `LON`）。
