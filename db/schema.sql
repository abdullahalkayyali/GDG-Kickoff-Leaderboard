CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attempts (
  id UUID PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES teams(id),
  booth TEXT NOT NULL CHECK (booth IN ('cys', 'ai', 'doodle-rocket', 'coaster-chaser')),
  points INTEGER NOT NULL CHECK (points BETWEEN 0 AND 1000),
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 1000),
  submissions INTEGER NOT NULL DEFAULT 1 CHECK (submissions >= 1),
  scoring_version TEXT NOT NULL,
  idempotency_key TEXT,
  fingerprint TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  voided_at TIMESTAMPTZ,
  void_reason TEXT,
  UNIQUE (booth, idempotency_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_valid_result_per_booth ON attempts(team_id, booth) WHERE voided_at IS NULL;
CREATE INDEX IF NOT EXISTS attempts_created_at ON attempts(created_at DESC);
