# 外部活動資料同步與官方公告搜尋系統 — 架構設計

## 0. 目標與範圍

**要解決的問題**：目前搜尋只查 Cloudflare D1，若資料庫沒有活動（例如搜尋「BIGBANG」），會直接回傳 0 筆，即使該活動已在合法可信的外部來源公開。

**本文件範圍**：設計一套「發現 → 同步 → 去重 → 驗證 → 寫入 D1 → 通知」的資料管線，以及對應的搜尋流程，讓搜尋在本地沒有資料時，能從《EVENT_SOURCE_MATRIX.md》盤點過、風險可控的外部來源即時或準即時補足結果。

**明確排除**：不涉及任何售票、選位、付款、CAPTCHA、排隊機制；不做「未經確認直接大規模爬取」；本文件只是設計，實作前每個來源是否啟用同步，仍受《EVENT_SOURCE_MATRIX.md》的授權判斷與第一階段名單約束（見 `docs/CODEX_EXTERNAL_EVENT_SYNC_TASK.md`）。

**與既有系統的關係**：本系統是既有 `events` / `artists` / `venues` / `artist_aliases` 資料表（見 `docs/DATABASE.md`）的**上游資料供給管線**，最終仍寫入既有的 `events` 表（延伸 `source_type` 列舉），不重新設計核心活動表結構，只新增「候選 → 驗證」階段所需的輔助表。

---

## 1. 整體資料流程（文字版管線圖）

```text
                         ┌─────────────────────┐
                         │   Source Registry    │  (data_sources 表 + Adapter 程式碼註冊表)
                         └──────────┬───────────┘
                                    │ 依 status/agreement_status 篩選出可用來源
                                    ▼
                         ┌─────────────────────┐
   排程 Cron  ──────────▶│   Source Adapter     │  每個來源一個 Adapter（fetchRecent / fetchByQuery）
   搜尋 Miss ──────────▶│  (per-source class)   │
   人工觸發 ──────────▶│                       │
                         └──────────┬───────────┘
                                    │ timeout + retry + circuit breaker（見第 5 節）
                                    ▼
                         ┌─────────────────────┐
                         │  Raw Source Inbox     │  (raw_event_sources 表；大型內容存 R2，D1 只存指標)
                         └──────────┬───────────┘
                                    │ content_hash 去重，避免重複解析同一份原始資料
                                    ▼
                         ┌─────────────────────┐
                         │      Parser           │  依來源格式解析（JSON-LD／JSON／Atom／受限 HTML）
                         └──────────┬───────────┘
                                    ▼
                         ┌─────────────────────┐
                         │    Normalizer         │  時區轉 UTC、幣別/價格單位化、欄位對齊成 EventCandidate DTO
                         └──────────┬───────────┘
                                    ▼
              ┌─────────────────────┴─────────────────────┐
              ▼                                             ▼
   ┌─────────────────────┐                     ┌─────────────────────┐
   │ Artist Alias Resolver│                     │   Venue Resolver     │
   │ (artists/artist_     │                     │ (venues/venue_       │
   │  aliases/artist_      │                     │  aliases)             │
   │  external_ids)        │                     │                       │
   └──────────┬───────────┘                     └──────────┬───────────┘
              └─────────────────────┬─────────────────────┘
                                    ▼
                         ┌─────────────────────┐
                         │   event_candidates    │  寫入候選活動（status = pending_review）
                         └──────────┬───────────┘
                                    ▼
                         ┌─────────────────────┐
                         │   Deduplication       │  比對既有 events 與其他 candidates（event_duplicates）
                         └──────────┬───────────┘
                                    ▼
                         ┌─────────────────────┐
                         │    Verification       │  規則引擎 + 可信度分數 + 管理員審核（verification_reviews）
                         └──────────┬───────────┘
                         auto_verified／confirmed          rejected／duplicate
                                    │                              │
                                    ▼                              ▼
                         ┌─────────────────────┐        （保留候選記錄，不寫入 events，
                         │   Change Detection     │         供稽核與重新比對）
                         │ (event_change_logs)   │
                         └──────────┬───────────┘
                                    ▼
                         ┌─────────────────────┐
                         │      D1 Upsert         │  寫入 events / event_artists / ticket_sale_windows
                         │                       │  更新 event_source_links
                         └──────────┬───────────┘
                                    ▼
                         ┌─────────────────────┐
                         │ Notification Trigger  │  比對 user_artist_follows / user_event_favorites，
                         │                       │  只對「已確認」活動與「重大變更」觸發
                         └─────────────────────┘
```

---

## 2. 元件設計

### 2.1 Source Registry

