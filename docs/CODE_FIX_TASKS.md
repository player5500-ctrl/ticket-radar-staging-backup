# 追票雷達 Ticket Radar — 修正任務清單（可直接交給 Codex / Claude Code）

盤點日期：2026-07-30
盤點方式：實際登入 Staging（`https://ticket-radar-web-staging.pages.dev`，帳號 `player5500@gmail.com`）操作瀏覽器逐項驗證，並比對程式碼稽核結果（`COWORK_STAGING_AUDIT.md`）。

> 注意：本次**沒有**在 Cowork 沙箱對 `D:\cowork files` 執行 `pnpm lint / typecheck / test / build`。原因：專案自己的 `_context/rules/sync-folder-hazards.md` 明確規定「同步夾跑 tsc/build 的結果不可信…型別與 build 驗證一律以 `C:\` 本機執行為準」，且 `18_ticket-radar/node_modules-isolated-failed-20260729/` 目錄本身就是先前一次在同步夾對 exFAT D 槽跑安裝失敗留下的證據。因此 lint/typecheck/test/build 這四項請 Vanny 在本機 `C:\` 環境執行，不建議在本沙箱重跑，以免產生不可信的假錯誤。`docs/FINAL_DELIVERY.md` 第 9 節記錄 2026-07-29 本機執行結果為全數通過（ESLint 0 warnings、TypeScript 通過、Vitest 31 項通過、Playwright 14/14+2/2 通過），但那是本機 MVP 版本的驗證，**不包含這次 Staging 部署後新增的 Cloudflare Access 相關程式碼路徑**，建議重新在本機跑一次完整 `pnpm check`。

---

## TASK-01：跨網域 Cloudflare Access 架構讓所有資料型 API 呼叫在使用者第一次使用時失敗（P0）

**問題描述**：PWA（`ticket-radar-web-staging.pages.dev`）與 Worker API（`ticket-radar-api-staging.vannyai.workers.dev`）是兩個不同網域，且都各自獨立掛了 Cloudflare Access（同一個 team `royal-hall-5179`，但 API 網域是**獨立的 Access Application**，有自己的 AUD `6f5d05d1...`）。使用者用 email OTP 登入 PWA 後，瀏覽器只拿到 PWA 網域的 Access session cookie；對 API 網域的 fetch 由於瀏覽器從未對該網域完成過一次「完整導覽＋Access 登入」，不具備該網域的 session cookie，導致：

- API 回應先是 `503`，接著瀏覽器嘗試自動跟隨 Cloudflare 的重新導向前往 API 網域自己的 Access 登入頁（`royal-hall-5179.cloudflareaccess.com/cdn-cgi/access/login/ticket-radar-api-staging.vannyai.workers.dev?...`）。
- 這個重新導向是給「完整頁面導覽」設計的互動流程（要跳轉、要 OTP），`fetch()`/XHR 呼叫無法完成這個流程，請求會卡住或被 CORS 擋下。
- 前端因此永遠停在 loading 狀態（首頁搜尋顯示「正在掃描演出資料…」不會結束；`/tasks`、`/records` 也是同樣情形）。

**重現步驟**：

1. 開無痕視窗（確保沒有任何 Cloudflare Access cookie）。
2. 前往 `https://ticket-radar-web-staging.pages.dev`，用任一已授權 email 完成 OTP 登入。
3. 在搜尋框輸入任意關鍵字並送出（或直接點底部導覽「任務」）。
4. 觀察畫面卡在「正在掃描演出資料…」/「正在整理你的購票準備…」永不結束。
5. 打開瀏覽器 Network 面板可看到對 `ticket-radar-api-staging.vannyai.workers.dev/api/v1/...` 的請求回應 `503`，緊接著出現一筆對 `royal-hall-5179.cloudflareaccess.com/cdn-cgi/access/login/...` 的請求，狀態一直是 `pending`。
6. 若改成在同一瀏覽器分頁「直接導覽」到 `https://ticket-radar-api-staging.vannyai.workers.dev/api/v1/search?q=test`（完整網址列輸入，不是 fetch），因為使用者已在 team domain 完成過 OTP，Cloudflare 會用團隊層級的 SSO 靜默完成第二個 Access Application 的登入，之後回到 PWA 重新操作就會正常。但一般使用者不會知道要這樣做。

**預期結果**：使用者只需完成一次登入，PWA 內所有頁面（搜尋、任務、紀錄、我的）都應該能正常讀寫資料，不需要額外手動導覽 API 網域。

**實際結果**：任何新 session 的使用者，只要沒有手動完整導覽過 API 網域一次，PWA 裡所有需要打 API 的畫面都會卡死在 loading，且沒有任何錯誤訊息告知原因。

