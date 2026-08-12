# Beta Bug Backlog

分級定義（與 `INTERNAL_CLOSED_BETA.md` 一致）：
P0＝立即停止 Beta；P1＝修復後再繼續；P2＝可持續測試但需排程；P3＝記錄即可。

| ID | 嚴重度 | 標題 | 狀態 | 頁面/流程 | 描述 | 重現步驟 | 建議修法 |
|---|---|---|---|---|---|---|---|
| BUG-01 | P1 | 建立購票任務：預算欄位預設值與 placeholder 視覺相同，送出失敗無錯誤提示 | **已修復並於 Staging 驗證通過（2026-08-12）** | 活動詳情頁 →「🚀 建立購票任務與志願順位」精靈 Step 1 | `ProtoTaskWizardModal.tsx` 第 18 行 `useState("4800")` 讓「單張預算上限」欄位一開始就是真實值 `4800`，畫面樣式與 `placeholder="例如: 4800"` 完全相同，測試者無法分辨。若使用者未先清空欄位就直接輸入預算，新輸入會接在 `4800` 後面（例如打 `1500` 變成 `45001500`），送出後端 `/api/v1/ticket-tasks` 回 422（`Number must be less than or equal to 1000000`），但前端沒有顯示任何 toast／錯誤訊息，UI 停在同一頁，看起來像按鈕沒反應。 | 1. 登入後開啟任一活動詳情頁 2. 點「建立購票任務與志願順位」 3. 不要清空「單張預算上限」欄位，直接輸入任意數字，例如 `1500` 4. 走完 Step 2、Step 3 並勾選確認框 5. 點「完成建立任務」→ 畫面沒反應，開發者工具可見 API 回 422 | 1. 欄位初始值改為空字串（`useState("")`），只保留 placeholder 提示 2. 前端加上 `max` 驗證與清楚錯誤訊息 3. `TicketTaskForm.tsx`（Header 保護版）與 `ProtoTaskWizardModal.tsx`（Beta 目前實際使用版）都要檢查是否有同樣問題 4. mutation 失敗時要在 UI 顯示錯誤（呼應 `report.isError` 在 `FeedbackPage.tsx` 已有的良好範例） |
| BUG-02 | P3 | 手動新增購票紀錄的入口本次未找到 | 待確認 | `/records` | `/records` 列表可正確顯示既有紀錄（含一筆來源標示 `manual` 的紀錄），但頁面上沒有找到「新增紀錄」按鈕，不確定是否只能透過瀏覽器 Extension 建立。 | 登入後開啟 `/records`，檢視頁面是否有新增/手動輸入紀錄的按鈕。 | 確認手動建立紀錄的正確入口（是否僅限 Extension），若 Web 端本來就不支援，建議在 `INTERNAL_CLOSED_BETA.md` 或 `BETA_TEST_CHECKLIST.md` 註明「購票紀錄僅能透過 Extension 建立」，避免測試者誤以為壞掉。 |
| BUG-03 | P3 | 本次驗收未能確認手機版面 | 待確認 | 全站（行動裝置） | 本次驗收使用的瀏覽器自動化工具未能正確觸發行動版 viewport（resize 後畫面仍以桌面寬度渲染），因此手機版面、有無橫向捲動等項目本次無法確認。 | 需要真人測試者用實機（或正確設定的裝置模擬）開啟 Staging 網址檢查。 | 待真人測試者以手機實測後回報，若有問題再記錄嚴重度。 |

## BUG-04（P1）搜尋框中文輸入法（注音）無法選字 — 已修復並於 Staging 驗證通過（2026-08-12）

**現象**：Product Owner 實測回報，`/search` 關鍵字欄位用注音輸入時，注音符號（如「ㄅㄚㄙㄢㄧㄠ」）直接掉進欄位、無法組字選字，搜尋一律 0 結果。中文是本產品主要使用語言，搜尋是核心流程，判 P1。

**根因**（`ProtoSearchPage.tsx`）：關鍵字欄位是 controlled input，`value` 直接綁 URL 參數（`useSearchParams`），`onChange` 每個按鍵都呼叫 `setParams()`。router 更新是非同步的，欄位值在下一次 render 才回填，IME 的組字（composition）過程被中斷，導致組字失敗。

**修復**：
1. `ProtoSearchPage.tsx`：關鍵字欄位改綁本地 state（`keyword`），加 `onCompositionStart`/`onCompositionEnd`；組字中不同步 URL，組字結束或一般輸入才呼叫 `updateParam("q", ...)`。URL 參數被外部改變（清空鈕、返回導覽）時用 `useEffect` 同步回欄位。
2. `ProtoHomePage.tsx`：首頁快速搜尋框的 Enter 處理加 `e.nativeEvent.isComposing || e.keyCode === 229` 防護，避免注音選字的 Enter 被誤判成送出搜尋。

**Staging 實測結果（2026-08-12，bundle `index-4i--4z9q.js`）**：Product Owner 以注音實際輸入，中文字（如「八三」）可正常組字選字，欄位不再殘留整串注音符號。✅（找 0 筆是因 demo 資料庫無該歌手，屬預期。）

## BUG-01 修復內容（2026-08-11）

`apps/web/src/prototype/components/ProtoTaskWizardModal.tsx`

1. `budget` 初始值由 `"4800"` 改為 `""`，只留 placeholder 當提示，使用者不會再碰到「看起來是提示、其實是真值」的欄位。
2. 預算 input 加上 `min={0}` / `max={MAX_BUDGET_TWD}`（`1_000_000`，與 `packages/shared/src/ticket-task.ts` 第 8 行的 zod schema 一致）。
3. 新增 `errorMessage` / `isSubmitting` 兩個 optional props；Step 3 送出按鈕上方會以 `role="alert"` 顯示「建立任務失敗：{訊息}」，送出中按鈕顯示「正在建立…」並 disabled，避免重複送出。

`apps/web/src/prototype/pages/ProtoDetailPage.tsx`

4. 把 `taskMutation.error?.message` 與 `taskMutation.isPending` 傳進 modal，讓失敗真的看得到。

另註：`apps/web/src/components/TicketTaskForm.tsx`（另一個版本的表單）第 142 行本來就是 `useState("")`，沒有同樣問題，未改動。

**Staging 實測結果（2026-08-12，bundle `index-RUEQqXBe.js`）**：

- 情境 A（超額值 `48004800` 送出）：畫面顯示紅色 `role="alert"` 錯誤「建立任務失敗：Number must be less than or equal to 1000000」，不再無聲失敗。✅
- 情境 B（正常值 `2000` 送出）：API 回 200，導向 `/tasks`，任務 `budgetTwd: 2000` 正確保存。✅
- 欄位初始為空、`min=0 max=1000000` 已生效。✅

## 未分級／待補充（需真人測試者回報後才能分級）

- 3 位一般測試者登入與核心流程結果
- User A / User B 資料隔離結果
- 一般使用者是否能誤入 `/admin`
- 登出再登入資料保存
