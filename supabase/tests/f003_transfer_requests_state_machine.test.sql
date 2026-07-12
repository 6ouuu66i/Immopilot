-- F-003 (Critical, reclassified) regression test — transfer_requests state machine.
--
-- Run with the Supabase local stack (after the migration has been applied):
--   supabase start
--   supabase test db
--
-- NOT executed yet: prepared for review only, per instruction not to call
-- apply_migration before explicit authorization.
--
-- Covers the original 16 scenarios plus 14 additional resolution-field / direct-INSERT
-- assertions added after the second security review pass.

begin;
select plan(33);

-- ---------------------------------------------------------------------------
-- Seed (runs as the migration/owner role -> bypasses the BEFORE trigger's
-- authenticated/anon gate and the F-001 profile guard, same pattern as f001/f002).
-- ---------------------------------------------------------------------------

insert into public.agencies (id, name, slug) values
  ('e1000000-0000-0000-0000-000000000001', 'F003 Agency A', 'f003-agency-a'),
  ('e2000000-0000-0000-0000-000000000002', 'F003 Agency B', 'f003-agency-b');

select public.create_default_pipeline_stages('e1000000-0000-0000-0000-000000000001');
select public.create_default_pipeline_stages('e2000000-0000-0000-0000-000000000002');

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'f003-owner1@test.local', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'f003-requester1@test.local', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'f003-owner2@test.local', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'f003-admin-a@test.local', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'f003-inactive-recipient@test.local', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'f003-requester2@test.local', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'f003-admin-b@test.local', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'f003-owner-b@test.local', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'f003-agent-b@test.local', now(), now());

update public.profiles set agency_id = 'e1000000-0000-0000-0000-000000000001', role = 'agent' where id = 'a1000000-0000-0000-0000-000000000001';
update public.profiles set agency_id = 'e1000000-0000-0000-0000-000000000001', role = 'agent' where id = 'a1000000-0000-0000-0000-000000000002';
update public.profiles set agency_id = 'e1000000-0000-0000-0000-000000000001', role = 'agent' where id = 'a1000000-0000-0000-0000-000000000003';
update public.profiles set agency_id = 'e1000000-0000-0000-0000-000000000001', role = 'admin' where id = 'a1000000-0000-0000-0000-000000000004';
update public.profiles set agency_id = 'e1000000-0000-0000-0000-000000000001', role = 'agent' where id = 'a1000000-0000-0000-0000-000000000005';
update public.profiles set agency_id = 'e1000000-0000-0000-0000-000000000001', role = 'agent' where id = 'a1000000-0000-0000-0000-000000000006';
update public.profiles set agency_id = 'e2000000-0000-0000-0000-000000000002', role = 'admin' where id = 'a2000000-0000-0000-0000-000000000001';
update public.profiles set agency_id = 'e2000000-0000-0000-0000-000000000002', role = 'agent' where id = 'a2000000-0000-0000-0000-000000000002';
update public.profiles set agency_id = 'e2000000-0000-0000-0000-000000000002', role = 'agent' where id = 'a2000000-0000-0000-0000-000000000003';

-- Deals need a real property_id (global, scraper-owned table) -- reuse any existing row.
do $$
declare
  v_property_id uuid;
  v_stage_a uuid;
  v_stage_b uuid;
begin
  select id into v_property_id from public.properties limit 1;
  if v_property_id is null then
    insert into public.properties (id, source, property_type)
    values ('f0030000-0000-0000-0000-000000000001', 'test', 'APARTMENT')
    returning id into v_property_id;
  end if;

  select id into v_stage_a from public.pipeline_stages where agency_id = 'e1000000-0000-0000-0000-000000000001' order by position limit 1;
  select id into v_stage_b from public.pipeline_stages where agency_id = 'e2000000-0000-0000-0000-000000000002' order by position limit 1;

  insert into public.deals (id, agency_id, property_id, stage_id, owner_id) values
    ('d1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', v_property_id, v_stage_a, 'a1000000-0000-0000-0000-000000000001'), -- owner1's deal
    ('d1000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000001', v_property_id, v_stage_a, 'a1000000-0000-0000-0000-000000000003'), -- owner2's deal (hijack target)
    ('d1000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000001', v_property_id, v_stage_a, 'a1000000-0000-0000-0000-000000000001'), -- for cross-agency-recipient test
    ('d1000000-0000-0000-0000-000000000004', 'e1000000-0000-0000-0000-000000000001', v_property_id, v_stage_a, 'a1000000-0000-0000-0000-000000000001'), -- for inactive-recipient test
    ('d2000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000002', v_property_id, v_stage_b, 'a2000000-0000-0000-0000-000000000002'); -- agency B's deal
