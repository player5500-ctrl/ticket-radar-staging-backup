-- 0013 preserved a rollback snapshot of events. SQLite rewrote FKs in tables
-- created before that rename to the snapshot table, so rebuild Phase 0 tables
-- against the active events table without deleting any historical rows.
PRAGMA foreign_keys = OFF;
PRAGMA legacy_alter_table = ON;

ALTER TABLE event_candidates RENAME TO event_candidates_fkbackup;
CREATE TABLE event_candidates (
  id TEXT PRIMARY KEY, raw_event_source_id TEXT REFERENCES raw_event_sources(id) ON DELETE SET NULL,
  name TEXT NOT NULL, normalized_name TEXT NOT NULL, artist_raw_json TEXT, venue_raw_json TEXT,
  venue_id TEXT REFERENCES venues(id) ON DELETE SET NULL, city TEXT, starts_at_utc TEXT NOT NULL, ends_at_utc TEXT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Taipei', organizer_name TEXT, ticket_platform_name TEXT,
  official_event_url TEXT, official_ticket_url TEXT, price_low_minor INTEGER, price_high_minor INTEGER, currency TEXT,
  credibility_score INTEGER NOT NULL CHECK (credibility_score BETWEEN 0 AND 100), confidence REAL NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','auto_verified','confirmed','rejected','duplicate','expired')),
  matched_event_id TEXT REFERENCES events(id) ON DELETE SET NULL, created_at_utc TEXT NOT NULL, updated_at_utc TEXT NOT NULL
);
INSERT INTO event_candidates SELECT * FROM event_candidates_fkbackup;
CREATE INDEX idx_event_candidates_review_v2 ON event_candidates(status, starts_at_utc);
CREATE INDEX idx_event_candidates_name_date_v2 ON event_candidates(normalized_name, starts_at_utc);

ALTER TABLE event_source_links RENAME TO event_source_links_fkbackup;
CREATE TABLE event_source_links (
  id TEXT PRIMARY KEY, event_id TEXT REFERENCES events(id) ON DELETE CASCADE, candidate_id TEXT REFERENCES event_candidates(id) ON DELETE CASCADE,
  data_source_id TEXT NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE, external_id TEXT, source_url TEXT NOT NULL,
  credibility_score INTEGER NOT NULL CHECK (credibility_score BETWEEN 0 AND 100), is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0,1)),
  first_seen_at_utc TEXT NOT NULL, last_seen_at_utc TEXT NOT NULL, last_confirmed_at_utc TEXT, created_at_utc TEXT NOT NULL, updated_at_utc TEXT NOT NULL,
  CHECK (event_id IS NOT NULL OR candidate_id IS NOT NULL), UNIQUE (event_id, data_source_id, external_id), UNIQUE (candidate_id, data_source_id, external_id)
);
INSERT INTO event_source_links SELECT * FROM event_source_links_fkbackup;
CREATE INDEX idx_event_source_links_event_v2 ON event_source_links(event_id, is_primary);

ALTER TABLE event_duplicates RENAME TO event_duplicates_fkbackup;
CREATE TABLE event_duplicates (
  id TEXT PRIMARY KEY, candidate_a_id TEXT NOT NULL REFERENCES event_candidates(id) ON DELETE CASCADE, candidate_b_id TEXT REFERENCES event_candidates(id) ON DELETE CASCADE,
  existing_event_id TEXT REFERENCES events(id) ON DELETE CASCADE, similarity_score REAL NOT NULL CHECK (similarity_score BETWEEN 0 AND 1),
  match_method TEXT NOT NULL CHECK (match_method IN ('exact_key','fuzzy_name_date_venue','artist_date_overlap','admin_manual')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed_duplicate','confirmed_distinct','auto_merged')),
  resolved_by TEXT CHECK (resolved_by IN ('auto','admin')), resolved_at_utc TEXT, created_at_utc TEXT NOT NULL,
  CHECK (candidate_b_id IS NOT NULL OR existing_event_id IS NOT NULL)
);
INSERT INTO event_duplicates SELECT * FROM event_duplicates_fkbackup;
CREATE INDEX idx_event_duplicates_status_v2 ON event_duplicates(status);

ALTER TABLE event_change_logs RENAME TO event_change_logs_fkbackup;
CREATE TABLE event_change_logs (
  id TEXT PRIMARY KEY, event_id TEXT REFERENCES events(id) ON DELETE CASCADE, candidate_id TEXT REFERENCES event_candidates(id) ON DELETE CASCADE,
  data_source_id TEXT REFERENCES data_sources(id) ON DELETE SET NULL, field_name TEXT NOT NULL, old_value TEXT, new_value TEXT,
  change_source TEXT NOT NULL CHECK (change_source IN ('sync','admin','user_report')), significant INTEGER NOT NULL DEFAULT 0 CHECK (significant IN (0,1)),
  notified INTEGER NOT NULL DEFAULT 0 CHECK (notified IN (0,1)), detected_at_utc TEXT NOT NULL, created_at_utc TEXT NOT NULL,
  CHECK (event_id IS NOT NULL OR candidate_id IS NOT NULL)
);
INSERT INTO event_change_logs SELECT * FROM event_change_logs_fkbackup;
CREATE INDEX idx_event_change_logs_event_detected_v2 ON event_change_logs(event_id, detected_at_utc);
PRAGMA legacy_alter_table = OFF;
PRAGMA foreign_keys = ON;