- **定位**：唯一「有哪些來源、目前能不能用」的權威來源，結合資料庫設定（可動態調整）與程式碼註冊（型別安全的 Adapter 實作）。
- **資料面**：`data_sources` 表（見第 4 節），記錄每個來源的 `status`（active/paused/disabled/pending_agreement）與 `agreement_status`（是否已取得書面同意）。
- **程式面**：新增 `packages/event-source-adapters` package（比照既有 `packages/platform-adapters` 的模式），每個來源實作同一個 `EventSourceAdapter` 介面，並在啟動時註冊到一個 in-memory registry，以 `data_sources.key` 對應。
- **啟用門檻（寫死在 Registry 邏輯，非資料庫可繞過）**：Adapter 註冊存在 **不代表** 會被排程呼叫；排程/搜尋 fallback 前必須同時檢查資料庫的 `status = 'active'` **且** `agreement_status IN ('agreed', 'not_required')`。任何來源在《EVENT_SOURCE_MATRIX.md》判定「需要合作授權」但尚未取得同意者，`agreement_status` 預設 `not_contacted`，Registry 會直接跳過，即使 Adapter 程式碼已經寫好。這是把「未經確認不得大規模抓取」的產品要求，做成架構層的強制閘門，不是口頭約定。

### 2.2 Source Adapter

- **介面**（TypeScript 概念）：
  ```ts
  interface EventSourceAdapter {
    readonly sourceKey: string;
    fetchRecent(params: { since?: string; limit: number }): Promise<RawFetchResult>;
    fetchByQuery(params: { query: string; limit: number }): Promise<RawFetchResult>;
    // 每個 Adapter 內部自行決定要打哪個端點（JSON API／Atom／受限 HTML），
    // 但一律回傳未解析的原始內容 + 來源 metadata，不在 Adapter 內做業務邏輯判斷
  }
  ```
- 每個來源一個 Adapter class，內部封裝該來源特有的：認證方式（如 Ticketmaster 的 `apikey`）、端點網址、預期回應格式、該來源專屬的 rate limit 設定。
- Adapter **不**直接寫資料庫，只回傳 `RawFetchResult`（原始內容 + 抓取時間 + 來源 URL），交給 Raw Source Inbox 落地。
- Adapter 內部呼叫一律經過共用的 `resilientFetch()` wrapper（timeout + retry + circuit breaker，見第 5 節），單一 Adapter 不得自行繞過。

### 2.3 Raw Source Inbox

- **資料表**：`raw_event_sources`。
- **定位**：所有外部資料進入系統的唯一入口，作為「這份資料我們什麼時候、從哪裡、原封不動拿到什麼」的證據留存，供除錯與（如遇爭議時）稽核追溯。
- **儲存策略**：
  - D1 只存 `content_hash`、`source_url`、`external_id`、`fetched_at_utc`、`parser_status` 等中繼資料。
  - 原始 payload（JSON/HTML）若小（< 幾 KB，例如單筆 JSON-LD）可直接存 D1 的 `raw_payload` 欄位；若整頁 HTML 或批次 JSON 較大，改存 Cloudflare R2，D1 只存物件 key。
  - **不得整頁存留完整 HTML 供長期保存**（對應法遵限制第 6 條「無限制保存完整頁面」）；`retention_expires_at_utc` 預設 90 天，到期由排程清除原始內容（僅刪 payload，中繼資料與其解析結果可保留供歷史查核）。
- **去重**：以 `content_hash`（原始內容 hash）判斷是否為重複抓取，重複則只更新 `last_seen_at_utc`，不重新進 Parser。

### 2.4 Parser

- 依來源宣告的格式（`data_sources.sync_method`：`json_ld_scrape` / `json_api` / `atom_feed` / `html_scrape_limited` / `manual_entry`）選擇對應的解析器。
- 每個來源一個 Parser 實作，輸出**未正規化**的中繼 DTO（欄位名稱可能還是來源原始命名），不做跨來源統一，這一步只負責「把這個特定來源的格式，轉成程式看得懂的物件」。
- 解析失敗（格式不符預期、缺必要欄位）記錄 `parser_status = 'parse_failed'` 與 `parse_error`，不中斷整個 sync job（見第 5 節韌性設計），該筆略過即可。

### 2.5 Normalizer

- 將 Parser 輸出的來源特定 DTO，轉成統一的 `EventCandidateDTO`：
  - 時間一律轉為 UTC ISO 8601（來源常見台灣時區 `Asia/Taipei`，需注意夏令時不適用但仍要明確轉換不可假設）。
  - 價格統一為「最小貨幣單位整數 + 幣別代碼」（比照既有 `purchase_records` 慣例的 `_minor` 命名）。
  - 字串正規化（去除全半形空白差異、統一括號、trim）供後續比對使用，比照既有 `normalized_name` 慣例。
  - 缺欄位不得憑空補值（例如沒有票價區間就留空，不可猜測），避免產生看起來像官方資料但實際是拼湊的錯誤資訊。

### 2.6 Artist Alias Resolver

