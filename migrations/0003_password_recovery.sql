CREATE TABLE IF NOT EXISTS password_recovery (
  user_id TEXT PRIMARY KEY REFERENCES "user" ("id") ON DELETE CASCADE,
  question_1 TEXT NOT NULL,
  answer_salt_1 TEXT NOT NULL,
  answer_hash_1 TEXT NOT NULL,
  question_2 TEXT,
  answer_salt_2 TEXT,
  answer_hash_2 TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (question_2 IS NULL AND answer_salt_2 IS NULL AND answer_hash_2 IS NULL)
    OR
    (question_2 IS NOT NULL AND answer_salt_2 IS NOT NULL AND answer_hash_2 IS NOT NULL)
  ),
  CHECK (question_2 IS NULL OR question_1 <> question_2)
);

CREATE TABLE IF NOT EXISTS password_recovery_attempts (
  email_hash TEXT PRIMARY KEY,
  failed_count INTEGER NOT NULL DEFAULT 0,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_until TIMESTAMPTZ
);
