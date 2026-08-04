-- SQLite cannot alter a CHECK constraint in place. Preserve the original table
-- as a rollback snapshot, then restore the original table name with the wider
-- source_type enum. No existing row is deleted by this migration.
PRAGMA foreign_keys = OFF;
PRAGMA legacy_alter_table = ON;
ALTER TABLE events RENAME TO events_phase0_backup;

CREATE TABLE events (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, normalized_name TEXT NOT NULL, image_url TEXT,
  starts_at_utc TEXT NOT NULL, ends_at_utc TEXT, venue_id TEXT REFERENCES venues(id) ON DELETE SET NULL,
  city TEXT NOT NULL, timezone TEXT NOT NULL DEFAULT 'Asia/Taipei', organizer_name TEXT NOT NULL,
  ticket_platform_id TEXT REFERENCES ticket_platforms(id) ON DELETE SET NULL, official_event_url TEXT, official_ticket_url TEXT,
  status TEXT NOT NULL DEFAULT 'unconfirmed' CHECK (status IN ('announced','registration','presale','on_sale','sold_out','postponed','cancelled','completed','unconfirmed')),
  source_type TEXT NOT NULL CHECK (source_type IN ('admin_manual','user_manual','official_url','mock_parser','external_sync')),
  source_url TEXT, last_verified_at_utc TEXT, is_admin_verified INTEGER NOT NULL DEFAULT 0 CHECK (is_admin_verified IN (0,1)),
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL, created_at_utc TEXT NOT NULL, updated_at_utc TEXT NOT NULL, deleted_at_utc TEXT
);
INSERT INTO events SELECT * FROM events_phase0_backup;
-- The legacy rename preserves the existing index names; do not recreate them.
PRAGMA legacy_alter_table = OFF;
PRAGMA foreign_keys = ON;
