# Ticket Radar 外部活動同步 — 資料庫設計（逐表規格）

更新日期：2026-08-03
用途：補齊 `EXTERNAL_EVENT_SYNC_ARCHITECTURE.md` 與 `CODEX_EXTERNAL_EVENT_SYNC_TASK.md` 只把 10 張表列成「待建立 migration」、
沒有逐表欄位/主鍵/索引/關聯/保存期限/個資與內容權利注意事項的缺口。本檔是「設計產出」，不是已執行的 migration；
實際建表、rollback 腳本、staging dry-run 仍照 `CODEX_EXTERNAL_EVENT_SYNC_TASK.md` Phase 0 的完成條件執行。

命名與型別慣例沿用既有 `workers/api/migrations/0001~0007`：`id` 一律 `TEXT PRIMARY KEY`（UUID）、時間欄一律 `TEXT`（ISO 8601 UTC，命名 `_at_utc`）、
布林用 `INTEGER CHECK (x IN (0,1))`、外鍵明確宣告 `ON DELETE` 行為、enum 用 `CHECK (... IN (...))`。建議檔名：`workers/api/migrations/0008_external_event_sync.sql`。

## 總覽：10 張表與既有表的關聯

```text
data_sources ──< source_sync_jobs ──< raw_event_sources ──< event_candidates ──> events (既有)
     │                                                            │  │
     │                                                            │  └──< verification_reviews
     │                                                            └──< event_duplicates
     ├──< artist_external_ids >── artists (既有)
     ├──< venue_aliases >── venues (既有)
     └──< event_source_links >── events (既有)
events (既有) ──< event_change_logs
```

---

## 1. `data_sources`

外部來源登記表，對應「Source Registry」元件。

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | TEXT PK | UUID |
| `slug` | TEXT UNIQUE NOT NULL | 例：`ticketmaster`、`tpmc`、`kpmc`、`zepp_new_taipei`、`iculture` |
| `display_name` | TEXT NOT NULL | 顯示名稱，如「Ticketmaster Discovery API」 |
| `source_kind` | TEXT NOT NULL CHECK IN (`official_api`,`partner_feed`,`json_ld`,`sitemap`,`rss`,`manual`) | 對應 `EVENT_SOURCE_MATRIX.md` 的「建議同步方式」 |
| `official_url` | TEXT | 來源官方網址 |
| `authorization_status` | TEXT NOT NULL DEFAULT `blocked_pending_review` CHECK IN (`blocked_pending_review`,`approved`,`partner_agreement`,`disabled`) | 未經人工審查一律 `blocked_pending_review`，不得自動抓取 |
| `robots_checked_at_utc` | TEXT | 對應 E-6 任務書「每個 adapter 啟用前必須保存人工審查記錄」 |
| `robots_summary` | TEXT | 允許/禁止路徑摘要 |
| `terms_url` | TEXT | 服務條款網址 |
| `terms_checked_at_utc` | TEXT | |
| `trust_score` | INTEGER NOT NULL DEFAULT 0 CHECK (trust_score BETWEEN 0 AND 100) | 對應架構文件「可信度分數」基礎分 |
| `sync_frequency_minutes` | INTEGER | 建議同步頻率（分鐘），如 360（6 小時）、1440（24 小時） |
| `rate_limit_per_minute` | INTEGER | adapter 併發／速率上限 |
| `health_status` | TEXT NOT NULL DEFAULT `disabled` CHECK IN (`active`,`degraded`,`blocked_pending_review`,`disabled`) | Source Registry 即時狀態，供搜尋回應的 `externalSearch.sources` 顯示 |
| `raw_retention_days` | INTEGER NOT NULL DEFAULT 30 | 這個來源的 `raw_event_sources` 保存天數上限 |
| `created_at_utc` / `updated_at_utc` | TEXT NOT NULL | |

