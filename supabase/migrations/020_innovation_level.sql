ALTER TABLE opportunity_objects
  ADD COLUMN IF NOT EXISTS innovation_level text NOT NULL DEFAULT 'highest'
    CHECK (innovation_level IN ('lowest', 'medium', 'highest'));
