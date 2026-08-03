# 追票雷達 Ticket Radar — Staging 上線前實話盤點

稽核日期：2026-07-30
稽核方式：直接讀取程式碼（非只讀文件），逐一核對 `docs/FINAL_DELIVERY.md`（2026-07-29）與 `docs/staging-deployment.md`（2026-07-30）的宣稱是否與實際程式碼一致。

---

## 1. 專案實際結構

實際掃描到的目錄樹（已排除 `node_modules`、`dist`、`.wrangler`、`test-results`、`playwright-report*`、`output`、`node_modules-isolated-failed-20260729`）：

```
18_ticket-radar/
├─ .env.example
├─ README.md, package.json, pnpm-workspace.yaml
├─ playwright.config.ts, playwright.running-servers.config.ts, playwright.staging.config.ts
├─ apps/
│  ├─ web/src/
│  │  ├─ app/            queryClient.ts, router.tsx
│  │  ├─ components/      AdminGuard.tsx, AppLayout.tsx, EventCard.tsx, SearchBar.tsx …
│  │  ├─ pages/           HomePage, SearchPage, EventDetailPage, TasksPage, RecordsPage,
│  │  │                   DemoTicketPage, AdminPage, NotFoundPage
│  │  ├─ services/        api.ts（fetch API client）、ics.ts（前端 ICS 產生）
│  │  └─ utils/status.ts
│  └─ extension/src/      background.ts, content.ts, popup.ts, capture.ts, crypto.ts, storage.ts
│     └─ public/manifest.json
├─ workers/api/
│  ├─ src/                app.ts, auth.ts, env.ts, http.ts, index.ts, rate-limit.ts
│  │  ├─ repositories/    event / ticket-task / purchase / admin repository（全部 D1 SQL）
│  │  └─ services/        event.service.ts, ticket-task.service.ts
│  ├─ migrations/         0001~0007（見第 7 節）
│  ├─ seeds/seed.sql
│  └─ wrangler.toml
├─ packages/
│  ├─ shared/src/         domain.ts, admin.ts, ticket-task.ts, purchase-record.ts, search.ts, time.ts
│  ├─ platform-adapters/src/ generic-demo/, kktix/, tixcraft/, disabled-adapter.ts, types.ts
│  ├─ ui/src/
│  └─ config/
├─ docs/                  ARCHITECTURE / DATABASE / SECURITY / PRODUCT_SPEC / TEST_PLAN /
│                          PLATFORM_ADAPTERS / PHASE_0~6_REPORT / staging-deployment / FINAL_DELIVERY
└─ tests/
   ├─ e2e/phase1-search-and-event.spec.ts（本機全流程）
   └─ staging/public-smoke.spec.ts（Staging 公開頁面 smoke test）
```

分層符合文件描述：PWA（React + Vite + React Router + TanStack Query）→ Cloudflare Worker（Hono）→ D1；Extension 與 Web/Worker 完全分離。`packages/shared` 只有型別與 Zod schema，`platform-adapters` 只有 DOM 偵測/填入邏輯，沒有 D1 或 Cloudflare binding 依賴，符合 `docs/ARCHITECTURE.md` 第 4.1 節宣稱。

---

## 2. 已完成的真實功能（有實際 D1 / 真實邏輯佐證）

