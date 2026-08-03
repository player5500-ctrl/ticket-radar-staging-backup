PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO users (
  id, email_normalized, display_name, role, timezone, locale, status,
  created_at_utc, updated_at_utc, deleted_at_utc
) VALUES
  (
    'user-demo', 'demo@example.invalid', '雷達測試員', 'user',
    'Asia/Taipei', 'zh-TW', 'active',
    '2026-07-20T00:00:00.000Z', '2026-07-20T00:00:00.000Z', NULL
  ),
  (
    'admin-demo', 'admin@example.invalid', '雷達管理員', 'admin',
    'Asia/Taipei', 'zh-TW', 'active',
    '2026-07-20T00:00:00.000Z', '2026-07-20T00:00:00.000Z', NULL
  );

INSERT OR IGNORE INTO artists (
  id, name, normalized_name, artist_type, image_url, official_url,
  created_at_utc, updated_at_utc, deleted_at_utc
) VALUES
  (
    'artist-night-orbit', '夜航星', '夜航星', 'group', NULL, NULL,
    '2026-07-20T01:00:00.000Z', '2026-07-20T01:00:00.000Z', NULL
  ),
  (
    'artist-dawn-signal', '晨光訊號', '晨光訊號', 'group', NULL, NULL,
    '2026-07-20T01:05:00.000Z', '2026-07-20T01:05:00.000Z', NULL
  ),
  (
    'artist-lin-aoi', '林澄音', '林澄音', 'solo', NULL, NULL,
    '2026-07-20T01:10:00.000Z', '2026-07-20T01:10:00.000Z', NULL
  );

INSERT OR IGNORE INTO artist_aliases (
  id, artist_id, alias, normalized_alias, language_code, created_at_utc
) VALUES
  ('alias-night-en', 'artist-night-orbit', 'Night Orbit', 'night orbit', 'en', '2026-07-20T01:20:00.000Z'),
  ('alias-night-ja', 'artist-night-orbit', 'ナイトオービット', 'ナイトオービット', 'ja', '2026-07-20T01:21:00.000Z'),
  ('alias-night-ko', 'artist-night-orbit', '나이트 오비트', '나이트 오비트', 'ko', '2026-07-20T01:22:00.000Z'),
  ('alias-dawn-en', 'artist-dawn-signal', 'Dawn Signal', 'dawn signal', 'en', '2026-07-20T01:23:00.000Z'),
  ('alias-dawn-ja', 'artist-dawn-signal', 'ドーンシグナル', 'ドーンシグナル', 'ja', '2026-07-20T01:24:00.000Z'),
  ('alias-dawn-ko', 'artist-dawn-signal', '새벽 신호', '새벽 신호', 'ko', '2026-07-20T01:25:00.000Z'),
  ('alias-aoi-en', 'artist-lin-aoi', 'Aoi Lin', 'aoi lin', 'en', '2026-07-20T01:26:00.000Z'),
  ('alias-aoi-ja', 'artist-lin-aoi', 'リン・アオイ', 'リン・アオイ', 'ja', '2026-07-20T01:27:00.000Z'),
  ('alias-aoi-ko', 'artist-lin-aoi', '린 아오이', '린 아오이', 'ko', '2026-07-20T01:28:00.000Z');

INSERT OR IGNORE INTO venues (
  id, name, normalized_name, city, country_code, timezone, address,
  official_url, created_at_utc, updated_at_utc, deleted_at_utc
) VALUES
  (
    'venue-taipei-dome-demo', '台北星環館（Demo）', '台北星環館 demo',
    '台北市', 'TW', 'Asia/Taipei', NULL, NULL,
    '2026-07-20T02:00:00.000Z', '2026-07-20T02:00:00.000Z', NULL
  ),
  (
    'venue-kaohsiung-harbor-demo', '高雄港灣舞台（Demo）', '高雄港灣舞台 demo',
    '高雄市', 'TW', 'Asia/Taipei', NULL, NULL,
    '2026-07-20T02:05:00.000Z', '2026-07-20T02:05:00.000Z', NULL
  );

