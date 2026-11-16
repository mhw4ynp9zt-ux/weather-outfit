# 天気×服装提案アプリ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 7日分の予報から、選んだ日の朝・昼・夜の服装を提案する、ホーム画面に追加できるPWAを作る。

**Architecture:** ビルド不要の静的ファイル(ES modules)。判断ロジック・予報整形・保存・描画文字列生成を副作用のない小モジュールに分け、`node:test`で検証する。`app.js`はそれらをDOMにつなぐだけにする。Service Workerでアプリ本体と最後の予報をオフラインでも表示する。

**Tech Stack:** HTML/CSS/vanilla JS(ES modules)、Open-Meteo(forecast + geocoding)、localStorage、Service Worker、Node 18+の`node:test`、Cloudflare Pages。

**Spec:** `docs/superpowers/specs/2026-11-16-weather-outfit-design.md`

## Global Constraints

- 外部ライブラリ・ビルド工程・npm依存なし(テストは`node --test`のみ)
- 天気データはOpen-Meteo(キー不要)。予報URLは `https://api.open-meteo.com/v1/forecast`、ジオコーディングは `https://geocoding-api.open-meteo.com/v1/search`
- 予報は7日分(`forecast_days=7`)、`timezone=auto`、風速は`wind_speed_unit=ms`
- 時間帯の既定値: 朝7〜9時 / 昼12〜15時 / 夜18〜22時(終了時刻を含む)
- 寒がり度は `cold|normal|hot`、初期値 `hot`。初期の場所は東京(35.6895, 139.6917)
- 温度帯は体感温度で6段階。`hot`は段階を+1、`cold`は−1(0〜5にクランプ)
- 設定・場所・最後の予報はlocalStorage。予報取得はnetwork-first、失敗時は保存分を表示
- UI文言は日本語。スマホ縦画面を優先
- 初版の非ゴール: 手持ち服登録、アカウント、通知、コーデ画像、サーバー処理

## Review Focus

- 予報APIの失敗・オフライン: 保存済み予報があれば表示し「保存した予報です」と明示、なければエラー文(白画面にしない)
- 時間別データにnullが混じる(降水確率やUVが欠ける): nullを除いて平均し、全部nullなら該当項目は「−」表示で服装計算から外す
- 今日の朝など既に過ぎた時間帯: 提案は出すが「過ぎた時間帯」として薄く表示する
- 都市検索で0件・通信失敗: 設定済みの場所を変えず、画面にメッセージを出す
- localStorageが壊れている・使えない: 初期値で動き続ける。時間帯設定で開始≥終了は保存せず初期値に戻す

---

## File Structure

```
index.html / style.css / app.js          画面とDOM接続
lib/outfit.js                            体感温度→段階→服装、1日のまとめ
lib/forecast.js                          Open-Meteo応答→Day[]、fetch、ジオコーディング
lib/store.js                             設定・予報キャッシュの保存
lib/render.js                            Day/提案→HTML文字列(純関数)
manifest.webmanifest / sw.js / icons/    PWA
tests/*.test.mjs                         node --test
```

共有の型(全タスクで同一):
```js
// Slot: 時間帯の平均値。欠測はnull
// { label: '朝'|'昼'|'夜', tempC, feelsLikeC, precipProb, windMs, uv, isPast }
// Day: { date: 'YYYY-MM-DD', weatherCode: number, tMin: number, tMax: number, slots: Slot[3] }
// Item: { icon: string, text: string }
// Sensitivity: 'cold' | 'normal' | 'hot'
```

### Task 1: 服装の判断ロジック

**Files:**
- Create: `lib/outfit.js`, `tests/outfit.test.mjs`
- 先に `git init` し、`.gitignore` は不要

**Interfaces:**
- Produces: `bandFor(feelsLikeC: number, sensitivity: Sensitivity): 0|1|2|3|4|5`、`suggest(slot: Slot, sensitivity: Sensitivity): { items: Item[], reason: string }`、`summarize(slots: Slot[], sensitivity: Sensitivity): string`