| 功能 | 佐證程式碼 |
|---|---|
| 活動搜尋／首頁／詳情 | `workers/api/src/repositories/event.repository.ts:212-452`，真實 SQL（`LIKE`、JOIN venues/artists/ticket_platforms），非記憶體假資料 |
| 收藏活動／追蹤歌手 | `workers/api/src/repositories/event.repository.ts:454-504`，寫入 `user_event_favorites`／`user_artist_follows` 表（migration `0002_user_tracking.sql`） |
| 購票任務 CRUD＋準備清單 | `workers/api/src/repositories/ticket-task.repository.ts:106-234`，`ticket_tasks`／`ticket_task_checklists` 表，`createTask` 會用 `db.batch()` 一次寫入任務與 9 項預設清單（第 153-178 行） |
| 提醒建立／列表 | `workers/api/src/repositories/ticket-task.repository.ts:235-294`，`reminders` 表，含 idempotency key 防重複（第 263-268 行） |
| 遮罩後購票紀錄 | `workers/api/src/repositories/purchase.repository.ts:1-78`，`purchase_records` 表，含 SHA-256 去重雜湊（第 36-45 行） |
| 管理摘要／稽核紀錄／活動確認 | `workers/api/src/repositories/admin.repository.ts:11-153`，`audit_logs`／`platform_adapter_versions` 表，`setEventVerified` 用 `db.batch()` 同時寫入事件狀態與 audit log（第 70-91 行） |
| Cloudflare Access JWT 驗證 | `workers/api/src/auth.ts:28-51`，用 `hono/utils/jwt` 的 `Jwt.verifyWithJwks` 對 `https://{ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs` 驗簽，檢查 `aud`／`iss`／`exp`／`nbf`／`iat` |
| 角色判斷（user/admin） | `workers/api/src/auth.ts:193-209`（`requireAdminId`）重新查 D1 `users.role`／`status`，非只信任 JWT payload |
| Rate limit | `workers/api/src/rate-limit.ts:22-62`，真實寫入 `rate_limit_windows` 表計數，`ENVIRONMENT==="development"` 才略過（第 26 行） |
| CORS／CSRF Origin 檢查 | `workers/api/src/app.ts:46-90`，非開發環境下 mutation 請求 Origin 不符會回 `CSRF_ORIGIN_DENIED` |
| Extension 只認 Demo 頁 | `apps/extension/src/background.ts:18-29` 白名單只允許 `http://127.0.0.1:5173` 與 `https://ticket-radar-web-staging.pages.dev` |
| KKTIX／tixCraft 停用（非模擬，是真的被關閉） | `packages/platform-adapters/src/disabled-adapter.ts:36-70`：`fillProfile()` 回傳空陣列、`detectPage()`／`detectSuccess()` 恆為 `false`，`kktix/adapter.ts`、`tixcraft/adapter.ts` 都呼叫 `createDisabledEvaluationAdapter` |
| Staging D1／Access 已真的建立 | `workers/api/wrangler.toml:19-34`：`env.staging` 有真實 `database_id = "4cca7519-2ad0-45e6-91d5-156e11098782"`、真實 `ACCESS_TEAM_DOMAIN = "royal-hall-5179.cloudflareaccess.com"`、真實 `ACCESS_AUD` |

**結論**：使用者這輪回報「Cloudflare Access session 通過、一般使用者登入成功、role=user、admin API 回 ADMIN_REQUIRED」與程式碼邏輯完全吻合（見第 6 節逐行對照）。

---

## 3. 模擬功能（mock／寫死資料／localStorage）

| 項目 | 佐證 | 說明 |
|---|---|---|
| 活動／歌手／場館目錄內容 | `workers/api/seeds/seed.sql:1-60` | 表結構是真 D1，但**內容**是虛構 Demo 資料（夜航星、晨光訊號、林澄音、星際航線、破曉代碼等），且目前**沒有任何 admin API 可以新增/編輯活動或歌手**（`app.ts` 只有 `PATCH /api/v1/admin/events/:eventId/verification` 可切換已確認狀態，找不到 `POST /api/v1/admin/events` 或類似建立端點）。要上真實票務資料只能靠人工下 SQL 或改 seed。 |
| Demo Header 登入 | `apps/web/src/services/api.ts:22-26, 60`：`import.meta.env.DEV` 為真時固定送 `X-Demo-User-Id: user-demo` | 純前端 dev-only 便利設計；伺服器端由 `auth.ts:142-144` 二次把關（`ENVIRONMENT==="development" && ALLOW_DEMO_AUTH==="true"`），staging build 不會觸發（見第 9 節風險） |
| AdminGuard 前端繞過 | `apps/web/src/components/AdminGuard.tsx:15`：`if (import.meta.env.DEV) return children;` | 只在本機開發模式跳過角色檢查；Staging build（`import.meta.env.DEV=false`）會走 `session.data?.user.role !== "admin"` 真實判斷（第 17 行） |
| `admin-demo` 假身分字串 | `apps/web/src/services/api.ts:129-140`：`adminOverview`／`setAdminEventVerified` 傳入字面字串 `"admin-demo"` 作為 `demoUserId` | 只有 `import.meta.env.DEV` 為真時才會實際被送出（`request()` 第 60 行判斷），staging 正式建置下這個字串是死碼、不影響行為，但屬程式碼殘留，建議清除 |
| Web Push／Email／LINE 提醒管道 | `workers/api/migrations/0003_ticket_tasks_and_reminders.sql:42`：`reminders.channel` 允許 `'web_push'／'email'／'line'`；`docs/ARCHITECTURE.md:207-213` 宣稱有 Mock Email provider／Disabled LINE provider | 實際 `workers/api/src` 內找不到任何 cron trigger（`wrangler.toml` 無 `[triggers]`）、找不到 email/line/push provider 檔案，前端 `apps/web/src` 也 grep 不到 `Notification`／`pushManager`／`VAPID` 任何字樣。這些 channel 目前**只是資料表列舉值**，沒有實際發送邏輯，真正會動作的只有前端 `apps/web/src/services/ics.ts` 產生 `.ics` 檔下載（channel 固定用 `"ics"`，見 `EventDetailPage.tsx:56-63`） |

