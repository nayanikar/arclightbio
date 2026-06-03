-- Allow classifier to run on rows without an explicit tier (avoid default 'clinical' blocking re-classification)
alter table opportunity_objects alter column query_tier drop default;
alter table opportunity_objects alter column query_tier set default null;
