PRAGMA foreign_keys = ON;

CREATE TABLE platform_adapter_versions (
  id TEXT PRIMARY KEY,
  ticket_platform_id TEXT REFERENCES ticket_platforms(id) ON DELETE SET NULL,
  adapter_id TEXT NOT NULL,
  version TEXT NOT NULL,
  last_updated_at_utc TEXT NOT NULL,
  last_verified_at_utc TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft','disabled','testing','active','deprecated')),
  notes TEXT NOT NULL DEFAULT '',
  created_at_utc TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL
);

CREATE TABLE notification_logs (
  id TEXT PRIMARY KEY,
  reminder_id TEXT REFERENCES reminders(id) ON DELETE SET NULL,
  channel TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  attempt_number INTEGER NOT NULL DEFAULT 1 CHECK (attempt_number > 0),
  provider_message_id_masked TEXT,
  error_code TEXT,
  created_at_utc TEXT NOT NULL
);

CREATE TABLE user_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
  adapter_id TEXT,
  category TEXT NOT NULL,
  description TEXT NOT NULL CHECK (length(description) BETWEEN 1 AND 2000),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','resolved','rejected')),
  created_at_utc TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL,
  resolved_at_utc TEXT
);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  request_id TEXT NOT NULL,
  before_summary_json TEXT,
  after_summary_json TEXT,
  ip_hash TEXT,
  created_at_utc TEXT NOT NULL
);

CREATE INDEX idx_platform_adapter_versions_adapter
  ON platform_adapter_versions(adapter_id, updated_at_utc);
CREATE INDEX idx_notification_logs_reminder_created
  ON notification_logs(reminder_id, created_at_utc);
CREATE INDEX idx_user_reports_status_created
  ON user_reports(status, created_at_utc);
CREATE INDEX idx_audit_logs_entity_created
  ON audit_logs(entity_type, entity_id, created_at_utc);
