alter table opportunity_objects
  add column if not exists evidence_tier text,
  add column if not exists prior_score float;
