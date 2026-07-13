create table if not exists scraper_config (
  id boolean primary key default true check (id),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table scraper_config enable row level security;

insert into scraper_config (id, enabled) values (true, true) on conflict do nothing;