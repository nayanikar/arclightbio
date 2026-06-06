-- Default-deny direct PostgREST access (anon/authenticated).
-- Server-side service_role bypasses RLS; app behavior unchanged.

ALTER TABLE org_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE regulatory_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE hypotheses ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohort_patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE drug_discovery_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ind_regulatory_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE undruggable_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE calibration_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_trail_entries ENABLE ROW LEVEL SECURITY;