INSERT OR IGNORE INTO ticket_platforms (
  id, name, slug, official_url, domains_json, status,
  created_at_utc, updated_at_utc
) VALUES
  (
    'platform-demo', 'Ticket Radar Demo', 'demo', NULL, '[]', 'active',
    '2026-07-20T02:10:00.000Z', '2026-07-20T02:10:00.000Z'
  ),
  (
    'platform-kktix', 'KKTIX（尚未啟用）', 'kktix', 'https://kktix.com',
    '["kktix.com"]', 'disabled',
    '2026-07-20T02:11:00.000Z', '2026-07-20T02:11:00.000Z'
  ),
  (
    'platform-tixcraft', '拓元售票（尚未啟用）', 'tixcraft',
    'https://tixcraft.com', '["tixcraft.com"]', 'disabled',
    '2026-07-20T02:12:00.000Z', '2026-07-20T02:12:00.000Z'
  );

INSERT OR IGNORE INTO platform_adapter_versions (
  id, ticket_platform_id, adapter_id, version, last_updated_at_utc,
  last_verified_at_utc, status, notes, created_at_utc, updated_at_utc
) VALUES
  (
    'adapter-version-generic-demo', 'platform-demo', 'generic-demo', '0.1.0',
    '2026-07-29T00:00:00.000Z', '2026-07-29T00:00:00.000Z', 'active',
    '僅限 http://127.0.0.1:5173 受控 Demo；不選票、不送單、不付款。',
    '2026-07-29T00:00:00.000Z', '2026-07-29T00:00:00.000Z'
  ),
  (
    'adapter-version-kktix', 'platform-kktix', 'kktix', '0.1.0-evaluation',
    '2026-07-29T00:00:00.000Z', NULL, 'disabled',
    '未取得固定測試頁、穩定 selector 與明確整合許可；不注入真實平台。',
    '2026-07-29T00:00:00.000Z', '2026-07-29T00:00:00.000Z'
  ),
  (
    'adapter-version-tixcraft', 'platform-tixcraft', 'tixcraft',
    '0.1.0-evaluation', '2026-07-29T00:00:00.000Z', NULL, 'disabled',
    '服務條款禁止自動程式干擾、繞過或操控正常購票流程與公平性。',
    '2026-07-29T00:00:00.000Z', '2026-07-29T00:00:00.000Z'
  );

INSERT OR IGNORE INTO events (
  id, name, normalized_name, image_url, starts_at_utc, ends_at_utc,
  venue_id, city, timezone, organizer_name, ticket_platform_id,
  official_event_url, official_ticket_url, status, source_type, source_url,
  last_verified_at_utc, is_admin_verified, created_by_user_id,
  created_at_utc, updated_at_utc, deleted_at_utc
) VALUES
  (
    'event-stellar-route-taipei', '星際航線：台北站', '星際航線 台北站', NULL,
    '2026-08-15T11:30:00.000Z', '2026-08-15T14:00:00.000Z',
    'venue-taipei-dome-demo', '台北市', 'Asia/Taipei', 'Ticket Radar Demo',
    'platform-demo', 'https://example.com/ticket-radar-demo/stellar-route',
    'https://example.com/ticket-radar-demo/stellar-route/tickets',
    'presale', 'mock_parser',
    'https://example.com/ticket-radar-demo/stellar-route',
    '2026-07-28T03:00:00.000Z', 0, 'admin-demo',
    '2026-07-28T03:00:00.000Z', '2026-07-28T03:00:00.000Z', NULL
  ),
  (
    'event-daybreak-code-kaohsiung', '破曉代碼：高雄場', '破曉代碼 高雄場', NULL,
    '2026-09-05T11:00:00.000Z', '2026-09-05T13:30:00.000Z',
    'venue-kaohsiung-harbor-demo', '高雄市', 'Asia/Taipei',
    'Ticket Radar Demo', 'platform-demo',
    'https://example.com/ticket-radar-demo/daybreak-code',
    'https://example.com/ticket-radar-demo/daybreak-code/tickets',
    'registration', 'admin_manual',
    'https://example.com/ticket-radar-demo/daybreak-code',
    '2026-07-27T04:00:00.000Z', 1, 'admin-demo',
    '2026-07-27T04:00:00.000Z', '2026-07-27T04:00:00.000Z', NULL
  ),
  (
    'event-blue-hour-taipei', '藍色時刻：澄音專場', '藍色時刻 澄音專場', NULL,
    '2026-10-10T10:30:00.000Z', '2026-10-10T13:00:00.000Z',
    'venue-taipei-dome-demo', '台北市', 'Asia/Taipei', 'Ticket Radar Demo',
    'platform-demo', 'https://example.com/ticket-radar-demo/blue-hour',
    'https://example.com/ticket-radar-demo/blue-hour/tickets',
    'announced', 'user_manual',
    'https://example.com/ticket-radar-demo/blue-hour',
    NULL, 0, 'user-demo',
    '2026-07-26T05:00:00.000Z', '2026-07-26T05:00:00.000Z', NULL
  );