**推測根因**：架構把「給人看的網頁」與「給程式呼叫的 API」放在兩個不同 hostname，並各自獨立套用 Cloudflare Access（一種為互動式登入設計的機制），而不是：(a) 用同一個 Access Application／同一個 zone 涵蓋兩個 hostname，或 (b) 讓 PWA 對 API 的呼叫改走同網域的 reverse proxy／rewrite（例如 Cloudflare Pages Functions 或同網域路徑轉發），或 (c) 在 API 端另外接受非互動式的驗證方式（Service Token）並由前端在必要時使用。

**涉及檔案**：

- `workers/api/wrangler.toml`（`env.staging` 的 `ACCESS_AUD`／`ACCESS_TEAM_DOMAIN` 設定）
- `apps/web/src/services/api.ts`（`VITE_API_BASE_URL` 指向跨網域 API）
- Cloudflare Zero Trust 後台的 Access Application 設定（不在程式碼庫內，需要有權限的人一起檢視）

**修正建議（擇一，需要架構決策，不建議由工程師自行選擇）**：

1. 將 API 改為同網域路徑（例如 `https://ticket-radar-web-staging.pages.dev/api/*` 透過 Cloudflare Pages Functions 或 Worker route 轉發到現有 Worker），只在最外層網域套一個 Access Application，PWA 與 API 自然共用同一組 session cookie。
2. 或者維持兩個網域，但把 API 網域的 Access Application 設定改成允許 Service Token／或關閉 Access 改由應用層 `auth.ts` 的 JWT 驗證獨立把關（`auth.ts` 本來就有自己的 Cloudflare Access JWT 驗證邏輯，第二層 Cloudflare Access Application 保護可能是重複保護，反而造成這個問題）。
3. 若決定保留現況，至少要在前端加上偵測與提示：偵測到 API 呼叫失敗時，不要無限轉圈，改成明確提示「請先完整開啟 API 網址完成一次驗證」並提供可點擊連結，作為過渡方案。

**驗收條件**：在全新無痕視窗、僅完成一次 PWA 登入（不手動導覽 API 網域）的情況下，搜尋、任務、紀錄頁都能在合理時間內（例如 5 秒）顯示資料或正確的空狀態，不會無限 loading。

**優先級**：P0（阻斷 Staging Ready）

---

## TASK-02：活動詳情頁「＋ 建立購票任務」按鈕點擊無反應（P0）

**問題描述**：在活動詳情頁（例如 `/events/event-stellar-route-taipei`）點擊右側「建立購票任務」按鈕，沒有任何視覺變化：沒有彈出視窗、沒有導頁、沒有 toast 提示，瀏覽器 Network 面板在點擊前後沒有新增任何 API 請求。用 accessibility tree 確認按鈕確實存在且可點擊（`type="button"`），但沒有觀察到任何副作用。

**重現步驟**：

1. 登入後前往任一活動詳情頁。
2. 點擊「建立購票任務」按鈕。
3. 觀察畫面（無變化）與 Network 面板（無新請求）。

**預期結果**：依產品規格（`docs/PRODUCT_SPEC.md`／使用者需求第三節），應該要能設定預算、票數、場次順位、區域順位，並呼叫後端 `POST /api/v1/ticket-tasks` 建立任務、同時建立 9 項預設準備清單（後端邏輯已存在，見 `ticket-task.repository.ts:106-234` 的 `createTask`）。

**實際結果**：前端完全沒有反應，功能實際上無法使用。

**推測根因**：可能是（a）按鈕的 `onClick` 尚未接上任何 handler（純樣式佔位），或（b）有接 handler 但開啟的 modal/drawer 元件渲染失敗且被 CSS 隱藏、或條件判斷有誤導致永遠不顯示，或（c）該功能其實依賴 TASK-01 的 API 呼叫，但正常應該先開啟本地表單 UI 再送出，不應該連「開啟表單」這一步都無法觸發。建議先用 React DevTools／原始碼確認 `EventDetailPage.tsx` 裡這顆按鈕綁定的函式内容。

**涉及檔案**：`apps/web/src/pages/EventDetailPage.tsx`（或其子元件，需搜尋「建立購票任務」文字所在檔案）

**驗收條件**：點擊後應出現任務建立表單（預算、張數、場次順位、區域順位、準備清單），送出後能在 `/tasks` 頁看到新任務，重新整理／登出重新登入後資料仍存在。

**優先級**：P0（阻斷使用者需求第三節「建立購票任務」全流程驗收）

---

## TASK-03：活動詳情頁「加入行事曆提醒」按鈕點擊無反應（P1）

**問題描述**：售票時間軸每個節點旁的「加入行事曆提醒」按鈕，點擊後同樣沒有任何視覺變化或 API 請求，無法確認是否真的建立了提醒或觸發 `.ics` 下載。

**重現步驟**：同 TASK-02，改點「加入行事曆提醒」按鈕。