- 輸入 Normalizer 輸出的藝人名稱字串（可能是「BIGBANG」「빅뱅」等不同語言別名）。
- 解析順序：
  1. 先比對 `artist_external_ids`（該來源過去已經人工/自動確認過的藝人 ID 對照）。
  2. 再比對既有 `artist_aliases.normalized_alias` 精確比對。
  3. 找不到才進行模糊比對（例如去除空白/大小寫後比對），模糊比對結果只能標記候選，**不可自動建立新的 `artists` 正式記錄**——新藝人一律先停在 `event_candidates` 階段等待驗證，避免自動生成錯誤或惡搞的藝人資料污染既有藝人庫。
- 若成功解析到既有 `artist_id`，寫入/更新 `artist_external_ids` 供下次直接命中（學習效果）。

### 2.7 Venue Resolver

- 邏輯與 Artist Alias Resolver 對稱，比對 `venue_aliases` → `venues.normalized_name`，找不到則保留原始場館字串在 `event_candidates.venue_name_raw`，不自動建立正式 `venues` 記錄。
- 對於《EVENT_SOURCE_MATRIX.md》中已知的場館官方來源（北流／南流／Zepp），可預先建立這些場館在 `venues` 表的正式資料與常見別名（如「北流」「TMC」「Taipei Music Center」），提高解析命中率。

### 2.8 Deduplication

- **資料表**：`event_duplicates`。
- 比對順序（由嚴到鬆）：
  1. **精確鍵比對**：同一 `data_source_id + external_id` 已存在 → 視為同一筆更新，不算新重複問題。
  2. **跨來源精確比對**：正規化名稱 + 演出日期（同日）+ 場館（若都能 resolve 到同一 `venue_id`）完全一致 → 高信心視為同一活動，自動標記 `confirmed_duplicate` 並合併來源連結（寫入 `event_source_links` 而非建立新 event）。
  3. **模糊比對**：正規化名稱字串相似度（如 trigram/Levenshtein）超過門檻 + 日期在 ±1 天內 → 標記 `pending`，交由 Verification 階段決定，不自動合併（避免誤合併不同場次）。
  4. 完全比對不到 → 視為新活動候選，進入 Verification。
- 合併後的活動應保留**所有**來源連結（見 `event_source_links`），而不是只留下最先寫入的那一筆，這樣才能實現「同一活動需合併多個來源，並保留來源連結」的要求。

### 2.9 Verification

- **資料表**：`verification_reviews`。
- **自動驗證規則**（滿足全部才可 `auto_verified`）：
  1. 來源可信度分數 ≥ 門檻（預設：官方售票平台／官方主辦單位／場館官網三級可自動驗證，其餘一律進人工審核，見第 6 節分數設計）。
  2. 沒有與既有 `events` 或其他 `event_candidates` 產生 `pending`／`confirmed_duplicate` 之外的衝突（例如同名活動但日期衝突且無法判斷孰真）。
  3. 必要欄位齊全（活動名稱、至少一個時間欄位、來源 URL）。
- 不滿足者進入 `pending_review`，由管理後台人工審核（Phase 6），審核結果寫入 `verification_reviews`（`approve` / `reject` / `needs_more_info` / `escalate`）。
- **一般搜尋結果與使用者提交的來源，規則上永遠不能自動驗證**，無論分數多高，都必須人工審核才能轉為 `confirmed`（對應「不得將未驗證內容視為正式公告」的硬性要求）。

### 2.10 Change Detection

- **資料表**：`event_change_logs`。
- 每次 sync 產生的新候選資料，若已存在對應的**已確認** `events` 記錄（透過 `event_source_links` 找到），比對關鍵欄位（`starts_at_utc`、`ends_at_utc`、`status`、售票時間軸相關欄位）是否變化。
- 變化時寫入 `event_change_logs`，並標記 `is_significant`（日期/售票時間/取消/延期一律視為重大；場館拼字微調等非重大）。
- 重大變更**不直接覆寫** `events` 表，而是同樣先進 `pending_review`（除非變更來源與原確認來源相同且可信度達自動驗證門檻），避免單一來源的錯誤更新污染已確認資料。

### 2.11 D1 Upsert

- 只有 Verification 階段判定 `auto_verified` 或人工 `approve` 的候選，才會由這一步寫入既有 `events` / `event_artists` / `ticket_sale_windows` 表：
  - 新活動：`INSERT`，`events.source_type` 使用新增列舉值 `external_sync`，`events.source_url` 記錄主要來源。
  - 既有活動的變更：依 Change Detection 結果 `UPDATE` 對應欄位，並更新 `events.last_verified_at_utc`。
  - 全程使用 D1 `batch()` 交易處理多表寫入，比照既有 `ticket-task.repository.ts` 的 `db.batch()` 模式。
- 寫入完成後更新 `event_source_links`（`last_confirmed_at_utc`）與 `event_candidates.status = 'confirmed'`、`matched_event_id`。

### 2.12 Notification Trigger

