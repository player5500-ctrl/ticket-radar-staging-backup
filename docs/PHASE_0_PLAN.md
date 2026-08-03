# 追票雷達 Ticket Radar — Phase 0 Plan

## 1. 現有工作區盤點

盤點日期：2026-07-29（Asia/Taipei）。

工作區根目錄：

```text
C:\Users\B00028\Documents\Vanny 個人 AI 工作團隊
```

已確認事實：

- 根目錄是一個尚無 commit 的外層 Git 工作樹，分支顯示為 `master`。
- 根目錄現有 `17-find-it-ai-vercel-work`、`microjet-erp-gate-preview`、`mitea-tarot-pwa`、`TARO-work` 等專案。
- 工作區全文搜尋沒有 `Ticket Radar`、`追票雷達`、`ticket-radar` 或 `ticket_radar` 的既有程式。
- 根目錄沒有共用 `package.json`、`pnpm-workspace.yaml` 或 `.openai/hosting.json`。
- 現有專案屬於其他產品，不應被覆蓋或併入本專案。

結論：在根目錄新增獨立 `ticket-radar/` 子目錄；Phase 0 不改動其他專案，也不部署。

## 2. 建議架構

- Monorepo：pnpm workspace。
- Web：React + TypeScript strict + Vite + Tailwind CSS + PWA。
- API：Cloudflare Workers + D1 + Cron Triggers。
- Extension：Chrome／Edge Manifest V3。
- 共用契約：Zod + TypeScript。
- 測試：Vitest + Testing Library + Playwright。
- 資料層：route → service → repository → D1。
- 本機購票資料：Extension + Web Crypto + PIN；預設不上雲。
- 截圖：使用者 opt-in、遮罩後本機下載；雲端只收遮罩後中繼資料。
- Adapter：Generic Demo 先完成；KKTIX／TixCraft 必須在 Phase 6 條款與 selector 審查後才可能啟用。

詳細設計：

