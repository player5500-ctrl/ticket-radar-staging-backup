PRAGMA foreign_keys = ON;

CREATE TABLE ticket_tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  budget_twd INTEGER CHECK (budget_twd IS NULL OR budget_twd >= 0),
  max_ticket_count INTEGER CHECK (max_ticket_count IS NULL OR max_ticket_count BETWEEN 1 AND 20),
  acceptable_sessions_json TEXT NOT NULL DEFAULT '[]',
  area_preferences_json TEXT NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT '',
  created_at_utc TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL,
  deleted_at_utc TEXT,
  UNIQUE (user_id, event_id)
);

CREATE INDEX idx_ticket_tasks_user_status
  ON ticket_tasks(user_id, status, updated_at_utc);

CREATE TABLE ticket_task_checklists (
  id TEXT PRIMARY KEY,
  ticket_task_id TEXT NOT NULL REFERENCES ticket_tasks(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  label TEXT NOT NULL,
  is_applicable INTEGER NOT NULL DEFAULT 1 CHECK (is_applicable IN (0, 1)),
  is_completed INTEGER NOT NULL DEFAULT 0 CHECK (is_completed IN (0, 1)),
  completed_at_utc TEXT,
  sort_order INTEGER NOT NULL,
  created_at_utc TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL,
  UNIQUE (ticket_task_id, item_key)
);

CREATE TABLE reminders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  ticket_task_id TEXT REFERENCES ticket_tasks(id) ON DELETE CASCADE,
  ticket_sale_window_id TEXT REFERENCES ticket_sale_windows(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('web_push', 'ics', 'email', 'line')),
  scheduled_at_utc TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled', 'sent', 'failed')),
  custom_message TEXT,
  idempotency_key TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_attempt_at_utc TEXT,
  created_at_utc TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL,
  UNIQUE (user_id, idempotency_key)
);

CREATE INDEX idx_reminders_status_scheduled
  ON reminders(status, scheduled_at_utc);
