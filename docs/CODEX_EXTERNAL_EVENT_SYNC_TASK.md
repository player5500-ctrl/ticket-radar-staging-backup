# 交辦：外部活動資料同步與官方公告搜尋系統（Codex 任務書，2026-08-03）

## 已定案決策（Vanny）

追票雷達目前搜尋只查 Cloudflare D1，資料庫沒有的活動（例如搜尋「BIGBANG」）會直接回傳 0 筆。已拍板方向：建立一套「發現 → 同步 → 去重 → 驗證 → 寫入 D1 → 通知」的資料管線，在本地搜尋沒有結果時，從盤點過、風險可控的外部來源即時補足，而不是繼續讓搜尋只依賴本地既有資料。

**本任務書分 Phase 0～6，請依序完成，每個 Phase 結束都要自測並回報，不要一次做完全部 Phase 才回報。**

## 開工前必讀

Codex 開始寫程式前，**必須先完整讀過**以下兩份文件，本任務書中大量內容直接引用這兩份文件，不重複貼原文：

- `docs/EVENT_SOURCE_MATRIX.md`：13 個候選來源逐一查證的 robots.txt／服務條款／API／可信度／風險。
- `docs/EXTERNAL_EVENT_SYNC_ARCHITECTURE.md`：Source Registry／Adapter／Inbox／Parser／Normalizer／Resolver／Dedup／Verification／D1 Upsert／Notification 的元件設計、10 張新資料表 schema、搜尋流程韌性設計、可信度分數設計。

本任務書是「把上述架構落地成可執行 Phase」的實作指引，若本任務書內容與架構文件衝突，以架構文件為準並在回報中提出。

## 硬約束（全程適用，全文寫出，不引用外部檔）

1. **不得繞過登入**、**不得破解 CAPTCHA**、**不得規避網站防護**（不偽造 UA、不輪換 IP 躲偵測）、**不得高頻大量抓取**、**不得抓取私人頁面**、**不得無限制保存完整頁面**、**不得將未驗證內容視為正式公告**。這 7 條是產品底線，任何 Phase 的程式碼都不能違反，違反其中任一條的實作視為未完成，不能回報「已完成」。
2. **任何來源要真正被排程或搜尋 fallback 呼叫到，`data_sources.status` 必須是 `active` 且 `agreement_status` 必須是 `agreed` 或 `not_required`**。Phase 0～2 的所有來源初始 `agreement_status` 一律設為 `not_contacted`，**除非本任務書在該來源小節明確寫「本階段可設為 not_required」**。也就是說：Adapter 程式碼可以先寫好、先測試，但**預設不會被正式排程執行**，需要 Vanny 人工確認合作狀態後再手動把 `agreement_status` 改成 `agreed`／`not_required` 才會真的開始跑。這是刻意設計的安全閂，Codex 不要為了讓功能「看起來動起來」而自己把預設值改成 `agreed`。
3. 不修改既有 D1 migration 檔（`0001~0007`），新表一律用新 migration 檔（`0008` 起），且必須先在本機 D1 驗證過（比照 `docs/DATABASE.md` 第 7 節既有慣例）。
4. 不碰 Production 環境、不執行 `wrangler deploy --env production`、不嘗試登入 Cloudflare 帳號或修改 Cloudflare 後台設定。
5. 不新增本任務書未提及的套件依賴；若某 Phase 確實需要新套件（如 HTML 解析、模糊字串比對），在該 Phase 小節已列出建議套件，不要自行引入其他套件。
6. 完成後不要自己宣稱「已驗收通過」，只能說「已自測：<結果>」，正式驗收由 Vanny 或另一個 fresh context 的 agent 執行。
7. 這次沒有強制要求 `.git`，但如果專案當下已有 `.git`（截至本任務交辦時應該已經有），**請照常 commit**，不要迴避版控；每個 Phase 完成後各自 commit，訊息前綴 `feat(event-sync): Phase N ...`，不要把多個 Phase 混在一個 commit。

---

## Phase 0：資料來源與介面

