create table if not exists public.agencies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  ipi_number text,
  address text,
  city text,
  postal_code text,
  phone text,
  email text,
  website text,
  logo_url text,
  subscription_plan text not null default 'trial'
    check (subscription_plan in ('trial', 'starter', 'pro', 'agency')),
  subscription_status text not null default 'active'
    check (subscription_status in ('active', 'paused', 'cancelled')),
  trial_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  agency_id uuid references public.agencies(id) on delete set null,
  email text not null,
  full_name text,
  avatar_url text,
  phone text,
  role text not null default 'agent'
    check (role in ('admin', 'agent')),
  is_active boolean not null default true,
  ipi_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_agency on public.profiles(agency_id);

create table if not exists public.agency_invitations (
  id uuid primary key default uuid_generate_v4(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  invited_by uuid not null references public.profiles(id),
  email text not null,
  role text not null default 'agent' check (role in ('admin', 'agent')),
  token text unique not null default encode(gen_random_bytes(32), 'hex'),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'expired', 'cancelled')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_invitations_token on public.agency_invitations(token);
create index if not exists idx_invitations_agency on public.agency_invitations(agency_id);

alter table public.agencies enable row level security;
alter table public.profiles enable row level security;
alter table public.agency_invitations enable row level security;;
