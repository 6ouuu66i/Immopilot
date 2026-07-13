create table zimmo_session (
  id int primary key default 1 check (id = 1),
  jwt text not null,
  refresh_token text not null,
  previous_refresh_token text,
  jwt_expires_at timestamptz not null,
  locked_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table zimmo_session enable row level security;
-- Aucune policy créée : accès service-role uniquement (deny-all pour les autres rôles).
