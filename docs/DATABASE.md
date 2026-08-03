# 追票雷達 Ticket Radar — Database

## 1. 資料庫範圍

- 正式雲端資料：Cloudflare D1。
- 本機開發：Wrangler local D1。
- 購票資料組明文與原始截圖：不進 D1。
- 所有應用只能經 Workers API 存取資料；前端不可執行任意 SQL。
- migration 只向前新增／調整，正式執行前先備份並驗證環境。

## 2. 共通慣例

- 主鍵：應用端產生 UUID／ULID 文字值。
- 時間：ISO 8601 UTC 字串，欄位後綴 `_at_utc`。
- 布林：D1 `INTEGER NOT NULL CHECK (... IN (0, 1))`。
- 可列舉狀態：`TEXT CHECK (...)`，並在 TypeScript／Zod 同步定義。
- 軟刪除：需要保留稽核關係的資料使用 `deleted_at_utc`。
- 更新衝突：可變資源包含 `version` 或依 `updated_at_utc` 進行樂觀鎖。
- SQL 一律使用 binding，不插入字串拼接值。

## 3. 關聯概覽

```text
users
├─ user_artist_follows ─ artists ─ artist_aliases
├─ user_event_favorites ─ events ─ event_artists ─ artists
├─ ticket_tasks ─ ticket_task_checklists
│  └─ reminders
├─ purchase_records
├─ user_reports
└─ audit_logs (actor)

venues ─ events ─ ticket_sale_windows ─ reminders
ticket_platforms ─ events
ticket_platforms ─ platform_adapter_versions
notification_logs ─ reminders
```

## 4. 資料表草案

### 4.1 `users`

| 欄位                                                 | 說明                                       |
| ---------------------------------------------------- | ------------------------------------------ |
| `id`                                                 | 主鍵                                       |
| `email_normalized`                                   | 可空；唯一索引；不進一般 log               |
| `display_name`                                       | 顯示名稱                                   |
| `role`                                               | `user` / `admin`                           |
| `timezone`                                           | IANA 時區，預設 `Asia/Taipei`              |
| `locale`                                             | 預設 `zh-TW`                               |
| `status`                                             | `active` / `disabled` / `deletion_pending` |
| `created_at_utc`, `updated_at_utc`, `deleted_at_utc` | 生命週期                                   |

### 4.2 `artists`

`id`, `name`, `normalized_name`, `artist_type` (`solo` / `group` / `other`), `image_url`, `official_url`, `created_at_utc`, `updated_at_utc`, `deleted_at_utc`。

### 4.3 `artist_aliases`

`id`, `artist_id`, `alias`, `normalized_alias`, `language_code`, `created_at_utc`。

唯一限制：`artist_id + normalized_alias`。

### 4.4 `venues`

`id`, `name`, `normalized_name`, `city`, `country_code`, `timezone`, `address`, `official_url`, `created_at_utc`, `updated_at_utc`, `deleted_at_utc`。

### 4.5 `ticket_platforms`

`id`, `name`, `slug`, `official_url`, `domains_json`, `status`, `created_at_utc`, `updated_at_utc`。

`domains_json` 只由管理員 service 驗證後寫入；Extension 的 host permissions 由建置時的明確白名單產生，不直接信任資料庫內容。

### 4.6 `events`

| 欄位                                                 | 說明                                                                                                                        |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `id`                                                 | 主鍵                                                                                                                        |
| `name`, `normalized_name`                            | 活動名稱與搜尋值                                                                                                            |
| `image_url`                                          | HTTPS 圖片網址                                                                                                              |
| `starts_at_utc`, `ends_at_utc`                       | 演出時間                                                                                                                    |
| `venue_id`                                           | 可空的場館 FK                                                                                                               |
| `city`, `timezone`                                   | 活動所在地與顯示時區                                                                                                        |
| `organizer_name`                                     | 主辦單位                                                                                                                    |
| `ticket_platform_id`                                 | 可空的售票平台 FK                                                                                                           |
| `official_event_url`, `official_ticket_url`          | 官方來源                                                                                                                    |
| `status`                                             | `announced` / `registration` / `presale` / `on_sale` / `sold_out` / `postponed` / `cancelled` / `completed` / `unconfirmed` |
| `source_type`                                        | `admin_manual` / `user_manual` / `official_url` / `mock_parser`                                                             |
| `source_url`                                         | 來源 URL                                                                                                                    |
| `last_verified_at_utc`                               | 最後確認時間                                                                                                                |
| `is_admin_verified`                                  | 管理員確認                                                                                                                  |
| `created_by_user_id`                                 | 建立者                                                                                                                      |
| `created_at_utc`, `updated_at_utc`, `deleted_at_utc` | 生命週期                                                                                                                    |

