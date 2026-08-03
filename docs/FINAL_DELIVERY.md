# 追票雷達 Ticket Radar 最終交付與操作手冊

交付日期：2026-07-29  
專案路徑：`D:\cowork files\projects\18_ticket-radar`

## 交付狀態

Phase 1–6 的本機 MVP 已完成並驗證。Cloudflare Production、正式登入、正式 D1、
WAF／Rate Limiting 與真實售票平台整合尚未完成，因此目前狀態是：

> 本機 Demo 可驗收；不是 Production Ready；不是 KKTIX／拓元自動購票工具。

## 1. 專案目錄結構

```text
18_ticket-radar/
├─ apps/
│  ├─ web/                    React + Vite PWA、管理後台、Demo 售票頁
│  └─ extension/              Chrome／Edge Manifest V3 Extension
├─ packages/
│  ├─ shared/                 共用型別、Zod schema、時間與遮罩工具
│  ├─ platform-adapters/      Demo 與停用平台 Adapter
│  ├─ ui/                     共用 UI 元件
│  └─ config/                 共用設定
├─ workers/api/               Hono Worker、D1 repositories、migration、seed
├─ tests/e2e/                 Playwright 手機與桌面核心流程
├─ docs/                      規格、架構、安全、各 Phase 與交付文件
├─ scripts/setup-exfat.ps1    exFAT workspace 實體注入
├─ playwright.config.ts
├─ pnpm-workspace.yaml
└─ package.json
```

`node_modules/`、`dist/`、`.wrangler/`、`test-results/`、`playwright-report/`
與 `output/` 都是依賴或驗證產物，不是核心原始碼。

## 2. 主要架構

```text
React PWA / Admin
        │ HTTPS JSON
        ▼
Cloudflare Worker (Hono)
        │ route → validation/auth → service → repository
        ▼
Cloudflare D1

Chrome / Edge Extension
        │ 使用者明確點擊
        ▼
Generic Demo Adapter → 只填姓名、Email、電話
        │
        └─ 成功頁可靠遮罩 → 本機截圖；原始圖片不上傳
```

- 所有日期以 UTC 儲存，前端依 `Asia/Taipei` 顯示。
- Demo 購票的票種、張數、條款與送出都由使用者手動操作。
- KKTIX／tixCraft 只存在停用評估 Adapter，不會注入真實網站。
- Production 不接受 `X-Demo-User-Id`；目前尚未接正式身分提供端。

## 3. 本機安裝與啟動

需求：Node.js 22.12+、pnpm 11、Chromium。

專案位於 exFAT D 槽。首次安裝使用：

```powershell
Set-Location 'D:\cowork files\projects\18_ticket-radar'
powershell -ExecutionPolicy Bypass -File .\scripts\setup-exfat.ps1
```

初始化本機 D1：

```powershell
pnpm.cmd db:setup:local
```

啟動 Web 與 Worker：

```powershell
pnpm.cmd dev
```

網址：

- PWA：`http://127.0.0.1:5173`
- Worker health：`http://127.0.0.1:8787/health`
- Demo 售票頁：`http://127.0.0.1:5173/demo-ticket`
- 管理後台：`http://127.0.0.1:5173/admin`

若 exFAT 環境再次觸發不必要的 pnpm 重建，可直接使用專案既有工具：

```powershell
Set-Location '.\workers\api'
$env:WRANGLER_LOG_PATH = '.wrangler/logs/wrangler.log'
..\..\node_modules\.bin\wrangler.cmd d1 migrations apply ticket-radar-db --local
..\..\node_modules\.bin\wrangler.cmd d1 execute ticket-radar-db --local --file seeds/seed.sql
```

## 4. Extension 安裝

先建置：

```powershell
Set-Location 'D:\cowork files\projects\18_ticket-radar\apps\extension'
..\..\node_modules\.bin\vite.cmd build --configLoader runner
```

Chrome／Edge：

1. 開啟 `chrome://extensions` 或 `edge://extensions`。
2. 開啟「開發人員模式」。
3. 選擇「載入未封裝項目」。
4. 選取 `D:\cowork files\projects\18_ticket-radar\apps\extension\dist`。
5. 開啟本機 Demo 售票頁，再使用 Extension popup 建立加密資料組與手動填入。

權限只包含 `storage`、`activeTab`、`scripting`、`downloads`，host 只允許
`http://127.0.0.1:5173/*`。

## 5. Cloudflare 部署方式

目前不應直接部署為正式產品，因為 `wrangler.toml` 的 D1 id 是全零 placeholder，
且正式 Auth、WAF／Rate Limiting、Production CORS 與正式前端網域尚未完成。

取得 Cloudflare 授權並完成上述項目後，安全流程為：

```powershell
Set-Location 'D:\cowork files\projects\18_ticket-radar\workers\api'
..\..\node_modules\.bin\wrangler.cmd login
..\..\node_modules\.bin\wrangler.cmd d1 create ticket-radar-db --location apac
```

將 Cloudflare 回傳的真實 `database_id` 放入獨立 Production 設定，不得覆用本機全零
placeholder。Production 設定至少必須使用：

```text
ENVIRONMENT=production
ALLOW_DEMO_AUTH=false
CORS_ORIGIN=https://正式前端網域
```

先 dry-run：

