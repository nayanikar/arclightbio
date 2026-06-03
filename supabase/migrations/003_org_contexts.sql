-- org contexts must exist before opportunity_objects FK
create table if not exists org_contexts (
  id uuid primary key default gen_random_uuid(),
  org_name text not null,
  org_type text not null,
  portfolio jsonb not null default '{}',
  commercial_weights jsonb not null,
  risk_tolerance jsonb not null,
  discovery_horizons text[] not null,
  surveillance_defaults jsonb not null
);

-- Seed demo org contexts
insert into org_contexts (org_name, org_type, portfolio, commercial_weights, risk_tolerance, discovery_horizons, surveillance_defaults)
values
  (
    'Pfizer (Demo)',
    'large_pharma',
    '{"approved_assets":["Vyndaqel","tafamidis","Eliquis","Comirnaty"],"pipeline_assets":["gene therapy platform"],"platforms":["small molecule","ADC","mRNA"],"therapeutic_areas":["cardiology","oncology","rare disease","immunology"]}',
    '{"market_size_importance":0.8,"first_mover_importance":0.6,"competitive_moat_importance":0.7,"reimbursement_pathway_importance":0.8}',
    '{"actionability_lower_threshold":0.30,"actionability_upper_threshold":0.75}',
    ARRAY['asset_extension','portfolio_combination'],
    '{"scan_frequency_act_now":"daily","scan_frequency_too_early":"weekly"}'
  ),
  (
    'Helix Therapeutics (Demo)',
    'biotech_startup',
    '{"approved_assets":[],"pipeline_assets":["HLX-101"],"platforms":["ADC platform"],"therapeutic_areas":["rare disease","cardiology"]}',
    '{"market_size_importance":0.6,"first_mover_importance":0.9,"competitive_moat_importance":0.8,"reimbursement_pathway_importance":0.5}',
    '{"actionability_lower_threshold":0.25,"actionability_upper_threshold":0.70}',
    ARRAY['capability_driven_new_product','asset_extension'],
    '{"scan_frequency_act_now":"daily","scan_frequency_too_early":"weekly"}'
  ),
  (
    'Horizon Ventures (Demo)',
    'vc_fund',
    '{"approved_assets":[],"pipeline_assets":[],"platforms":[],"therapeutic_areas":["oncology","neurology","rare disease"]}',
    '{"market_size_importance":0.85,"first_mover_importance":0.95,"competitive_moat_importance":0.6,"reimbursement_pathway_importance":0.4}',
    '{"actionability_lower_threshold":0.30,"actionability_upper_threshold":0.65}',
    ARRAY['capability_driven_new_product'],
    '{"scan_frequency_act_now":"weekly","scan_frequency_too_early":"monthly"}'
  )
on conflict do nothing;
