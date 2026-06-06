-- V3 drug discovery pipeline foundation (additive; v1/v2 rows unchanged)

-- Patient cohort upload (Spec §4)
CREATE TABLE IF NOT EXISTS patient_cohorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  file_name text NOT NULL,
  row_count int NOT NULL DEFAULT 0,
  domain_summary jsonb NOT NULL DEFAULT '{}',
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cohort_patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid NOT NULL REFERENCES patient_cohorts(id) ON DELETE CASCADE,
  patient_id text NOT NULL,
  primary_diagnosis text NOT NULL,
  comorbidities text[] NOT NULL DEFAULT '{}',
  biomarkers text,
  resistance_status text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cohort_patients_cohort ON cohort_patients(cohort_id);
CREATE INDEX IF NOT EXISTS idx_cohort_patients_patient_id ON cohort_patients(cohort_id, patient_id);

-- V3 opportunity fields (Spec §4–§5)
ALTER TABLE opportunity_objects
  ADD COLUMN IF NOT EXISTS parent_domain text,
  ADD COLUMN IF NOT EXISTS cohort_id uuid REFERENCES patient_cohorts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS program_hypothesis_sentence text,
  ADD COLUMN IF NOT EXISTS anchor_profiles jsonb,
  ADD COLUMN IF NOT EXISTS expert_domains jsonb,
  ADD COLUMN IF NOT EXISTS selected_phase2_hypothesis_id uuid,
  ADD COLUMN IF NOT EXISTS v3_phase text;

CREATE INDEX IF NOT EXISTS idx_opportunity_objects_cohort ON opportunity_objects(cohort_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_objects_v3_phase ON opportunity_objects(v3_phase)
  WHERE schema_version = 3;

-- V3 hypothesis funnel columns (Spec §5.4–§5.6 + SME rigor)
ALTER TABLE hypotheses
  ADD COLUMN IF NOT EXISTS hypothesis_stage text
    CHECK (hypothesis_stage IS NULL OR hypothesis_stage IN ('association', 'causation', 'selectivity')),
  ADD COLUMN IF NOT EXISTS parent_hypothesis_id uuid REFERENCES hypotheses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS falsifiability_statement text,
  ADD COLUMN IF NOT EXISTS anchor_type text
    CHECK (anchor_type IS NULL OR anchor_type IN ('biology', 'resistance')),
  ADD COLUMN IF NOT EXISTS anchor_linkage text,
  ADD COLUMN IF NOT EXISTS dropped_links jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS new_moa_requires_experiment boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS intervention_direction_hypothesis text,
  ADD COLUMN IF NOT EXISTS direction_status text
    CHECK (direction_status IS NULL OR direction_status IN ('supported', 'disputed', 'unsupported')),
  ADD COLUMN IF NOT EXISTS direction_hypotheses jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS rank_decomposition jsonb,
  ADD COLUMN IF NOT EXISTS ranking_rationale text,
  ADD COLUMN IF NOT EXISTS ranked_targets jsonb,
  ADD COLUMN IF NOT EXISTS falsification_experiment jsonb,
  ADD COLUMN IF NOT EXISTS target_family_context jsonb;

CREATE INDEX IF NOT EXISTS idx_hypotheses_stage ON hypotheses(opportunity_object_id, hypothesis_stage);
CREATE INDEX IF NOT EXISTS idx_hypotheses_parent ON hypotheses(parent_hypothesis_id);

-- Phase 2 drug discovery assessment (Spec §6.1–§6.2)
CREATE TABLE IF NOT EXISTS drug_discovery_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_object_id uuid NOT NULL REFERENCES opportunity_objects(id) ON DELETE CASCADE,
  hypothesis_id uuid NOT NULL REFERENCES hypotheses(id) ON DELETE CASCADE,
  drug_exists boolean,
  branch text CHECK (branch IS NULL OR branch IN ('existing', 'new')),
  assessment jsonb NOT NULL DEFAULT '{}',
  tpp_blueprint jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drug_assessments_opportunity ON drug_discovery_assessments(opportunity_object_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_drug_assessments_hypothesis ON drug_discovery_assessments(hypothesis_id);

-- Phase 2 IND regulatory package (Spec §6.3)
CREATE TABLE IF NOT EXISTS ind_regulatory_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_object_id uuid NOT NULL REFERENCES opportunity_objects(id) ON DELETE CASCADE,
  hypothesis_id uuid NOT NULL REFERENCES hypotheses(id) ON DELETE CASCADE,
  package jsonb NOT NULL DEFAULT '{}',
  risk_of_failure float,
  risk_components jsonb NOT NULL DEFAULT '{}',
  modality_pathway text CHECK (modality_pathway IS NULL OR modality_pathway IN ('NDA', 'BLA')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ind_packages_opportunity ON ind_regulatory_packages(opportunity_object_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ind_packages_hypothesis ON ind_regulatory_packages(hypothesis_id);

-- Undruggable target registry (Spec §6.3)
CREATE TABLE IF NOT EXISTS undruggable_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_object_id uuid REFERENCES opportunity_objects(id) ON DELETE SET NULL,
  hypothesis_id uuid REFERENCES hypotheses(id) ON DELETE SET NULL,
  target_name text NOT NULL,
  intervention_point text,
  reasoning text NOT NULL,
  alternate_intervention text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_undruggable_targets_opportunity ON undruggable_targets(opportunity_object_id);

-- Calibration registry for promoted low-association pairs (SME §4)
CREATE TABLE IF NOT EXISTS calibration_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_opportunity_id uuid REFERENCES opportunity_objects(id) ON DELETE SET NULL,
  source_hypothesis_id uuid REFERENCES hypotheses(id) ON DELETE SET NULL,
  domain_a text NOT NULL,
  domain_b text NOT NULL,
  association_claim text NOT NULL,
  rejection_reason text,
  notes text,
  promoted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calibration_registry_domains ON calibration_registry(domain_a, domain_b);