### 4.7 `event_artists`

`event_id`, `artist_id`, `billing_order`, `is_headliner`。複合主鍵：`event_id + artist_id`。

### 4.8 `ticket_sale_windows`

`id`, `event_id`, `sale_type`, `title`, `starts_at_utc`, `ends_at_utc`, `eligibility_note`, `official_url`, `status`, `created_at_utc`, `updated_at_utc`。

`sale_type`：

- `fan_registration_deadline`
- `member_presale`
- `card_presale`
- `organizer_presale`
- `lottery_registration_start`
- `lottery_registration_end`
- `lottery_result`
- `general_sale`
- `payment_deadline`
- `pickup_start`
- `event_reminder`

### 4.9 `user_artist_follows`

`user_id`, `artist_id`, `created_at_utc`。複合主鍵避免重複追蹤。

### 4.10 `user_event_favorites`

`user_id`, `event_id`, `created_at_utc`。複合主鍵避免重複收藏。

### 4.11 `ticket_tasks`

`id`, `user_id`, `event_id`, `status`, `budget_minor`, `currency`, `max_ticket_count`, `acceptable_sessions_json`, `area_preferences_json`, `notes`, `created_at_utc`, `updated_at_utc`, `deleted_at_utc`。

陣列 JSON 進入 service 前必須通過 Zod，且限制項目數與字串長度。

### 4.12 `ticket_task_checklists`

`id`, `ticket_task_id`, `item_key`, `label`, `is_applicable`, `is_completed`, `completed_at_utc`, `sort_order`, `created_at_utc`, `updated_at_utc`。

`item_key` 預設值：

- `platform_account_created`
- `phone_verified`
- `presale_eligibility_confirmed`
- `payment_method_confirmed`
- `purchaser_name_confirmed`
- `companions_confirmed`
- `budget_set`
- `area_preferences_set`
- `acceptable_sessions_set`
- `max_ticket_count_set`
- `notes_reviewed`

### 4.13 `reminders`

`id`, `user_id`, `event_id`, `ticket_task_id`, `ticket_sale_window_id`, `channel`, `scheduled_at_utc`, `status`, `custom_message`, `idempotency_key`, `attempt_count`, `last_attempt_at_utc`, `created_at_utc`, `updated_at_utc`。

`channel`：`web_push` / `ics` / `email` / `line`。

### 4.14 `purchase_records`

| 欄位                                                 | 說明                                                                                                |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `id`                                                 | 主鍵                                                                                                |
| `user_id`, `event_id`, `ticket_platform_id`          | 所屬資料                                                                                            |
| `order_reference_masked`                             | 顯示用遮罩                                                                                          |
| `order_dedupe_hash`                                  | 不可逆去重摘要                                                                                      |
| `session_label`, `seat_or_area_masked`               | 遮罩後資訊                                                                                          |
| `ticket_count`                                       | 張數                                                                                                |
| `order_created_at_utc`                               | 訂單成立時間                                                                                        |
| `order_status`                                       | `not_purchased` / `created` / `payment_pending` / `paid` / `cancelled` / `refunded` / `unconfirmed` |
| `payment_deadline_at_utc`                            | 付款期限                                                                                            |
| `pickup_status`                                      | `not_available` / `pending` / `available` / `picked_up` / `unconfirmed`                             |
| `screenshot_filename`                                | 本機檔名，不是檔案網址                                                                              |
| `notes`                                              | 使用者備註                                                                                          |
| `source`                                             | `extension_demo` / `extension_adapter` / `manual`                                                   |
| `created_at_utc`, `updated_at_utc`, `deleted_at_utc` | 生命週期                                                                                            |

唯一索引：`user_id + ticket_platform_id + order_dedupe_hash`（hash 可空時使用 service fallback idempotency）。

### 4.15 `platform_adapter_versions`