---

## 4. 尚未接通的功能

| 功能 | 現況佐證 |
|---|---|
| `notification_logs`、`user_reports` 資料表 | `workers/api/migrations/0005_admin_reporting_and_audit.sql:16-39` 建表，但全專案 `grep -r "notification_logs\|user_reports" workers/api/src` 只找到 `admin.repository.ts:22,25` 的 `COUNT(*)` 讀取，**沒有任何寫入路徑**（無 `INSERT INTO notification_logs`、無 `POST /api/v1/reports` 路由）。這兩張表在目前程式碼下永遠是空的，管理後台顯示的「通知失敗」「待處理回報」數字會恆為 0，不代表系統真的在運作。 |
| `/me/export`、`/me/data`、`/me/account`、`/calendar/ics` API | `docs/ARCHITECTURE.md:169-188` 的 API 草案列出這些端點，但 `workers/api/src/app.ts` 實際只註冊了 `/health`、`/api/v1/home`、`/search`、`/events/:id`（+favorite）、`/artists/:id/follow`、`/ticket-tasks`（+checklist）、`/reminders`、`/purchase-records`、`/admin/overview`、`/admin/events/:id/verification`、`/auth/session`、`/auth/logout` — 共 14 條路由。使用者自助資料匯出／刪除／刪帳號**完全沒有實作**。 |
| CSRF Token | `docs/SECURITY.md:145-149` 與 `docs/ARCHITECTURE.md:194` 宣稱「CSRF token 和 Origin 驗證」，但 `workers/api/src/app.ts:80-82` 只做 Origin 比對（`CSRF_ORIGIN_DENIED`），程式碼中沒有任何 CSRF token 產生／驗證邏輯。 |
| Admin 完整 CRUD | `README.md:225-227`（FINAL_DELIVERY 對應章節）自己承認「管理後台只完成摘要、活動確認、Adapter 狀態與 audit，不是完整 CRUD」——與程式碼一致，`app.ts` 中管理路由確實只有 2 條（overview 讀取＋verification 切換）。 |
| 使用者個人資料是否已真的落地 D1 | `workers/api/src/auth.ts:96-107`：使用者第一次以 Cloudflare Access 登入時會自動 `INSERT INTO users (...)`，角色固定為 `'user'`。使用者本輪回報「購票任務／紀錄目前是空的」——這**不是 mock 或未接通**，而是 `ticket-task.repository.ts:127-137`／`purchase.repository.ts:14-22` 對該 `user_id` 查詢後 D1 真的沒有資料列（因為還沒手動建立任何任務或購票紀錄）。是否真的存進 D1，需使用者實際在 Staging 建立一筆任務／收藏後，於 D1 執行 `SELECT * FROM users WHERE email_normalized=...` 才能百分之百確認，本次稽核只能確認程式碼邏輯正確、無法直接連線該使用者的遠端 Staging D1 驗證資料列。 |

---

## 5. 目前 Staging 網址

依 `workers/api/wrangler.toml:19-34` 與 `docs/staging-deployment.md:6-10, 26-36`：

