-- Internal SECURITY DEFINER and reference-counter regression suite.
-- Every fixture and counter increment is rolled back.

begin;

create temporary table security_definer_tap_results (
  sequence bigint generated always as identity,
  result text not null
) on commit drop;
grant select, insert on pg_temp.security_definer_tap_results to anon, authenticated, service_role;
grant usage, select on sequence pg_temp.security_definer_tap_results_sequence_seq to anon, authenticated, service_role;

insert into pg_temp.security_definer_tap_results (result) select plan(24);

insert into public.agencies (id, name, slug)
values ('f0240000-0000-0000-0000-000000000001', 'F024 Agency', 'f024-agency');

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000000',
  'f0240001-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'f024-agent@test.local',
  now(),
  now()
);

update public.profiles
set role = 'agent',
    agency_id = 'f0240000-0000-0000-0000-000000000001',
    is_active = true
where id = 'f0240001-0000-0000-0000-000000000001';

insert into pg_temp.security_definer_tap_results (result)
select ok((select prosecdef from pg_proc where oid = 'public.generate_reference(uuid,text)'::regprocedure), '1. generate_reference is SECURITY DEFINER');
insert into pg_temp.security_definer_tap_results (result)
select ok((select prosecdef from pg_proc where oid = 'public.set_contact_reference()'::regprocedure), '2. contact reference trigger wrapper is SECURITY DEFINER');
insert into pg_temp.security_definer_tap_results (result)
select ok((select prosecdef from pg_proc where oid = 'public.set_deal_reference()'::regprocedure), '3. deal reference trigger wrapper is SECURITY DEFINER');

insert into pg_temp.security_definer_tap_results (result)
select ok(not exists (
  select 1
  from pg_proc p,
       lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
  where p.oid = 'public.generate_reference(uuid,text)'::regprocedure
    and acl.grantee = 0
    and acl.privilege_type = 'EXECUTE'
), '4. PUBLIC cannot execute generate_reference');
insert into pg_temp.security_definer_tap_results (result)
select ok(not has_function_privilege('anon', 'public.generate_reference(uuid,text)', 'EXECUTE'), '5. anon cannot execute generate_reference');
insert into pg_temp.security_definer_tap_results (result)
select ok(not has_function_privilege('authenticated', 'public.generate_reference(uuid,text)', 'EXECUTE'), '6. authenticated cannot execute generate_reference');
insert into pg_temp.security_definer_tap_results (result)
select ok(not has_function_privilege('service_role', 'public.generate_reference(uuid,text)', 'EXECUTE'), '7. service_role cannot execute generate_reference');

insert into pg_temp.security_definer_tap_results (result)
select ok(not has_function_privilege('anon', 'public.rls_auto_enable()', 'EXECUTE'), '8. anon cannot execute rls_auto_enable');
insert into pg_temp.security_definer_tap_results (result)
select ok(not has_function_privilege('authenticated', 'public.rls_auto_enable()', 'EXECUTE'), '9. authenticated cannot execute rls_auto_enable');
insert into pg_temp.security_definer_tap_results (result)
select ok(not has_function_privilege('service_role', 'public.rls_auto_enable()', 'EXECUTE'), '10. service_role cannot execute rls_auto_enable');
insert into pg_temp.security_definer_tap_results (result)
select ok(exists (
  select 1
  from pg_event_trigger e
  where e.evtname = 'ensure_rls'
    and e.evtfoid = 'public.rls_auto_enable()'::regprocedure
    and e.evtenabled = 'O'
), '11. ensure_rls event trigger remains enabled');

