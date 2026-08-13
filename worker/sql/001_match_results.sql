-- Run through the approved database migration workflow before starting an ECS
-- worker task. event_id is the authoritative at-least-once delivery boundary.
CREATE TABLE IF NOT EXISTS match_result_receipts (
  event_id VARCHAR(128) PRIMARY KEY,
  match_id VARCHAR(128) NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS player_progression (
  player_id VARCHAR(64) PRIMARY KEY,
  total_xp BIGINT NOT NULL DEFAULT 0 CHECK (total_xp >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
