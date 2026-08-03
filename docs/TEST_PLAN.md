# 追票雷達 Ticket Radar — Test Plan

## 1. 測試目標

驗證核心流程真實可運作，並以負向測試證明系統沒有自動刷新、選票、選位、送單、付款、CAPTCHA 或未經點擊填入等能力。

## 2. 測試層級

| 層級     | 工具                                      | 重點                            |
| -------- | ----------------------------------------- | ------------------------------- |
| 靜態檢查 | ESLint、TypeScript strict、Prettier check | 型別、規則、格式                |
| 單元測試 | Vitest                                    | 純函式、schema、Adapter 容錯    |
| 整合測試 | Vitest + Workers local/D1                 | route → service → repository    |
| 元件測試 | Testing Library                           | 表單、狀態、無障礙互動          |
| E2E      | Playwright + Chromium extension           | PWA → Demo → Extension → record |
| 安全檢查 | 測試 + manifest/CSP 靜態檢查              | 權限、個資、禁止自動化          |
| 視覺驗證 | Playwright screenshots                    | 手機／桌面、深色、錯誤狀態      |

## 3. 固定品質命令

Phase 1–5 建立後，根目錄提供：

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
pnpm check
```

`pnpm check` 依序執行 format check、lint、typecheck、test、build；E2E 可單獨執行以便載入擴充功能。

## 4. 單元測試

### 日期與時區

- UTC 儲存與 `Asia/Taipei` 顯示。
- 跨日、跨年與夏令時間時區。
- 無效 IANA timezone 被拒絕。
- 倒數到期後不出現負數錯誤。

### 提醒

- 7 天、1 天、1 小時、10 分鐘、1 分鐘前。
- 自訂時間。
- 計算結果在現在之前時的處理。
- 同一 reminder/channel 不重複送出。

### 搜尋與別名

- 繁中、英文、日文、韓文別名命中同一歌手。
- 大小寫、前後空白、Unicode 正規化。
- 活動、場館、城市、平台、日期與狀態組合篩選。
- 特殊字元不形成 SQL injection。

### 購票任務

- 準備度正確。
- 不適用項目不進分母。
- 0 個適用項目顯示 0%。
- 預算、票數、順位上限與錯誤訊息。

### 欄位對應

- 支援欄位才可填入。
- 找不到 selector 回傳 `not_found`。
- selector 指向錯誤元素時安全跳過。
- 票數、座位、條款、送出等欄位永遠 `blocked`。
- 沒有使用者 gesture 時不執行 `fillProfile`。

### 敏感資料遮罩

- 身分證、電話、信用卡樣式、地址、QR／barcode 容器。
- 空值、部分值、不同格式。
- 遮罩失敗回傳 failure，不宣稱成功。
- error／log serializer 移除個資。

### 訂單去重

- 相同平台 + 訂單編號只保存一次。
- 同頁面短時間 debounce。
- 沒有訂單編號時使用 fallback key。
- 不同訂單不被誤判為重複。

### Crypto

- 正確 PIN 可解密。
- 錯誤 PIN 不洩漏部分明文。
- 每次加密使用不同 IV。
- 變更 PIN 失敗時保留原資料。
- 明文與 PIN 不寫入 storage mock／log。

## 5. 整合測試

1. 建立歌手、別名、場館、平台與活動。
2. 建立售票時間窗並由活動詳情讀回。
3. 收藏／取消收藏具有 idempotency。
4. 建立購票任務與預設清單。
5. 更新清單並重新計算準備度。
6. 建立提醒，Cron 只處理到期項目。
7. Mock Email／disabled LINE 不阻塞 Web Push／ICS。
8. Extension storage repository 可加密保存／讀取資料組。
9. Demo Adapter 填入測試表單並逐欄回報。
10. 成功頁解析保留「訂單成立」與「已付款」差異。
11. 遮罩後呼叫 capture mock 並保存檔名。
12. 建立購票紀錄；重送 idempotency key 不重複。
13. 管理員 CRUD 產生 audit log。
14. 一般使用者無法呼叫 `/admin/*` 或讀取他人資料。
15. 資料匯出與帳號／資料刪除。

## 6. E2E 核心流程

### E2E-01 完整成功路徑

1. 啟動 local D1、Workers API 與 Web。
2. 載入測試版 Extension。
3. 使用者以別名搜尋歌手。
4. 打開 Seed 活動並檢查官方來源警語。
5. 收藏活動、建立購票任務。
6. 完成部分清單並確認準備度。
7. 建立提醒並下載／解析 ICS。
8. 開啟 Demo 售票頁。
9. Extension 顯示 Generic Demo 平台與活動。
10. 使用者解鎖、選擇資料組並按「填入資料」。
11. 驗證固定欄位已填，票數／條款／送出未操作。
12. 使用者手動勾選 Demo 條款並手動送出。
13. Extension 在已 opt-in 下偵測成功頁。
14. 驗證敏感區域已遮罩後才擷取。
15. 驗證本機截圖檔名。
16. PWA 顯示一筆遮罩後購票紀錄。

### E2E-02 安全失敗路徑

- 沒有 opt-in：不截圖、不建紀錄。
- 沒有使用者按鈕點擊：不填欄位。
- selector 失效：頁面不崩潰，顯示未找到清單。
- 敏感區域無法可靠遮蔽：不上傳、不自動保存，顯示取消／僅本機選項。
- 相同成功頁再次載入：不產生重複截圖或紀錄。
- 頁面文字只有「訂單成立」：不得標記為已付款。

## 7. API 與安全測試

- 401：未登入。
- 403：跨使用者資料、非管理員路由。
- 400／422：schema、UTC、URL、body size、enum 錯誤。
- 409：樂觀鎖／唯一限制衝突。
- 429：rate limit。
- CSRF token 缺少、錯誤與跨 origin。
- SQL injection／XSS payload 以純文字處理。
- Error response 不含 stack、SQL、secret 或輸入個資。
- Audit log 不含完整 email、電話、地址、訂單編號。
- Manifest 不含 `<all_urls>`。
- Content script 不包含 `setInterval` 刷新、表單 `submit()` 或自動 click 購票控制。

## 8. 無障礙與響應式

測試 viewport：

- 360 × 800（小型手機）。
- 390 × 844（常見手機）。
- 768 × 1024（平板）。
- 1440 × 900（桌面管理後台）。

檢查：

- 鍵盤可操作與清楚焦點。
- 控制項可存取名稱。
- 表單 label 與錯誤關聯。
- 觸控區域至少 44 px。
- 狀態不只靠顏色。
- 深色模式對比。
- `prefers-reduced-motion`。
- 200% zoom 不遺失主要功能。

## 9. 視覺證據

Phase 5 至少保存以下 Playwright 截圖：

- 手機首頁。
- 搜尋結果與篩選。
- 活動詳情與售票時間軸。
- 購票任務／準備度。
- 作戰模式倒數。
- Extension popup 填入結果。
- Demo 成功頁遮罩狀態（只使用假資料）。
- 購票紀錄。
- 管理後台。
- 深色模式與一個錯誤狀態。

所有截圖只使用 Seed 假資料。

## 10. 測試資料

- 不使用真實 email、電話、地址、訂單、信用卡或平台帳號。
- 固定 clock／timezone，避免時間型測試不穩。
- 每個測試建立並清理自己的 local D1。
- Extension 測試使用獨立 browser profile。

## 11. 完成 Gate

只有以下全部成立，才可標示 MVP 完成：

- [x] ESLint 通過。
- [x] TypeScript typecheck 通過。
- [x] 各 workspace Vitest 通過。
- [x] Production build／Worker dry-run 通過。
- [x] Playwright 手機與桌面 Chromium E2E 通過。
- [x] Adapter 網域偽裝與停用零操作安全測試通過。
- [ ] 完整深色模式、200% zoom、Extension 真實安裝與下載視窗人工驗收。
- [x] 沒有把已知且能由自動測試修復的 Bug 留給使用者。
- [x] Cloudflare 明確標示為「本機已驗證」，未宣稱 Production。

最後自動驗證日期：2026-07-29。完整證據見 `PHASE_1_REPORT.md` 至
`PHASE_6_REPORT.md` 與 `FINAL_DELIVERY.md`。

## 12. 手動驗收的最小範圍

Codex 完成自動測試後，使用者只需驗收涉及主觀觀感或本人瀏覽器權限的項目：

1. Chrome／Edge 顯示的 Extension 權限說明是否可接受。
2. 手機版資訊層級與文字是否符合偏好。
3. 正式 Cloudflare 授權與 secrets 設定（進入部署階段時）。

在請使用者驗收前，必須先附上已執行測試、結果、外部限制與唯一必要操作。