- [ ] **Step 1: 失敗するテストを書く(`tests/outfit.test.mjs`)**
  - `bandFor` の基準(normal): 体感 <5→0, <10→1, <15→2, <20→3, <25→4, ≥25→5。例: `bandFor(4.9,'normal')===0`、`bandFor(10,'normal')===2`、`bandFor(25,'normal')===5`
  - `bandFor(12,'hot')===3`(normalは2)、`bandFor(12,'cold')===1`、`bandFor(2,'cold')===0`、`bandFor(30,'hot')===5`(クランプ)
  - `suggest`: `precipProb:60` なら `items` に `text` が「傘」を含むItemがある。`precipProb:20`なら含まない
  - `suggest`: `windMs:9` なら「風よけ」を含むItem、`uv:7` なら「帽子」を含むItemがある
  - `suggest`: `feelsLikeC:null` のSlotは `items` が空で `reason` が「データなし」
  - `summarize`: 朝feels 8・昼feels 17・夜feels 10(normal)で、返り値が「脱ぎ着」を含む(段階差が2以上の日)。全時間帯が同じ段階なら「脱ぎ着」を含まない
- [ ] **Step 2: 実行して失敗を確認** — `node --test tests/outfit.test.mjs` → FAIL(モジュールなし)
- [ ] **Step 3: `lib/outfit.js` を実装** — 段階ごとにトップス/アウターのItemを返すテーブル(0: 厚手コート+ヒートテック系、1: 冬コート+ニット、2: 薄手コート+ニット、3: 羽織り+長袖、4: 長袖シャツか薄手、5: 半袖)を持つ。小物は降水確率≥50→傘、風速≥8→風よけ、UV≥6→帽子・日焼け止め。`reason`は体感温度と最も効いた要因を1文で。文言の細部は実装者の裁量
- [ ] **Step 4: 通過を確認** — 同コマンド → PASS
- [ ] **Step 5: コミット** — `git init` 後に `git add lib/outfit.js tests/outfit.test.mjs && git commit -m "feat: outfit decision logic"`

### Task 2: 予報の取得と整形

**Files:**
- Create: `lib/forecast.js`, `tests/forecast.test.mjs`

**Interfaces:**
- Consumes: Task 1の`Slot`型
- Produces:
  - `DEFAULT_SLOTS = { 朝:[7,9], 昼:[12,15], 夜:[18,22] }`
  - `buildDays(api: object, slotsConfig = DEFAULT_SLOTS, now: Date = new Date()): Day[]`
  - `fetchForecast(lat: number, lon: number, fetchFn = fetch): Promise<Day[]>`(失敗時は例外)
  - `geocode(name: string, fetchFn = fetch): Promise<{name:string, lat:number, lon:number}[]>`(0件は`[]`)

- [ ] **Step 1: 失敗するテストを書く** — 小さなOpen-Meteo形式のフィクスチャ(2日分のhourly: `time`は`"2026-11-17T07:00"`形式、`temperature_2m`, `apparent_temperature`, `precipitation_probability`, `wind_speed_10m`, `uv_index`、daily: `time`, `weather_code`, `temperature_2m_max/min`)をテスト内に置く
  - 朝(7〜9時、両端含む)の`tempC`が7,8,9時の平均になる
  - 1日目の`slots.map(s=>s.label)`が `['朝','昼','夜']`、`tMin/tMax/weatherCode`がdailyの値
  - `precipitation_probability` の一部がnullでも、nullを除いた平均になる。全部nullなら`precipProb===null`
  - `now`が2026-11-17 10:00なら、同日の朝は`isPast:true`、夜は`false`
  - `fetchForecast`: モックfetchが`ok:false`なら例外、呼ばれたURLに`forecast_days=7`と`timezone=auto`と`wind_speed_unit=ms`が含まれる
  - `geocode`: `results`なしの応答で`[]`、あれば`{name,lat,lon}`の配列(`latitude/longitude`から変換)
- [ ] **Step 2: 失敗を確認** — `node --test tests/forecast.test.mjs`
- [ ] **Step 3: 実装** — 日付プレフィックスでhourlyをグループ化→時間帯の範囲で平均。URLには`hourly=temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,uv_index`と`daily=weather_code,temperature_2m_max,temperature_2m_min`を指定
- [ ] **Step 4: 通過を確認**
- [ ] **Step 5: コミット** — `feat: forecast fetching and slot aggregation`

