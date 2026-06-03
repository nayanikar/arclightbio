create table if not exists evidence_cards (
  id uuid primary key default gen_random_uuid(),
  opportunity_object_id uuid references opportunity_objects(id) on delete cascade,
  content text not null,
  source_url text,
  source_type text not null,
  contributing_agent text not null,
  timestamp timestamptz default now(),
  quality_scores jsonb not null,
  regulatory_weight float,
  raw_source_metadata jsonb,
  is_challenge boolean not null default false,
  challenge_metadata jsonb
);

create index if not exists idx_evidence_cards_opportunity on evidence_cards(opportunity_object_id);
create index if not exists idx_evidence_cards_timestamp on evidence_cards(timestamp);
