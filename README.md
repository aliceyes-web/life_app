# 生活小幫手（PWA）

首頁總覽、天氣、行事曆、記事、手機條碼載具、色系設定。純 HTML / CSS / JavaScript，不需要編譯，丟到任何 HTTPS 靜態網站空間就能用。

## 功能

| 頁面 | 內容 | 資料來源 |
|---|---|---|
| 首頁 | 問候、今天日期、農曆、節氣、上班日／假日、天氣、今日行程、最近記事 | 本機 |
| 天氣 | 目前天氣、逐時預報、7 天預報、濕度、紫外線、AQI、日出日落、帶傘提醒；可選縣市或用目前位置 | Open-Meteo（免金鑰） |
| 行事曆 | 月曆格子內直接顯示當天行程與假日、節氣、新增／編輯行程；可連結 Google 日曆（唯讀） | 本機 + Google Calendar API |
| 記事 | 分類、搜尋、置頂、自動儲存 | 本機 |
| 載具 | Code 39 手機條碼、全螢幕顯示、螢幕不休眠 | 本機 |
| 設定 | 5 種主題色 × 3 種背景色調、跟隨系統深色模式、備份匯出／匯入 | 本機 |

所有資料存在手機瀏覽器的 localStorage，不會上傳。換手機前請到「設定 › 資料備份」匯出。

## 本機試用

```bash
cd life-helper
python3 -m http.server 8080
# 開 http://localhost:8080
```

## 部署（以 GitHub Pages 為例）

1. 在 GitHub 建一個 repository，把整個資料夾的檔案推上去。
2. Repository › Settings › Pages › Source 選 `main` 分支、根目錄 `/`。
3. 幾分鐘後會得到 `https://<帳號>.github.io/<repo>/`。
4. 用手機開這個網址：
   - iPhone（Safari）：分享 › 加入主畫面
   - Android（Chrome）：選單 › 安裝應用程式

Netlify、Cloudflare Pages 也可以，直接拖曳資料夾上傳即可。PWA 必須在 HTTPS 下才能安裝。

## 連結 Google 日曆（選用）

1. 到 [Google Cloud Console](https://console.cloud.google.com/) 建立專案。
2. 「API 和服務 › 程式庫」啟用 **Google Calendar API**。
3. 「OAuth 同意畫面」：使用者類型選「外部」，把自己的 Google 帳號加到「測試使用者」。
4. 「憑證 › 建立憑證 › OAuth 用戶端 ID」，類型選「網頁應用程式」，在「已授權的 JavaScript 來源」填入部署網址的來源（例如 `https://<帳號>.github.io`）。
5. 把用戶端 ID 貼到 APP 的「設定 › Google 日曆」，再按「連結」。

APP 只要求 `calendar.readonly` 權限，只讀取主要日曆。Google 的授權約 1 小時過期，過期後在行事曆按「同步 Google 日曆」即可重新取得；沒有網路時會顯示上次同步的內容。

## 維護

- **放假日**：在 `js/almanac.js` 的 `HOLIDAYS` 新增。人事行政總處每年 6 月左右公布隔年辦公日曆表，目前收錄 2026、2027 年。若有補班日，加到 `MAKEUP_WORKDAYS`。
- **更新後讓手機抓到新版**：改 `sw.js` 裡的 `VERSION`。
- **農曆與節氣**：`vendor/lunar.js`（[6tail/lunar-javascript](https://github.com/6tail/lunar-javascript)，MIT 授權）。

## 檔案結構

```
index.html            入口
manifest.webmanifest  PWA 設定
sw.js                 離線快取
css/app.css           樣式與主題色變數
js/app.js             路由與底部導覽
js/store.js           本機資料
js/theme.js           主題色與深色模式
js/almanac.js         農曆、節氣、放假日
js/weather.js         Open-Meteo 天氣
js/gcal.js            Google 日曆
js/barcode.js         Code 39 條碼
js/pages/*.js         各頁面（首頁、天氣、行事曆、記事、載具、設定）
vendor/lunar.js       農曆函式庫
icons/                APP 圖示
```