### Task 3: 設定と予報キャッシュの保存

**Files:**
- Create: `lib/store.js`, `tests/store.test.mjs`

**Interfaces:**
- Consumes: Task 2の`DEFAULT_SLOTS`、`Day`型
- Produces:
  - `DEFAULT_SETTINGS = { place:{name:'東京',lat:35.6895,lon:139.6917}, sensitivity:'hot', slots: DEFAULT_SLOTS }`
  - `loadSettings(storage): Settings`、`saveSettings(storage, settings): Settings`(検証後の値を返す)
  - `loadCache(storage): {days: Day[], savedAt: string, place: Place} | null`、`saveCache(storage, days, place, now = new Date())`
  - `storage`は`getItem/setItem`を持つオブジェクト(テストではMap製の偽物)

- [ ] **Step 1: 失敗するテストを書く**
  - 空のstorageで`loadSettings`が`DEFAULT_SETTINGS`と深く等しい
  - 壊れたJSON(`'{oops'`)が入っていても`loadSettings`が`DEFAULT_SETTINGS`を返し例外を投げない
  - `saveSettings`後に`loadSettings`で同じ値が戻る。`sensitivity:'xxx'`は`'hot'`に補正される
  - `slots`の`朝:[9,7]`(開始≥終了)を保存すると、`朝`だけ既定値`[7,9]`に戻る
  - `setItem`が例外を投げるstorageでも`saveSettings`/`saveCache`が例外を投げない
  - `saveCache`→`loadCache`で`days`と`place`と`savedAt`(ISO文字列)が戻る。未保存なら`null`
- [ ] **Step 2: 失敗を確認** — `node --test tests/store.test.mjs`
- [ ] **Step 3: 実装** — キーは`wo.settings` / `wo.cache`。読み込み時に型を検証して欠けた項目は既定値で補う
- [ ] **Step 4: 通過を確認**
- [ ] **Step 5: コミット** — `feat: settings and forecast cache store`

### Task 4: 画面(描画関数とDOM接続)

**Files:**
- Create: `lib/render.js`, `tests/render.test.mjs`, `index.html`, `style.css`, `app.js`

**Interfaces:**
- Consumes: Task 1の`suggest`/`summarize`、Task 2の`fetchForecast`/`geocode`/`Day`、Task 3の`loadSettings/saveSettings/loadCache/saveCache`
- Produces: `renderTabs(days: Day[], selectedIndex: number): string`、`renderDay(day: Day, sensitivity: Sensitivity): string`、`renderBanner(kind: 'cached'|'error'|'none', info?: string): string`、`weatherIcon(code: number): string`(WMOコード→絵文字)

- [ ] **Step 1: 失敗するテストを書く(`tests/render.test.mjs`)**
  - `renderTabs`: 7日分のフィクスチャで`data-index="0"`〜`"6"`が出て、選択中だけ`aria-selected="true"`、各タブに「8〜17℃」形式の気温幅と`weatherIcon`の絵文字が入る
  - `renderDay`: 「朝」「昼」「夜」と1日のまとめ(`summarize`の結果)を含む。`isPast:true`のSlotは`class="slot past"`、欠測Slotは「−」と「データなし」を含む
  - `renderBanner('cached','2026-11-16T09:00:00.000Z')`は「保存した予報です」を含み、`'none'`は空文字
  - `weatherIcon(0)`は☀、`weatherIcon(61)`は☂、未知コードは空でない既定の絵文字
- [ ] **Step 2: 失敗を確認** — `node --test tests/render.test.mjs`
- [ ] **Step 3: `lib/render.js` を実装** — 純関数。ユーザー入力(都市名)を埋め込む箇所はHTMLエスケープする
- [ ] **Step 4: 通過を確認**
- [ ] **Step 5: `index.html` / `style.css` / `app.js` を実装** — `app.js`は起動時に`loadSettings`→`fetchForecast`、成功なら`saveCache`、失敗なら`loadCache`の保存分+`renderBanner('cached')`、保存もなければ`renderBanner('error')`。タブのクリックで`renderDay`を差し替える。設定ダイアログに場所(都市名検索→候補選択、現在地ボタン=`navigator.geolocation`)、寒がり度、時間帯を置く。検索0件・失敗は設定済みの場所を変えずメッセージのみ。現在地が拒否されたら同様にメッセージのみ。`<meta name="viewport">`と`theme-color`を入れる
- [ ] **Step 6: 手動確認** — `cd /home/claude/weather-outfit && python3 -m http.server 8000` でブラウザを開き、7タブの切替、朝昼夜の表示、寒がり度変更で提案が変わること、機内モード相当で保存分が出ることを確認
- [ ] **Step 7: コミット** — `feat: UI rendering and app wiring`

