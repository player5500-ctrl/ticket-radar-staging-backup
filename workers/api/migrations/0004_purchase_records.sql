PRAGMA foreign_keys = ON;
CREATE TABLE purchase_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  ticket_platform_id TEXT REFERENCES ticket_platforms(id) ON DELETE SET NULL,
  order_reference_masked TEXT NOT NULL,
  order_dedupe_hash TEXT,
  session_label TEXT,
  seat_or_area_masked TEXT,
  ticket_count INTEGER NOT NULL CHECK (ticket_count BETWEEN 1 AND 20),
  order_created_at_utc TEXT NOT NULL,
  order_status TEXT NOT NULL CHECK (order_status IN ('not_purchased','created','payment_pending','paid','cancelled','refunded','unconfirmed')),
  payment_deadline_at_utc TEXT,
  pickup_status TEXT NOT NULL DEFAULT 'unconfirmed' CHECK (pickup_status IN ('not_available','pending','available','picked_up','unconfirmed')),
  screenshot_filename TEXT,
  notes TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL CHECK (source IN ('extension_demo','extension_adapter','manual')),
  created_at_utc TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL,
  deleted_at_utc TEXT
);
CREATE UNIQUE INDEX idx_purchase_records_dedupe ON purchase_records(user_id, ticket_platform_id, order_dedupe_hash) WHERE order_dedupe_hash IS NOT NULL;
CREATE INDEX idx_purchase_records_user_created ON purchase_records(user_id, created_at_utc);
