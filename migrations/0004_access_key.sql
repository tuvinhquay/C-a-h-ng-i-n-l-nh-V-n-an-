CREATE TABLE IF NOT EXISTS app_access_key (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  user_id TEXT NOT NULL UNIQUE REFERENCES "user" ("id") ON DELETE CASCADE,
  key_salt TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_access_key_setup (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  setup_token_hash TEXT NOT NULL,
  key_salt TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS app_access_key_attempts (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  failed_count INTEGER NOT NULL DEFAULT 0,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_until TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS app_access_key_sessions (
  session_id TEXT PRIMARY KEY REFERENCES "session" ("id") ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
