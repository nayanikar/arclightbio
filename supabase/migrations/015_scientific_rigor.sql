ALTER TABLE hypotheses
  ADD COLUMN IF NOT EXISTS mechanistic_chain jsonb,
  ADD COLUMN IF NOT EXISTS target_alignment jsonb,
  ADD COLUMN IF NOT EXISTS evidence_summary jsonb,
  ADD COLUMN IF NOT EXISTS score_decomposition jsonb;
