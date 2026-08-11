# Internal Closed Beta 驗收結果

驗收日期：2026-08-11
驗收人：Claude（Product Owner 帳號代測）＋ Product Owner 本人（Cloudflare Access 登入）
環境：Staging（`ticket-radar-web-staging.pages.dev`），非 Production。

## 1. 測試範圍與方式說明（誠實區分）

本文件分兩類結果：

- **「Claude 已親自驗證」**：透過已連線的瀏覽器，以 Product Owner 帳號（Cloudflare Access OTP 由 Product Owner 本人登入後交接）實際點擊、送出表單、讀取網路請求（含 API 回應內容）驗證。
- **「需真人測試者，本次尚未完成」**：需要 3 位指定測試者（`player5500@gmail.com`、`andy10302744@gmail.com`、`Chocolatesc@gmail.com`）以自己的 Email 收 OTP 登入才能做的項目。Claude 沒有這些信箱的存取權限，無法代為完成，本次僅完成 Product Owner 帳號的單人測試。

## 2. Access 白名單鎖定（Claude 已親自驗證）

用腳本對主網域、Worker API、隨機 wildcard 子網域、24 個歷史 Pages deployment URL（共 27 個網址）做無 cookie 掃描：

- 302（Access 攔截）：27
- 404：0
- 未授權 200：0

判定：**Access Ready**，白名單外的人一律進不去。

## 3. Beta UI 標示（Claude 已親自驗證，程式碼 + 線上畫面雙重確認）

- 原始碼確認：`apps/web/src/components/AppLayout.tsx` 有 `INTERNAL BETA` 徽章、「🐞 回報問題」連結（連到 `/feedback`）、頁尾 `role="note"` 兩段安全聲明。
- 線上畫面確認：截圖顯示 Staging 首頁確實顯示上述三項，與程式碼一致。
- 這幾個檔案原本是「已部署、未 commit」狀態，已於本次驗收中補 commit 並 push 到 GitHub（commit `e45917c`）。

## 4. 登入流程（Claude 已親自驗證機制，實際登入由 Product Owner 本人完成）

- 點擊「重新登入」會導到 `royal-hall-5179.cloudflareaccess.com` 的 Cloudflare Access OTP 頁面，要求輸入 Email 收驗證碼，機制正常運作。
- Claude 沒有信箱可收碼，此步驟由 Product Owner 本人完成登入後，Claude 接手已登入的瀏覽器 session 繼續測試。

## 5. Product Owner 帳號核心流程實測結果

| 項目 | 結果 | 備註 |
|---|---|---|
| 登入 | ✅ 通過 | Access OTP 正常，登入後導回首頁 |
| 首頁 | ✅ 通過 | 卡片、追蹤歌手、即將開賣賽道正常顯示 |
| 搜尋頁 | ✅ 通過 | 篩選欄位、掃描狀態文字正常顯示 |
| 活動詳情頁 | ✅ 通過 | 時間軸、售票階段、官方連結提示正常 |
| 收藏 / 取消收藏 | ✅ 通過 | 以網路請求確認：`DELETE /api/v1/events/.../favorite` → 200（取消收藏成功，按鈕變 `☆ 收藏活動`），`POST` 同路徑 → 重新收藏成功 |
| 建立購票任務 | ⚠️ **有條件通過，發現 P1 bug（見第 6 節 BUG-01）** | 用預設欄位值直接送出會失敗（422，且無任何錯誤提示）；手動清空欄位重填正確數值後，送出成功（200），任務正確出現在 `/tasks`，含 9 項 checklist |
| 任務 checklist 勾選 | ✅ 通過 | `PATCH /api/v1/ticket-tasks/{id}/checklist/{itemId}` → 200，狀態即時更新 |
| `/tasks` 列表 | ✅ 通過 | 正確列出多筆既有任務與新建任務 |
| `/records` 購票紀錄列表 | ✅ 通過（僅檢視） | 既有紀錄正確顯示（遮罩訂單號、張數、本機截圖狀態） |
| 手動新增購票紀錄 | ⚠️ **未完成** | 在 `/records` 頁面沒有找到手動新增紀錄的按鈕；清單中有一筆標示來源 `manual` 的紀錄，代表功能存在，但入口位置本次未找到，需要真人測試者或 Extension 使用者協助確認 |
| 提醒／行事曆匯出 | ✅ 通過（功能存在） | 活動詳情頁每個售票階段皆有「加入行事曆 (下載 .ics)」按鈕；未實際下載驗證檔案內容 |
| 手機版面 | ⚠️ **未完成** | 瀏覽器 resize 工具在本次環境下沒有正確觸發行動版 viewport，畫面仍以桌面寬度渲染，無法在本次驗收中確認手機版面，需要真人測試者用實機或正確的裝置模擬確認 |
| 登出／重新登入資料保存 | ⚠️ **未完成** | 尚未實測此項目 |