`id`, `ticket_platform_id`, `adapter_id`, `version`, `last_updated_at_utc`, `last_verified_at_utc`, `status`, `notes`, `created_at_utc`, `updated_at_utc`。

`status`：`draft` / `disabled` / `testing` / `active` / `deprecated`。

### 4.16 `notification_logs`

`id`, `reminder_id`, `channel`, `provider`, `status`, `attempt_number`, `provider_message_id_masked`, `error_code`, `created_at_utc`。

禁止保存完整 payload、Email、電話、LINE user id 或 provider secret。

### 4.17 `user_reports`

`id`, `user_id`, `event_id`, `adapter_id`, `category`, `description`, `status`, `created_at_utc`, `updated_at_utc`, `resolved_at_utc`。

內容需限制長度、清理控制字元，管理後台以純文字顯示。

### 4.18 `audit_logs`

`id`, `actor_user_id`, `action`, `entity_type`, `entity_id`, `request_id`, `before_summary_json`, `after_summary_json`, `ip_hash`, `created_at_utc`。

稽核摘要只保存白名單欄位。禁止存 auth header、cookie、個資全文、資料組、截圖或秘密。

## 5. 主要索引

- `artists(normalized_name)`
- `artist_aliases(normalized_alias, artist_id)`
- `events(normalized_name, starts_at_utc)`
- `events(city, starts_at_utc)`
- `events(ticket_platform_id, starts_at_utc)`
- `ticket_sale_windows(event_id, starts_at_utc)`
- `user_artist_follows(user_id, created_at_utc)`
- `user_event_favorites(user_id, created_at_utc)`
- `ticket_tasks(user_id, status, updated_at_utc)`
- `reminders(status, scheduled_at_utc)`
- `purchase_records(user_id, created_at_utc)`
- `notification_logs(reminder_id, created_at_utc)`
- `audit_logs(entity_type, entity_id, created_at_utc)`

## 6. Repository／Service 邊界

### Repository

- 只接受已驗證、具體型別的參數。
- 只執行參數化 SQL。
- 不判斷 HTTP、session 或 UI 狀態。
- 查詢預設排除 `deleted_at_utc IS NOT NULL`。

### Service

- 權限與資料所有權。
- UTC／時區轉換規則。
- 狀態轉換與跨表 transaction/batch。
- audit log。
- reminder 與 purchase record idempotency。
- 對外 DTO 遮罩。

## 7. Migration 規劃

```text
0001_core_catalog.sql
0002_user_tracking.sql
0003_ticket_tasks_and_reminders.sql
0004_purchase_records.sql
0005_admin_reporting_and_audit.sql
0006_indexes.sql
```

Phase 1 建立 migration 時必須：

1. 先在全新 local D1 執行。
2. 再從上一 migration 狀態逐版升級。
3. 檢查 FK 與唯一限制。
4. 執行 seed 與 repository 整合測試。
5. 正式環境執行前先 export／backup，並記錄 database id 與 migration 狀態。

## 8. Seed 規劃

測試資料至少包含：

- 3 位／組歌手，含繁中、英、日、韓別名。
- 2 個場館、2 個城市。
- Demo Platform 與 disabled 的 KKTIX／TixCraft 平台資料。
- 3 個活動，含預售、抽選、一般售票等不同時間軸。
- 1 個 Demo 使用者與 1 個 Demo 管理員（僅本機）。
- 收藏、購票任務、清單、提醒與遮罩後購票紀錄。

Seed 不得含真實個資、憑證、正式平台帳號或可用付款資料。

## 9. 資料刪除與匯出

- 使用者匯出只包含自己的雲端資料，不包含 audit log 中其他人的資料。
- 刪除資料以 transaction/batch 處理所有使用者關聯資料。
- 法規或資安必要的 audit log 可保留去識別摘要；保留期在正式上線前由隱私政策確認。
- 購票資料組與本機截圖由 Extension 提供獨立刪除；PWA 帳號刪除不宣稱已刪除瀏覽器下載資料夾檔案。

## 10. 待確認決策

- 正式身分提供端與帳號驗證方式。
- D1 的正式資料保留期。
- Web Push subscription 的加密與刪除策略。
- Email／LINE provider 與地區法規要求。
- 是否需要 FTS5；先以 MVP 規模測量後決定。
