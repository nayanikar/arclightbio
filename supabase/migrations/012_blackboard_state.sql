ALTER TABLE opportunity_objects
  ADD COLUMN IF NOT EXISTS blackboard_state jsonb DEFAULT NULL;
