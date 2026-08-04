CREATE TABLE raw_event_sources (
  id TEXT PRIMARY KEY, data_source_id TEXT NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  source_sync_job_id TEXT REFERENCES source_sync_jobs(id) ON DELETE SET NULL, external_id TEXT, source_url TEXT NOT NULL,
  content_hash TEXT, raw_payload TEXT, raw_payload_r2_key TEXT, fetched_at_utc TEXT NOT NULL,
  parser_status TEXT NOT NULL DEFAULT 'pending' CHECK (parser_status IN ('pending','parsed','parse_failed','ignored')),
  parse_error TEXT, retention_expires_at_utc TEXT NOT NULL, created_at_utc TEXT NOT NULL,
  UNIQUE (data_source_id, content_hash)
);
CREATE INDEX idx_raw_event_sources_parser_status ON raw_event_sources(parser_status, fetched_at_utc);
CREATE INDEX idx_raw_event_sources_external ON raw_event_sources(data_source_id, external_id);
