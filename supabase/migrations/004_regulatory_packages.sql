create table if not exists regulatory_packages (
  id uuid primary key default gen_random_uuid(),
  opportunity_object_id uuid references opportunity_objects(id),
  opportunity_object_version integer not null,
  assembly_timestamp timestamptz default now(),
  target_agency text not null,
  credibility_report jsonb not null,
  gap_report jsonb not null,
  provenance_trail jsonb not null,
  version_lock_hash text not null
);

create index if not exists idx_regulatory_packages_opportunity on regulatory_packages(opportunity_object_id);
