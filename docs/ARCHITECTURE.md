# 追票雷達 Ticket Radar — Architecture

## 1. 架構決策摘要

採用 pnpm workspace monorepo，將 PWA、Cloudflare API、瀏覽器擴充功能與共用 domain 契約分開。MVP 優先完成可在本機重現的 Generic Demo 全流程；所有真實平台 Adapter 預設停用，直到完成條款與頁面結構審查。

## 2. 建議目錄

```text
ticket-radar/
├─ apps/
│  ├─ web/                         # React + Vite PWA、管理後台、Demo 售票頁
│  │  ├─ src/
│  │  │  ├─ app/                   # router、providers、權限邊界
│  │  │  ├─ features/              # search/events/tasks/reminders/records/admin
│  │  │  ├─ pages/
│  │  │  ├─ services/              # typed API client、ICS、push client
│  │  │  └─ test/
│  │  └─ public/
│  └─ extension/                   # Chrome／Edge Manifest V3
│     ├─ src/
│     │  ├─ background/            # service worker、下載、截圖協調
│     │  ├─ content/               # page detect／fill／redaction overlay
│     │  ├─ popup/                 # 使用者主動操作 UI
│     │  ├─ options/               # PIN、資料組、截圖同意
│     │  ├─ crypto/                # Web Crypto 封裝
│     │  └─ storage/               # encrypted local repository
│     └─ manifest.json
├─ workers/
│  └─ api/
│     ├─ src/
│     │  ├─ routes/
│     │  ├─ middleware/
│     │  ├─ repositories/
│     │  ├─ services/
│     │  ├─ providers/             # mock/email/line/push 抽象
│     │  └─ index.ts
│     ├─ migrations/
│     ├─ seeds/
│     └─ wrangler.toml
├─ packages/
│  ├─ shared/                      # domain types、Zod schemas、UTC／mask 工具
│  ├─ ui/                          # 可重用且可存取的 UI 元件
│  ├─ platform-adapters/           # Adapter contract、selector registry、demo adapter
│  └─ config/                      # TypeScript、ESLint、Prettier 共用設定
├─ tests/
│  └─ e2e/                         # Playwright 核心流程
├─ docs/
├─ .env.example
├─ .gitignore
├─ package.json
├─ pnpm-lock.yaml
├─ pnpm-workspace.yaml
├─ playwright.config.ts
├─ tsconfig.base.json
└─ README.md
```

Phase 0 只建立 `docs/` 文件；其餘目錄在 Phase 1–5 依功能逐步建立。

## 3. 系統邊界

```text
PWA / Admin
  │ HTTPS JSON（Zod 驗證、session、CSRF、rate limit）
  ▼
Cloudflare Workers API
  ├─ service layer
  ├─ repository layer
  ├─ D1
  ├─ Web Push provider
  ├─ Mock Email provider
  └─ Disabled LINE provider

Extension
  ├─ chrome.storage.local（PIN 派生金鑰加密）
  ├─ 使用者點擊 → content script → Adapter.fillProfile
  ├─ opt-in 成功頁偵測 → 敏感區域遮蔽 → captureVisibleTab
  ├─ chrome.downloads（本機保存）
  └─ 僅將遮罩後訂單中繼資料送至 Workers API

Demo Ticket Page（apps/web）
  └─ 只供 Generic Demo Adapter E2E；訂單送出必須是使用者操作
```

PWA 不讀取購票資料明文；Workers 不保存購票資料明文或原始截圖。

## 4. 套件責任

### 4.1 `packages/shared`

- Domain enum 與 TypeScript 型別。
- API request／response Zod schema。
- UTC、時區、提醒時間計算。
- 訂單編號遮罩與一般文字遮罩。
- Idempotency key 與安全檔名產生器。
- 禁止欄位清單。

不含 DOM selector、D1 SQL 或 Cloudflare binding。

### 4.2 `packages/platform-adapters`

Phase 6 實際核心契約摘要：

```ts
interface PlatformAdapter {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly status: "demo" | "disabled" | "testing" | "active";
  readonly reviewedAt: string;
  readonly domains: readonly string[];
  readonly supportedFields: readonly ContactField[];
  readonly capabilities: Readonly<AdapterCapabilities>;
  matchesUrl(input: string | URL): boolean;
  detectPage(document: Document): boolean;
  fillProfile(document: Document, candidate: unknown): FieldResult[];
  detectSuccess(document: Document): boolean;
  redactSuccess(document: Document): RedactionResult;
  clearRedaction(document: Document): void;
}
```

補充規則：

- Selector 只存放在 adapter 的集中 registry。
- `fillProfile` 只能處理白名單的固定欄位。
- 所有 selector 存取都要容錯，禁止無限重試。
- `FillResult` 必須逐欄回報 `filled`、`not_found`、`blocked` 或 `invalid`。
- 票數、票種、座位、條款、付款與送出 selector 永不列入可填欄位。
- `kktix`、`tixcraft` 已於 Phase 6 評估，結果均為 disabled；只保留安全網域辨識，
  DOM 讀取、填入、成功偵測、遮罩與所有購票能力皆關閉。

### 4.3 `apps/extension`

- `popup` 是填入操作唯一入口。
- content script 不在背景輪詢或刷新頁面。
- success detection 只在使用者針對本次購票開啟 opt-in 後生效。
- 截圖前使用暫時性遮罩覆蓋敏感 DOM；完成或失敗都要移除遮罩。
- 若無法可靠找出或遮罩敏感區域，取消自動上傳，只允許使用者選擇本機保存或取消。
- `chrome.storage.local` 中只存加密 envelope、salt、KDF 參數與非敏感顯示名稱。

### 4.4 `workers/api`

固定分層：

```text
route → auth/validation/rate-limit → service → repository → D1
```

