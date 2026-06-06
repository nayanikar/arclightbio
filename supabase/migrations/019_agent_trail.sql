-- V3 agent audit trail (append-only events for human review)

CREATE TABLE IF NOT EXISTS agent_trail_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES opportunity_objects(id) ON DELETE CASCADE,
  timestamp timestamptz NOT NULL DEFAULT now(),
  step text NOT NULL,
  agent text NOT NULL,
  phase text NOT NULL,
  kind text NOT NULL,
  title text NOT NULL,
  summary text,
  sources jsonb NOT NULL DEFAULT '[]',
  evidence_card_ids uuid[] NOT NULL DEFAULT '{}',
  hypothesis_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_agent_trail_opportunity_ts
  ON agent_trail_entries(opportunity_id, timestamp);

CREATE INDEX IF NOT EXISTS idx_agent_trail_hypothesis
  ON agent_trail_entries(opportunity_id, hypothesis_id)
  WHERE hypothesis_id IS NOT NULL;
