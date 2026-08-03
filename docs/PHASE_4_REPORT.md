# Phase 4 完成報告

日期：2026-07-29

## 完成內容

- PWA 新增 `/records` 購票紀錄頁與底部導覽。
- Worker 新增購票紀錄 list/create API、D1 repository 與遮罩輸入驗證。
- D1 migration `0004_purchase_records.sql` 已在 D 槽本機資料庫成功套用。
- Generic Demo Adapter 可偵測成功頁、遮罩敏感 selector，且 selector 未命中時拒絕截圖。
- Extension popup 由使用者明確點擊後才執行成功頁確認、遮罩、可見分頁截圖與本機下載。
- 截圖完成或失敗後都會移除頁面遮罩。
- 截圖收據只保存本機檔名、時間與防重 key，不保存原始截圖或明文訂單號。
- 同分頁、同網址、同分鐘會阻止重複截圖；API 另以活動與遮罩訂單參考 hash 保持 idempotent。
- PWA Demo 成功頁可建立遮罩後紀錄，並在購票紀錄頁顯示。

## 驗證結果

- Prettier：通過。
- ESLint：通過，0 warnings。
- TypeScript：shared、platform-adapters、UI、Extension、Web、Worker、根目錄 E2E 全部通過。
- Vitest：10 個測試檔、27 項測試全部通過。
- Build：Extension、PWA、Worker bundle、shared、platform-adapters、UI 全部通過。
- D1：migration 5 個指令成功，seed 11 個指令成功。
- Playwright：Mobile Chromium 6/6、Desktop Chromium 6/6，共 12/12 通過。
- 實際 HTTP 記錄：`POST /api/v1/purchase-records` 回傳 201，`GET /api/v1/purchase-records` 回傳 200。

## 安全邊界

- 只允許 `http://127.0.0.1:5173/*` 受控 Demo。
- 不使用 `<all_urls>`。
- 不自動選票、送單、付款、操作 CAPTCHA 或刷新頁面。
- 遮罩無法可靠套用時取消截圖。
- 原始截圖只交由瀏覽器下載，不上傳 D1。
- 成功頁只建立「訂單已成立／付款待確認」，不推定已付款。

## 已知限制

- 自動測試未安裝真實 Chrome／Edge 使用者 Extension，因此 `captureVisibleTab` 與瀏覽器「另存新檔」視窗仍需在瀏覽器內人工驗收；核心偵測、遮罩、清理、檔名與防重已有單元測試與 production build。
- D 槽是 exFAT，不支援 pnpm workspace 需要的 symlink。專案提供 `scripts/setup-exfat.ps1`，在套件安裝後以實體副本注入 6 個內部 workspace 依賴。
- 正式 Cloudflare D1、正式登入與遠端部署不在 Phase 4 本機驗證範圍。