- **PWA (Cloudflare Pages)**：`ticket-radar-web-staging`（`https://ticket-radar-web-staging.pages.dev`）
- **Worker API**：`ticket-radar-api-staging`（部署指令中使用 `https://ticket-radar-api-staging.vannyai.workers.dev` 作為 `VITE_API_BASE_URL`，見 `staging-deployment.md:34`）
- **D1**：`ticket-radar-db-staging`，`database_id = 4cca7519-2ad0-45e6-91d5-156e11098782`（`wrangler.toml:32-33`，非全零 placeholder，是真實建立的資料庫）
- **Cloudflare Access team domain**：`royal-hall-5179.cloudflareaccess.com`（`wrangler.toml:27`）

對照：**Production** 環境（`wrangler.toml:36-50`）`database_id` 仍是 `00000000-0000-0000-0000-000000000000` 全零 placeholder，`CORS_ORIGIN = "https://replace-with-production-domain.invalid"`，證實 Production 尚未部署，只有 Staging 是真的。

---

## 6. 登入與權限架構

**流程（`workers/api/src/auth.ts`）：**

1. `resolveAccessUser()`（第 28-134 行）從 Header `Cf-Access-Jwt-Assertion` 取出 JWT（第 31 行）。
2. 用 `Jwt.verifyWithJwks(token, { jwks_uri: "https://{team}/cdn-cgi/access/certs", allowedAlgorithms: ["RS256"], verification: { aud, iss, exp, nbf, iat } })` 驗簽（第 38-48 行）——這是對 Cloudflare Access 公開 JWKS 做的**真實**簽章驗證，不是假驗證。
3. 驗證通過後檢查 payload 是否有合法 `sub`／`email`（`isAccessClaims`，第 19-26 行）。
4. 先查 `user_auth_identities`（`provider='cloudflare_access' AND subject=?`）JOIN `users`，若找到且 `status==='active'` 就回傳該使用者（角色取自 D1 的 `users.role`，第 71-79 行）。
5. 若是第一次登入，改用 email 比對既有 `users`；仍找不到就自動建立新使用者，**角色固定寫死 `'user'`**（第 100-103 行）：
   ```sql
   INSERT INTO users (...,role,...) VALUES (?,?,?,'user',...)
   ```
   → **代表沒有任何自助升級為 admin 的路徑**，admin 帳號必須由人工直接在 D1 執行 UPDATE 才能產生。
6. `getOptionalUser()`（第 136-175 行）：只有 `ENVIRONMENT==="development" && ALLOW_DEMO_AUTH==="true"` 才會改用 Demo Header 登入；否則一律走 Cloudflare Access 流程。
7. `requireAdminId()`（第 193-209 行）：先呼叫 `requireUserId()` 拿到已登入 user id，接著**重新查一次 D1** `SELECT role,status FROM users WHERE id=?`，`role !== 'admin' || status !== 'active'` 就回 `403 ADMIN_REQUIRED`——這與使用者本輪回報「呼叫管理 API 回 ADMIN_REQUIRED」完全一致，是伺服器端真實判斷，不是前端假造。

**前端**：`apps/web/src/components/AdminGuard.tsx:8-19` 呼叫 `GET /api/v1/auth/session` 取得 `session.data.user.role`，非 admin 導回首頁（`<Navigate to="/" replace />`，第 17 行）——與使用者回報「一般使用者開 `/admin` 被導回首頁」一致。**但這只是 UX 層防呆**，真正的存取控制是 `requireAdminId`（伺服器端），前端守衛被繞過也不會洩漏資料。

---

## 7. D1 資料流（實際 schema 與 repository 讀寫路徑）

| Migration | 主要表 | 讀寫路徑 |
|---|---|---|
| `0001_core_catalog.sql` | `users`、`artists`、`artist_aliases`、`venues`、`ticket_platforms`、`events`、`event_artists`、`ticket_sale_windows` | `event.repository.ts` 全部 SQL 查詢（search／home／findById） |
| `0002_user_tracking.sql` | `user_artist_follows`、`user_event_favorites` | `event.repository.ts:454-504`（favorite/unfavorite/followArtist/unfollowArtist） |
| `0003_ticket_tasks_and_reminders.sql` | `ticket_tasks`、`ticket_task_checklists`、`reminders` | `ticket-task.repository.ts` 全檔 |
| `0004_purchase_records.sql` | `purchase_records` | `purchase.repository.ts` 全檔 |
| `0005_admin_reporting_and_audit.sql` | `platform_adapter_versions`、`notification_logs`（只讀，無寫入）、`user_reports`（只讀，無寫入）、`audit_logs` | `admin.repository.ts` |
| `0006_cloudflare_access_auth.sql` | `user_auth_identities` | `auth.ts:55-125` |
| `0007_rate_limiting.sql` | `rate_limit_windows` | `rate-limit.ts:37-52` |