insert into pg_temp.security_definer_tap_results (result)
select ok(not (
  has_table_privilege('anon', 'public.reference_counters', 'INSERT')
  or has_table_privilege('anon', 'public.reference_counters', 'UPDATE')
  or has_table_privilege('anon', 'public.reference_counters', 'DELETE')
  or has_table_privilege('anon', 'public.reference_counters', 'TRUNCATE')
), '12. anon has no counter mutation grants');
insert into pg_temp.security_definer_tap_results (result)
select ok(not (
  has_table_privilege('authenticated', 'public.reference_counters', 'INSERT')
  or has_table_privilege('authenticated', 'public.reference_counters', 'UPDATE')
  or has_table_privilege('authenticated', 'public.reference_counters', 'DELETE')
  or has_table_privilege('authenticated', 'public.reference_counters', 'TRUNCATE')
), '13. authenticated has no counter mutation grants');
insert into pg_temp.security_definer_tap_results (result)
select ok(not (
  has_table_privilege('service_role', 'public.reference_counters', 'INSERT')
  or has_table_privilege('service_role', 'public.reference_counters', 'UPDATE')
  or has_table_privilege('service_role', 'public.reference_counters', 'DELETE')
  or has_table_privilege('service_role', 'public.reference_counters', 'TRUNCATE')
), '14. service_role has no counter mutation grants');

insert into pg_temp.security_definer_tap_results (result)
select is((
  select count(*)::integer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and (
      p.proconfig is null
      or not exists (
        select 1
        from unnest(p.proconfig) config
        where config like 'search_path=%'
          and config not like '%$user%'
          and config not like '%pg_temp%'
      )
    )
), 0, '15. every public SECURITY DEFINER function has a fixed safe search_path');

insert into pg_temp.security_definer_tap_results (result)
select is((
  select count(*)::integer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and lower(p.prosrc) ~ '\\m(insert|update|delete|truncate|merge|alter|create|drop|grant|revoke)\\M'
    and exists (
      select 1
      from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
      where acl.grantee = 0
        and acl.privilege_type = 'EXECUTE'
    )
), 0, '16. no write-capable SECURITY DEFINER function is executable by PUBLIC');

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'f0240001-0000-0000-0000-000000000001',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

insert into public.contacts (agency_id, created_by, owner_id, full_name)
values
  ('f0240000-0000-0000-0000-000000000001', 'f0240001-0000-0000-0000-000000000001', 'f0240001-0000-0000-0000-000000000001', 'F024 Contact One'),
  ('f0240000-0000-0000-0000-000000000001', 'f0240001-0000-0000-0000-000000000001', 'f0240001-0000-0000-0000-000000000001', 'F024 Contact Two');

insert into pg_temp.security_definer_tap_results (result)
select ok(bool_and(reference ~ '^CTC-[0-9]{4,}$'), '17. authenticated contact inserts still generate references')
from public.contacts
where agency_id = 'f0240000-0000-0000-0000-000000000001';
insert into pg_temp.security_definer_tap_results (result)
select is(count(distinct reference)::integer, 2, '18. generated contact references are unique')
from public.contacts
where agency_id = 'f0240000-0000-0000-0000-000000000001';
insert into pg_temp.security_definer_tap_results (result)
select throws_ok(
  $$ select public.generate_reference('f0240000-0000-0000-0000-000000000001', 'contact') $$,
  '42501',
  null,
  '19. authenticated direct helper execution is denied'
);
insert into pg_temp.security_definer_tap_results (result)
select throws_ok(
  $$ truncate table public.reference_counters $$,
  '42501',
  null,
  '20. authenticated cannot truncate reference counters'
);

reset role;
set local role service_role;
insert into pg_temp.security_definer_tap_results (result)
select throws_ok(
  $$ select public.generate_reference('f0240000-0000-0000-0000-000000000001', 'contact') $$,
  '42501',
  null,
  '21. service_role direct helper execution is denied'
);
insert into pg_temp.security_definer_tap_results (result)
select throws_ok(
  $$ update public.reference_counters set current_value = current_value $$,
  '42501',
  null,
  '22. service_role cannot update reference counters'
);

reset role;
set local role anon;
insert into pg_temp.security_definer_tap_results (result)
select throws_ok(
  $$ select public.generate_reference('f0240000-0000-0000-0000-000000000001', 'contact') $$,
  '42501',
  null,
  '23. anon direct helper execution is denied'
);
insert into pg_temp.security_definer_tap_results (result)
select throws_ok(
  $$ select public.rls_auto_enable() $$,
  '42501',
  null,
  '24. anon direct event-trigger function execution is denied'
);

reset role;
insert into pg_temp.security_definer_tap_results (result) select * from finish();
select result from pg_temp.security_definer_tap_results order by sequence;
rollback;