- 寫入/更新 `events` 後，比對：
  - `user_artist_follows`：新活動的演出者是否為使用者已追蹤歌手 → 觸發「新場次公告」提醒候選。
  - `user_event_favorites`：既有收藏活動若有 `event_change_logs.is_significant = true` → 觸發「活動資訊變更」提醒候選。
- 產生的提醒進入既有 `reminders` 表（`channel` 沿用現有 `web_push` / `ics` / `email` / `line`），由既有通知管線處理，本系統不重新設計通知發送機制。
- **只對「已確認」活動觸發通知**，`pending_review` 階段的候選絕對不能觸發任何推播/通知，避免把未驗證資訊當成正式公告推給使用者（對應法遵限制第 8 條）。

---

## 3. 與既有系統整合點

- `events.source_type` 列舉需新增 `external_sync`（原有 `admin_manual` / `user_manual` / `official_url` / `mock_parser` 之外）。
- `events.source_url` 若由多來源合併，取可信度最高者的 URL 為主顯示，其餘來源見 `event_source_links`。
- `packages/shared` 需新增對應的 Zod schema：`EventCandidateSchema`、`DataSourceSchema` 等，供 Worker 與未來管理後台共用型別。
- 新增 package 建議：`packages/event-source-adapters`（比照 `packages/platform-adapters` 的資料夾結構：`src/<source-key>/adapter.ts` + `adapter.test.ts`）。

---

## 4. 資料庫設計

共通慣例沿用 `docs/DATABASE.md` 第 2 節：文字 UUID/ULID 主鍵、時間欄位 `_at_utc` 後綴、布林用 `INTEGER CHECK (IN (0,1))`、列舉用 `TEXT CHECK`、SQL 一律 binding。

### 4.1 `data_sources`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | TEXT PK | UUID |
| `key` | TEXT UNIQUE NOT NULL | 程式碼對應鍵，如 `kktix`、`opentix`、`tmc`、`ticketmaster_discovery` |
| `name` | TEXT NOT NULL | 顯示名稱 |
| `source_category` | TEXT CHECK (`ticketing_platform`/`venue`/`organizer`/`artist_site`/`international_api`/`general_search`/`user_submitted`) | 對應第 6 節可信度分級 |
| `base_url` | TEXT | 官方網址 |
| `sync_method` | TEXT CHECK (`json_api`/`atom_feed`/`json_ld_scrape`/`html_scrape_limited`/`partner_feed`/`manual_entry`) | |
| `status` | TEXT CHECK (`active`/`paused`/`disabled`/`pending_agreement`) NOT NULL DEFAULT `pending_agreement` | Registry 啟用閘門之一 |
| `agreement_status` | TEXT CHECK (`not_required`/`not_contacted`/`contacted`/`in_discussion`/`agreed`/`declined`) NOT NULL DEFAULT `not_contacted` | Registry 啟用閘門之二 |
| `requires_agreement` | INTEGER CHECK (IN (0,1)) NOT NULL | 對應 EVENT_SOURCE_MATRIX 的「是否需要合作授權」判斷 |
| `robots_txt_snapshot` | TEXT | 最後一次查證的 robots.txt 摘要 |
| `robots_txt_checked_at_utc` | TEXT | |
| `terms_url` | TEXT | |
| `terms_summary` | TEXT | 關鍵限制摘要（人工填寫，來自 EVENT_SOURCE_MATRIX） |
| `contact_email` | TEXT | 合作洽談窗口 |
| `rate_limit_per_hour` | INTEGER | Adapter 呼叫上限，供 resilientFetch 節流用 |
| `sync_frequency_minutes` | INTEGER | 建議同步頻率 |
| `credibility_base_score` | INTEGER NOT NULL | 對應第 6 節分級基礎分數 |
| `last_synced_at_utc` | TEXT | |
| `last_success_at_utc` | TEXT | |
| `last_error` | TEXT | |
| `notes` | TEXT | |
| `created_at_utc`, `updated_at_utc` | TEXT NOT NULL | |

索引：`data_sources(key)` UNIQUE、`data_sources(status, agreement_status)`。

### 4.2 `source_sync_jobs`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | TEXT PK | |
| `data_source_id` | TEXT NOT NULL FK → `data_sources.id` | |
| `job_type` | TEXT CHECK (`scheduled`/`manual`/`backfill`/`search_fallback`) | |
| `status` | TEXT CHECK (`queued`/`running`/`success`/`partial_success`/`failed`/`circuit_open`) NOT NULL | |
| `trigger_source` | TEXT CHECK (`cron`/`queue`/`search_miss`/`admin`) | |
| `request_params_json` | TEXT | 如搜尋關鍵字、時間範圍 |
| `started_at_utc` | TEXT | |
| `finished_at_utc` | TEXT | |
| `items_fetched`, `items_new`, `items_updated`, `items_failed` | INTEGER DEFAULT 0 | |
| `error_summary` | TEXT | |
| `created_at_utc` | TEXT NOT NULL | |