```powershell
..\..\node_modules\.bin\vite.cmd build --config vite.worker.config.ts --configLoader runner
..\..\node_modules\.bin\wrangler.cmd deploy --dry-run --no-bundle
```

只有正式 Auth、D1 備份、migration、CORS 與安全 Gate 都通過後，才可執行：

```powershell
..\..\node_modules\.bin\wrangler.cmd deploy --no-bundle
```

本次交付沒有登入 Cloudflare、建立遠端 D1 或部署 Worker。

## 6. D1 migration

本機：

```powershell
Set-Location 'D:\cowork files\projects\18_ticket-radar\workers\api'
..\..\node_modules\.bin\wrangler.cmd d1 migrations apply ticket-radar-db --local
..\..\node_modules\.bin\wrangler.cmd d1 execute ticket-radar-db --local --file seeds/seed.sql
```

遠端正式環境必須先確認目標帳號、database id 與備份，再執行：

```powershell
..\..\node_modules\.bin\wrangler.cmd d1 migrations apply ticket-radar-db --remote
```

`seed.sql` 是虛構 Demo 資料，不應在正式資料庫自動執行。

Migration：

1. `0001_core_catalog.sql`
2. `0002_user_tracking.sql`
3. `0003_ticket_tasks_and_reminders.sql`
4. `0004_purchase_records.sql`
5. `0005_admin_reporting_and_audit.sql`

## 7. 測試帳號與資料

- 一般使用者：`user-demo`
- 管理員：`admin-demo`
- Email：使用 `.invalid` 測試網域，不是真實帳號。
- 歌手：夜航星、晨光訊號、林澄音。
- 韓文搜尋範例：`나이트 오비트`
- 活動：星際航線、破曉代碼、藍色時刻。
- Demo 訂單編號與場館均為虛構資料。

Demo header 只在 `ALLOW_DEMO_AUTH=true` 且非 Production 時有效。

## 8. Demo 售票頁

啟動 Web 與 Worker 後開啟：

`http://127.0.0.1:5173/demo-ticket`

頁面會保留票種、張數、條款與送出按鈕給使用者手動操作。Extension 只會填入姓名、
Email、電話三個固定欄位。

## 9. 測試報告

2026-07-29 最後驗證：

- ESLint：通過，0 warnings。
- TypeScript：Shared、Adapter、API、Web 通過。
- Vitest：31 項通過。
- Phase 6 Adapter 安全測試：9 項通過。
- Playwright：Phase 5 完整回歸 14/14 通過；Phase 6 管理頁手機／桌面 2/2 通過。
- 本機 D1：5 個 migration 已套用，seed 12 個 statement 成功。
- 管理 API：一般使用者 403、管理員 200。
- Build：Shared、UI、Adapter、Web PWA、Extension、Worker dry-run 全部通過。

各階段詳細證據見 `PHASE_1_REPORT.md` 至 `PHASE_6_REPORT.md`。

## 10. 已知限制

- 正式登入／session 尚未實作；Production 寫入 API 會回 401。
- 正式 D1、Worker、PWA 網域與 Cloudflare Production 尚未部署。
- 正式 WAF／Rate Limiting、CSRF 與身分提供端整合尚未完成。
- KKTIX／tixCraft Adapter 均停用，不支援真實平台填入或購票。
- Web Push、Email、LINE 僅有資料模型／邊界；MVP 實際提醒以 ICS 為主。
- 管理後台只完成摘要、活動確認、Adapter 狀態與 audit，不是完整 CRUD。
- Extension 真實載入、`captureVisibleTab`、下載提示與主觀 UI 仍需瀏覽器人工驗收。
- 尚未完成完整深色模式、200% zoom 與所有視覺證據清單。
- D 槽是 exFAT，workspace 依賴需由 `setup-exfat.ps1` 實體注入。
- 專案搬移時沒有一併保留 `.git`，目前無法直接建立 commit 或列出歷史 diff。

## 11. 後續建議

優先順序：

1. 實作正式 Auth/session、CSRF 與 Production RBAC。
2. 建立 Cloudflare Preview D1 與 Preview Worker，先做非破壞性 smoke test。
3. 設定正式 WAF／Rate Limiting、CORS、CSP 與可觀測性。
4. 完成 Extension Chrome／Edge 人工驗收與隱私權揭露。
5. 補齊管理 CRUD、資料匯出／刪除與通知 provider。
6. 建立新的 Git repository，將目前已驗證版本作為基準 commit。
7. KKTIX／tixCraft 只有取得書面允許與平台沙盒後才重新評估。

## 12. 修改檔案清單

各階段變更分別記錄於：

- `PHASE_1_REPORT.md`
- `PHASE_2_REPORT.md`
- `PHASE_3_REPORT.md`
- `PHASE_4_REPORT.md`
- `PHASE_5_REPORT.md`
- `PHASE_6_REPORT.md`

本次最終交付整理修改：

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_PLAN.md`
- `docs/FINAL_DELIVERY.md`

因目前沒有 `.git` 歷史，無法可靠還原搬移前的逐檔 diff；核心原始碼完整保存在
`apps/`、`packages/`、`workers/`、`tests/` 與 `docs/`。

## 13. Git commit 建議

若先建立 Git repository，建議基準 commit：

```text
feat: deliver ticket radar phase 1-6 local MVP
```

最終交付文件可使用：

```text
docs: finalize ticket radar delivery and verification guide
```