**目標**：把《EXTERNAL_EVENT_SYNC_ARCHITECTURE.md》的資料庫設計落地成 migration，並建立 Source Registry 與 Adapter 的程式碼骨架（介面與型別），此階段**不寫任何真正對外抓取的邏輯**。

**範圍**：

- 依《EXTERNAL_EVENT_SYNC_ARCHITECTURE.md》第 4 節，建立 migration `0008`～`0013`（`data_sources`、`source_sync_jobs`、`raw_event_sources`、`event_candidates`、`event_source_links`、`event_duplicates`、`verification_reviews`、`artist_external_ids`、`venue_aliases`、`event_change_logs`，並擴充既有 `events.source_type` CHECK 列舉加入 `external_sync`）。
- 在 `packages/shared/src/` 新增對應 Zod schema（`event-source.ts`：`DataSourceSchema`、`EventCandidateSchema`、`RawEventSourceSchema` 等），供 Worker 與未來管理後台共用。
- 新增 `packages/event-source-adapters` package（比照既有 `packages/platform-adapters` 的資料夾結構），定義：
  ```ts
  interface EventSourceAdapter {
    readonly sourceKey: string;
    fetchRecent(params: { since?: string; limit: number }): Promise<RawFetchResult>;
    fetchByQuery(params: { query: string; limit: number }): Promise<RawFetchResult>;
  }
  ```
  此階段每個來源先建立**空殼 Adapter**（`fetchRecent`/`fetchByQuery` 直接回傳空陣列或 `NotImplemented`），重點是把介面、型別、目錄結構、測試骨架建好。
- 在 `workers/api/src/repositories/` 新增 `data-source.repository.ts`，實作 Source Registry 的查詢邏輯：`getActiveEligibleSources()`（篩選 `status='active' AND agreement_status IN ('agreed','not_required')`）、`getSourceByKey()`。
- Seed：依《EVENT_SOURCE_MATRIX.md》13 個來源，於 `workers/api/seeds/` 新增 `data_sources` 種子資料，**全部**（除非下方 Phase 2 小節特別註明）初始 `status='pending_agreement'`、`agreement_status='not_contacted'`。

**完成標準**：

- [ ] 6 個新 migration 在全新本機 D1 可依序執行成功，且可從 `0007` 狀態逐版升級。
- [ ] `pnpm typecheck` 全 workspace 通過。
- [ ] `data-source.repository.ts` 有單元測試，驗證 `getActiveEligibleSources()` 正確排除 `pending_agreement`／`not_contacted` 的來源。
- [ ] 13 個來源的 seed 資料齊全，欄位對照《EVENT_SOURCE_MATRIX.md》（`source_category`、`sync_method`、`requires_agreement`、`terms_summary`、`credibility_base_score`）。

---

## Phase 1：Ticketmaster Discovery API ＋ Generic JSON-LD Parser

**目標**：用「覆蓋率不是重點、但技術規格最標準」的 Ticketmaster Discovery API，驗證整條 Parser → Normalizer → Resolver → event_candidates 的管線可以跑通；同時做出一個**可重複使用的 Generic JSON-LD Parser**，因為 OPENTIX、KKTIX、Live Nation Taiwan 都輸出標準 `schema.org/Event` 結構，這個 Parser 之後在 Phase 2 可以直接複用。

**範圍**：

