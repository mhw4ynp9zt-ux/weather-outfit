# 今日なに着る?

天気予報(Open-Meteo)から、朝・昼・夜の服装を提案するPWA。ビルド不要の静的サイトです。

## テスト
    node --test tests/*.test.mjs

## ローカル確認
    python3 -m http.server 8000   # http://localhost:8000

## Cloudflare Pagesへの公開
ビルドコマンドなし、公開ディレクトリはリポジトリのルート(`/`)。

方法A(CLI):
    npx wrangler login
    npx wrangler pages deploy . --project-name weather-outfit

方法B(Git連携): リポジトリをGitHubに置き、Cloudflare Pagesで接続。Build command は空、Output directory は `/`。

## 更新時の注意
`sw.js` の `CACHE` 名(`wo-shell-v1`)を上げると、利用者の端末のキャッシュが入れ替わります。