- route 不直接寫 SQL。
- repository 使用參數化查詢。
- service 處理權限、狀態轉換、audit log 與 idempotency。
- API 回應使用穩定 error code，不回傳堆疊、SQL 或個資。
- 管理員 CRUD 與一般使用者 API 分離。

## 5. 前端資料流

採用功能模組化資料流，不在 Phase 1 引入不必要的全域狀態框架：

1. API server state：TanStack Query（在 Phase 1 安裝前再確認版本）。
2. URL search params：搜尋與篩選的來源真相。
3. local component state：表單草稿與 UI 狀態。
4. 時區：使用者設定；沒有設定時為 `Asia/Taipei`。
5. 表單：Zod schema 與可存取的錯誤訊息。

所有寫入採 optimistic update 時，失敗必須回滾並顯示可操作錯誤。

## 6. API 草案

MVP REST API 以 `/api/v1` 為前綴：

| 方法        | 路徑                                  | 用途                       |
| ----------- | ------------------------------------- | -------------------------- |
| GET         | `/search`                             | 搜尋歌手／別名／活動／場館 |
| GET         | `/events/:id`                         | 活動與售票時間軸           |
| POST/DELETE | `/events/:id/favorite`                | 收藏／取消收藏             |
| POST/DELETE | `/artists/:id/follow`                 | 追蹤／取消追蹤             |
| GET/POST    | `/ticket-tasks`                       | 任務列表／建立             |
| PATCH       | `/ticket-tasks/:id`                   | 更新任務                   |
| PUT         | `/ticket-tasks/:id/checklist/:itemId` | 更新檢查項目               |
| GET/POST    | `/reminders`                          | 提醒列表／建立             |
| POST        | `/calendar/ics`                       | 產生或驗證 ICS payload     |
| GET/POST    | `/purchase-records`                   | 紀錄列表／建立             |
| GET         | `/me/export`                          | 匯出使用者雲端資料         |
| DELETE      | `/me/data`                            | 刪除使用者資料             |
| DELETE      | `/me/account`                         | 刪除帳號                   |
| CRUD        | `/admin/*`                            | 受 RBAC 保護的管理功能     |

所有 POST／PUT／PATCH：

- 驗證 `Content-Type` 與 body size。
- 使用 Zod。
- 驗證 session 與 CSRF。
- 重要建立操作支援 `Idempotency-Key`。

## 7. 搜尋設計

MVP 使用 D1 的正規化欄位：

- `normalized_name`：Unicode 正規化、trim、lowercase。
- `search_text`：歌手／別名／活動／場館／城市可搜尋字串。
- 別名以獨立表保存，支援繁中、英文、日文、韓文。

Phase 1 先使用索引與 `LIKE` 的受限查詢；資料量增長後才評估 D1 FTS5。不得在未測量前引入複雜搜尋基礎設施。

## 8. 提醒設計

- `ticket_sale_windows.starts_at_utc`／`ends_at_utc` 與 `reminders.scheduled_at_utc` 使用 ISO 8601 UTC 字串。
- Worker Cron 找出到期且尚未送出的提醒。
- service 以 reminder id + channel 建立 idempotency key。
- provider 回傳 `sent`、`skipped`、`retryable_failure`、`permanent_failure`。
- 正式 Web Push 需要 VAPID 設定；未設定時，本機由 mock provider 記錄結果。
- ICS 在瀏覽器端即可匯出，不依賴通知 provider。

## 9. 截圖與紀錄同步

```text
opt-in
→ detectPurchaseResult
→ 判斷不是「付款成功」的過度推論
→ 依 selector 與文字規則建立遮罩
→ 遮罩完整性檢查
→ captureVisibleTab
→ chrome.downloads.download
→ 寫入本機 idempotency store
→ POST 遮罩後 purchase record metadata
```

去重鍵優先順序：

1. `platform_id + masked/hash(order_number)`。
2. 沒有訂單編號時：`platform_id + canonical_url + event + session + 5-minute bucket`。
3. 同一頁面另有短時間 debounce。

只保存 HMAC／不可逆摘要用於去重；不把完整訂單編號寫入雲端 log。

## 10. 本機開發拓樸

建議命令（Phase 1 建立後才可執行）：

```bash
pnpm install
pnpm dev
pnpm dev:web
pnpm dev:api
pnpm dev:extension
```

- Web：Vite localhost。
- API：Wrangler local + local D1。
- Extension：Vite build／watch 後以 Chrome／Edge「載入未封裝項目」安裝。
- E2E：啟動 Web 與 API，再以 Playwright persistent context 載入 extension。

## 11. 部署邊界

- Phase 0 不部署。
- Cloudflare 帳號、D1 database id、VAPID、Email、LINE 等未授權前，只能提供 `.env.example` 與 `wrangler.toml` 範例。
- 正式部署前必須先建立 D1 備份／migration 記錄、檢查 bindings，再以非破壞性 smoke test 驗證。
- 本機成功不宣稱 Cloudflare Production 成功。

## 12. 架構決策紀錄

| 決策                        | 理由                               |
| --------------------------- | ---------------------------------- |
| PWA 與 Extension 分開       | 權限、儲存與發版生命週期不同       |
| 購票資料只在 Extension 本機 | 最小化個資外洩面                   |
| 原始截圖不進雲端            | 遮蔽失敗仍可能含可冒用資訊         |
| Generic Demo 優先           | 可合法、穩定、可重現地驗證全流程   |
| D1 採 repository/service    | 防止 UI 或 route 任意 SQL          |
| 真實 Adapter 預設停用       | 條款與 selector 尚未審查           |
| REST + Zod 共用契約         | Workers、Web、Extension 可共享驗證 |
| UTC 儲存                    | 避免跨時區與夏令時間錯誤           |