購票任務 (`ticket_tasks`) 欄位：`id, user_id, event_id, status, budget_twd, max_ticket_count, acceptable_sessions_json, area_preferences_json, notes, created_at_utc, updated_at_utc, deleted_at_utc`，`UNIQUE(user_id, event_id)`（每人每活動只能有一個任務）。

購票紀錄 (`purchase_records`) 欄位：`id, user_id, event_id, ticket_platform_id, order_reference_masked, order_dedupe_hash, session_label, seat_or_area_masked, ticket_count, order_created_at_utc, order_status, pickup_status, screenshot_filename, notes, source, ...`，`source` 欄位 CHECK 限制只能是 `'extension_demo'／'extension_adapter'／'manual'`（`0004` 第 18 行），確保紀錄來源可追溯。

提醒 (`reminders`) 欄位含 `channel CHECK IN ('web_push','ics','email','line')`，但如第 3、4 節所述，實際只有 `ics` 有前端消費邏輯。

---

## 8. Extension 與 PWA 的連線方式

`apps/extension/public/manifest.json`：

```json
"permissions": ["storage", "activeTab", "scripting", "downloads"],
"host_permissions": [
  "http://127.0.0.1:5173/*",
  "https://ticket-radar-web-staging.pages.dev/*"
],
"content_scripts": [{
  "matches": ["http://127.0.0.1:5173/*", "https://ticket-radar-web-staging.pages.dev/*"],
  "js": ["content.js"], "run_at": "document_idle"
}]
```

- 沒有 `<all_urls>`，也沒有 `kktix.com`／`tixcraft.com` 的 host_permissions，證實 Extension 目前**實體上無法**注入這兩個真實售票網站（即使 adapter 程式碼存在，瀏覽器層級也不會授權腳本執行）。
- `background.ts:18-21` 再做一次白名單檢查（同兩個 origin），雙重防呆。
- popup（`popup.ts`）→ `crypto.ts`（PIN + Web Crypto 加密）→ `storage.ts`（`chrome.storage.local`，只存加密 envelope，`storage.ts:7-13`）；填入操作透過 `chrome.runtime.sendMessage({type:"ticket-radar:fill-demo"})` → `background.ts` 轉發給 `content.ts` → `packages/platform-adapters` 的 `fillDemoProfile()`（`generic-demo/adapter.ts:73-89`）。
- 截圖流程：`background.ts:54-93` 先要求 content script 遮罩敏感區塊確認可靠（`prepare-capture`），成功才 `chrome.tabs.captureVisibleTab()` 並 `chrome.downloads.download()` 存本機，**不上傳原圖**；只有使用者在 Web 端 `DemoTicketPage.tsx:39` 手動點擊才會呼叫 `api.createPurchaseRecord()` 把遮罩後中繼資料寫進 D1（PWA 與 Extension 之間沒有直接連線，是透過使用者操作分別各自呼叫）。
- PWA 對 Worker 的連線：`apps/web/src/services/api.ts:19-20` 用 `VITE_API_BASE_URL`（build 時注入），`credentials: "include"` 讓 Cloudflare Access cookie／session 隨請求送出。

---

## 9. 主要風險

