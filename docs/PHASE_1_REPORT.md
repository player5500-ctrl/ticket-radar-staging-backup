# 追票雷達 Ticket Radar — Phase 1 Report

## 1. 階段結果

Phase 1 已完成本機可執行版本：

- pnpm workspace monorepo。
- React + TypeScript strict + Vite + Tailwind CSS PWA。
- Cloudflare Worker + local D1。
- 歌手／團體、別名、活動、場館、城市與平台搜尋。
- 城市、售票狀態、平台與日期範圍篩選。
- 首頁即將登場、追蹤歌手與最近新增。
- 活動詳情、官方來源警語與多階段售票時間軸。
- 歌手追蹤與活動收藏實際寫入 D1。
- 本機 Demo 身分；Production 明確禁用。

本階段沒有建立 Extension、購票任務、提醒、截圖或管理後台空殼。

## 2. 實際資料流

```text
React PWA
→ typed API client
→ Hono route
→ Zod validation / Demo auth / CORS
→ EventService
→ D1EventRepository
→ Wrangler local D1
```

搜尋、活動詳情、收藏與追蹤都透過 Worker API，不在前端內嵌活動假資料。

## 3. D1

已建立並實際套用：

- `0001_core_catalog.sql`
  - `users`
  - `artists`
  - `artist_aliases`
  - `venues`
  - `ticket_platforms`
  - `events`
  - `event_artists`
  - `ticket_sale_windows`
- `0002_user_tracking.sql`
  - `user_artist_follows`
  - `user_event_favorites`

Seed 包含：

- 2 個純本機 Demo 使用者。
- 3 位／組虛構歌手。
- 英文、日文、韓文別名。
- 2 個虛構場館與城市。
- Demo 平台，以及 disabled 的 KKTIX／TixCraft 平台資料。
- 3 個虛構活動與 6 個售票時間窗。
- 初始追蹤與收藏。

所有 Seed Email 使用 `.invalid`，活動來源使用 `example.com`，不含真實個資、帳號或購票資料。

## 4. 安全限制

- Demo 身分只在 `ALLOW_DEMO_AUTH=true` 且非 Production 時生效。
- Production 不接受 `X-Demo-User-Id`。
- Worker CORS 只接受設定的單一 origin。
- 所有動態 SQL 值使用 D1 binding。
- 搜尋字串會做 NFKC 正規化並跳脫 SQLite LIKE 萬用字元。
- API 驗證錯誤不回傳 stack、SQL 或輸入內容。
- Worker log 只記錄 request id 與穩定 error code。
- KKTIX／TixCraft 仍為 disabled，沒有 selector 或自動化程式。
- PWA 明確顯示官方資料警語與禁止自動購票原則。

## 5. 測試結果

### 完整品質命令

```text
pnpm check
```

結果：

- Prettier check：通過。
- ESLint：通過，0 warnings。
- TypeScript strict：5 個 workspace package 通過。
- Vitest：5 個測試檔、13 個測試通過。
- Shared／UI declaration build：通過。
- PWA build：通過。
- Worker Vite bundle：通過。
- Wrangler `deploy --dry-run --no-bundle`：通過，沒有部署。

### PWA build 證據

- 122 modules transformed。
- Route lazy loading：
  - `SearchPage` 獨立 chunk。
  - `EventDetailPage` 獨立 chunk。
- `manifest.webmanifest` 已產生。
- `sw.js` 與 Workbox 已產生。
- 10 個項目進入 PWA precache。

### D1

```text
pnpm db:setup:local
```

- 2 版 migration 已套用。
- Seed 的 11 段 SQL 全部成功。
- 再次執行 migration 顯示沒有待套用項目。

### Playwright E2E

```text
pnpm test:e2e
```

手機 Chromium：

1. 首頁警語與即將登場活動：通過。
2. 韓文別名搜尋、活動詳情與抽選時間軸：通過。
3. 收藏寫入 D1 並取消：通過。

桌面 Chromium：

1. 首頁警語與即將登場活動：通過。
2. 韓文別名搜尋、活動詳情與抽選時間軸：通過。
3. 收藏寫入 D1 並取消：通過。

總計 6／6 通過。

## 6. 畫面檢查

Playwright 成功畫面：

- `output/playwright/phase1-home-mobile-chromium.png`
- `output/playwright/phase1-home-desktop-chromium.png`
- `output/playwright/phase1-event-mobile-chromium.png`
- `output/playwright/phase1-event-desktop-chromium.png`

已人工查看手機首頁與桌面活動詳情：

- 沒有水平溢位。
- 觸控控制至少 44px。
- 狀態同時使用文字、圓點與顏色。
- 官方警語可見。
- 禁用的 Phase 2–4 導覽以不可操作狀態呈現，不是空按鈕。
- 手機 Hero 字級已依實際截圖收斂。
- 桌面售票時間軸、收藏面板及資料來源層級正常。

完整頁截圖中的浮動底部導覽會出現在第一個 viewport 底部，這是 Playwright full-page 截圖對 `position: fixed` 元件的呈現，不是頁面中段的實際定位。

## 7. 本機啟動

```bash
pnpm install
pnpm db:setup:local
pnpm dev
```

- PWA：`http://127.0.0.1:5173`
- API health：`http://127.0.0.1:8787/health`

## 8. 已知限制

- 尚未選定正式身分提供端；Demo auth 不可用於 Production。
- 尚未建立正式 Cloudflare D1，`database_id` 是全零 placeholder。
- 尚未部署 Cloudflare。
- PWA CSP 為了 Vite 本機樣式暫時允許 inline style；正式上線前需改成 hash／nonce 或確認完全不需要。
- Service worker 的 API runtime cache 目前只指向本機 `127.0.0.1`。
- 活動資料全為 Seed Demo，不代表真實演出公告。
- 提醒、ICS、購票任務與購票資料組屬 Phase 2。
- Extension 與 Generic Demo Adapter 屬 Phase 3。

## 9. 主要新增檔案

```text
ticket-radar/
├─ README.md
├─ package.json
├─ pnpm-lock.yaml
├─ pnpm-workspace.yaml
├─ eslint.config.mjs
├─ prettier.config.mjs
├─ playwright.config.ts
├─ tsconfig.json
├─ tsconfig.base.json
├─ apps/web/
├─ packages/config/
├─ packages/shared/
├─ packages/ui/
├─ workers/api/
│  ├─ migrations/0001_core_catalog.sql
│  ├─ migrations/0002_user_tracking.sql
│  └─ seeds/seed.sql
├─ tests/e2e/
└─ docs/PHASE_1_REPORT.md
```

## 10. Git 狀態

外層工作區尚無任何 commit；`ticket-radar/` 仍為新增未追蹤專案。本階段未 stage、commit、push 或部署，也未修改其他既有專案。

建議 Phase 1 commit 訊息：

```text
feat(ticket-radar): build phase 1 PWA search and D1 event catalog
```

## 11. 下一階段

Phase 2 才會加入：

- 購票任務。
- 準備度與檢查清單。
- 售票提醒。
- ICS 匯出。
- 購票資料組的 PWA 說明與 Extension 連線入口。

進入 Phase 2 前需再次確認目前 Git 狀態與 Phase 1 測試基線。