索引：`idx_data_sources_health (health_status)`、`idx_data_sources_authorization (authorization_status)`。
關聯：被 `source_sync_jobs.source_id`、`raw_event_sources.source_id`、`event_candidates.source_id`、`event_source_links.source_id`、`artist_external_ids.source_id`、`venue_aliases.source_id`、`event_change_logs.evidence_source_id` 參照。
個資／內容權利：本表不存個資；`terms_url`/`authorization_status` 就是法遵稽核依據，停用來源前不得刪除歷史列（改 `health_status='disabled'`）。
保存期限：長期保留（登記表，非快取資料）。

```sql
CREATE TABLE data_sources (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  source_kind TEXT NOT NULL
    CHECK (source_kind IN ('official_api','partner_feed','json_ld','sitemap','rss','manual')),
  official_url TEXT,
  authorization_status TEXT NOT NULL DEFAULT 'blocked_pending_review'
    CHECK (authorization_status IN ('blocked_pending_review','approved','partner_agreement','disabled')),
  robots_checked_at_utc TEXT,
  robots_summary TEXT,
  terms_url TEXT,
  terms_checked_at_utc TEXT,
  trust_score INTEGER NOT NULL DEFAULT 0 CHECK (trust_score BETWEEN 0 AND 100),
  sync_frequency_minutes INTEGER,
  rate_limit_per_minute INTEGER,
  health_status TEXT NOT NULL DEFAULT 'disabled'
    CHECK (health_status IN ('active','degraded','blocked_pending_review','disabled')),
  raw_retention_days INTEGER NOT NULL DEFAULT 30,
  created_at_utc TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL
);
CREATE INDEX idx_data_sources_health ON data_sources(health_status);
CREATE INDEX idx_data_sources_authorization ON data_sources(authorization_status);
```

---

## 2. `source_sync_jobs`

每次 cron/queue 執行的紀錄，對應「Cron / Queue Job」。

```sql
CREATE TABLE source_sync_jobs (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK (job_type IN ('scheduled','triggered_by_search','manual_backfill')),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','succeeded','failed','degraded')),
  request_id TEXT NOT NULL,
  trigger_query_normalized TEXT,
  items_discovered INTEGER NOT NULL DEFAULT 0,
  items_upserted INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at_utc TEXT,
  finished_at_utc TEXT,
  created_at_utc TEXT NOT NULL
);
CREATE INDEX idx_source_sync_jobs_source_time ON source_sync_jobs(source_id, started_at_utc);
CREATE INDEX idx_source_sync_jobs_status ON source_sync_jobs(status);
```

主鍵：`id`。關聯：`source_id → data_sources`；被 `raw_event_sources.sync_job_id` 參照。
個資：`trigger_query_normalized` 只存標準化查詢字串（如「bigbang」），不得存使用者 ID／IP／email。
保存期限：90 天後可歸檔或刪除（純營運日誌，非法遵證據）。

---

## 3. `raw_event_sources`

外部來源的原始最小化輸入，對應「Raw Source Inbox」。

```sql
CREATE TABLE raw_event_sources (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  sync_job_id TEXT REFERENCES source_sync_jobs(id) ON DELETE SET NULL,
  source_ref TEXT NOT NULL,
  fetch_url TEXT NOT NULL,
  fetched_at_utc TEXT NOT NULL,
  http_status INTEGER,
  etag TEXT,
  last_modified TEXT,
  content_hash TEXT NOT NULL,
  parser_version TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  purge_after_utc TEXT NOT NULL,
  created_at_utc TEXT NOT NULL,
  UNIQUE (source_id, source_ref, content_hash)
);
CREATE INDEX idx_raw_event_sources_source_time ON raw_event_sources(source_id, fetched_at_utc);
CREATE INDEX idx_raw_event_sources_purge ON raw_event_sources(purge_after_utc);
```