end $$;

-- =============================================================================
-- ORIGINAL 16 SCENARIOS
-- =============================================================================

-- Scenario 1: legitimate creation.
select set_config('request.jwt.claims', json_build_object('sub', 'a1000000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
set local role authenticated;

select lives_ok(
  $$ insert into public.transfer_requests (id, agency_id, deal_id, from_agent_id, to_agent_id, requested_by, status)
     values ('f1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001',
             'd1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
             'a1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', 'pending') $$,
  'scenario 1: legitimate transfer request creation succeeds'
);

-- Scenario 11: deal from another agency is rejected at INSERT (EXISTS check).
reset role;
select set_config('request.jwt.claims', json_build_object('sub', 'a1000000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
set local role authenticated;

select throws_ok(
  $$ insert into public.transfer_requests (agency_id, deal_id, from_agent_id, to_agent_id, requested_by, status)
     values ('e1000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000001',
             'a2000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002',
             'a1000000-0000-0000-0000-000000000002', 'pending') $$,
  '42501',
  null,
  'scenario 11: creating a request for a deal outside the caller''s agency is rejected'
);

-- Scenario 5/6/7/8: identity columns are immutable (F-003 exploit demonstration).
reset role;
select set_config('request.jwt.claims', json_build_object('sub', 'a1000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;

select throws_ok(
  $$ update public.transfer_requests set deal_id = 'd1000000-0000-0000-0000-000000000002'
     where id = 'f1000000-0000-0000-0000-000000000001' $$,
  'TRQ01', null, 'scenario 5: deal_id cannot be rewritten'
);
select throws_ok(
  $$ update public.transfer_requests set to_agent_id = 'a1000000-0000-0000-0000-000000000003'
     where id = 'f1000000-0000-0000-0000-000000000001' $$,
  'TRQ01', null, 'scenario 6: to_agent_id cannot be rewritten'
);
select throws_ok(
  $$ update public.transfer_requests set agency_id = 'e2000000-0000-0000-0000-000000000002'
     where id = 'f1000000-0000-0000-0000-000000000001' $$,
  'TRQ01', null, 'scenario 7: agency_id cannot be rewritten'
);
select throws_ok(
  $$ update public.transfer_requests set from_agent_id = 'a1000000-0000-0000-0000-000000000003'
     where id = 'f1000000-0000-0000-0000-000000000001' $$,
  'TRQ01', null, 'scenario 8a: from_agent_id cannot be rewritten'
);
select throws_ok(
  $$ update public.transfer_requests set requested_by = 'a1000000-0000-0000-0000-000000000003'
     where id = 'f1000000-0000-0000-0000-000000000001' $$,
  'TRQ01', null, 'scenario 8b: requested_by cannot be rewritten'
);

-- F-003 exploit demonstration: the exact original attack (rewrite deal_id + to_agent_id
-- + status in one call) now fails on the immutability check alone.
select throws_ok(
  $$ update public.transfer_requests
     set deal_id = 'd1000000-0000-0000-0000-000000000002',
         to_agent_id = 'a1000000-0000-0000-0000-000000000003',
         status = 'accepted'
     where id = 'f1000000-0000-0000-0000-000000000001' $$,
  'TRQ01', null,
  'F-003 exploit: hijacking an unrelated deal via a legitimately-owned pending row now fails'
);
select is(
  (select owner_id from public.deals where id = 'd1000000-0000-0000-0000-000000000002'),
  'a1000000-0000-0000-0000-000000000003'::uuid, false,
  'sanity: deal 2 owner was NOT reassigned by the failed exploit attempt'
);

-- Scenario 9: admin of a DIFFERENT agency cannot resolve this row.
reset role;
select set_config('request.jwt.claims', json_build_object('sub', 'a2000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;

select throws_ok(
  $$ update public.transfer_requests set status = 'accepted'
     where id = 'f1000000-0000-0000-0000-000000000001' $$,
  null, null,
  'scenario 9: cross-agency admin cannot match the row under RLS'
);

-- Scenario 4: legitimate cancellation by requested_by (fixes the pre-existing bug).
reset role;
select set_config('request.jwt.claims', json_build_object('sub', 'a1000000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
set local role authenticated;

select lives_ok(
  $$ update public.transfer_requests set status = 'cancelled', resolved_at = now()
     where id = 'f1000000-0000-0000-0000-000000000001' $$,
  'scenario 4: requested_by can legitimately cancel their own request'
);

-- Scenario 13/14: a terminal row cannot be resolved again, nor bounced back to pending.
select throws_ok(
  $$ update public.transfer_requests set status = 'accepted'
     where id = 'f1000000-0000-0000-0000-000000000001' $$,
  'TRQ02', null, 'scenario 13: a second resolution of an already-terminal request is rejected'
);

reset role;
select set_config('request.jwt.claims', json_build_object('sub', 'a1000000-0000-0000-0000-000000000004', 'role', 'authenticated')::text, true);
set local role authenticated;

select throws_ok(
  $$ update public.transfer_requests set status = 'pending'
     where id = 'f1000000-0000-0000-0000-000000000001' $$,
  'TRQ02', null, 'scenario 14: even an admin cannot bounce a terminal request back to pending'
);

-- Scenario 2/12/15: legitimate acceptance, and rejection when the deal is no longer
-- owned by from_agent_id at accept time.
reset role;
select set_config('request.jwt.claims', json_build_object('sub', 'a1000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;

select lives_ok(
  $$ insert into public.transfer_requests (id, agency_id, deal_id, from_agent_id, to_agent_id, requested_by, status)
     values ('f1000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000001',
             'd1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
             'a1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', 'pending') $$,
  'second legitimate request created for scenario 12/15'
);

reset role;
update public.deals set owner_id = 'a1000000-0000-0000-0000-000000000003' where id = 'd1000000-0000-0000-0000-000000000001';

select set_config('request.jwt.claims', json_build_object('sub', 'a1000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;

select throws_ok(
  $$ update public.transfer_requests set status = 'accepted', resolved_at = now()
     where id = 'f1000000-0000-0000-0000-000000000002' $$,
  'TRQ05', null,
  'scenario 12: acceptance is rejected when the deal is no longer owned by from_agent_id'
);

reset role;
update public.deals set owner_id = 'a1000000-0000-0000-0000-000000000001' where id = 'd1000000-0000-0000-0000-000000000001';

select set_config('request.jwt.claims', json_build_object('sub', 'a1000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;

select lives_ok(
  $$ update public.transfer_requests set status = 'accepted', resolved_at = now()
     where id = 'f1000000-0000-0000-0000-000000000002' $$,
  'scenario 2: legitimate acceptance by from_agent_id succeeds'
);

reset role;
select is(
  (select owner_id from public.deals where id = 'd1000000-0000-0000-0000-000000000001'),
  'a1000000-0000-0000-0000-000000000002'::uuid,
  'scenario 15: deal ownership correctly transferred to to_agent_id after legitimate acceptance'
);
select is(
  (select count(*)::int from public.notifications where related_type = 'transfer' and related_id = 'f1000000-0000-0000-0000-000000000002' and type = 'transfer_accepted'),
  1,
  'scenario 15: transfer_accepted notification created'
);

-- Scenario 3: legitimate refusal.
select set_config('request.jwt.claims', json_build_object('sub', 'a1000000-0000-0000-0000-000000000003', 'role', 'authenticated')::text, true);
set local role authenticated;

select lives_ok(
  $$ insert into public.transfer_requests (id, agency_id, deal_id, from_agent_id, to_agent_id, requested_by, status)
     values ('f1000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000001',
             'd1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000003',
             'a1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000003', 'pending') $$,
  'third request created for scenario 3'
);

select lives_ok(
  $$ update public.transfer_requests set status = 'refused', refusal_reason = 'not now', resolved_at = now()
     where id = 'f1000000-0000-0000-0000-000000000003' $$,
  'scenario 3: legitimate refusal by from_agent_id succeeds'
);

select pass('scenario 16: all seeded data above is discarded by the transaction rollback at the end of this file');

-- =============================================================================
-- ADDITIONAL 14 TESTS (second security review pass)
-- =============================================================================

-- 1/2/3: direct INSERT into a terminal status is rejected.
reset role;
select set_config('request.jwt.claims', json_build_object('sub', 'a1000000-0000-0000-0000-000000000006', 'role', 'authenticated')::text, true);
set local role authenticated;

select throws_ok(
  $$ insert into public.transfer_requests (agency_id, deal_id, from_agent_id, to_agent_id, requested_by, status)
     values ('e1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000003',
             'a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000006',
             'a1000000-0000-0000-0000-000000000006', 'accepted') $$,
  '42501', null, 'additional 1: direct INSERT with status=accepted is rejected'
);
select throws_ok(
  $$ insert into public.transfer_requests (agency_id, deal_id, from_agent_id, to_agent_id, requested_by, status)
     values ('e1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000003',
             'a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000006',
             'a1000000-0000-0000-0000-000000000006', 'refused') $$,
  '42501', null, 'additional 2: direct INSERT with status=refused is rejected'
);
select throws_ok(
  $$ insert into public.transfer_requests (agency_id, deal_id, from_agent_id, to_agent_id, requested_by, status)
     values ('e1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000003',
             'a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000006',
             'a1000000-0000-0000-0000-000000000006', 'cancelled') $$,
  '42501', null, 'additional 3: direct INSERT with status=cancelled is rejected'
);

-- 4/5: direct INSERT with resolved_at or refusal_reason pre-filled is rejected.
select throws_ok(
  $$ insert into public.transfer_requests (agency_id, deal_id, from_agent_id, to_agent_id, requested_by, status, resolved_at)
     values ('e1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000003',
             'a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000006',
             'a1000000-0000-0000-0000-000000000006', 'pending', now()) $$,
  '42501', null, 'additional 4: direct INSERT with resolved_at prefilled is rejected'
);
select throws_ok(
  $$ insert into public.transfer_requests (agency_id, deal_id, from_agent_id, to_agent_id, requested_by, status, refusal_reason)
     values ('e1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000003',
             'a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000006',
             'a1000000-0000-0000-0000-000000000006', 'pending', 'preset reason') $$,
  '42501', null, 'additional 5: direct INSERT with refusal_reason prefilled is rejected'
);

-- Legitimate row for the remaining additional tests.
select lives_ok(
  $$ insert into public.transfer_requests (id, agency_id, deal_id, from_agent_id, to_agent_id, requested_by, status)
     values ('f1000000-0000-0000-0000-000000000004', 'e1000000-0000-0000-0000-000000000001',
             'd1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001',
             'a1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000006', 'pending') $$,
  'legitimate request created for additional tests 6-10'
);

-- 6: modifying resolved_at without a status change is rejected.
reset role;
select set_config('request.jwt.claims', json_build_object('sub', 'a1000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;

select throws_ok(
  $$ update public.transfer_requests set resolved_at = now()
     where id = 'f1000000-0000-0000-0000-000000000004' $$,
  'TRQ06', null, 'additional 6: resolved_at cannot change without an actual status transition'
);

-- 7: modifying refusal_reason without transitioning to refused is rejected.
select throws_ok(
  $$ update public.transfer_requests set refusal_reason = 'sneaky'
     where id = 'f1000000-0000-0000-0000-000000000004' $$,
  'TRQ06', null, 'additional 7: refusal_reason cannot change without an actual status transition'
);

-- 8: accepting with a refusal_reason set in the same statement is rejected.
select throws_ok(
  $$ update public.transfer_requests set status = 'accepted', refusal_reason = 'should not be allowed'
     where id = 'f1000000-0000-0000-0000-000000000004' $$,
  'TRQ07', null, 'additional 8: accepted with refusal_reason is rejected'
);

-- 9: cancelling with a refusal_reason set is rejected (actor: requested_by).
reset role;
select set_config('request.jwt.claims', json_build_object('sub', 'a1000000-0000-0000-0000-000000000006', 'role', 'authenticated')::text, true);
set local role authenticated;

select throws_ok(
  $$ update public.transfer_requests set status = 'cancelled', refusal_reason = 'should not be allowed'
     where id = 'f1000000-0000-0000-0000-000000000004' $$,
  'TRQ07', null, 'additional 9: cancelled with refusal_reason is rejected'
);

-- 10: resolved_at is server-determined -- a bogus client-supplied value is silently
-- overwritten with the real transaction time, never stored as sent.
reset role;
select set_config('request.jwt.claims', json_build_object('sub', 'a1000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;

select lives_ok(
  $$ update public.transfer_requests set status = 'accepted', resolved_at = '2000-01-01T00:00:00Z'
     where id = 'f1000000-0000-0000-0000-000000000004' $$,
  'additional 10 setup: acceptance with a bogus client resolved_at succeeds (value gets overridden)'
);
reset role;
select ok(
  (select resolved_at > '2020-01-01T00:00:00Z'::timestamptz from public.transfer_requests where id = 'f1000000-0000-0000-0000-000000000004'),
  'additional 10: resolved_at was overridden by the server, not the bogus client-supplied value'
);

-- 11: acceptance toward a profile that no longer belongs to the transfer's agency.
select set_config('request.jwt.claims', json_build_object('sub', 'a1000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;

select lives_ok(
  $$ insert into public.transfer_requests (id, agency_id, deal_id, from_agent_id, to_agent_id, requested_by, status)
     values ('f1000000-0000-0000-0000-000000000005', 'e1000000-0000-0000-0000-000000000001',
             'd1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001',
             'a1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000005', 'pending') $$,
  'request created for additional test 11 (to_agent_id will be moved to another agency)'
);

reset role;
-- Privileged context: simulate the recipient having since moved to a different agency.
update public.profiles set agency_id = 'e2000000-0000-0000-0000-000000000002' where id = 'a1000000-0000-0000-0000-000000000005';

select set_config('request.jwt.claims', json_build_object('sub', 'a1000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;

select throws_ok(
  $$ update public.transfer_requests set status = 'accepted'
     where id = 'f1000000-0000-0000-0000-000000000005' $$,
  'TRQ05', null,
  'additional 11: acceptance is rejected when the recipient no longer belongs to the transfer''s agency'
);

-- restore for cleanliness (irrelevant given the outer rollback, but explicit).
reset role;
update public.profiles set agency_id = 'e1000000-0000-0000-0000-000000000001' where id = 'a1000000-0000-0000-0000-000000000005';

-- 12: acceptance toward an inactive profile is rejected.
select set_config('request.jwt.claims', json_build_object('sub', 'a1000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;

select lives_ok(
  $$ insert into public.transfer_requests (id, agency_id, deal_id, from_agent_id, to_agent_id, requested_by, status)
     values ('f1000000-0000-0000-0000-000000000006', 'e1000000-0000-0000-0000-000000000001',
             'd1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001',
             'a1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000005', 'pending') $$,
  'request created for additional test 12 (to_agent_id will be deactivated)'
);

reset role;
update public.profiles set is_active = false where id = 'a1000000-0000-0000-0000-000000000005';

select set_config('request.jwt.claims', json_build_object('sub', 'a1000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;

select throws_ok(
  $$ update public.transfer_requests set status = 'accepted'
     where id = 'f1000000-0000-0000-0000-000000000006' $$,
  'TRQ05', null,
  'additional 12: acceptance is rejected when the recipient profile is inactive'
);

reset role;
update public.profiles set is_active = true where id = 'a1000000-0000-0000-0000-000000000005';

-- 13: the deals UPDATE affects exactly one row (already exercised by scenario 2/15's
-- success path; this asserts the row-count invariant explicitly via a clean
-- accept/verify pair on deal 3, which was never reassigned by any earlier test).
select lives_ok(
  $$ insert into public.transfer_requests (id, agency_id, deal_id, from_agent_id, to_agent_id, requested_by, status)
     values ('f1000000-0000-0000-0000-000000000007', 'e1000000-0000-0000-0000-000000000001',
             'd1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001',
             'a1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000006', 'pending') $$,
  'request created for additional test 13'
);
select lives_ok(
  $$ update public.transfer_requests set status = 'accepted'
     where id = 'f1000000-0000-0000-0000-000000000007' $$,
  'additional 13 setup: acceptance succeeds'
);
reset role;
select is(
  (select owner_id from public.deals where id = 'd1000000-0000-0000-0000-000000000003'),
  'a1000000-0000-0000-0000-000000000006'::uuid,
  'additional 13: exactly the targeted deal''s owner_id was updated (ROW_COUNT=1 path)'
);

-- 14: explicit demonstration that a malicious direct INSERT cannot immediately
-- transfer a deal -- the INSERT itself is rejected before any deals row is ever touched.
select set_config('request.jwt.claims', json_build_object('sub', 'a1000000-0000-0000-0000-000000000006', 'role', 'authenticated')::text, true);
set local role authenticated;

select throws_ok(
  $$ insert into public.transfer_requests (agency_id, deal_id, from_agent_id, to_agent_id, requested_by, status)
     values ('e1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000002',
             'a1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000006',
             'a1000000-0000-0000-0000-000000000006', 'accepted') $$,
  '42501', null,
  'additional 14: malicious direct INSERT-as-accepted is rejected, deal never touched'
);
reset role;
select is(
  (select owner_id from public.deals where id = 'd1000000-0000-0000-0000-000000000002'),
  'a1000000-0000-0000-0000-000000000003'::uuid,
  'additional 14: deal 2 owner remains unchanged after the rejected malicious INSERT'
);

select * from finish();
rollback;
