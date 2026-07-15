-- F-006 pgTAP regression contract.
-- Run only against an isolated local Supabase database:
--   supabase start
--   supabase test db

begin;
select plan(23);

insert into public.agencies (id, name, slug)
values ('f0060000-0000-0000-0000-000000000001', 'F006 Agency', 'f006-agency');

insert into auth.users (
  instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  'f0060000-0000-0000-0000-000000000002',
  'authenticated',
  'authenticated',
  'f006-admin@test.local',
  jsonb_build_object('full_name', 'F006 Admin', 'invitation_token', repeat('f', 64)),
  now(),
  now()
);

update public.profiles
set agency_id = 'f0060000-0000-0000-0000-000000000001', role = 'admin'
where id = 'f0060000-0000-0000-0000-000000000002';

insert into public.agency_invitations (
  id, agency_id, invited_by, email, role, token, status, expires_at
) values
  ('f0060000-0000-0000-0000-000000000010', 'f0060000-0000-0000-0000-000000000001',
   'f0060000-0000-0000-0000-000000000002', 'valid@test.local', 'agent', repeat('1', 64), 'pending', now() + interval '1 day'),
  ('f0060000-0000-0000-0000-000000000011', 'f0060000-0000-0000-0000-000000000001',
   'f0060000-0000-0000-0000-000000000002', 'expired@test.local', 'agent', repeat('2', 64), 'pending', now() - interval '1 minute'),
  ('f0060000-0000-0000-0000-000000000012', 'f0060000-0000-0000-0000-000000000001',
   'f0060000-0000-0000-0000-000000000002', 'cancelled@test.local', 'agent', repeat('3', 64), 'cancelled', now() + interval '1 day'),
  ('f0060000-0000-0000-0000-000000000013', 'f0060000-0000-0000-0000-000000000001',
   'f0060000-0000-0000-0000-000000000002', 'accepted@test.local', 'agent', repeat('4', 64), 'accepted', now() + interval '1 day');

select is(
  public.hook_require_invitation(jsonb_build_object(
    'user', jsonb_build_object(
      'email', 'valid@test.local',
      'app_metadata', jsonb_build_object('provider', 'email'),
      'user_metadata', jsonb_build_object('invitation_token', repeat('1', 64))
    )
  )),
  '{}'::jsonb,
  'valid pending unexpired invitation allows user creation'
);

select ok(
  public.hook_require_invitation(jsonb_build_object(
    'user', jsonb_build_object('email', 'valid@test.local', 'app_metadata', jsonb_build_object('provider', 'email'), 'user_metadata', '{}'::jsonb)
  )) ? 'error',
  'missing token is rejected'
);

select ok(
  public.hook_require_invitation(jsonb_build_object(
    'user', jsonb_build_object('email', 'valid@test.local', 'app_metadata', jsonb_build_object('provider', 'email'), 'user_metadata', jsonb_build_object('invitation_token', 'bad'))
  )) ? 'error',
  'malformed token is rejected'
);

select ok(
  public.hook_require_invitation(jsonb_build_object(
    'user', jsonb_build_object('email', 'other@test.local', 'app_metadata', jsonb_build_object('provider', 'email'), 'user_metadata', jsonb_build_object('invitation_token', repeat('1', 64)))
  )) ? 'error',
  'wrong email is rejected'
);

select ok(
  public.hook_require_invitation(jsonb_build_object(
    'user', jsonb_build_object('email', 'expired@test.local', 'app_metadata', jsonb_build_object('provider', 'email'), 'user_metadata', jsonb_build_object('invitation_token', repeat('2', 64)))
  )) ? 'error',
  'expired invitation is rejected'
);

select ok(
  public.hook_require_invitation(jsonb_build_object(
    'user', jsonb_build_object('email', 'cancelled@test.local', 'app_metadata', jsonb_build_object('provider', 'email'), 'user_metadata', jsonb_build_object('invitation_token', repeat('3', 64)))
  )) ? 'error',
  'revoked invitation is rejected'
);

select ok(
  public.hook_require_invitation(jsonb_build_object(
    'user', jsonb_build_object('email', 'accepted@test.local', 'app_metadata', jsonb_build_object('provider', 'email'), 'user_metadata', jsonb_build_object('invitation_token', repeat('4', 64)))
  )) ? 'error',
  'already-used invitation is rejected'
);

select ok(
  public.hook_require_invitation(jsonb_build_object(
    'user', jsonb_build_object('email', 'valid@test.local', 'app_metadata', jsonb_build_object('provider', 'google'), 'user_metadata', jsonb_build_object('invitation_token', repeat('1', 64)))
  )) ? 'error',
  'non-email provider creation is rejected'
);

select is(
  (select raw_user_meta_data->>'invitation_token' from auth.users where id = 'f0060000-0000-0000-0000-000000000002'),
  null::text,
  'handle_new_user removes invitation token from auth metadata'
);

select is(
  (select role from public.profiles where id = 'f0060000-0000-0000-0000-000000000002'),
  'admin',
  'privileged owner setup remains possible for the test admin'
);

select ok(has_function_privilege('supabase_auth_admin', 'public.hook_require_invitation(jsonb)', 'EXECUTE'), 'auth admin can execute signup hook');
select ok(not has_function_privilege('anon', 'public.hook_require_invitation(jsonb)', 'EXECUTE'), 'anon cannot call signup hook');
select ok(not has_function_privilege('authenticated', 'public.hook_require_invitation(jsonb)', 'EXECUTE'), 'authenticated cannot call signup hook');
select ok(has_function_privilege('authenticated', 'public.accept_invitation(text)', 'EXECUTE'), 'F-002 authenticated accept grant remains');
select ok(not has_function_privilege('anon', 'public.accept_invitation(text)', 'EXECUTE'), 'F-002 anon accept remains denied');

select ok(
  (select prosecdef from pg_proc where oid = 'public.get_dashboard_snapshot(integer)'::regprocedure),
  'dashboard snapshot uses the reviewed guarded definer model'
);
select ok(
  (select proconfig from pg_proc where oid = 'public.get_dashboard_snapshot(integer)'::regprocedure)
    @> array['search_path=""'],
  'dashboard snapshot uses an empty search_path'
);
select ok(not has_table_privilege('authenticated', 'public.active_properties_canonical_mat', 'SELECT'), 'authenticated cannot read canonical matview directly');
select ok(not has_table_privilege('anon', 'public.active_properties_canonical_mat', 'SELECT'), 'anon cannot read canonical matview directly');
select ok(not has_table_privilege('authenticated', 'public.market_reference', 'SELECT'), 'authenticated cannot read market reference directly');

select is(
  (select count(*)::integer from pg_policies
   where schemaname = 'public'
     and tablename in ('properties', 'listings', 'price_history', 'listing_signals', 'listing_scores', 'listing_score_history', 'listing_outcomes')
     and qual = '(current_agency_id() IS NOT NULL)'),
  7,
  'all shared market tables require an active agency membership'
);

select ok(
  (select pg_get_functiondef('public.current_agency_id()'::regprocedure) ilike '%is_active = true%'),
  'current_agency_id requires an active profile'
);
select ok(
  (select pg_get_functiondef('public.current_agency_id()'::regprocedure) ilike '%agency_id IS NOT NULL%'),
  'current_agency_id requires an agency membership'
);

select * from finish();
rollback;
