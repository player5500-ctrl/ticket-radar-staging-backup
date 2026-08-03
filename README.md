# 追票雷達 Ticket Radar

合法合規的演唱會與活動購票準備助手。這不是自動搶票工具。

目前已完成 **Phase 1–6 本機 MVP**：pnpm monorepo、PWA、Cloudflare Workers
API、D1、搜尋與活動詳情、購票任務、提醒與 ICS、加密資料組 Extension、受控
Demo 成功頁偵測、敏感資訊遮罩、本機截圖與購票紀錄、具備伺服器端 RBAC、
活動確認與 audit log 的基本管理後台，以及 KKTIX／tixCraft 合規評估。

KKTIX 與 tixCraft Adapter 均為 `disabled`，不代表支援這兩個真實售票平台。

## 安全邊界

- 不自動刷新、選票、選位、切換場次、排隊、送單或付款。
- 不操作 CAPTCHA 或防機器人問題。
- 不監控剩餘票量。
- 不保存售票平台密碼、OTP 或信用卡安全碼。
- 活動資料請以主辦單位及售票平台官方公告為準。

## 專案結構

```text
apps/web/              React + Vite PWA
apps/extension/        Chrome／Edge Manifest V3 Extension
workers/api/           Cloudflare Worker + D1
packages/shared/       共用型別、Zod schema、搜尋與時間工具
packages/ui/           共用 UI 元件
packages/config/       TypeScript 共用設定
tests/e2e/             Phase 1–6 Playwright 核心流程
docs/                  產品、架構、資料庫、安全與測試文件
```

## 系統需求

- Node.js 22.12 或更新版本。
- pnpm 11。
- Chromium（執行 Playwright E2E 時）。

目前驗證環境為 Node 24 與 pnpm 11。

## 本機啟動

```bash
pnpm install
pnpm db:setup:local
pnpm dev
```

目前專案位於 exFAT 的 D 槽。exFAT 不支援 pnpm workspace symlink，首次安裝請改用：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-exfat.ps1
```

開啟：

- PWA：<http://127.0.0.1:5173>
- Worker health：<http://127.0.0.1:8787/health>

若要分開啟動：

```bash
pnpm dev:api
pnpm dev:web
```

## 本機 D1

Migration：

```bash
pnpm db:migrate:local
```

Seed：

```bash
pnpm db:seed:local
```

資料庫檔案由 Wrangler 保存在 `workers/api/.wrangler/`，不進 Git。

## Demo 資料

- Demo 使用者：`user-demo`，只在 `ALLOW_DEMO_AUTH=true` 且非 Production 時有效。
- 歌手：夜航星、晨光訊號、林澄音。
- 別名：包含英文、日文、韓文。
- 活動：星際航線、破曉代碼、藍色時刻。
- 售票平台：Ticket Radar Demo。

所有活動、網址、場館與帳號資料均為虛構測試資料，不可視為真實售票公告。

## 品質檢查

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

一次執行格式、lint、型別、單元測試與 build：

```bash
pnpm check
```

## 環境設定

複製 `.env.example`，但不要把 `.env` 或 secrets 提交到 Git。

PWA 可用環境變數：

```text
VITE_API_BASE_URL=http://127.0.0.1:8787
```

Worker 本機非敏感設定位於 `workers/api/wrangler.toml`。其中的 D1 `database_id` 是不可部署的全零 placeholder。

正式環境必須：

1. 建立真實 D1。
2. 以 Cloudflare 回傳的 database id 更新正式設定。
3. 將 `ALLOW_DEMO_AUTH` 設為 `false`。
4. 設定正式身分提供端、CORS origin 與 secrets。
5. 正式 migration 前先備份 D1。

目前所有階段都只完成本機與 Worker dry-run 驗證，尚未執行 Cloudflare
Production 部署。正式 Auth、Production D1、WAF／Rate Limiting 與正式網域完成前，
不可將本專案標示為 Production Ready。

## API

| 方法        | 路徑                                             | 功能                         |
| ----------- | ------------------------------------------------ | ---------------------------- |
| GET         | `/health`                                        | 健康檢查                     |
| GET         | `/api/v1/home`                                   | 即將登場、最近新增、追蹤歌手 |
| GET         | `/api/v1/search`                                 | 歌手別名、活動、場館與篩選   |
| GET         | `/api/v1/events/:id`                             | 活動詳情與售票時間軸         |
| POST/DELETE | `/api/v1/events/:id/favorite`                    | 收藏／取消收藏               |
| POST/DELETE | `/api/v1/artists/:id/follow`                     | 追蹤／取消追蹤               |
| GET/POST    | `/api/v1/ticket-tasks`                           | 購票任務列表／建立           |
| PATCH       | `/api/v1/ticket-tasks/:id`                       | 更新購票任務                 |
| PATCH       | `/api/v1/ticket-tasks/:taskId/checklist/:itemId` | 更新準備清單                 |
| GET/POST    | `/api/v1/reminders`                              | 提醒列表／建立               |
| GET/POST    | `/api/v1/purchase-records`                       | 遮罩後購票紀錄列表／建立     |
| GET         | `/api/v1/admin/overview`                         | 管理摘要與最近稽核紀錄       |
| PATCH       | `/api/v1/admin/events/:id/verification`          | 活動確認狀態與稽核           |

寫入操作只在明確的 Demo 開發模式接受 `X-Demo-User-Id`。Production 不接受這個 Demo 身分。

## PWA

`vite-plugin-pwa` 會在 build 產生 manifest 與 service worker。本機開發以網路資料為準；API runtime cache 採短期 Network First。

## 文件

- [產品規格](./docs/PRODUCT_SPEC.md)
- [系統架構](./docs/ARCHITECTURE.md)
- [資料庫](./docs/DATABASE.md)
- [安全與隱私](./docs/SECURITY.md)
- [測試計畫](./docs/TEST_PLAN.md)
- [Phase 0 計畫](./docs/PHASE_0_PLAN.md)
- [Phase 4 完成報告](./docs/PHASE_4_REPORT.md)
- [Phase 5 完成報告](./docs/PHASE_5_REPORT.md)
- [Phase 6 完成報告](./docs/PHASE_6_REPORT.md)
- [平台 Adapter 評估](./docs/PLATFORM_ADAPTERS.md)
- [最終交付與操作手冊](./docs/FINAL_DELIVERY.md)
