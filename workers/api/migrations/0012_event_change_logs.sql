CREATE TABLE event_change_logs (
  id TEXT PRIMARY KEY, event_id TEXT REFERENCES events(id) ON DELETE CASCADE, candidate_id TEXT REFERENCES event_candidates(id) ON DELETE CASCADE,
  data_source_id TEXT REFERENCES data_sources(id) ON DELETE SET NULL, field_name TEXT NOT NULL, old_value TEXT, new_value TEXT,
  change_source TEXT NOT NULL CHECK (change_source IN ('sync','admin','user_report')), significant INTEGER NOT NULL DEFAULT 0 CHECK (significant IN (0,1)),
  notified INTEGER NOT NULL DEFAULT 0 CHECK (notified IN (0,1)), detected_at_utc TEXT NOT NULL, created_at_utc TEXT NOT NULL,
  CHECK (event_id IS NOT NULL OR candidate_id IS NOT NULL)
);
CREATE INDEX idx_event_change_logs_event_detected ON event_change_logs(event_id, detected_at_utc);
