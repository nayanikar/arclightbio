-- Program-level discovery trust score for V3 sessions
ALTER TABLE opportunity_objects
  ADD COLUMN IF NOT EXISTS program_trust_score numeric,
  ADD COLUMN IF NOT EXISTS program_trust_breakdown jsonb;
