-- Wave 4: board-ready decision brief persisted on completed v2 sessions

ALTER TABLE opportunity_objects
  ADD COLUMN IF NOT EXISTS decision_brief jsonb NULL;
