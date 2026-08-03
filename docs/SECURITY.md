# 追票雷達 Ticket Radar — Security & Privacy

## 1. 安全目標

1. 不把 Ticket Radar 變成自動搶票、繞過限制或批次操作工具。
2. 最小化購票個資的收集、傳輸與保存。
3. 即使截圖遮蔽失敗，也不把可能含敏感資訊的圖片上傳雲端。
4. 所有管理與資料寫入都經過身分、權限、輸入驗證與稽核。
5. 錯誤、log、analytics 不包含個資或 secrets。

## 2. 威脅模型

| 威脅                   | MVP 控制                                                |
| ---------------------- | ------------------------------------------------------- |
| 惡意頁面偽裝售票頁     | domain 白名單、Adapter `detectPage`、popup 顯示平台     |
| 未經同意自動填入       | 填入只由 popup 使用者點擊觸發，不設 timer／自動流程     |
| 擴充功能本機資料被讀取 | PIN + Web Crypto 加密、最短解鎖時間、禁止明文 log       |
| 弱 PIN 暴力破解        | PBKDF2／Argon2 可替換設計、隨機 salt、高迭代、嘗試延遲  |
| Selector 失效填錯欄位  | 白名單欄位、selector 集中、逐欄結果、敏感 selector 排除 |
| XSS／惡意使用者內容    | React 文字渲染、禁止未清理 HTML、CSP、輸入長度限制      |
| CSRF                   | SameSite session + CSRF token／Origin 驗證              |
| API 濫用               | 身分／所有權、分路由 rate limit、body size、idempotency |
| SQL injection          | Zod + repository 參數化查詢                             |
| 截圖洩密               | opt-in、DOM 遮罩、可靠性檢查、本機保存、預設不上傳      |
| 重複截圖／紀錄         | debounce + idempotency key + D1 唯一限制                |
| 管理員濫權或誤改       | RBAC、關鍵異動 audit log、before／after 安全摘要        |
| Supply-chain           | lockfile、版本審查、依賴掃描、最小依賴                  |

## 3. 擴充功能權限

MVP Manifest V3 預計權限：

| 權限        | 用途                               | 限制                             |
| ----------- | ---------------------------------- | -------------------------------- |
| `storage`   | 保存加密資料組、設定與 idempotency | 不保存明文 PIN／個資             |
| `activeTab` | 使用者操作時存取當前分頁           | 不常駐讀取所有網站               |
| `scripting` | 在支援頁面執行偵測／填入／遮罩     | 只由使用者操作或明確 opt-in 流程 |
| `downloads` | 保存遮蔽後的本機截圖               | 不自動上傳                       |

`host_permissions`：

- Phase 3 只列 Demo 頁面的 localhost／正式 Demo origin。
- Phase 6 經審查後，才逐一加入 KKTIX／TixCraft 的精確 HTTPS host pattern。
- 禁止 `<all_urls>`。

不申請 cookies、history、webRequest、tabs 全域存取等非必要權限。若 `captureVisibleTab` 的瀏覽器實作需要額外權限，須在 Phase 4 以 Chrome／Edge 官方需求實測後記錄，不先擴權。

## 4. 本機資料加密

建議 envelope：

```ts
type EncryptedEnvelope = {
  version: 1;
  algorithm: "AES-GCM";
  kdf: "PBKDF2-SHA-256";
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
  createdAt: string;
};
```

規則：

- PIN 不保存；使用 PIN + 隨機 salt 派生 AES-GCM key。
- 每次加密使用新的 96-bit IV。
- salt、IV 可保存，解密金鑰只存在記憶體。
- 擴充功能鎖定、service worker 終止或逾時後清除記憶體金鑰。
- 不在 console、錯誤追蹤、analytics 或 audit log 輸出明文 profile。
- 變更 PIN 時先以舊 PIN 解密，再以新 salt／key 重新加密；中途失敗保留原 envelope。
- Phase 3 以當時瀏覽器支援與效能測試決定 PBKDF2 iteration；不可硬寫未驗證的低安全值。

## 5. 禁止資料

UI、Zod schema、storage repository 都拒絕：

- 售票平台密碼。
- OTP／一次性驗證碼。
- 信用卡安全碼。
- 網路銀行資訊。
- CAPTCHA。
- 身分證正反面照片。

信用卡完整號碼也不在 MVP 可保存欄位中。若發票資訊包含統編或地址，仍視為個資，僅在裝置端加密保存。

## 6. 截圖遮蔽

必須遮蔽：

- 身分證號。
- 完整電話。
- 信用卡資訊。
- 完整地址。
- QR Code、條碼、取票驗證碼。
- 可被冒用的訂單或會員識別資訊。

策略：