### Task 5: PWA化

**Files:**
- Create: `manifest.webmanifest`, `sw.js`, `icons/icon-192.png`, `icons/icon-512.png`, `tests/pwa.test.mjs`
- Modify: `index.html`(manifest・アイコンのlink、`app.js`にSW登録)

**Interfaces:**
- Consumes: Task 4のファイル一式
- Produces: `sw.js`は`SHELL`配列(キャッシュ対象のパス一覧)をexportではなく先頭の定数で持つ。テストはファイルを読んで検査する

- [ ] **Step 1: 失敗するテストを書く(`tests/pwa.test.mjs`)**
  - `manifest.webmanifest`をJSONとして読み、`name`,`short_name`,`start_url`,`display==='standalone'`,`theme_color`,`background_color`があり、`icons`に192と512のpngが含まれる
  - その`icons`の`src`が実在し、`index.html`が`rel="manifest"`と`rel="apple-touch-icon"`を含む
  - `sw.js`内の`SHELL`の全パスがリポジトリ内に実在し、`index.html`, `app.js`, `style.css`, `lib/*.js`が含まれる
- [ ] **Step 2: 失敗を確認** — `node --test tests/pwa.test.mjs`
- [ ] **Step 3: 実装** — `sw.js`: installで`SHELL`をキャッシュ、アプリ本体はcache-first、`api.open-meteo.com`など別オリジンへのリクエストはSWで扱わない(予報の保存はTask 3のlocalStorage側)。キャッシュ名にバージョンを持ち、activateで古いものを削除。アイコンは単色背景に☀🧥の簡易デザインでよい(生成方法は自由、PNGの実体が必要)
- [ ] **Step 4: 通過を確認**
- [ ] **Step 5: 手動確認** — `localhost:8000`(localhostはHTTPS相当として扱われる)でDevToolsのApplicationタブを開き、Manifest・Service Workerが有効、オフラインで再読み込みしても画面が出ることを確認
- [ ] **Step 6: コミット** — `feat: PWA manifest, service worker, icons`

### Task 6: Cloudflare Pagesへ公開

**Files:**
- Modify: なし(必要なら `README.md` に手順を追記)

**Interfaces:**
- Consumes: Task 5までの静的ファイル一式(ビルド不要、ルートをそのまま公開)

- [ ] **Step 1: 全テスト実行** — `node --test tests/` → すべてPASS
- [ ] **Step 2: 公開** — Pagesプロジェクトを作成しリポジトリのルートを公開ディレクトリにする(ビルドコマンドなし)。方法は、`wrangler pages deploy .`(認証が必要)か、リポジトリ連携のどちらか。認証や接続はユーザーの操作が必要なため、できない場合は手順を提示して止まる
- [ ] **Step 3: 公開後の確認** — 公開URLでHTTPS、予報が表示される、スマホで「ホーム画面に追加」が出ること、追加後にスタンドアロンで起動すること、機内モードで保存分が出ることを確認
- [ ] **Step 4: コミット** — 変更があれば `docs: deployment notes`

---

## Self-Review メモ

- 仕様カバー: 7日タブ(T4)、朝昼夜(T2,T4)、寒がり度(T1,T3)、場所設定(T3,T4)、オフライン(T3,T4,T5)、PWA(T5)、Cloudflare Pages(T6)
- 型の一致: `Slot/Day/Item/Sensitivity` は上の共有定義で統一。`DEFAULT_SLOTS`はT2で定義しT3が参照
- Review Focusの5項目は T2(null平均・isPast)、T3(壊れた保存・時間帯検証)、T4(失敗時表示・検索0件)のテストまたは手動確認で拾っている