主鍵：`id`；`UNIQUE(source_id, source_ref, content_hash)` 避免同內容重複入庫。關聯：`source_id → data_sources`、`sync_job_id → source_sync_jobs`；被 `event_candidates.raw_source_id` 參照。
個資／內容權利：`payload_json` **只存 Parser 需要的最小欄位**（名稱/時間/地點/URL），禁止存整頁 HTML、圖片二進位或截圖；`purge_after_utc` 由 `data_sources.raw_retention_days` 換算寫入，排程清除工作依此欄位刪除到期列。

---

## 4. `event_candidates`

Parser／Normalizer 產出、尚未確認的候選活動。

```sql
CREATE TABLE event_candidates (
  id TEXT PRIMARY KEY,
  raw_source_id TEXT NOT NULL REFERENCES raw_event_sources(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES data_sources(id),
  candidate_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  artist_names_json TEXT NOT NULL DEFAULT '[]',
  venue_name_raw TEXT,
  city TEXT,
  starts_at_utc TEXT,
  ends_at_utc TEXT,
  source_status_raw TEXT,
  official_event_url TEXT,
  official_ticket_url TEXT,
  confidence_score INTEGER NOT NULL CHECK (confidence_score BETWEEN 0 AND 100),
  review_state TEXT NOT NULL DEFAULT 'pending'
    CHECK (review_state IN ('pending','matched_existing','needs_review','rejected','promoted')),
  matched_event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
  expires_at_utc TEXT NOT NULL,
  created_at_utc TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL
);
CREATE INDEX idx_event_candidates_review_state ON event_candidates(review_state, updated_at_utc);
CREATE INDEX idx_event_candidates_name_date ON event_candidates(normalized_name, starts_at_utc);
CREATE INDEX idx_event_candidates_matched_event ON event_candidates(matched_event_id);
```

主鍵：`id`。關聯：`raw_source_id → raw_event_sources`、`source_id → data_sources`、`matched_event_id → events`（既有表）；被 `event_duplicates.duplicate_candidate_id`、`verification_reviews.candidate_id` 參照。
個資：無（活動公開資訊）；內容權利：不存官方圖片/描述全文，只存必要欄位＋來源 URL。
保存期限：`expires_at_utc` 依架構文件既定的「候選未驗證：保存 30–90 天後清理」寫入；`promoted`／`matched_existing` 狀態的列可延長保留以利追溯，`rejected` 到期即刪。

---

## 5. `event_source_links`

已確認活動與其來源證據的多對多連結（provenance）。

```sql
CREATE TABLE event_source_links (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES data_sources(id),
  candidate_id TEXT REFERENCES event_candidates(id) ON DELETE SET NULL,
  source_ref TEXT,
  source_url TEXT NOT NULL,
  trust_score_at_link_time INTEGER NOT NULL,
  first_seen_at_utc TEXT NOT NULL,
  last_confirmed_at_utc TEXT NOT NULL,
  UNIQUE (event_id, source_id, source_ref)
);
CREATE INDEX idx_event_source_links_event ON event_source_links(event_id);
CREATE INDEX idx_event_source_links_source ON event_source_links(source_id);
```

主鍵：`id`；`UNIQUE(event_id, source_id, source_ref)` 避免重複連結。關聯：`event_id → events`（既有）、`source_id → data_sources`、`candidate_id → event_candidates`。
個資：無。保存期限：與 `events` 同生命週期（活動存在就保留，供之後稽核「這筆資料哪裡來的」）。

---

## 6. `event_change_logs`

重要欄位變更稽核（日期異動、取消、延期、場館變更等）。

```sql
CREATE TABLE event_change_logs (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  changed_field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  evidence_source_id TEXT REFERENCES data_sources(id) ON DELETE SET NULL,
  evidence_url TEXT,
  changed_by TEXT NOT NULL CHECK (changed_by IN ('sync_job','admin_review','ai_suggestion')),
  notified_at_utc TEXT,
  created_at_utc TEXT NOT NULL
);
CREATE INDEX idx_event_change_logs_event_time ON event_change_logs(event_id, created_at_utc);
CREATE INDEX idx_event_change_logs_unnotified ON event_change_logs(notified_at_utc);
```