- [PRODUCT_SPEC.md](./PRODUCT_SPEC.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [DATABASE.md](./DATABASE.md)
- [SECURITY.md](./SECURITY.md)
- [TEST_PLAN.md](./TEST_PLAN.md)

## 3. 風險與假設

| 等級 | 風險／假設                                       | 影響                      | 緩解方式                                                  |
| ---- | ------------------------------------------------ | ------------------------- | --------------------------------------------------------- |
| 高   | 真實平台服務條款與頁面結構會變動                 | Adapter 可能不合法或失效  | Phase 6 前保持 disabled；逐平台審查並記錄日期             |
| 高   | 截圖遮罩不能對未知頁面保證完整                   | 個資或取票資訊外洩        | Demo 先驗證；遮罩不可靠時禁止上傳並讓使用者取消           |
| 高   | 擴充功能保存敏感個資                             | 裝置被入侵時有外洩風險    | AES-GCM、PIN KDF、短暫解鎖、明文不落盤／不進 log          |
| 高   | 自動化範圍漂移成搶票工具                         | 合規與平台封鎖風險        | 產品、程式與測試三層禁止；負向 E2E                        |
| 中   | Cloudflare 帳號、D1、VAPID、Email、LINE 尚未授權 | 正式通知／部署不能驗證    | local D1 + Mock／disabled provider；部署階段才請求授權    |
| 中   | 正式身分提供端尚未選定                           | 帳號、RBAC、CSRF 細節未定 | MVP 使用可替換 Demo provider；Phase 1 先定 auth interface |
| 中   | Web 與 Extension 跨上下文同步複雜                | 購票紀錄可能漏寫／重複    | idempotency、重試上限、狀態可見、E2E                      |
| 中   | MV3 service worker 會休眠                        | 解鎖狀態與長流程中斷      | 短交易、持久化非敏感狀態、重啟可恢復                      |
| 中   | D1 搜尋的中日韓正規化能力有限                    | 別名搜尋品質              | 明確 alias 表與 normalized 欄位；資料量後再評估 FTS       |
| 中   | 瀏覽器截圖／下載權限在 Chrome、Edge 差異         | 雙瀏覽器行為不同          | Phase 4 實測兩者並保持最小權限                            |
| 低   | 外層 Git 尚無 commit 且含多個未追蹤專案          | Git diff 容易混雜         | 所有操作限制在 `ticket-radar/`，回報使用 path-scoped diff |

核心假設：

- 第一版只需本機完整執行，不需要 Phase 0 部署。
- Demo 資料不含真實個資。
- 原始截圖永不上雲是 MVP 的固定安全邊界。
- Email 與 LINE 沒有憑證時使用 mock／disabled provider。
- Web Push 正式測試需要安全 origin 與 VAPID，local 可以測 provider contract。

## 4. Phase 0 實際建立檔案

```text
ticket-radar/
└─ docs/
   ├─ PRODUCT_SPEC.md
   ├─ ARCHITECTURE.md
   ├─ DATABASE.md
   ├─ SECURITY.md
   ├─ TEST_PLAN.md
   └─ PHASE_0_PLAN.md
```

## 5. Phase 1–6 預計建立／修改檔案

### Phase 1：基礎、D1、搜尋與活動

- 根目錄：`package.json`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`、`tsconfig.base.json`、`.gitignore`、`.env.example`、`README.md`。
- `packages/config/*`、`packages/shared/*`、`packages/ui/*`。
- `apps/web/*`：PWA shell、router、首頁、搜尋、活動詳情、Demo 身分。
- `workers/api/wrangler.toml`、`src/index.ts`、routes/services/repositories。
- `workers/api/migrations/0001_*`、`0002_*` 與 seeds。
- 對應單元、整合與元件測試。

### Phase 2：任務、時間軸、提醒、ICS、資料組介面

- `apps/web/src/features/tasks/*`
- `apps/web/src/features/reminders/*`
- `apps/web/src/services/ics.ts`
- `workers/api/src/routes|services|repositories/{tasks,reminders}*`
- `workers/api/migrations/0003_ticket_tasks_and_reminders.sql`
- `packages/shared/src/{time,reminders,ticket-task}*`
- 對應測試。

購票資料組的實際加密儲存等 Extension 在 Phase 3 建立；Web 此階段只提供裝置端保存說明與連線入口。

### Phase 3：Extension 與 Generic Demo

- `apps/extension/manifest.json`
- `apps/extension/src/{background,content,popup,options,crypto,storage}/*`
- `packages/platform-adapters/src/generic-demo/*`
- `apps/web/src/features/demo-ticket/*`
- Adapter、crypto、storage 與 Demo E2E 測試。

### Phase 4：成功頁、遮罩、截圖與紀錄

- Extension success detector、redaction、capture、download、idempotency。
- `workers/api/migrations/0004_purchase_records.sql`
- purchase record route/service/repository。
- PWA 購票紀錄頁。
- 遮罩失敗、取消、重複與狀態判定測試。

### Phase 5：管理後台、完整品質與文件

- `apps/web/src/features/admin/*`
- `workers/api/migrations/0005_admin_reporting_and_audit.sql`、`0006_indexes.sql`
- admin/report/audit/notification routes 與服務。
- 完整 E2E、手機／深色／無障礙修正。
- `docs/PLATFORM_ADAPTERS.md`、`docs/DEPLOYMENT.md`、README 完整操作說明。

### Phase 6：真實平台評估

- 查核當時有效的 KKTIX／TixCraft 條款與頁面結構。
- 建立或更新 disabled adapter 草案與 selector registry。
- 只有通過合規、安全與人工審查後才可啟用。
- 不承諾永久 selector 或完全支援。

## 6. 後續執行順序

每一 Phase 都遵守：

1. 先閱讀上一階段產物與目前 Git 狀態。
2. 列出該階段修改檔案、3–6 條計畫、風險與完成標準。
3. 小步實作資料契約、後端、前端與測試。
4. 自行執行 lint、typecheck、單元／整合測試與 build。
5. 需要 UI／流程時用本機 HTTP 與 Playwright 驗證。
6. 修正可自行處理的錯誤後再回報。
7. 提供實際檔案、測試結果、Git diff、限制與下一階段建議。
8. 等使用者同意後才進入下一 Phase。

## 7. Phase 0 完成標準

- [x] 已確認不存在既有 Ticket Radar 專案。
- [x] 已決定不修改其他現有專案。
- [x] 產品範圍與禁止自動化行為已文件化。
- [x] Monorepo、資料流、API、Extension 與 Adapter 邊界已定義。
- [x] 需求指定的 18 個 D1 資料表、關聯、索引與 migration 策略已規劃。
- [x] 安全、隱私、CSP、CSRF、rate limit、遮罩與權限已規劃。
- [x] 單元、整合、E2E、負向安全與視覺測試已規劃。
- [x] 已列出 Phase 1–6 的預計檔案與執行順序。
- [x] Phase 0 未安裝依賴、未建立功能空殼、未部署。