- `Ticketmaster Discovery API` 的 `data_sources` 種子：`sync_method='json_api'`、`requires_agreement=0`、`agreement_status='not_required'`（**這是唯一一個本階段可以直接設 `not_required` 的來源**，因為它是公開自助 API，不需人工審核，見《EVENT_SOURCE_MATRIX.md》第 12 節）。API Key 走環境變數（`TICKETMASTER_API_KEY`），本機開發用免費 tier 自行申請的 key 測試，不寫死在程式碼或 commit 進 repo。
- 實作 `packages/event-source-adapters/src/ticketmaster/adapter.ts`：呼叫 `GET https://app.ticketmaster.com/discovery/v2/events.json`，支援 `keyword`／`countryCode`／`city` 參數。
- 實作 `packages/event-source-adapters/src/generic-json-ld/parser.ts`：輸入任意頁面 HTML，抓取 `<script type="application/ld+json">`，篩選 `@type` 為 `Event`／`MusicEvent`／`TheaterEvent` 等 schema.org Event 子型別，解析成中繼 DTO（`name`／`startDate`／`endDate`／`location`／`offers`）。這個 parser **不綁定特定來源**，之後 KKTIX／OPENTIX／Live Nation Taiwan 的 Adapter 都呼叫它。
- 完成 Normalizer（時區轉換、價格單位化）與最小可用的 Artist/Venue Resolver（先支援精確比對即可，模糊比對留給 Phase 4）。
- 串通整條管線：Ticketmaster Adapter → Raw Source Inbox → Generic Parser（Ticketmaster 回應本身是 JSON 不是 JSON-LD，需另外一個 `ticketmaster/parser.ts` 直接解析 JSON）→ Normalizer → Resolver → 寫入 `event_candidates`（`status='pending_review'`，因為一般搜尋/國際 API 依《EXTERNAL_EVENT_SYNC_ARCHITECTURE.md》6.1 節本就不能自動驗證，除非後續判定要把「合作 API」分級套用在 Ticketmaster 上——**本階段先不自動驗證，一律 pending_review**，是否調整分級留給 Vanny 決定）。

**完成標準**：

- [ ] 用測試用 API Key 實際呼叫 Ticketmaster Discovery API 成功，至少一筆真實回應資料完整跑過 Parser → Normalizer → `event_candidates`，資料庫可查到這筆記錄。
- [ ] Generic JSON-LD Parser 有單元測試，用至少 3 組不同結構的 mock JSON-LD（完整欄位／缺 location／缺 offers）驗證不會因缺欄位而整個解析失敗。
- [ ] `source_sync_jobs` 正確記錄這次同步的 `items_fetched`／`items_new`。
- [ ] 確認 Ticketmaster 的 rate limit（依《EVENT_SOURCE_MATRIX.md》：公開額度約 5000 次/日、2～5 req/s）在 Adapter 內有對應節流設定。

---

## Phase 2：台灣核心來源 Adapter

**目標**：實作《EVENT_SOURCE_MATRIX.md》判定風險相對可控、且本任務書第一階段建議名單內的台灣來源 Adapter。**每個來源的 `agreement_status` 仍維持種子預設值，不會被本 Phase 自動改成 `agreed`**——Adapter 寫完之後是「待命」狀態，等 Vanny 逐一確認合作/告知結果後才手動開通。

**本階段實作以下 9 個來源的 Adapter**（依《EVENT_SOURCE_MATRIX.md》逐項查證結果排序，理由與難度見本文件最後一節「第一階段方案」）：

