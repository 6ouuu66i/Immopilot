-- F-008 / F-014 pgTAP regression contract.
-- Run only against an isolated local Supabase database:
--   supabase start
--   supabase test db

begin;
select plan(32);

select is(
  (select array_agg(attname || ':' || format_type(atttypid, atttypmod) order by attnum)
   from pg_attribute
   where attrelid = 'public.active_properties_canonical'::regclass
     and attnum > 0 and not attisdropped),
  (select array_agg(attname || ':' || format_type(atttypid, atttypmod) order by attnum)
   from pg_attribute
   where attrelid = 'public.active_properties_canonical_mat'::regclass
     and attnum > 0 and not attisdropped),
  'canonical view and matview expose identical ordered columns'
);

select is(
  (select count(*)::integer
   from public.active_properties_canonical live
   full join public.active_properties_canonical_mat materialized using (listing_id)
   where live.listing_id is null
      or materialized.listing_id is null
      or (to_jsonb(live) - 'days_online') is distinct from (to_jsonb(materialized) - 'days_online')),
  0,
  'canonical business rows match outside expected days_online refresh drift'
);

select is((select count(*) from public.active_properties_canonical),
          (select count(*) from public.active_properties_canonical_mat),
          'active canonical property count matches');
select is((select count(*) from public.active_properties_canonical where is_fsbo),
          (select count(*) from public.active_properties_canonical_mat where is_fsbo),
          'FSBO count matches');
select is((select count(*) from public.active_properties_canonical live join public.listing_scores score using (property_id) where score.band = 'forte'),
          (select count(*) from public.active_properties_canonical_mat materialized join public.listing_scores score using (property_id) where score.band = 'forte'),
          'strong-opportunity count matches');
select is((select round(avg(score.score)::numeric, 1) from public.active_properties_canonical live join public.listing_scores score using (property_id)),
          (select round(avg(score.score)::numeric, 1) from public.active_properties_canonical_mat materialized join public.listing_scores score using (property_id)),
          'score average matches');

select ok((select prosecdef from pg_proc where oid = 'public.get_dashboard_snapshot(integer)'::regprocedure),
          'Dashboard RPC is SECURITY DEFINER');
select ok((select proconfig from pg_proc where oid = 'public.get_dashboard_snapshot(integer)'::regprocedure)
            @> array['search_path=""'],
          'Dashboard RPC has an empty search_path');
select ok((select proconfig from pg_proc where oid = 'public.get_dashboard_snapshot(integer)'::regprocedure)
            @> array['work_mem=16MB'],
          'Dashboard RPC uses a bounded work_mem that avoids temporary-file spill');
select is((select pg_get_userbyid(proowner) from pg_proc where oid = 'public.get_dashboard_snapshot(integer)'::regprocedure),
          'postgres', 'Dashboard RPC has a controlled owner');
select ok((select pg_get_functiondef('public.get_dashboard_snapshot(integer)'::regprocedure) like '%FROM public.active_properties_canonical_mat%'),
          'Dashboard RPC reads the canonical matview');
select ok((select pg_get_functiondef('public.get_dashboard_snapshot(integer)'::regprocedure) like '%profile.is_active = true%'),
          'Dashboard RPC requires an active profile');
select ok((select pg_get_functiondef('public.get_dashboard_snapshot(integer)'::regprocedure) like '%profile.agency_id IS NOT NULL%'),
          'Dashboard RPC requires an agency membership');
select ok((select pg_get_functiondef('public.get_dashboard_snapshot(integer)'::regprocedure) not similar to '%(public.contacts|public.deals|public.tasks)%'),
          'Dashboard RPC exposes no CRM table');
select ok(has_function_privilege('authenticated', 'public.get_dashboard_snapshot(integer)', 'EXECUTE'),
          'authenticated can execute Dashboard RPC');
select ok(not has_function_privilege('anon', 'public.get_dashboard_snapshot(integer)', 'EXECUTE'),
          'anon cannot execute Dashboard RPC');
select ok(not has_function_privilege('service_role', 'public.get_dashboard_snapshot(integer)', 'EXECUTE'),
          'service role is not a client of Dashboard RPC');
