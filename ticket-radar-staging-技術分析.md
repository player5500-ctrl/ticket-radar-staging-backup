# 追票雷達 Ticket Radar — Staging 網站技術分析

分析對象：https://ticket-radar-web-staging.pages.dev/
分析日期：2026-08-01

## 基本資訊

- 網站名稱：追票雷達 Ticket Radar（manifest 內定義）
- 用途描述（來自 manifest）：「合法合規的演唱會與活動購票準備助手」
- 語系：zh-TW
- 需要登入才能使用主要功能（購票準備功能），目前測試時顯示「登入 Session 已失效」

## 技術棧

- 前端框架：React（頁面掛載於 `#root`，偵測到 React container）
- 建置工具：Vite（資源檔名為 hash 模式 `index-Br1kMd0f.js`，符合 Vite 預設輸出）
- 路由：Client-side routing，偵測到 5 條路徑：`/`、`/search`、`/tasks`、`/battle`、`/records`
- PWA：有 `manifest.webmanifest`（standalone 模式、深色主題 `#07111f`）+ Service Worker 已註冊，代表可安裝為獨立 App
- 部署平台：Cloudflare Pages（`*.pages.dev` staging 網域）

## 頁面結構（底部導覽列）

1. 首頁
2. 搜尋
3. 任務
4. 作戰
5. 紀錄

推測這是一個協助使用者「追蹤、準備、搶購」演唱會或活動門票的工具：任務＝追蹤中的活動、作戰＝開賣搶票操作、紀錄＝歷史記錄。

## UI 風格

深色科幻／電馭風格（neon cyberpunk），青色＋粉色霓虹配色，符合品牌「雷達」意象。

## 限制與備註

- 因需登入才能看到完整功能頁面，本次分析僅涵蓋未登入狀態下可見的公開資訊（首頁、導覽結構、manifest、技術棧偵測），未進入 `/search`、`/tasks`、`/battle`、`/records` 的實際功能畫面。
- 未偵測到明顯的第三方分析工具屬於此網站本身；瀏覽過程中出現的 `log.felo.me`、`chrome-extension://...` 請求經確認來自本機瀏覽器擴充功能，與此網站無關。