1. **台北流行音樂中心（北流／TMC）** — `sync_method='html_scrape_limited'`。目標頁面 `tmc.taipei/tw/blog/show`；解析活動名稱/演出者/日期/場館/主辦單位/購票連結；售票起始時間需額外解析公告文字（正則抓「X月X日 X點」類句型，抓不到就留空，不可猜測）。
2. **高雄流行音樂中心（南流／KPMC）** — `sync_method='atom_feed'` 優先嘗試 `kpmc.com.tw/program/feed/`；若實測 feed 不含足夠欄位（Phase 0 未逐一驗證過，Codex 需自行先跑一次確認），改用 `html_scrape_limited` 解析 `kpmc.com.tw/program/`。
3. **Zepp New Taipei** — `sync_method='html_scrape_limited'`。月曆列表 `zepp.co.jp/hall/newtaipei/schedule/` 按月枚舉 → 逐一解析 `schedule/single/?rid=` 詳情頁。**此來源種子 `agreement_status` 維持 `not_contacted`，且本文件建議 Vanny 在開通前先發信至 `inquiry.tw@zepp.co.jp` 告知用途**（見《EVENT_SOURCE_MATRIX.md》十一節），Codex 只需把 Adapter 寫好並在程式碼註解標明此提醒，不需（也不能）自己發信。
4. **OPENTIX** — `sync_method='json_ld_scrape'`，直接複用 Phase 1 的 Generic JSON-LD Parser。**此來源服務條款明文要求「事前書面同意」才可重製資料**（《EVENT_SOURCE_MATRIX.md》第五節），Adapter 寫好後**必須維持 `agreement_status='not_contacted'`，並在 PR 說明中特別標註「此來源需 Vanny 先取得兩廳院書面同意才能開通，即使技術上已可運作」**。
5. **KKTIX** — `sync_method='atom_feed'`，呼叫 `kktix.com/events.json` 全站端點，以及可設定的主辦單位清單逐一呼叫 `<org>.kktix.cc/events.json`（主辦單位清單先寫死一份小名單於設定檔，不要自動探索/爬全站找主辦單位，避免範圍失控）。
6. **拓元 tixCraft** — `sync_method='html_scrape_limited'`，**只解析 `/activity` 活動列表頁與活動詳情頁的 `<title>` 與基本 meta 資訊（名稱/場館/日期）**，Adapter 程式碼層面**禁止**存取 robots.txt 中 `Disallow` 的任何路徑（`/activity/game/`、`/activity/search-suggest/`、`/ticket/*`），寫死一個路徑黑名單常數並在請求前檢查，命中黑名單直接拋錯而不是發送請求。
7. **ibon 售票系統** — `sync_method='html_scrape_limited'`，只解析 `/Index/entertainment`、`/Index/Sport` 分類列表頁與 `/ActivityInfo/Details/{id}` 詳情頁，同樣寫死路徑黑名單排除 `/Home/TicketflowControl`、`/UnderControl*`、`/trafpage/`。
8. **Ticket Plus** — `sync_method='html_scrape_limited'`，因首頁為 Vue SPA 動態渲染，需用 headless browser 渲染後再解析（建議套件：`@cloudflare/puppeteer` 若 Workers 環境支援，或改為此 Adapter 先降級為「只記錄有哪些活動標題出現在首頁，供人工比對」，不強求完整結構化欄位）。
9. **年代售票（ERA）** — `sync_method='html_scrape_limited'`，解析活動詳情頁純文字內容；**此來源官方已公告主動 IP 層級反爬蟲防護**，Adapter 必須設定明顯低於其他來源的請求頻率（建議 `sync_frequency_minutes` 種子值設 1440，即每日 1 次），且完全不做任何規避偵測的手法。

**本階段刻意不實作**（理由詳見本文件最後一節）：寬宏售票（核心資料為圖片，需 OCR，投入產出比差）、Live Nation Taiwan（ToS 限定個人非商業用途且資料分散至上述已列的第三方系統，直接抓取風險高於效益）、Songkick API（申請門檻已提高為付費商業合作且條款排他性與本產品定位衝突）。如果 Vanny 之後認為仍要做，需另開任務書重新評估，不在本次範圍。

**完成標準**：

- [ ] 9 個 Adapter 皆有對應單元測試（至少涵蓋正常回應解析成功、缺欄位不炸掉、HTTP 錯誤時正確拋出可被上層捕捉的例外三種情境）。
- [ ] 拓元、ibon 的路徑黑名單檢查有專門測試驗證「命中黑名單會被阻擋，不會真的發送請求」。
- [ ] 所有 Adapter 皆透過 Phase 0 建立的共用 `resilientFetch()`（本階段若尚未實作，需在此階段補上：timeout + 重試 1 次 + 不對 4xx 重試，完整版含 circuit breaker 留給 Phase 5）。
- [ ] 手動跑一次每個 Adapter 對測試環境（或該來源允許的公開頁面）的 `fetchRecent()`，能抓到至少 1 筆真實資料進 `raw_event_sources`，並在回報中列出每個來源實測抓到的筆數。
- [ ] 確認 `data_sources` 種子中，OPENTIX／Zepp New Taipei／KKTIX／拓元／ibon／Ticket Plus／年代 的 `agreement_status` 都還是 `not_contacted`（沒有被程式碼意外改掉），只有 Ticketmaster 是 `not_required`，北流／南流依《EVENT_SOURCE_MATRIX.md》判斷「技術上不強制需要授權」可設為 `not_required`。