select ok(not has_table_privilege('authenticated', 'public.active_properties_canonical_mat', 'SELECT'),
          'authenticated cannot read matview directly');
select ok(not has_table_privilege('anon', 'public.active_properties_canonical_mat', 'SELECT'),
          'anon cannot read matview directly');

select ok((select prosecdef from pg_proc where oid = 'public.search_active_properties(text,integer)'::regprocedure),
          'property search RPC is SECURITY DEFINER');
select ok((select proconfig from pg_proc where oid = 'public.search_active_properties(text,integer)'::regprocedure)
            @> array['search_path=""'],
          'property search RPC has an empty search_path');
select ok(has_function_privilege('authenticated', 'public.search_active_properties(text,integer)', 'EXECUTE'),
          'authenticated can execute property search RPC');
select ok(not has_function_privilege('anon', 'public.search_active_properties(text,integer)', 'EXECUTE'),
          'anon cannot execute property search RPC');
select ok((select pg_get_functiondef('public.search_active_properties(text,integer)'::regprocedure) like '%LEAST(GREATEST(COALESCE(result_limit, 6), 1), 20)%'),
          'property search has a server-side maximum limit');

select ok(
  strpos(pg_get_functiondef('public.sync_daily_pipeline()'::regprocedure), 'compute_listing_scores') <
  strpos(pg_get_functiondef('public.sync_daily_pipeline()'::regprocedure), 'refresh_active_properties_canonical'),
  'daily pipeline computes scores before refreshing the canonical matview'
);

select set_config('request.jwt.claim.sub', 'f0080000-0000-0000-0000-000000000099', true);
set local role authenticated;
select throws_ok(
  'select public.get_dashboard_snapshot(8)',
  '42501',
  'Acces Dashboard refuse: appartenance a une agence active requise.',
  'authenticated user without a profile is refused'
);
select throws_ok(
  $$select * from public.search_active_properties('bruxelles', 6)$$,
  '42501',
  'Recherche refusee: appartenance a une agence active requise.',
  'property search refuses authenticated user without a profile'
);
reset role;

insert into public.agencies (id, name, slug)
values ('f0080000-0000-0000-0000-000000000001', 'F008 Agency', 'f008-agency');

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'f0080000-0000-0000-0000-000000000002',
   'authenticated', 'authenticated', 'f008-active@test.local', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'f0080000-0000-0000-0000-000000000003',
   'authenticated', 'authenticated', 'f008-inactive@test.local', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'f0080000-0000-0000-0000-000000000004',
   'authenticated', 'authenticated', 'f008-no-agency@test.local', now(), now());
update public.profiles
set agency_id = 'f0080000-0000-0000-0000-000000000001', is_active = true
where id = 'f0080000-0000-0000-0000-000000000002';
update public.profiles
set agency_id = 'f0080000-0000-0000-0000-000000000001', is_active = false
where id = 'f0080000-0000-0000-0000-000000000003';

select set_config('request.jwt.claim.sub', 'f0080000-0000-0000-0000-000000000003', true);
set local role authenticated;
select throws_ok(
  'select public.get_dashboard_snapshot(8)',
  '42501',
  'Acces Dashboard refuse: appartenance a une agence active requise.',
  'inactive profile is refused'
);
reset role;

select set_config('request.jwt.claim.sub', 'f0080000-0000-0000-0000-000000000004', true);
set local role authenticated;
select throws_ok(
  'select public.get_dashboard_snapshot(8)',
  '42501',
  'Acces Dashboard refuse: appartenance a une agence active requise.',
  'profile without an agency is refused'
);
reset role;

select set_config('request.jwt.claim.sub', 'f0080000-0000-0000-0000-000000000002', true);
set local role authenticated;
select lives_ok('select public.get_dashboard_snapshot(8)', 'active agency member can use Dashboard RPC');
select ok(
  (select count(*) from public.search_active_properties('bruxelles', 999)) <= 20,
  'active member search is authorized and server-limited'
);
select is(
  (select count(*) from public.search_active_properties('', 999)),
  0::bigint,
  'empty property search returns without scanning results'
);
reset role;

select * from finish();
rollback;