## 5b. Admin 權限保護（Claude 已親自驗證）

### 已確認的事實

- Product Owner 帳號實際身分（直接呼叫 `/api/v1/auth/session` 取得）：
  - Email `player5500@gmail.com`、`role: "admin"`
- `/admin` 頁面對 admin 正常開啟，顯示「管理後台」與 Beta 指標（歌手 4、活動 29、待確認活動 2、待處理回報 0、通知失敗 0）。
- Admin API 對 admin 全部回 200：`/api/v1/admin/overview`、`/api/v1/admin/event-candidates`、`/api/v1/admin/event-sources`。
- 後端授權為真：`workers/api/src/auth.ts` 的 `requireAdminId()` 每次都直接查 D1 的 `users.role`，非 admin 或非 active 一律回 **403 `ADMIN_REQUIRED`**，不是只靠前端隱藏按鈕。
- 前端 `AdminGuard.tsx` 另外在 `role !== "admin"` 時 `Navigate to="/"`，屬第二層保護。
- 新使用者第一次登入時（`auth.ts` 第 118 行）`INSERT INTO users ... role` 硬寫死 `'user'`，**不可能有人自動變成 admin**。

### 尚未驗證的部分

- 三位測試者的實際 role 值尚無法直接查看：Beta 指標「最近登入使用者 = 1」，代表**目前只有 Product Owner 登入過**，另外三位在 D1 裡還沒有 user 資料列。
- 因此「一般使用者被 403 擋在 `/admin` 外」目前是**程式碼層面確認**，還缺一次真人實測。等測試者登入後，請他們直接開 `https://ticket-radar-web-staging.pages.dev/admin`，正常行為應該是被踢回首頁、且看不到「⚙️ 管理後台」按鈕。
- Claude 的沙箱沒有 Cloudflare 憑證（無 wrangler），無法直接跑 D1 查詢。若要用 D1 確認角色，請在 Windows 本機執行：
  ```
  wrangler d1 execute <DB_NAME> --remote --command "SELECT email_normalized, role, status FROM users WHERE deleted_at_utc IS NULL"
  ```

## 6. 發現的 Bug（詳見 `BETA_BUG_BACKLOG.md`）

- **BUG-01（P1）**：「建立購票任務」精靈的「單張預算上限」欄位，程式碼裡用 `useState("4800")` 當初始值（`ProtoTaskWizardModal.tsx` 第 18 行），畫面上跟 placeholder 文字一模一樣（`例如: 4800`），使用者無法從外觀分辨這是「真的已經有值」還是「範例提示文字」。如果測試者直接點進欄位輸入自己的預算而沒有先清空，會變成兩段數字接在一起（例如打「1500」變成「45001500」），送出後端會用 422 拒絕（`Number must be less than or equal to 1000000`），但前端完全沒有顯示任何錯誤訊息，畫面看起來就像按鈕沒反應。這會讓測試者誤以為「建立購票任務」這個必測核心流程壞掉。

## 7. 尚未完成、需要 Vanny／真人測試者協助的項目

1. 3 位測試者（player5500、andy10302744、Chocolatesc）本人登入與核心流程實測 — 需要他們自己收 Email OTP，Claude 無法代勞。
2. D1 直接查角色：Product Owner `role='admin'` 已確認（見 §5b）；3 位測試者尚未登入過，D1 內還沒有他們的資料列，等他們登入後可用 §5b 的 wrangler 指令核對 `role='user'`。
3. 一般使用者（非 admin）是否真的無法進入 `/admin` — 程式碼層面已確認 403 保護為真（見 §5b），仍缺一次真人實測。
4. User A / User B 資料隔離 — 需要至少兩位不同角色的真人各自登入後比對。
5. 手動新增購票紀錄的入口 — 需要再確認一次是否只能透過瀏覽器 Extension 建立。
6. 手機版面與橫向捲動檢查 — 需要真人用實機或正確的裝置模擬完成。
7. 登出再登入資料保存 — 尚未實測。

## 8. 【最高優先修復】

1. BUG-01：購票任務精靈預算欄位預設值誤導 + 送出失敗無錯誤提示（P1，建議修復後再讓真人測試者測「建立購票任務」）。

## 9. 【版本判定】

**Internal Closed Beta Running**

理由：Access 白名單鎖定完成、Beta UI 標示與安全聲明已上線、Product Owner 本人可完整登入並操作大部分核心流程（收藏、建立任務、checklist、查看紀錄）。但尚有 1 個 P1 bug（BUG-01）與多項需要真人測試者才能完成的驗收項目未完成，建議：先修 BUG-01，再請 3 位測試者依 `BETA_TEST_CHECKLIST.md` 各自測試並回報，最後才能評估是否達到「Closed Beta Ready」。本階段仍非 Production Ready。
