create table property_links (
  id uuid primary key default gen_random_uuid(),
  property_a uuid not null references properties(id),
  property_b uuid not null references properties(id),
  method text not null check (method in ('epc_number', 'address_house', 'human')),
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  evidence jsonb not null,
  status text not null default 'suggested' check (status in ('active', 'rejected', 'suggested')),
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  check (property_a <> property_b)
);
create unique index property_links_pair_unique on property_links (least(property_a, property_b), greatest(property_a, property_b));
create index property_links_property_a_idx on property_links (property_a);
create index property_links_property_b_idx on property_links (property_b);
alter table property_links enable row level security;
