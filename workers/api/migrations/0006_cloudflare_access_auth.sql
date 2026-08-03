PRAGMA foreign_keys = ON;

CREATE TABLE user_auth_identities (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  subject TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_normalized TEXT,
  created_at_utc TEXT NOT NULL,
  last_seen_at_utc TEXT NOT NULL,
  UNIQUE (provider, subject)
);

CREATE INDEX idx_user_auth_identities_user
  ON user_auth_identities(user_id, provider);
