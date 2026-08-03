PRAGMA foreign_keys = ON;

CREATE TABLE rate_limit_windows (
  key_hash TEXT NOT NULL,
  limit_kind TEXT NOT NULL CHECK (limit_kind IN ('api','search','auth')),
  window_started_at_utc TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1 CHECK (request_count > 0),
  expires_at_utc TEXT NOT NULL,
  PRIMARY KEY (key_hash, limit_kind, window_started_at_utc)
);

CREATE INDEX idx_rate_limit_windows_expiry
  ON rate_limit_windows(expires_at_utc);
