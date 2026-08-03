PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email_normalized TEXT UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  timezone TEXT NOT NULL DEFAULT 'Asia/Taipei',
  locale TEXT NOT NULL DEFAULT 'zh-TW',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disabled', 'deletion_pending')),
  created_at_utc TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL,
  deleted_at_utc TEXT
);

CREATE TABLE artists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  artist_type TEXT NOT NULL CHECK (artist_type IN ('solo', 'group', 'other')),
  image_url TEXT,
  official_url TEXT,
  created_at_utc TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL,
  deleted_at_utc TEXT
);

CREATE INDEX idx_artists_normalized_name
  ON artists(normalized_name);

CREATE TABLE artist_aliases (
  id TEXT PRIMARY KEY,
  artist_id TEXT NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  language_code TEXT NOT NULL,
  created_at_utc TEXT NOT NULL,
  UNIQUE (artist_id, normalized_alias)
);

CREATE INDEX idx_artist_aliases_search
  ON artist_aliases(normalized_alias, artist_id);

CREATE TABLE venues (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  city TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'TW',
  timezone TEXT NOT NULL DEFAULT 'Asia/Taipei',
  address TEXT,
  official_url TEXT,
  created_at_utc TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL,
  deleted_at_utc TEXT
);

CREATE INDEX idx_venues_search
  ON venues(normalized_name, city);

CREATE TABLE ticket_platforms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  official_url TEXT,
  domains_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'disabled'
    CHECK (status IN ('active', 'disabled')),
  created_at_utc TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL
);

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  image_url TEXT,
  starts_at_utc TEXT NOT NULL,
  ends_at_utc TEXT,
  venue_id TEXT REFERENCES venues(id) ON DELETE SET NULL,
  city TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Taipei',
  organizer_name TEXT NOT NULL,
  ticket_platform_id TEXT REFERENCES ticket_platforms(id) ON DELETE SET NULL,
  official_event_url TEXT,
  official_ticket_url TEXT,
  status TEXT NOT NULL DEFAULT 'unconfirmed'
    CHECK (
      status IN (
        'announced',
        'registration',
        'presale',
        'on_sale',
        'sold_out',
        'postponed',
        'cancelled',
        'completed',
        'unconfirmed'
      )
    ),
  source_type TEXT NOT NULL
    CHECK (
      source_type IN (
        'admin_manual',
        'user_manual',
        'official_url',
        'mock_parser'
      )
    ),
  source_url TEXT,
  last_verified_at_utc TEXT,
  is_admin_verified INTEGER NOT NULL DEFAULT 0
    CHECK (is_admin_verified IN (0, 1)),
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at_utc TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL,
  deleted_at_utc TEXT
);

CREATE INDEX idx_events_name_date
  ON events(normalized_name, starts_at_utc);
CREATE INDEX idx_events_city_date
  ON events(city, starts_at_utc);
CREATE INDEX idx_events_platform_date
  ON events(ticket_platform_id, starts_at_utc);

CREATE TABLE event_artists (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  artist_id TEXT NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  billing_order INTEGER NOT NULL DEFAULT 0,
  is_headliner INTEGER NOT NULL DEFAULT 0 CHECK (is_headliner IN (0, 1)),
  PRIMARY KEY (event_id, artist_id)
);

CREATE TABLE ticket_sale_windows (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  sale_type TEXT NOT NULL
    CHECK (
      sale_type IN (
        'fan_registration_deadline',
        'member_presale',
        'card_presale',
        'organizer_presale',
        'lottery_registration_start',
        'lottery_registration_end',
        'lottery_result',
        'general_sale',
        'payment_deadline',
        'pickup_start',
        'event_reminder'
      )
    ),
  title TEXT NOT NULL,
  starts_at_utc TEXT NOT NULL,
  ends_at_utc TEXT,
  eligibility_note TEXT,
  official_url TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'open', 'closed', 'cancelled')),
  created_at_utc TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL
);

CREATE INDEX idx_ticket_sale_windows_event_date
  ON ticket_sale_windows(event_id, starts_at_utc);