---

## Phase 3：AI 公告解析

**目標**：處理「沒有結構化資料、只有自由格式文字」的來源內容（例如年代售票的純文字售票須知、場館公告文字裡的售票起始時間），用 AI 輔助解析成結構化欄位，作為規則式 Parser 解析失敗時的補強手段，**不是取代規則式 Parser**。

**範圍**：

- 新增 `packages/event-source-adapters/src/ai-announcement-parser/`，輸入一段自由格式文字（如公告全文），輸出結構化建議值（活動名稱、日期時間、場館、票價區間），每個欄位附帶信心分數。
- 呼叫方式：透過 Worker 既有可用的 AI 能力（若專案尚未整合任何 LLM API，本階段需先確認要用哪個 provider——**這是需要 Vanny 決定的事，Codex 不要自行選定並簽署付費方案**，可先用 mock/規則式 fallback 開發，實際 provider 串接留一個明確的 TODO 與介面切點）。
- AI 解析結果**永遠**進入 `event_candidates` 且 `confidence_score` 需明顯低於規則式解析結果（例如規則解析預設 90，AI 輔助解析上限 60），確保 Verification 階段（Phase 4）不會把 AI 猜測的結果當作高信心資料。
- AI 解析結果的原始輸入文字與輸出，需完整記錄在該筆 `raw_event_sources`／`event_candidates` 關聯資料，方便事後檢視「AI 到底看了什麼文字、猜出了什麼」，不可只留最終結構化結果。

**完成標準**：

- [ ] 至少對 Phase 2 實際抓到的 3 筆「純文字、規則解析抓不到售票時間」的真實內容跑過 AI 解析，並在回報中列出輸入文字與 AI 輸出的對照。
- [ ] `confidence_score` 機制確認生效：AI 解析結果的分數低於規則解析結果。
- [ ] 明確列出「AI provider 串接」這項待 Vanny 決策的事項在回報的「未做項目」。

---

## Phase 4：去重與驗證

**目標**：實作《EXTERNAL_EVENT_SYNC_ARCHITECTURE.md》第 2.8～2.9 節的 Deduplication 與 Verification 引擎，補上 Phase 0 留下的模糊比對邏輯。

**範圍**：

- 精確鍵比對（同 `data_source_id + external_id`）與跨來源精確比對（正規化名稱+同日+同場館）依架構文件邏輯實作。
- 模糊比對：建議套件 `fastest-levenshtein`（輕量、無額外相依）計算正規化名稱字串距離，門檻值先設一個保守初始值（如相似度 ≥ 0.85 且日期 ±1 天內才進入 `pending`），並在程式碼與回報中明確標示這是「初始值，待 Phase 4 完成後用真實資料調整」。
- Verification 規則引擎：依《EXTERNAL_EVENT_SYNC_ARCHITECTURE.md》第 2.9 節與第 6 節可信度分數，實作 `auto_verified` 的判定邏輯與人工審核佇列的寫入。
- Change Detection：實作既有已確認 `events` 與新候選的欄位比對，寫入 `event_change_logs`。
- D1 Upsert：實作 `event-candidate.service.ts`，把 `auto_verified` 或人工 `approve` 的候選寫入既有 `events`／`event_artists`／`ticket_sale_windows`，比照既有 `ticket-task.repository.ts` 用 `db.batch()` 交易處理。

**完成標準**：

- [ ] 單元測試涵蓋：精確重複判定、模糊重複判定（含「相似但不同場次」不誤判為重複的反例測試）、自動驗證門檻判定（含一般搜尋/AI 解析結果無論分數多高都不能 `auto_verified` 的測試）。
- [ ] 用 Phase 1～3 實際產生的候選資料跑一次完整流程，回報中列出「幾筆自動驗證通過」「幾筆進人工審核」「幾筆判定重複」的實際數字。
- [ ] D1 Upsert 完成後，用既有 `pnpm --filter @ticket-radar/api test` 確認沒有破壞既有 `events` 相關測試。

---

## Phase 5：Cron、Queues 與通知

