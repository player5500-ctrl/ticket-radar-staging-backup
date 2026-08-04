PRAGMA foreign_keys = ON;

CREATE TABLE data_sources (
  id TEXT PRIMARY KEY, key TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  source_category TEXT NOT NULL CHECK (source_category IN ('ticketing_platform','venue','organizer','artist_site','international_api','general_search','user_submitted')),
  base_url TEXT, sync_method TEXT NOT NULL CHECK (sync_method IN ('json_api','atom_feed','json_ld_scrape','html_scrape_limited','partner_feed','manual_entry')),
  status TEXT NOT NULL DEFAULT 'pending_agreement' CHECK (status IN ('active','paused','disabled','pending_agreement')),
  agreement_status TEXT NOT NULL DEFAULT 'not_contacted' CHECK (agreement_status IN ('not_required','not_contacted','contacted','in_discussion','agreed','declined')),
  requires_agreement INTEGER NOT NULL DEFAULT 1 CHECK (requires_agreement IN (0,1)), robots_snapshot TEXT, robots_checked_at_utc TEXT,
  terms_url TEXT, terms_summary TEXT, contact_email TEXT, rate_limit_per_hour INTEGER, sync_frequency_minutes INTEGER,
  credibility_base_score INTEGER NOT NULL CHECK (credibility_base_score BETWEEN 0 AND 100), last_sync_at_utc TEXT, last_success_at_utc TEXT,
  last_error TEXT, notes TEXT, created_at_utc TEXT NOT NULL, updated_at_utc TEXT NOT NULL
);
CREATE INDEX idx_data_sources_status ON data_sources(status, agreement_status);

CREATE TABLE source_sync_jobs (
  id TEXT PRIMARY KEY, data_source_id TEXT NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK (job_type IN ('scheduled','manual','backfill','search_fallback')),
  status TEXT NOT NULL CHECK (status IN ('queued','running','success','partial_success','failed','circuit_open')),
  trigger_source TEXT NOT NULL CHECK (trigger_source IN ('cron','queue','search_miss','admin')),
  request_params_json TEXT, started_at_utc TEXT, finished_at_utc TEXT, items_fetched INTEGER NOT NULL DEFAULT 0,
  items_new INTEGER NOT NULL DEFAULT 0, items_updated INTEGER NOT NULL DEFAULT 0, items_failed INTEGER NOT NULL DEFAULT 0,
  error_summary TEXT, created_at_utc TEXT NOT NULL
);
CREATE INDEX idx_source_sync_jobs_source_created ON source_sync_jobs(data_source_id, created_at_utc);
