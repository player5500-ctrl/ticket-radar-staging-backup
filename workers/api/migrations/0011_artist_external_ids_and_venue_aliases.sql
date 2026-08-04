CREATE TABLE artist_external_ids (
  id TEXT PRIMARY KEY, artist_id TEXT NOT NULL REFERENCES artists(id) ON DELETE CASCADE, data_source_id TEXT NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL, external_name TEXT, external_url TEXT, confidence REAL NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  verified_by TEXT CHECK (verified_by IN ('auto','admin')), created_at_utc TEXT NOT NULL, updated_at_utc TEXT NOT NULL,
  UNIQUE (data_source_id, external_id)
);
CREATE INDEX idx_artist_external_ids_artist ON artist_external_ids(artist_id);

CREATE TABLE venue_aliases (
  id TEXT PRIMARY KEY, venue_id TEXT NOT NULL REFERENCES venues(id) ON DELETE CASCADE, alias TEXT NOT NULL, normalized_alias TEXT NOT NULL,
  data_source_id TEXT REFERENCES data_sources(id) ON DELETE SET NULL, language_code TEXT, created_at_utc TEXT NOT NULL,
  UNIQUE (venue_id, normalized_alias)
);
CREATE INDEX idx_venue_aliases_search ON venue_aliases(normalized_alias);