**目標**：把手動觸發的同步流程，接上排程（Cron）與非同步佇列（Queues），並補完《EXTERNAL_EVENT_SYNC_ARCHITECTURE.md》第 5.2 節完整的韌性設計（本階段前的 Phase 只需最小 timeout+retry，circuit breaker 與快取留到本階段補齊），最後接上 Notification Trigger。

**範圍**：

- Cloudflare Cron Trigger：依各 `data_sources.sync_frequency_minutes` 排程呼叫對應 Adapter 的 `fetchRecent()`。
- Cloudflare Queues：搜尋 API 偵測到本地零結果時，把「外部來源查詢」丟進 Queue 非同步處理，而不是讓使用者的搜尋請求同步等待所有外部來源回應（對應架構文件第 5.1 節「本地結果先回、外部候選非同步補充」）。
- 補齊 Circuit Breaker（滑動視窗失敗率、`circuit_open` 冷卻與 half-open 試探）與外部搜尋結果快取（零結果與有結果分別設定 TTL）。
- 搜尋 API 回應新增 `sourceStatus` 欄位，回報每個來源目前的健康狀態。
- Notification Trigger：接上既有 `reminders`／`notification_logs` 管線，只對「已確認」活動與「重大變更」觸發，`pending_review` 狀態的候選絕對不能觸發通知（需有測試專門驗證這一點）。

**完成標準**：

- [ ] Cron 設定於本機模擬（`wrangler dev` + 手動觸發或 `wrangler.toml` 設定）驗證可跑通完整同步流程。
- [ ] Circuit Breaker 有單元測試：連續失敗達門檻後進入 `circuit_open`，冷卻期後允許一次試探請求。
- [ ] 快取有單元測試：同一關鍵字短時間內第二次查詢不再呼叫外部 Adapter。
- [ ] 明確測試「`pending_review` 候選不會觸發任何通知」這條硬約束。
- [ ] 搜尋 API 端到端測試：模擬某個來源逾時/回應 500，確認本地結果仍正常回傳、API 整體回應時間沒有被拖慢到超過既定總預算（架構文件建議 6 秒）。

---

## Phase 6：管理後台與監控

**目標**：讓 Vanny／管理員可以在既有管理後台（`apps/web/src/pages/AdminPage.tsx`）看到並操作這套系統，不需要直接查 D1。

**範圍**：

- 新增管理頁籤/區塊：
  - 資料來源列表：顯示每個 `data_sources` 的 `status`／`agreement_status`／最後同步時間／最近失敗訊息，並提供管理員手動調整 `status`／`agreement_status` 的操作（這是目前**唯一**允許把某個來源改成 `agreed` 的地方，一般程式邏輯不可自動改）。
  - 待審核候選佇列：列出 `event_candidates.status='pending_review'`，可查看來源、可信度分數、比對到的重複候選，並可 `approve`／`reject`／`needs_more_info`，寫入 `verification_reviews`。
  - 同步紀錄：`source_sync_jobs` 的成功/失敗趨勢，供排查用。
- 所有管理操作需比照既有模式：伺服器端 RBAC 檢查（`admin` 角色）＋寫入 `audit_logs` 或 `verification_reviews`（依《EXTERNAL_EVENT_SYNC_ARCHITECTURE.md》4.10 節說明的稽核記錄方式）。

**完成標準**：

- [ ] 管理員登入可看到資料來源列表與待審核佇列，一般使用者（非 admin）呼叫對應 API 回 403（比照既有 `docs/FINAL_DELIVERY.md` 第 9 節「管理 API：一般使用者 403、管理員 200」的既有驗收標準）。
- [ ] 手動把某個來源的 `agreement_status` 從 `not_contacted` 改成 `agreed` 後，該來源才會出現在下次排程實際被呼叫，且此操作留有稽核紀錄。
- [ ] Playwright 補一條核心流程測試：管理員審核一筆候選活動 → 該活動出現在一般使用者的搜尋結果中。

---

## 第一階段方案（8～10 個台灣來源，優先支援理由）

