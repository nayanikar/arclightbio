create table if not exists opportunity_objects (
  id uuid primary key default gen_random_uuid(),
  version integer not null default 1,
  created_at timestamptz default now(),
  last_updated timestamptz default now(),
  anchor_type text not null check (anchor_type in ('auto_generated', 'human_prompted')),
  status text not null default 'initialising',
  hypothesis jsonb not null,
  confidence_score float not null default 0,
  actionability_score float not null default 0,
  actionability_zone text not null default 'too_early',
  surveillance_tags jsonb not null default '{"concept_tags":[],"entity_tags":[],"signal_tags":[]}',
  change_log jsonb not null default '[]',
  context_update_proposals jsonb not null default '[]',
  org_context_id uuid references org_contexts(id),
  search_query text,
  mode text default 'speed'
);

create index if not exists idx_opportunity_objects_status on opportunity_objects(status);
create index if not exists idx_opportunity_objects_created on opportunity_objects(created_at desc);