1. **Root `wrangler.toml` 預設值危險，只是目前沒被用在 Staging**：`workers/api/wrangler.toml:5-9` 頂層 `[vars]` 仍是 `ALLOW_DEMO_AUTH="true"`、`ENVIRONMENT="development"`。因為 `auth.ts:142-144` 要求兩個條件同時成立才會啟用 Demo 登入，且 `env.staging`／`env.production` 都覆寫成 `false`，所以目前 Staging／Production 安全。但如果未來有人執行 `wrangler deploy`（沒帶 `--env`）就會把這組危險預設值部署出去——建議把頂層預設也改成安全值，只在本機 `.dev.vars`／本機專用設定放開。
2. **Production D1 仍是全零 placeholder**：`wrangler.toml:50`，代表 Production 完全沒有建立，若誤用 `wrangler deploy --env production` 會直接失敗或指向不存在的資料庫，需人工建立後才可用。
3. **Admin 升級沒有自助流程**：`auth.ts:100-103` 新使用者一律 `role='user'`，唯一升級 admin 的方式是人工直接對 D1 執行 UPDATE，本次稽核未看到任何 script／migration 自動指定哪個 email 是 admin——上線前要確認「誰是第一個 admin」這件事有沒有人工執行過、執行在哪個環境。
4. **管理後台的「通知失敗」「待處理回報」永遠顯示 0**（見第 4 節），容易讓管理員誤以為系統健康，但實際上是這兩張表根本沒有寫入路徑，是死碼閱讀，不是「目前沒有異常」。
5. **CSRF 只做 Origin 檢查，沒有 token**：`app.ts:80-82`。Origin 檢查本身可被部分老舊瀏覽器或特定 proxy 繞過的機率雖低，但與 `docs/SECURITY.md` 宣稱的雙重防護（token + origin）不符，屬於「文件超前於實作」的落差，正式上線前要決定是否補 token 或更新文件降低宣稱。
6. **`admin-demo` 字面字串殘留於前端 production 程式碼**（`apps/web/src/services/api.ts:129-140`）：雖然在 `import.meta.env.DEV=false` 時不會被送出，但屬於應在正式程式碼中清除的開發期殘留，建議在 Staging 驗收前一併清理，降低未來維護者誤用風險。
7. **活動／歌手資料沒有任何正式建立管道**：目前只能靠 `seeds/seed.sql`（虛構資料）或人工 SQL 寫入 D1，Staging 通過後如果要換成真實活動資訊，仍需要額外開發「活動建立/編輯」的 admin API，這在目前程式碼中完全不存在。
8. **CORS_ORIGIN 是單一字串完全比對**（`app.ts:48`：`origin === context.env.CORS_ORIGIN`），沒有支援萬用字元或多來源，Staging 只認 `https://ticket-radar-web-staging.pages.dev`，若 Pages 有 preview deployment（例如 `*.ticket-radar-web-staging.pages.dev` 的 branch preview URL）會直接被 CORS 擋掉，需注意測試時使用的網址是否為正式 Staging 網域。
9. **Reminder 的 `web_push`／`email`／`line` 通道是「資料庫允許值」但無實作**（見第 3 節），若使用者在 UI 上未來被導向可選擇這些通道，會造成「選了但永遠不會收到通知」的體驗風險——目前 UI（`TasksPage.tsx`）沒有讓使用者選通道，固定用 `ics`，暫時安全，但要留意未來擴充時的一致性。

---

## 10. 尚需人工操作或外部授權的項目

1. **確認 Staging D1 內是否已有該使用者的真實資料列**：需要有 Cloudflare 帳號權限的人執行 `wrangler d1 execute ticket-radar-db-staging --env staging --remote --command "SELECT * FROM users WHERE email_normalized='...'"` 才能百分之百驗證使用者資料已落地（本次稽核只讀程式碼，無法連線遠端 Staging D1）。
2. **指定並升級第一個 Admin 帳號**：需要人工對 `ticket-radar-db-staging` 執行 `UPDATE users SET role='admin' WHERE email_normalized='...'`，目前系統無自助升級路徑。
3. **Cloudflare 帳號登入與 Wrangler 授權**：`docs/FINAL_DELIVERY.md:129` 明確記載「本次交付沒有登入 Cloudflare、建立遠端 D1 或部署 Worker」，Staging 的建立顯然是後續由有 Cloudflare 帳號權限的人完成，Production 至今仍未做，需要相同層級的人工授權才能繼續。
4. **正式網域**：`wrangler.toml:43` Production `CORS_ORIGIN` 仍是 `https://replace-with-production-domain.invalid`，需要業主提供正式網域並完成 DNS／Cloudflare Pages 綁定。
5. **`RATE_LIMIT_SALT` 等 Secrets**：`docs/staging-deployment.md:19,30` 明確要求只能用 `wrangler secret put RATE_LIMIT_SALT --env staging` 設定，不可提交進版本庫，需要人工在有權限的機器上執行過一次，且無法在程式碼層驗證是否已設定（若未設定，`rate-limit.ts:29-31` 會讓所有非開發環境請求回 500 `RATE_LIMIT_NOT_CONFIGURED`——這點也建議實際打一次 Staging API 確認沒有收到這個錯誤）。
6. **Cloudflare Access Application／OTP／身分提供者設定**：`ACCESS_TEAM_DOMAIN`／`ACCESS_AUD` 已經填入真實值（`wrangler.toml:27-28`），但 Access Application 內部的登入方式（Email OTP／Google／GitHub 等）、允許登入的 email 網域規則等，屬於 Cloudflare Zero Trust 後台設定，不在程式碼庫內，需要有 Cloudflare Zero Trust 管理權限的人再次確認設定內容與允許清單。
7. **驗收閘門本身要求人工完成**：`docs/staging-deployment.md:54-58` 明確寫「只有在 Access 登入／登出、使用者隔離、管理員權限、CRUD、CORS、Rate Limit、PWA、Extension、遮罩截圖及完整核心流程都在真實網址通過後，才能標記 Staging Ready」——目前使用者已完成登入／角色／admin 403 三項，購票任務與紀錄的 CRUD 全流程（建立、讀取、跨使用者隔離）與 Extension 實機驗收仍需人工在瀏覽器上逐項操作確認。