索引：`source_sync_jobs(data_source_id, started_at_utc)`、`source_sync_jobs(status, started_at_utc)`。
保存期限：90 天後彙總刪除明細，僅保留每日成功/失敗次數統計（供監控趨勢圖，Phase 6）。

### 4.3 `raw_event_sources`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | TEXT PK | |
| `data_source_id` | TEXT NOT NULL FK → `data_sources.id` | |
| `source_sync_job_id` | TEXT FK → `source_sync_jobs.id` | |
| `external_id` | TEXT | 來源自己的活動 ID，可空 |
| `source_url` | TEXT NOT NULL | |
| `content_hash` | TEXT NOT NULL | 去重用 |
| `raw_payload` | TEXT | 小型內容直接存；大型內容存 R2 改用 `raw_payload_r2_key` |
| `raw_payload_r2_key` | TEXT | |
| `fetched_at_utc` | TEXT NOT NULL | |
| `parser_status` | TEXT CHECK (`pending`/`parsed`/`parse_failed`/`ignored`) NOT NULL DEFAULT `pending` | |
| `parse_error` | TEXT | |
| `retention_expires_at_utc` | TEXT NOT NULL | 預設 fetched_at_utc + 90 天 |
| `created_at_utc` | TEXT NOT NULL | |

索引：`raw_event_sources(data_source_id, content_hash)` UNIQUE（同來源同內容不重複落地）、`raw_event_sources(parser_status)`、`raw_event_sources(retention_expires_at_utc)`（供清除排程）。
個資注意：`raw_payload` 不得含需登入頁面內容；若來源頁面意外含使用者個資（如留言板混入活動頁面），Parser 階段須過濾，不可原樣落地保存。

### 4.4 `event_candidates`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | TEXT PK | |
| `raw_event_source_id` | TEXT FK → `raw_event_sources.id`，可空（人工建立候選時為空） | |
| `name`, `normalized_name` | TEXT NOT NULL | |
| `artist_names_raw_json` | TEXT | 解析出的原始藝人名稱陣列（尚未 resolve） |
| `venue_name_raw` | TEXT | |
| `venue_id` | TEXT FK → `venues.id`，可空 | Venue Resolver 成功解析後填入 |
| `city` | TEXT | |
| `starts_at_utc`, `ends_at_utc` | TEXT | |
| `timezone` | TEXT | |
| `organizer_name` | TEXT | |
| `ticket_platform_name` | TEXT | |
| `official_url` | TEXT | |
| `price_low_minor`, `price_high_minor` | INTEGER | |
| `currency` | TEXT | |
| `credibility_score` | INTEGER NOT NULL | 見第 6 節，含來源基礎分＋多來源加成 |
| `confidence_score` | INTEGER | Parser/Normalizer 對解析結果的信心值（欄位齊全度） |
| `status` | TEXT CHECK (`pending_review`/`auto_verified`/`confirmed`/`rejected`/`duplicate`/`expired`) NOT NULL DEFAULT `pending_review` | |
| `matched_event_id` | TEXT FK → `events.id`，可空 | 確認後回填 |
| `created_at_utc`, `updated_at_utc` | TEXT NOT NULL | |

索引：`event_candidates(normalized_name, starts_at_utc)`、`event_candidates(status, created_at_utc)`、`event_candidates(venue_id)`。
保存期限：`status = 'pending_review'` 超過 90 天未處理自動轉 `expired`（避免審核佇列無限累積）；`rejected`／`expired` 保留 180 天供申訴/重新評估後刪除。

### 4.5 `event_source_links`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | TEXT PK | |
| `event_id` | TEXT FK → `events.id`，可空 | 候選階段為空，確認後回填 |
| `event_candidate_id` | TEXT FK → `event_candidates.id`，可空 | |
| `data_source_id` | TEXT NOT NULL FK → `data_sources.id` | |
| `external_id` | TEXT | |
| `source_url` | TEXT NOT NULL | |
| `credibility_score` | INTEGER NOT NULL | 該來源對此活動的可信度快照 |
| `is_primary_source` | INTEGER CHECK (IN (0,1)) NOT NULL DEFAULT 0 | 顯示時優先取用的來源 |
| `first_seen_at_utc`, `last_seen_at_utc`, `last_confirmed_at_utc` | TEXT | |
| `created_at_utc`, `updated_at_utc` | TEXT NOT NULL | |

索引/唯一限制：`event_source_links(event_id, data_source_id, external_id)` UNIQUE、`event_source_links(event_candidate_id, data_source_id, external_id)` UNIQUE、`event_source_links(event_id)`。
用途：實現「同一活動需合併多個來源，並保留來源連結」——一個 `event_id` 可對應多筆 `event_source_links`。