INSERT OR IGNORE INTO event_artists (
  event_id, artist_id, billing_order, is_headliner
) VALUES
  ('event-stellar-route-taipei', 'artist-night-orbit', 1, 1),
  ('event-daybreak-code-kaohsiung', 'artist-dawn-signal', 1, 1),
  ('event-blue-hour-taipei', 'artist-lin-aoi', 1, 1);

INSERT OR IGNORE INTO ticket_sale_windows (
  id, event_id, sale_type, title, starts_at_utc, ends_at_utc,
  eligibility_note, official_url, status, created_at_utc, updated_at_utc
) VALUES
  (
    'sale-stellar-member', 'event-stellar-route-taipei', 'member_presale',
    '會員預售', '2026-08-01T04:00:00.000Z', '2026-08-01T08:00:00.000Z',
    'Demo 會員資格，請勿使用真實平台帳號。',
    'https://example.com/ticket-radar-demo/stellar-route/tickets', 'scheduled',
    '2026-07-28T03:10:00.000Z', '2026-07-28T03:10:00.000Z'
  ),
  (
    'sale-stellar-general', 'event-stellar-route-taipei', 'general_sale',
    '一般售票', '2026-08-03T04:00:00.000Z', NULL, NULL,
    'https://example.com/ticket-radar-demo/stellar-route/tickets', 'scheduled',
    '2026-07-28T03:11:00.000Z', '2026-07-28T03:11:00.000Z'
  ),
  (
    'sale-daybreak-lottery-start', 'event-daybreak-code-kaohsiung',
    'lottery_registration_start', '抽選登記開始',
    '2026-08-05T02:00:00.000Z', NULL, NULL,
    'https://example.com/ticket-radar-demo/daybreak-code/tickets', 'scheduled',
    '2026-07-27T04:10:00.000Z', '2026-07-27T04:10:00.000Z'
  ),
  (
    'sale-daybreak-lottery-end', 'event-daybreak-code-kaohsiung',
    'lottery_registration_end', '抽選登記截止',
    '2026-08-08T15:59:00.000Z', NULL, NULL,
    'https://example.com/ticket-radar-demo/daybreak-code/tickets', 'scheduled',
    '2026-07-27T04:11:00.000Z', '2026-07-27T04:11:00.000Z'
  ),
  (
    'sale-daybreak-result', 'event-daybreak-code-kaohsiung', 'lottery_result',
    '抽選結果公布', '2026-08-12T04:00:00.000Z', NULL, NULL,
    'https://example.com/ticket-radar-demo/daybreak-code/tickets', 'scheduled',
    '2026-07-27T04:12:00.000Z', '2026-07-27T04:12:00.000Z'
  ),
  (
    'sale-blue-general', 'event-blue-hour-taipei', 'general_sale',
    '一般售票', '2026-08-20T04:00:00.000Z', NULL, NULL,
    'https://example.com/ticket-radar-demo/blue-hour/tickets', 'scheduled',
    '2026-07-26T05:10:00.000Z', '2026-07-26T05:10:00.000Z'
  );

INSERT OR IGNORE INTO user_artist_follows (
  user_id, artist_id, created_at_utc
) VALUES
  ('user-demo', 'artist-night-orbit', '2026-07-28T06:00:00.000Z');

INSERT OR IGNORE INTO user_event_favorites (
  user_id, event_id, created_at_utc
) VALUES
  (
    'user-demo', 'event-daybreak-code-kaohsiung',
    '2026-07-28T06:05:00.000Z'
  );
