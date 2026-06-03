-- Clear generic surveillance tags before Claude re-generation on next scan
UPDATE opportunity_objects
SET surveillance_tags = '{"concept_tags":[],"entity_tags":[],"signal_tags":[]}'::jsonb
WHERE status != 'archived';