### 4.6 `event_change_logs`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | TEXT PK | |
| `event_id` | TEXT FK → `events.id`，可空 | |
| `event_candidate_id` | TEXT FK → `event_candidates.id`，可空 | |
| `data_source_id` | TEXT FK → `data_sources.id`，可空 | |
| `field_name` | TEXT NOT NULL | 如 `starts_at_utc`、`status` |
| `old_value`, `new_value` | TEXT | |
| `change_source` | TEXT CHECK (`sync`/`admin`/`user_report`) NOT NULL | |
| `is_significant` | INTEGER CHECK (IN (0,1)) NOT NULL | |
| `notified` | INTEGER CHECK (IN (0,1)) NOT NULL DEFAULT 0 | |
| `detected_at_utc` | TEXT NOT NULL | |
| `created_at_utc` | TEXT NOT NULL | |

索引：`event_change_logs(event_id, detected_at_utc)`、`event_change_logs(is_significant, notified)`。
保存期限：至少 1 年（售票時間變更可能涉及消費爭議佐證，不宜太快刪除），之後可歸檔非即時查詢儲存。

### 4.7 `artist_external_ids`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | TEXT PK | |
| `artist_id` | TEXT NOT NULL FK → `artists.id` | |
| `data_source_id` | TEXT NOT NULL FK → `data_sources.id` | |
| `external_id` | TEXT NOT NULL | |
| `external_name` | TEXT | 該來源使用的名稱寫法 |
| `external_url` | TEXT | |
| `confidence` | INTEGER NOT NULL | |
| `verified_by` | TEXT CHECK (`auto`/`admin`) NOT NULL | |
| `created_at_utc`, `updated_at_utc` | TEXT NOT NULL | |

唯一限制：`artist_external_ids(data_source_id, external_id)`。索引：`artist_external_ids(artist_id)`。
不含個資（藝人為公開人物/團體之公開身分，非一般使用者個資）。

### 4.8 `venue_aliases`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | TEXT PK | |
| `venue_id` | TEXT NOT NULL FK → `venues.id` | |
| `alias`, `normalized_alias` | TEXT NOT NULL | |
| `data_source_id` | TEXT FK → `data_sources.id`，可空 | 若別名來自特定來源命名習慣 |
| `language_code` | TEXT | |
| `created_at_utc` | TEXT NOT NULL | |

唯一限制：`venue_aliases(venue_id, normalized_alias)`。索引：`venue_aliases(normalized_alias)`。

### 4.9 `event_duplicates`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | TEXT PK | |
| `event_candidate_id_a` | TEXT NOT NULL FK → `event_candidates.id` | |
| `event_candidate_id_b` | TEXT FK → `event_candidates.id`，可空 | |
| `event_id_b` | TEXT FK → `events.id`，可空 | 若比對對象是既有已確認活動 |
| `similarity_score` | REAL NOT NULL | |
| `match_method` | TEXT CHECK (`exact_key`/`fuzzy_name_date_venue`/`artist_date_overlap`/`admin_manual`) NOT NULL | |
| `status` | TEXT CHECK (`pending`/`confirmed_duplicate`/`confirmed_distinct`/`auto_merged`) NOT NULL DEFAULT `pending` | |
| `resolved_by` | TEXT CHECK (`auto`/`admin`) | |
| `resolved_at_utc` | TEXT | |
| `created_at_utc` | TEXT NOT NULL | |

索引：`event_duplicates(event_candidate_id_a)`、`event_duplicates(status)`。

### 4.10 `verification_reviews`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | TEXT PK | |
| `event_candidate_id` | TEXT NOT NULL FK → `event_candidates.id` | |
| `reviewer_type` | TEXT CHECK (`auto_rule`/`admin`) NOT NULL | |
| `reviewer_user_id` | TEXT FK → `users.id`，可空 | |
| `decision` | TEXT CHECK (`approve`/`reject`/`needs_more_info`/`escalate`) NOT NULL | |
| `reason` | TEXT | |
| `checklist_json` | TEXT | 例：日期合理性／來源可信度／是否已有官方公告 |
| `decided_at_utc` | TEXT NOT NULL | |
| `created_at_utc` | TEXT NOT NULL | |

索引：`verification_reviews(event_candidate_id, decided_at_utc)`。
比照既有 `audit_logs` 慣例：`reviewer_user_id` 為管理員時，此表本身即是該管理員「活動驗證」動作的稽核紀錄，不需額外重複寫入 `audit_logs`，但建議在 `audit_logs.entity_type = 'event_candidate'` 留一筆摘要方便統一查詢管理員所有動作。

### 4.11 Migration 檔案規劃

比照既有 `workers/api/migrations/0001~0007`，新增：

```text
0008_event_source_registry.sql   -- data_sources, source_sync_jobs
0009_raw_event_inbox.sql         -- raw_event_sources
0010_event_candidates.sql        -- event_candidates, event_source_links, event_duplicates, verification_reviews
0011_alias_resolvers.sql         -- artist_external_ids, venue_aliases
0012_event_change_logs.sql       -- event_change_logs
0013_events_source_type_external_sync.sql  -- 擴充既有 events.source_type CHECK 列舉
```

