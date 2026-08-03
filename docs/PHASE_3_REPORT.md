# Phase 3 完成報告：Extension 與 Generic Demo

完成日期：2026-07-29

## 交付內容

- 新增 Manifest V3 Extension：`apps/extension/`。
- 權限只包含 `storage`、`activeTab`、`scripting`；host 僅限 `http://127.0.0.1:5173/*`，沒有 `<all_urls>`、cookies、history、webRequest 或全域 tabs 權限。
- 資料組以 PBKDF2-SHA-256（600,000 iterations）衍生 AES-GCM 金鑰；每次加密建立新的 salt 與 96-bit IV，PIN 不保存。
- 加密資料只放在 `chrome.storage.local`；PWA 與 API 不接收解密後資料組。
- 共用 schema 與 Extension storage 同時拒絕密碼、OTP、卡號、CVV、CAPTCHA、網銀與身分證資料。
- Generic Demo Adapter 只識別受控 Demo 頁、只填入姓名／Email／手機三個明確欄位，逐欄回報結果。
- 填入必須由 popup 的使用者明確按鈕觸發；不會選票、座位、數量、條款、送出、付款、排隊或 CAPTCHA。
- PWA 新增 `/demo-ticket`，讓使用者手動操作票種、張數與 Demo 送出。

## 建置與驗證

- `pnpm test`：18 個單元／元件／Adapter／加密測試通過。
- `pnpm build`：PWA、Extension、共享套件與 Worker dry-run 通過。
- `pnpm test:e2e`：10/10 通過，手機與桌面都確認 Demo 頁的票種、張數與送出維持使用者手動控制。
- 已檢查 `apps/extension/dist/manifest.json`：未含 `<all_urls>`，且只列最小權限。

## 手動驗證邊界

Extension 尚未安裝到 Chrome／Edge，因此「載入未封裝擴充功能」及 popup 對受控 Demo 頁的實際訊息傳遞，仍需要在使用者本機瀏覽器中手動確認。這不影響已完成的 TypeScript、加密、Adapter、產物 Manifest 與 PWA E2E 驗證。

## 下一階段

Phase 4 會新增成功頁偵測、遮罩後截圖與購票紀錄；原始截圖不會上傳雲端。
