CREATE TABLE event_candidates (
  id TEXT PRIMARY KEY, raw_event_source_id TEXT REFERENCES raw_event_sources(id) ON DELETE SET NULL,
  name TEXT NOT NULL, normalized_name TEXT NOT NULL, artist_raw_json TEXT, venue_raw_json TEXT,
  venue_id TEXT REFERENCES venues(id) ON DELETE SET NULL, city TEXT, starts_at_utc TEXT NOT NULL, ends_at_utc TEXT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Taipei', organizer_name TEXT, ticket_platform_name TEXT,
  official_event_url TEXT, official_ticket_url TEXT, price_low_minor INTEGER, price_high_minor INTEGER,
  currency TEXT, credibility_score INTEGER NOT NULL CHECK (credibility_score BETWEEN 0 AND 100), confidence REAL NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','auto_verified','confirmed','rejected','duplicate','expired')),
  matched_event_id TEXT REFERENCES events(id) ON DELETE SET NULL, created_at_utc TEXT NOT NULL, updated_at_utc TEXT NOT NULL
);
CREATE INDEX idx_event_candidates_review ON event_candidates(status, starts_at_utc);
CREATE INDEX idx_event_candidates_name_date ON event_candidates(normalized_name, starts_at_utc);

CREATE TABLE event_source_links (
  id TEXT PRIMARY KEY, event_id TEXT REFERENCES events(id) ON DELETE CASCADE, candidate_id TEXT REFERENCES event_candidates(id) ON DELETE CASCADE,
  data_source_id TEXT NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE, external_id TEXT, source_url TEXT NOT NULL,
  credibility_score INTEGER NOT NULL CHECK (credibility_score BETWEEN 0 AND 100), is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0,1)),
  first_seen_at_utc TEXT NOT NULL, last_seen_at_utc TEXT NOT NULL, last_confirmed_at_utc TEXT, created_at_utc TEXT NOT NULL, updated_at_utc TEXT NOT NULL,
  CHECK (event_id IS NOT NULL OR candidate_id IS NOT NULL), UNIQUE (event_id, data_source_id, external_id), UNIQUE (candidate_id, data_source_id, external_id)
);
CREATE INDEX idx_event_source_links_event ON event_source_links(event_id, is_primary);

CREATE TABLE event_duplicates (
  id TEXT PRIMARY KEY, candidate_a_id TEXT NOT NULL REFERENCES event_candidates(id) ON DELETE CASCADE,
  candidate_b_id TEXT REFERENCES event_candidates(id) ON DELETE CASCADE, existing_event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
  similarity_score REAL NOT NULL CHECK (similarity_score BETWEEN 0 AND 1),
  match_method TEXT NOT NULL CHECK (match_method IN ('exact_key','fuzzy_name_date_venue','artist_date_overlap','admin_manual')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed_duplicate','confirmed_distinct','auto_merged')),
  resolved_by TEXT CHECK (resolved_by IN ('auto','admin')), resolved_at_utc TEXT, created_at_utc TEXT NOT NULL,
  CHECK (candidate_b_id IS NOT NULL OR existing_event_id IS NOT NULL)
);
CREATE INDEX idx_event_duplicates_status ON event_duplicates(status);

CREATE TABLE verification_reviews (
  id TEXT PRIMARY KEY, candidate_id TEXT NOT NULL REFERENCES event_candidates(id) ON DELETE CASCADE,
  reviewer_type TEXT NOT NULL CHECK (reviewer_type IN ('auto_rule','admin')), reviewer_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approve','reject','needs_more_info','escalate')), reason TEXT, checklist_json TEXT,
  decided_at_utc TEXT, created_at_utc TEXT NOT NULL
);
CREATE INDEX idx_verification_reviews_candidate ON verification_reviews(candidate_id, created_at_utc);
