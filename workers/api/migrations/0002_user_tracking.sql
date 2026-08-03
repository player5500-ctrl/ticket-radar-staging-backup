PRAGMA foreign_keys = ON;

CREATE TABLE user_artist_follows (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artist_id TEXT NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  created_at_utc TEXT NOT NULL,
  PRIMARY KEY (user_id, artist_id)
);

CREATE INDEX idx_user_artist_follows_user
  ON user_artist_follows(user_id, created_at_utc);

CREATE TABLE user_event_favorites (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_at_utc TEXT NOT NULL,
  PRIMARY KEY (user_id, event_id)
);

CREATE INDEX idx_user_event_favorites_user
  ON user_event_favorites(user_id, created_at_utc);
