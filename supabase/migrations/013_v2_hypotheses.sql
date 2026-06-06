-- v2 multi-hypothesis architecture (additive; v1 rows unchanged)

ALTER TABLE opportunity_objects
  ADD COLUMN IF NOT EXISTS schema_version int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS top_hypothesis_id uuid NULL,
  ADD COLUMN IF NOT EXISTS outgroup_validation jsonb NULL;

CREATE TABLE IF NOT EXISTS hypotheses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_object_id uuid NOT NULL REFERENCES opportunity_objects(id) ON DELETE CASCADE,
  rank int,
  is_outgroup boolean NOT NULL DEFAULT false,
  statement text NOT NULL,
  patient_population text NOT NULL,
  unmet_need text NOT NULL,
  org_positioning text NOT NULL,
  source text,
  cross_domain_score float,
  declared_modality text,
  regulatory_pathway text,
  confidence_score float,
  actionability_score float,
  actionability_zone text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE evidence_cards
  ADD COLUMN IF NOT EXISTS hypothesis_id uuid REFERENCES hypotheses(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_hypotheses_opportunity ON hypotheses(opportunity_object_id);
CREATE INDEX IF NOT EXISTS idx_evidence_cards_hypothesis ON evidence_cards(hypothesis_id);
