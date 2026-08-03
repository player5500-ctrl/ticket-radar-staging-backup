# Phase 5 完成報告

日期：2026-07-29

## 完成內容

- 新增 `0005_admin_reporting_and_audit.sql`。
- 建立 `platform_adapter_versions`、`notification_logs`、`user_reports`、`audit_logs`。
- 管理路由使用 Worker 查詢 `users.role` 與 `users.status`，不信任前端自行宣告權限。
- 一般 Demo 使用者讀取 `/api/v1/admin/*` 會得到 403 `ADMIN_REQUIRED`。
- 新增管理摘要：歌手、活動、待確認活動、待處理回報與通知失敗數量。
- 新增最近活動確認狀態與最近 audit log。
- 管理員可將活動標記為已確認，或改回待確認。
- 每次管理頁讀取與活動確認修改都會寫入 audit log。
- 活動確認 audit 只保存 `isAdminVerified` 白名單摘要，不保存活動全文或個資。
- 新增手機優先 `/admin` 頁面與 Phase 5 管理入口。

## 驗證結果

- D1 migration：10 個命令執行成功。
- TypeScript：shared、Worker、Web、根目錄 E2E 全部通過。
- ESLint：通過，0 warnings。
- Vitest：10 個測試檔、27 項測試全部通過。
- PWA production build：通過，管理頁為獨立 lazy chunk。
- Worker production bundle：通過。
- Playwright 完整回歸：Mobile Chromium 7/7、Desktop Chromium 7/7，共 14/14 通過。
- 修正後管理權限／活動確認案例再跑：2/2 通過。
- HTTP 證據：一般使用者 GET admin overview 為 403；管理員 GET 為 200；活動確認 PATCH 為 200。
- D1 證據：`admin.overview.read` 與 `event.verification.update` 已寫入 audit log。
- 活動確認 E2E 會鎖定同一活動切換後復原，不改變 seed 原始狀態。

## 安全邊界

- Demo header 身分只在 `ALLOW_DEMO_AUTH=true` 且非 Production 時有效。
- Production 不接受 Demo header，仍需接正式 session／身分提供端。
- CORS 只允許設定的單一 origin；OPTIONS 不符合時回 403。
- API 使用 secure headers，錯誤訊息不回傳例外內容或敏感資料。
- 正式環境 rate limit 應由 Cloudflare WAF／Rate Limiting 與持久化策略實作；不以單一 Worker isolate 的記憶體 Map 冒充正式限制。

## 已知限制

- 第一版管理後台完成摘要、活動確認與 audit；歌手、別名、售票時間、平台、Adapter、回報與通知的完整 CRUD 尚未實作。
- 正式 Cloudflare D1、正式 Auth、正式 WAF 與遠端部署未在本機 Phase 5 執行。
- D 槽為 exFAT，需使用 `scripts/setup-exfat.ps1` 完成 workspace 實體注入。
