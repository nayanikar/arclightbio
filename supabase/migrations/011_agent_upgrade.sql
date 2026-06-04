-- Agent upgrade v2.0: domain context, card flags, de-risking

ALTER TABLE opportunity_objects
ADD COLUMN IF NOT EXISTS domain_context text DEFAULT 'general';

ALTER TABLE opportunity_objects
ADD COLUMN IF NOT EXISTS indication_type text DEFAULT 'oncology';

ALTER TABLE evidence_cards
ADD COLUMN IF NOT EXISTS is_cross_domain boolean DEFAULT false;

ALTER TABLE evidence_cards
ADD COLUMN IF NOT EXISTS is_target_list boolean DEFAULT false;

ALTER TABLE evidence_cards
ADD COLUMN IF NOT EXISTS is_modality_card boolean DEFAULT false;

ALTER TABLE evidence_cards
ADD COLUMN IF NOT EXISTS is_novelty_check boolean DEFAULT false;

ALTER TABLE evidence_cards
ADD COLUMN IF NOT EXISTS derisk_recommendation jsonb;