1. Adapter 提供 `getSensitiveSelectors()`。
2. 通用文字規則只作第二層保護，不單獨宣稱可靠。
3. 在 DOM 上加入不透明遮罩後，再擷取可見分頁。
4. 檢查必要敏感區域是否都已命中。
5. 若不可靠：不建立雲端圖片、不自動保存；顯示警告，只允許本機保存或取消。
6. 擷取完成後以 `finally` 移除遮罩。
7. 僅同步遮罩後中繼資料；原圖不上傳。

圖片檔名先將歌手／平台／狀態正規化並移除路徑控制字元：

```text
歌手名稱_活動日期_售票平台_訂單狀態_YYYYMMDD-HHmmss.png
```

## 7. Web 與 API 安全

### CSP

初始策略以 deny-by-default 設計，Phase 1 依 Vite PWA 實測調整 nonce／hash：

```text
default-src 'self';
base-uri 'self';
object-src 'none';
frame-ancestors 'none';
form-action 'self';
img-src 'self' https: data:;
font-src 'self';
style-src 'self';
script-src 'self';
connect-src 'self' <local-api> <production-api>;
worker-src 'self';
manifest-src 'self';
```

正式 CSP 不以長期加入 `'unsafe-inline'` 作為捷徑。

### XSS

- 不使用未清理的 `dangerouslySetInnerHTML`。
- 使用者輸入與官方公告解析結果預設以純文字顯示。
- 外部 URL 限 `https:`，localhost 開發例外由環境設定控制。
- 新分頁連結使用 `rel="noopener noreferrer"`。

### CSRF

- 正式 session cookie：`Secure`、`HttpOnly`、`SameSite=Lax/Strict`。
- 狀態改變請求驗證 CSRF token 和 `Origin`。
- Extension API 若使用短期 bearer token，token 不進 log 並限制 audience／scope。

### Rate limit

至少分組：

- 公開搜尋：以 IP hash + route 限速。
- 使用者寫入：以 user id + route 限速。
- 登入／PIN 無關；Extension PIN 永不送 API。
- 管理員異動：較低速率並 audit。
- notification／report：防重與每日上限。

具體數值需在 Phase 1 根據 Cloudflare 方案與合理流量設定，先寫為可配置 binding，不硬編碼 secrets。

## 8. Log 與錯誤

- 每個 request 產生 request id。
- 記錄 route、status、duration、穩定 error code；不記錄 request body、cookie、authorization、email、電話、地址、訂單全文。
- IP 僅保存帶輪替 salt 的 hash，並設定保留期。
- 前端錯誤不包含 selector 擷取到的 value。
- API Production 不回傳 stack、SQL、binding 名稱或 provider secret。
- analytics 只收匿名產品事件，不收搜尋框中的任意文字或購票資料。

## 9. 權限與 Audit

- `user` 只能讀寫自己的收藏、任務、提醒與紀錄。
- `admin` 權限由 server session claim + 資料庫狀態共同確認。
- 角色變更、活動驗證、售票階段異動、Adapter 狀態、使用者報告處理都建立 audit log。
- audit 的 before／after 只包含欄位白名單與遮罩內容。

## 10. 資料匯出與刪除

- PWA 可匯出使用者在 D1 的資料。
- Extension 可匯出加密備份；若匯出明文，必須再次解鎖並顯示明確風險。
- 支援刪除單一資料組、清除所有本機資料、刪除雲端資料與刪除帳號。
- 不能從瀏覽器擴充功能靜默刪除使用者下載資料夾中的既有截圖；必須明確說明。

## 11. 合規與平台審查 Gate

啟用任何真實平台 Adapter 前必須：

1. 查閱該平台當下有效的服務條款與自動化限制。
2. 只列出固定身分／聯絡欄位 selector。
3. 確認沒有選票、座位、數量、條款、送出、付款、排隊或 CAPTCHA 操作。
4. 使用測試環境或取得平台允許的方式驗證。
5. 記錄 Adapter 最後確認日期與版本。
6. Selector 無法確認時保持 `disabled`。

## 12. 上線前安全 Gate

- [ ] CSP 在 Web 與 Extension 都通過瀏覽器檢查。
- [ ] Manifest 沒有 `<all_urls>` 或無關權限。
- [ ] Secrets 只存在 Cloudflare／本機未追蹤環境。
- [ ] D1 migration 已在備份後執行。
- [ ] Auth、CSRF、RBAC、rate limit 測試通過。
- [ ] 個資沒有出現在 console、network error、audit 或 analytics。
- [ ] 截圖遮蔽的正向／失敗／取消流程都通過。
- [ ] 禁止自動購票的負向測試全部通過。
- [ ] 相依套件與 lockfile 已審查。
