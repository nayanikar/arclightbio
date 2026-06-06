-- V3 opportunity JSON fields persisted on opportunity_objects (Spec §4–§5)

ALTER TABLE opportunity_objects
  ADD COLUMN IF NOT EXISTS population_definition jsonb,
  ADD COLUMN IF NOT EXISTS cd1_patterns jsonb,
  ADD COLUMN IF NOT EXISTS cd2_associations jsonb,
  ADD COLUMN IF NOT EXISTS cross_context_seeds jsonb;

-- Undruggable registry: flag targets eligible for cross-session re-scan (Spec §6.3)
ALTER TABLE undruggable_targets
  ADD COLUMN IF NOT EXISTS rescan_eligible boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_undruggable_targets_name ON undruggable_targets(lower(target_name));