（實際檔案切分由 Codex 實作時可依 D1 migration 慣例調整，但每個 migration 需可獨立在全新 local D1 執行並可回溯測試，比照 `docs/DATABASE.md` 第 7 節既有慣例。）

---

## 5. 搜尋流程與韌性設計

### 5.1 流程

```text
使用者搜尋關鍵字
   │
   ▼
① 本地 D1 搜尋（既有 packages/shared/src/search.ts 邏輯：events + artists + artist_aliases）
   │
   ├─ 有結果 ──────────────────────────────────────────────▶ 直接回傳「已確認」結果（既往行為，不變）
   │
   └─ 零結果或結果數 < 門檻（可設定，預設 0）
        │
        ▼
② 歌手別名查詢：即使 events 零結果，仍先確認 artists/artist_aliases 是否認得這個關鍵字
   （用於判斷這是「已知歌手但沒場次」還是「完全陌生的關鍵字」，兩者的外部搜尋策略可不同：
     已知歌手可直接用其正式名稱＋別名去查外部來源；完全陌生關鍵字則先查是否為活動名稱）
   │
   ▼
③ 外部來源 fallback（只在②之後仍無本地結果時觸發）
   - 從 Source Registry 取得目前 status=active AND agreement_status IN ('agreed','not_required') 的來源清單
   - 對每個來源呼叫 Adapter.fetchByQuery()，全部包在 resilientFetch()（見 5.2）
   - 所有來源呼叫平行送出，但整體 fallback 階段有總時間預算（預設 6 秒）
   │
   ▼
④ 建立候選活動（Parser → Normalizer → Resolver → event_candidates）
   │
   ▼
⑤ 驗證與去重（Deduplication → Verification，見第 2.8～2.9 節）
   │
   ▼
⑥ 回傳「已確認」＋「待確認」結果
   - 已確認：來自本地 events（含剛剛 auto_verified 並已 Upsert 的）
   - 待確認：event_candidates.status = 'pending_review'，UI 需明確標示「來源：XX，尚待確認」
     且不得與已確認結果混排在同一視覺層級，必須有清楚的分隔與免責文字
```

### 5.2 韌性機制

- **Timeout**：每個 Adapter 呼叫獨立 timeout（預設 3 秒，可依 `data_sources.rate_limit_per_hour` 及來源特性個別覆寫）；整體外部 fallback 階段總預算 6 秒，超過即放棄尚未回應的來源，**不阻塞既有本地結果的回傳**——本地結果一律先回，外部候選以非同步方式補充（例如前端第二次 poll，或先回傳「已確認」結果+一個 `externalLookupPending: true` 旗標，稍後前端再拉一次待確認結果）。
- **Retry**：單一來源呼叫失敗（網路錯誤/5xx）重試 1 次，指數退避（如 500ms），**不對 4xx（含 403/429）重試**——4xx 通常代表被拒絕或超出限制，重試只會加重對方負擔並提高被封鎖風險。
- **Cache**：外部搜尋結果以正規化關鍵字為 key 快取（例如 KV 或 D1 簡易快取表），TTL 預設 1 小時，避免同一天多個使用者搜同一藝人時重複打外部來源；快取需區分「零結果」與「有結果」，零結果也要快取（較短 TTL，如 15 分鐘），避免同一個查無資料的關鍵字被重複查詢外部來源。
- **Circuit Breaker**：每個 `data_source_id` 維護一個滑動視窗失敗率；超過門檻（如 5 分鐘內失敗 ≥ 5 次或失敗率 > 50%）則該來源進入 `circuit_open` 狀態，冷卻期（如 10 分鐘）內直接跳過不呼叫，冷卻期後允許 1 次「試探」呼叫（half-open），成功才恢復正常。此狀態即時反映在 `data_sources` 表（或獨立的 in-memory/KV 狀態，避免頻繁寫 D1），並可在管理後台看到。
- **來源狀態顯示**：搜尋 API 回應中可附帶 `sourceStatus` 摘要（如：`opentix: ok`, `kktix: degraded`, `tixcraft: circuit_open`），供前端在「待確認結果」區塊顯示「部分來源目前無法查詢」的提示，而非讓使用者誤以為「查過所有來源都沒有」。
- **核心原則**：**外部來源逾時/失敗/斷路絕對不能讓整個搜尋 API 回應失敗或變慢到本地結果也拿不到**——架構上用「本地結果同步回傳、外部 fallback 非同步/獨立 try-catch」實現，任何 Adapter 的例外都必須在該 Adapter 的呼叫邊界被捕捉並記錄，不得往上傳播影響其他來源或本地搜尋。

---

## 6. 資料品質與可信度分數設計

### 6.1 分級（`data_sources.source_category` → 基礎分數）

