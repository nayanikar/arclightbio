-- Align Pfizer demo org with ATTR/cardiology portfolio and act-now thresholds
update org_contexts
set
  portfolio = '{"approved_assets":["Vyndaqel","tafamidis","Eliquis","Comirnaty"],"pipeline_assets":["gene therapy platform"],"platforms":["small molecule","ADC","mRNA"],"therapeutic_areas":["cardiology","oncology","rare disease","immunology"]}'::jsonb,
  commercial_weights = '{"market_size_importance":0.8,"first_mover_importance":0.6,"competitive_moat_importance":0.7,"reimbursement_pathway_importance":0.8}'::jsonb,
  risk_tolerance = '{"actionability_lower_threshold":0.30,"actionability_upper_threshold":0.75}'::jsonb
where org_name ilike '%pfizer%';