**預期結果**：依 `docs/FINAL_DELIVERY.md` 第 8 節與程式碼 `apps/web/src/services/ics.ts`，應該觸發瀏覽器下載一個 `.ics` 檔案，或至少呼叫 `POST /api/v1/reminders` 記錄提醒。

**實際結果**：無任何反應，Network 面板無新請求，也沒有觀察到檔案下載提示。

**涉及檔案**：`apps/web/src/pages/EventDetailPage.tsx`、`apps/web/src/services/ics.ts`

**驗收條件**：點擊後應觸發 `.ics` 下載或跳出提醒建立確認，並可在 `/tasks` 頁「提醒與行事曆」區塊看到該筆提醒。

**優先級**：P1（次要功能，但目前完全無法使用）

---

## TASK-04：登出後直接開啟受保護頁面，畫面無限轉圈、沒有導回登入或提示重新登入（P1）

**問題描述**：完成 Cloudflare Access 登出（`/cdn-cgi/access/logout` 顯示成功）後，直接在網址列輸入受保護頁面（例如 `/tasks`），畫面卡在「正在整理你的購票準備…」無限轉圈超過數秒，沒有跳轉回登入頁，也沒有任何「請重新登入」的錯誤提示。

**重現步驟**：

1. 登入後點右上角「登出」，確認出現 Cloudflare「Success! You successfully logged out.」畫面。
2. 直接在網址列輸入 `https://ticket-radar-web-staging.pages.dev/tasks`。
3. 觀察畫面持續顯示 loading 動畫，長時間不結束。

**預期結果**：未登入使用者存取受保護頁面，應該要嘛被 Cloudflare Access 攔截導向登入頁，要嘛前端偵測到 401 後導向明確的「請重新登入」畫面。

**實際結果**：無限 loading，使用者無法判斷是網路問題、程式當機、還是需要重新登入。

**推測根因**：可能與 TASK-01 同源——前端的資料請求失敗後沒有「未登入」錯誤處理分支，只有通用的 loading／(可能有的)一般錯誤處理，401 情境被忽略。也可能是 Cloudflare Pages 的靜態資源本身沒有被 Access 保護（只有 API 才被 Access 擋），導致 SPA 殼永遠能載入，但內部資料請求失敗後沒有對應的 UI 狀態。

**涉及檔案**：`apps/web/src/services/api.ts`（錯誤處理／401 分支）、`apps/web/src/app/router.tsx` 或相關的資料載入 hook

**驗收條件**：登出後嘗試開啟任何受保護頁面，應在合理時間內看到清楚的「請重新登入」提示或自動導向登入頁，不應無限 loading。

**優先級**：P1

---

## TASK-05：Staging 環境的搜尋失敗錯誤訊息使用本機開發文案，會誤導驗收人員（P2）

**問題描述**：（此問題只有在使用者已先手動解決 TASK-01 的跨網域驗證問題後才會在正常操作中看到，但也可能在其他 503 情境出現）搜尋失敗時顯示的錯誤卡片文案為「搜尋失敗，請確認本機 Worker 與 D1 已啟動」，這是本機開發（`pnpm dev`）情境的除錯提示，出現在 Staging／未來 Production 環境會讓非工程背景的驗收者誤以為要自己啟動本機服務，或誤判問題方向。

**重現步驟**：在尚未對 API 網域完成 Access 驗證的情況下於 Staging 執行搜尋，錯誤卡片會顯示此文案（見 TASK-01 重現步驟第 6 步之前的畫面）。

**涉及檔案**：需搜尋前端程式碼中「本機 Worker 與 D1」或「訊號暫時中斷」等字串所在的錯誤狀態元件（推測在 `apps/web/src/pages/SearchPage.tsx` 或共用的錯誤卡片元件）。

**修正建議**：依環境變數（`import.meta.env.DEV` 或環境旗標）顯示不同文案：本機顯示技術性除錯訊息，Staging／Production 顯示對一般使用者友善的訊息（例如「暫時無法取得資料，請稍後再試」），並提供「重新連線」按鈕（目前已有此按鈕，只是文案需要環境區分）。

**優先級**：P2

---

## TASK-06（觀察，非必須立即修）：ARCHITECTURE.md／SECURITY.md 對已完成功能的宣稱超前於實作

依 `COWORK_STAGING_AUDIT.md` 第 2、3、4、9 節，以下文件宣稱與實作有落差，建議在下一輪文件維護時一併更新，避免未來開發者誤信文件：

- `/me/export`、`/me/data` 等自助資料 API：文件有寫，程式碼沒有。
- CSRF token 機制：文件寫「token + origin」雙重防護，程式碼只有 origin 比對。
- Web Push／Email／LINE 提醒 provider：文件寫有 Mock/Disabled provider，程式碼完全沒有對應檔案。

**優先級**：P3（文件債，不影響功能，但會誤導後續維護者）