---

## 附錄：2026-07-30 Cowork 瀏覽器實測補充（本節為實際操作結果，補足上面純程式碼稽核看不到的問題）

用 `player5500@gmail.com` 透過 Cloudflare Access OTP 實際登入 Staging PWA 後，逐項操作發現與上面程式碼分析吻合、但也發現程式碼審查看不出來的**新 P0 問題**，詳細重現步驟與修正建議見同目錄 `CODE_FIX_TASKS.md`。摘要：

1. **P0（架構級，影響所有人第一次使用）**：`ticket-radar-web-staging.pages.dev` 與 `ticket-radar-api-staging.vannyai.workers.dev` 是兩個獨立網域，且都各自掛了 Cloudflare Access。瀏覽器對 API 網域發出的 fetch 在使用者從未「完整導覽」過 API 網域之前一律失敗（先 503，後嘗試重新導向 API 自己的 Access 登入頁，但 fetch 無法完成互動式導向），前端會卡在無限 loading（首頁搜尋顯示「正在掃描演出資料…」永不結束），比對第 9 節第 8 點提到的 CORS_ORIGIN 精確比對問題，這是同一組跨網域架構衍生出的更嚴重後果。第二次以「完整導覽」方式打開 API 網域後，瀏覽器才會拿到該網域自己的 Access session cookie，之後 PWA 的 fetch 才會成功——這解釋了使用者本輪回報「個人購票任務／紀錄目前為空」很可能不是資料真的沒建立，而是這個 P0 bug 讓資料完全讀不到。
2. **P0（核心功能失效）**：活動詳情頁「＋ 建立購票任務」與「加入行事曆提醒」兩個按鈕點擊後**沒有任何反應**（無 modal、無導頁、無 toast、瀏覽器 Network 面板完全沒有新的 API 請求被送出），代表這兩個按鈕目前沒有接上任何邏輯。這使第三節要求的「建立購票任務→設定預算→…→建立提醒」全流程在目前 Staging 版本上**無法透過 UI 完成**，即使後端 repository（`ticket-task.repository.ts`）邏輯是真的。
3. **已驗證為真**：「收藏活動」（★ 已收藏）點擊後重新整理／重新導覽仍保留狀態，代表這個功能是真的寫進後端（非 localStorage），與第 2 節的程式碼判斷一致。
4. **登入／登出**：Cloudflare Access 登入（Email OTP）、登出（`/cdn-cgi/access/logout`）本身正常。但登出後直接輸入 `/tasks` 網址，畫面卡在「正在整理你的購票準備…」無限轉圈，沒有導回登入頁或顯示「請重新登入」，即使背景 API 呼叫應該已經因未登入被拒絕。
5. **雜項**：搜尋失敗時的錯誤訊息寫「請確認本機 Worker 與 D1 已啟動」，這是本機開發用的錯誤文案，出現在 Staging 環境會誤導非工程背景的驗收者。

以上第 1、2 項是本次稽核發現的最高優先級問題，建議列為 Staging Ready 的阻斷項目。