依《EVENT_SOURCE_MATRIX.md》逐項查證結果，建議 Phase 2 先支援以下 **9 個台灣來源**，排序即建議實作順序：

| 順序 | 來源 | 為什麼優先 | 實作方法 | 預估難度 | 預估維護量 | 是否需合作 |
|---|---|---|---|---|---|---|
| 1 | 台北流行音樂中心 | 官方一手資料、robots.txt 開放、**無任何明文服務條款限制**，法遵風險最低 | HTML 解析（無 API） | 中 | 中（場館改版才需調整，售票時間文字解析需持續調校） | 不需要（建議仍知會） |
| 2 | 高雄流行音樂中心 | 同上，且 robots.txt 更友善、有 sitemap/RSS 線索，實作門檻略低於北流 | RSS 優先，退而 HTML 解析 | 中低 | 中 | 不需要（建議仍知會） |
| 3 | Zepp New Taipei | 三個場館來源中欄位最完整（含開賣時間文字、票價、VIP 套票說明），資料價值最高 | HTML 解析（月曆枚舉＋詳情頁） | 中 | 中（月曆枚舉需處理不連續 ID） | 建議（B2B 導向+ noindex 訊號，先發信告知） |
| 4 | OPENTIX | 技術門檻全來源最低（標準 JSON-LD，欄位最完整），但**條款明文要求書面同意**，優先順位高是因為「一旦談成合作，技術成本幾乎是零」，值得優先去談 | Generic JSON-LD Parser 直接複用 | 低（技術）／中高（法遵） | 低（技術穩定） | **需要，且應優先接洽** |
| 5 | KKTIX | 半官方 JSON/Atom 端點穩定可用，社群已驗證多年可行，是四大售票平台中風險最低者 | JSON/Atom 端點訂閱 | 低～中 | 中（需維護主辦單位清單） | 建議 |
| 6 | 拓元 tixCraft | 台灣最大售票平台之一，即使只能拿到活動列表基本欄位仍有高價值，robots.txt 明確劃出「活動頁可爬、購票頁不可爬」的紅線可遵循 | HTML 解析＋路徑黑名單 | 高 | 高（無結構化資料，格式易隨改版變動） | 建議，尤其涉及即時售票資訊 |
| 7 | ibon | 統一超商系統規模大、涵蓋活動多，但资料多為自由文字、法律警示語氣最強 | HTML 解析（僅列表頁） | 高 | 高 | 建議，且應主動說明用途 |
| 8 | Ticket Plus | 有一定市占，但技術門檻高（SPA 動態渲染），先納入但預期投入產出比較低 | Headless browser 渲染＋標題比對 | 高 | 高 | 建議 |
| 9 | 年代售票 | 部分活動頁有純文字資訊可用，但平台已主動反爬蟲防護，穩定性最不可控 | HTML 解析，低頻請求 | 中～高 | 高（易被封鎖需持續監控） | 建議 |

未納入第一階段（理由已於 Phase 2 說明）：寬宏售票（OCR 成本高、投入產出比差）、Live Nation Taiwan（ToS 限定個人非商業用途、資料分散下游系統）、Songkick API（申請門檻高＋條款排他性與產品定位衝突）。Ticketmaster Discovery API 因幾乎不含台灣資料，不計入「台灣來源」名單，但建議 Phase 1 仍用它做技術驗證基礎。

---

## 回報格式（每個 Phase 結束請照此回報）

```
## Phase N 已完成項目
- <逐項一句話，含檔案路徑>

## 自測結果
- <對應該 Phase 完成標準逐條 pass/fail + 證據>

## 未做項目 / 待 Vanny 決策事項
- <明列 + 原因>（沒有就寫「無」）

## 硬約束檢查
- 是否有任何來源的 agreement_status 被程式碼自動改動：<是/否，若是則說明>
- 是否有存取 robots.txt Disallow 路徑：<是/否>
- 是否有 pending_review 候選觸發通知：<是/否>

## 改動檔案清單
- <path 清單，每個檔案一句話說明>
```

## 狀態

待處理 → （Codex 回報後由 Claude/Vanny 更新：驗收中／已完成／退回重做）
