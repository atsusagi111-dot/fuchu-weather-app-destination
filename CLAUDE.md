@AGENTS.md

# 府中市・目的地 天気予報アプリ

東京都府中市の天気予報に加えて、日本国内の任意の目的地の天気も検索・比較できる Next.js 製 Web アプリ。

## リンク

- GitHub リポジトリ: https://github.com/atsusagi111-dot/fuchu-weather-app-destination
- デプロイ後のアプリ: https://fuchu-weather-app-destination.vercel.app

## 使用している技術

- TypeScript（コードに型を付けられるJavaScriptの拡張言語。書き間違いをエディタ上で早期に検出できる）
- Next.js 16（Reactベースのアプリを画面表示とAPIの両方まとめて作れるフレームワーク。App Router構成を採用）
- React 19（画面のUIを部品（コンポーネント）単位で組み立てるためのJavaScriptライブラリ）
- CSS Modules（`*.module.css`）（コンポーネントごとにスタイルの名前が衝突しないように分離できるCSSの書き方）
- OpenWeatherMap API（気温・天気・湿度・降水確率を取得する外部の天気情報サービス。APIキーが必要）
- 国土地理院（GSI）住所検索API（「東京都渋谷区」のような日本語住所を緯度経度に変換する無料の外部サービス。APIキー不要）
- ESLint（コードの書き方の間違いや統一されていない書き方を自動でチェックするツール）
- npm（Node.js のパッケージ管理ツール。ライブラリのインストールやスクリプト実行に使う）
- Vercel（GitHubと連携して、pushするだけで自動的に本番環境へ公開してくれるホスティングサービス）
- GitHub（ソースコードを保存・共有し、変更履歴を管理するサービス）

## 環境変数

- `OPENWEATHER_API_KEY`: OpenWeatherMap の APIキー。ローカルでは `.env.local`（Gitには含めない）、本番では Vercel の Environment Variables に設定する。
