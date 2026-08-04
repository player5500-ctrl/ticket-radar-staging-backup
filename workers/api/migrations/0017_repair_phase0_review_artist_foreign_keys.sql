-- Repair the two Phase 0 tables that still referenced the pre-Phase 0 backup tables.
-- Keep the migration data-preserving: rows are copied before the old table is removed.
PRAGMA foreign_keys=OFF;

ALTER TABLE verification_reviews RENAME TO verification_reviews_fkbackup;
CREATE TABLE verification_reviews (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL REFERENCES event_candidates(id) ON DELETE CASCADE,
  reviewer_type TEXT NOT NULL CHECK (reviewer_type IN ('auto_rule','admin')),
  reviewer_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approve','reject','needs_more_info','escalate')),
  reason TEXT,
  checklist_json TEXT,
  decided_at_utc TEXT,
  created_at_utc TEXT NOT NULL
);
INSERT INTO verification_reviews
  SELECT id,candidate_id,reviewer_type,reviewer_user_id,decision,reason,checklist_json,decided_at_utc,created_at_utc
  FROM verification_reviews_fkbackup
  WHERE EXISTS (SELECT 1 FROM event_candidates WHERE event_candidates.id = verification_reviews_fkbackup.candidate_id);
CREATE TABLE verification_reviews_phase0_orphans AS
  SELECT * FROM verification_reviews_fkbackup
  WHERE NOT EXISTS (SELECT 1 FROM event_candidates WHERE event_candidates.id = verification_reviews_fkbackup.candidate_id);
DROP TABLE verification_reviews_fkbackup;

ALTER TABLE event_artists RENAME TO event_artists_fkbackup;
CREATE TABLE event_artists (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  artist_id TEXT NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  billing_order INTEGER NOT NULL DEFAULT 0,
  is_headliner INTEGER NOT NULL DEFAULT 0 CHECK (is_headliner IN (0,1)),
  PRIMARY KEY (event_id, artist_id)
);
INSERT INTO event_artists
  SELECT event_id,artist_id,billing_order,is_headliner FROM event_artists_fkbackup
  WHERE EXISTS (SELECT 1 FROM events WHERE events.id = event_artists_fkbackup.event_id)
    AND EXISTS (SELECT 1 FROM artists WHERE artists.id = event_artists_fkbackup.artist_id);
CREATE TABLE event_artists_phase0_orphans AS
  SELECT * FROM event_artists_fkbackup
  WHERE NOT EXISTS (SELECT 1 FROM events WHERE events.id = event_artists_fkbackup.event_id)
     OR NOT EXISTS (SELECT 1 FROM artists WHERE artists.id = event_artists_fkbackup.artist_id);
DROP TABLE event_artists_fkbackup;

PRAGMA foreign_keys=ON;
