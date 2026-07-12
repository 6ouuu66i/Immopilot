-- F-001 RLS regression test — profiles privileged-column immutability.
--
-- Run with the Supabase local stack:
--   supabase start
--   supabase test db
-- (pgTAP is provided by `supabase test db`; each test file runs in a rolled-back transaction.)
--
-- Proves:
--   1. a normal agent cannot change their own role
--   2. a normal agent cannot change their own agency_id (tenant move)
--   3. a normal agent cannot change their own is_active
--   4. a normal agent CAN still update allowed personal fields (full_name/avatar_url)
--   5. an agency admin CAN change a member's role (legitimate privileged path preserved)
--   6. an agency admin CAN deactivate a member (legitimate privileged path preserved)

begin;
select plan(6);

-- ---------------------------------------------------------------------------
-- Seed. Runs as the migration/owner role (current_user is not authenticated/anon),
-- so the guard is bypassed here — which also demonstrates that privileged contexts
-- retain full control over role/agency_id (needed for accept_invitation, F-002).
-- ---------------------------------------------------------------------------
insert into public.agencies (id, name, slug) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'F001 Agency A', 'f001-agency-a'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'F001 Agency B', 'f001-agency-b');

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated', 'f001-agent-a@test.local', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222',
   'authenticated', 'authenticated', 'f001-admin-a@test.local', now(), now());

-- handle_new_user() created both profiles (agency_id NULL, role 'agent').
-- Assign agency + roles through the privileged owner context.
update public.profiles
  set agency_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', role = 'agent'
  where id = '11111111-1111-1111-1111-111111111111';
update public.profiles
  set agency_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', role = 'admin'
  where id = '22222222-2222-2222-2222-222222222222';

-- ---------------------------------------------------------------------------
-- Act as the normal agent (user1, Agency A).
-- ---------------------------------------------------------------------------
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

select throws_ok(
  $$ update public.profiles set role = 'admin'
     where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501',
  'profiles.role can only be changed by an agency admin',
  'agent cannot self-promote to admin'
);

select throws_ok(
  $$ update public.profiles set agency_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
     where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501',
  'profiles.agency_id cannot be changed through the API',
  'agent cannot move themselves into another tenant'
);

select throws_ok(
  $$ update public.profiles set is_active = false
     where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501',
  'profiles.is_active can only be changed by an agency admin',
  'agent cannot change their own is_active'
);

select lives_ok(
  $$ update public.profiles
       set full_name = 'Agent A', avatar_url = 'https://example.test/a.png'
     where id = '11111111-1111-1111-1111-111111111111' $$,
  'agent can still update allowed personal fields'
);

-- ---------------------------------------------------------------------------
-- Act as an agency admin (user2, Agency A) managing a member (user1).
-- ---------------------------------------------------------------------------
reset role;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '22222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

select lives_ok(
  $$ update public.profiles set role = 'admin'
     where id = '11111111-1111-1111-1111-111111111111' $$,
  'agency admin can change a member role'
);

select lives_ok(
  $$ update public.profiles set is_active = false
     where id = '11111111-1111-1111-1111-111111111111' $$,
  'agency admin can deactivate a member'
);

reset role;
select * from finish();
rollback;