主鍵：`id`。關聯：`event_id → events`、`evidence_source_id → data_sources`。`notified_at_utc` 是 Notification Trigger 讀取本表用的欄位（見下方「Notification Trigger 設計」）。
個資：無。保存期限：長期保留（活動異動歷史屬產品信任基礎，不建議清除）。

---

## 7. `artist_external_ids`

歌手與外部來源 ID 的對應，供 Artist Alias Resolver 精確比對（比純模糊字串更可靠）。

```sql
CREATE TABLE artist_external_ids (
  id TEXT PRIMARY KEY,
  artist_id TEXT NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES data_sources(id),
  external_id TEXT NOT NULL,
  external_url TEXT,
  match_confidence TEXT NOT NULL CHECK (match_confidence IN ('verified','heuristic')),
  created_at_utc TEXT NOT NULL,
  UNIQUE (source_id, external_id)
);
CREATE INDEX idx_artist_external_ids_artist ON artist_external_ids(artist_id);
```

主鍵：`id`；`UNIQUE(source_id, external_id)` 防止同來源 ID 對應到兩個藝人。關聯：`artist_id → artists`（既有）、`source_id → data_sources`。
個資：藝人為公眾人物之公開身分資料，非一般個資，但仍不存聯絡方式等敏感欄位。保存期限：長期保留。

---

## 8. `venue_aliases`

場館別名，供 Venue Resolver 使用（比照既有 `artist_aliases` 設計）。

```sql
CREATE TABLE venue_aliases (
  id TEXT PRIMARY KEY,
  venue_id TEXT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  source_id TEXT REFERENCES data_sources(id) ON DELETE SET NULL,
  created_at_utc TEXT NOT NULL,
  UNIQUE (venue_id, normalized_alias)
);
CREATE INDEX idx_venue_aliases_search ON venue_aliases(normalized_alias, venue_id);
```

主鍵：`id`。關聯：`venue_id → venues`（既有）、`source_id → data_sources`。個資：無。保存期限：長期保留。

---

## 9. `event_duplicates`

去重決策紀錄（哪兩筆被判定重複、依什麼規則、誰核准）。

```sql
CREATE TABLE event_duplicates (
  id TEXT PRIMARY KEY,
  primary_event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  duplicate_candidate_id TEXT REFERENCES event_candidates(id) ON DELETE SET NULL,
  duplicate_event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
  match_method TEXT NOT NULL
    CHECK (match_method IN ('source_event_id','official_url','ticket_url','external_id','composite_heuristic')),
  match_confidence INTEGER NOT NULL CHECK (match_confidence BETWEEN 0 AND 100),
  decision TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (decision IN ('auto_merged','pending_review','confirmed_duplicate','rejected_not_duplicate')),
  reviewed_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at_utc TEXT NOT NULL,
  resolved_at_utc TEXT,
  CHECK (duplicate_candidate_id IS NOT NULL OR duplicate_event_id IS NOT NULL)
);
CREATE INDEX idx_event_duplicates_primary ON event_duplicates(primary_event_id);
CREATE INDEX idx_event_duplicates_decision ON event_duplicates(decision);
```

主鍵：`id`；`CHECK` 確保兩種重複來源（候選 vs 既有活動）至少擇一。關聯：`primary_event_id → events`、`duplicate_candidate_id → event_candidates`、`duplicate_event_id → events`、`reviewed_by_user_id → users`（既有）。
個資：`reviewed_by_user_id` 是內部管理員帳號，非一般使用者個資。保存期限：長期保留（去重稽核軌跡，避免日後誤合併爭議）。

---

## 10. `verification_reviews`

人工／AI 審核佇列與決策。