| 分級 | 範例 | 基礎分數 | 可否自動驗證 |
|---|---|---|---|
| 官方售票平台 | KKTIX、OPENTIX、拓元、ibon、Ticket Plus、寬宏、年代 | 90 | 可（若欄位齊全且無衝突） |
| 官方主辦單位 | 主辦公司官網/官方社群公告 | 85 | 可 |
| 官方歌手網站 | 藝人/經紀公司官方網站 | 85 | 可 |
| 場館官網 | 北流、南流、Zepp New Taipei | 80 | 可 |
| 合作 API（已取得授權） | 例：未來若與 Ticketmaster/場館談成資料合作 | 75 | 可 |
| 一般搜尋結果 | 新聞報導、部落格、社群貼文 | 40 | **不可**，一律 pending_review |
| 使用者提交 | 使用者手動回報活動 | 20 | **不可**，一律 pending_review，且需額外標示提交者供異常追蹤（不對外公開） |

### 6.2 候選活動的最終可信度分數

`event_candidates.credibility_score` = 該候選所有 `event_source_links` 中最高的 `credibility_score`，**但**若多個獨立來源（不同 `data_source_id`）都回報同一活動（透過 Deduplication 判定為同一筆），可疊加信心加成（例如 +5，上限 100），實現「同一活動由多來源佐證時更可信」的直覺。

### 6.3 合併與來源保留

- 同一活動合併多來源時，顯示用的主要欄位（名稱、日期、票價）採**可信度最高的來源**為準，但**所有**參與合併的來源皆保留在 `event_source_links`，供使用者點擊查看「還有哪些來源提到這場活動」與各自的原始連結。
- 若不同來源對同一活動的關鍵欄位（如日期）有衝突且都達自動驗證門檻，**不自動選邊**，強制轉 `pending_review` 交人工判斷，並在 `event_change_logs` 記錄衝突內容供審核參考。

### 6.4 重要日期變更

- 任何已確認活動的 `starts_at_utc` / `ends_at_utc` / `status`（如轉為 `cancelled`/`postponed`）發生變更，一律寫入 `event_change_logs` 並標記 `is_significant = 1`，即使變更本身通過自動驗證規則直接寫回 `events`，變更歷史仍必須留痕，供使用者或客服事後查證「這個活動的日期是什麼時候、依據哪個來源改的」。

---

## 7. 法遵與安全限制的架構落實

使用者要求的 8 條「不得」事項，對應到本架構的具體強制機制（不是只寫在文件裡的口頭原則）：

| 禁止事項 | 架構落實方式 |
|---|---|
| 繞過登入 | Adapter 介面設計上不支援任何憑證注入參數；code review 規則禁止 Adapter 內出現帳密/session cookie 相關程式碼 |
| 破解 CAPTCHA | 同上，Adapter 只能呼叫公開端點/公開頁面，架構未提供任何瀏覽器自動化操作 CAPTCHA 的元件 |
| 規避網站防護 | `resilientFetch()` 對 4xx（含 403/429）不重試、不換 IP、不偽造 UA；`robots_txt_snapshot` 需人工確認後才能將來源 `status` 設為 `active` |
| 高頻大量抓取 | `data_sources.rate_limit_per_hour` 與 `sync_frequency_minutes` 強制節流；Circuit Breaker 自動降級失敗來源 |
| 抓取私人頁面 | Adapter `fetchRecent`/`fetchByQuery` 的端點清單需在 Source Registry 設定審查時人工確認為「不需登入即可存取」，Parser 若偵測到頁面含登入表單/會員專屬標記，標記 `parse_failed` 並丟棄 |
| 無限制保存完整頁面 | `raw_event_sources.retention_expires_at_utc` 強制 90 天到期清除原始內容（見 4.3） |
| 將未驗證內容視為正式公告 | Verification 規則：一般搜尋結果／使用者提交永遠不可 `auto_verified`；`pending_review` 內容不觸發 Notification Trigger；前端 UI 強制區分「已確認」與「待確認」兩個視覺層級 |
| （額外）需要合作授權的來源 | Source Registry 的 `agreement_status` 閘門：非 `agreed`/`not_required` 狀態，即使 Adapter 已寫好也不會被排程或搜尋 fallback 呼叫到 |

---

## 8. 待確認決策

- 模糊比對（Deduplication 第 3 步）採用的字串相似度演算法與門檻值，建議 Phase 4 實作時以實際候選資料測試調整，本文件先只定義流程不定死參數。
- `event_candidates`／`raw_event_sources` 的保存期限（90 天／180 天）為建議值，正式上線前應與法務確認是否符合公司資料治理政策。
- 是否需要對「一般搜尋結果」（新聞/社群）也建 Source Adapter，或先只做官方來源、把一般搜尋結果留給 Phase 3 的 AI 公告解析（見 `docs/CODEX_EXTERNAL_EVENT_SYNC_TASK.md` Phase 3）再決定，本文件傾向後者。
- R2 物件儲存的具體 bucket 規劃與費用估算，留待 Phase 0 實作時確認 Cloudflare 帳號方案。