```sql
CREATE TABLE verification_reviews (
  id TEXT PRIMARY KEY,
  candidate_id TEXT REFERENCES event_candidates(id) ON DELETE CASCADE,
  event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
  review_type TEXT NOT NULL
    CHECK (review_type IN ('new_candidate','change_detection','duplicate_conflict','ai_extraction')),
  reviewer_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  decision TEXT NOT NULL DEFAULT 'pending'
    CHECK (decision IN ('pending','approved','rejected','needs_more_evidence')),
  notes TEXT,
  evidence_urls_json TEXT NOT NULL DEFAULT '[]',
  created_at_utc TEXT NOT NULL,
  decided_at_utc TEXT
);
CREATE INDEX idx_verification_reviews_candidate ON verification_reviews(candidate_id);
CREATE INDEX idx_verification_reviews_decision_time ON verification_reviews(decision, created_at_utc);
```

主鍵：`id`。關聯：`candidate_id → event_candidates`、`event_id → events`、`reviewer_user_id → users`（既有，管理員帳號）。
個資：`reviewer_user_id` 為內部帳號，非一般使用者個資；`notes`/`evidence_urls_json` 不得寫入他人聯絡方式等個資。保存期限：長期保留（審核軌跡）。

---

## Notification Trigger 設計（補齊架構文件缺口）

原 `EXTERNAL_EVENT_SYNC_ARCHITECTURE.md` 只在流程圖出現「Notification Trigger」一次，沒有設計說明，這裡補上：

1. **觸發來源**：只讀 `event_change_logs` 裡 `notified_at_utc IS NULL` 且 `changed_field` 屬於重要欄位（`starts_at_utc`、`status`（含 cancelled/postponed）、`venue_id`）的列，不在抓取 worker 內直接觸發，避免抓取與通知耦合、重試時重複發送。
2. **比對訂閱者**：`changed_field` 所屬 `event_id` 去 join 既有 `ticket_tasks`（`status='active'`）與 `reminders` 找出有追蹤該活動的 `user_id`，只通知有效訂閱者，不做全站廣播。
3. **產生通知**：沿用既有 `reminders` 表（`workers/api/migrations/0003_ticket_tasks_and_reminders.sql`），插入一列 `channel` 依使用者既有偏好、`idempotency_key = 'change:' || event_change_logs.id || ':' || user_id`，靠既有 `UNIQUE(user_id, idempotency_key)` 天生防重複，不需要新表。
4. **標記完成**：通知任務完成後把 `event_change_logs.notified_at_utc` 寫入時間戳，下一輪排程用 `idx_event_change_logs_unnotified` 索引只掃未通知列，避免全表掃描。
5. **失敗處理**：沿用 `reminders.status`（`scheduled/cancelled/sent/failed`）與 `attempt_count` 既有重試欄位，不需要额外狀態機。

這個設計刻意不新增獨立的 `notifications` 表，因為既有 `reminders` 表已經有 channel／idempotency／狀態機，重用可避免資料分裂成兩套通知系統。

---

## 個資與內容權利注意事項彙總

- 全部 10 張新表都不存一般使用者的聯絡資訊、身分證號、金流資料；唯一出現的使用者關聯是內部管理員 `reviewed_by_user_id`／`reviewer_user_id`（審核操作留痕，屬管理稽核而非個資蒐集）。
- `raw_event_sources.payload_json` 是唯一有內容權利風險的欄位：只能存 Parser 定義的最小欄位（名稱/時間/地點/URL/官方連結），**禁止整頁 HTML、禁止圖片二進位、禁止未授權轉載的完整描述文字**；`purge_after_utc` 到期必須真的刪除，不是只改狀態。
- `data_sources.authorization_status` 預設 `blocked_pending_review`：新增來源列時，若沒有人工審查記錄（`robots_checked_at_utc`/`terms_checked_at_utc` 皆為 NULL），對應 adapter 不得啟用，這是資料庫層級的守門，不只是程式邏輯判斷。

<!-- ✂ 檔尾哨兵｜本檔至此完整結束 -->
