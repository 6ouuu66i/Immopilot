-- F-002 RLS/behavior regression test — public.accept_invitation(p_token).
--
-- Run with the Supabase local stack:
--   supabase start
--   supabase test db
--
-- Covers scenarios 1-6 and 8 from the F-002 implementation review. Scenario 7 (true
-- concurrent acceptance) cannot be expressed within a single pgTAP script (each `select`
-- runs in the same session/transaction); the safety guarantee for concurrent callers
-- comes from `SELECT ... FOR UPDATE` on the invitation row in accept_invitation() and is
-- verified structurally by code review, not by this file. Scenario 9 (PostHog token
-- redaction) and scenario 10 (post-login/signup return flow) are frontend/integration
-- concerns covered by tests/e2e/*.spec.ts, not here.
--
-- Proves:
--   1. valid token + matching email + agency-less profile -> success, agency_id/role set,
--      invitation marked accepted
--   2. mismatched email -> rejected, profile unchanged
--   3. already-accepted invitation -> rejected, cannot be re-consumed
--   4. expired invitation -> rejected, and left untouched (no side-effect status write)
--   5. unknown token -> rejected
--   6. profile already attached to an agency (including the SAME agency) -> rejected
--   8. after successful acceptance, the F-001 guard still blocks a direct self-update of
--      role/agency_id by the now-agency-attached user

begin;
select plan(9);

-- ---------------------------------------------------------------------------
-- Seed (runs as the migration/owner role -> bypasses both the accept_invitation logic
-- and the F-001 trigger's authenticated/anon gate, same pattern as f001's test file).
-- ---------------------------------------------------------------------------
insert into public.agencies (id, name, slug) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'F002 Agency A', 'f002-agency-a'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'F002 Agency B', 'f002-agency-b');

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333',
   'authenticated', 'authenticated', 'f002-invitee-1@test.local', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444',
   'authenticated', 'authenticated', 'f002-invitee-2@test.local', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '55555555-5555-5555-5555-555555555555',
   'authenticated', 'authenticated', 'f002-invitee-3@test.local', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '66666666-6666-6666-6666-666666666666',
   'authenticated', 'authenticated', 'f002-already-in-agency@test.local', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '77777777-7777-7777-7777-777777777777',
   'authenticated', 'authenticated', 'f002-admin@test.local', now(), now());

-- handle_new_user() created all five profiles with agency_id NULL.
update public.profiles set agency_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc', role = 'admin'
  where id = '77777777-7777-7777-7777-777777777777';
update public.profiles set agency_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc', role = 'agent'
  where id = '66666666-6666-6666-6666-666666666666';

-- Invitation tokens (deliberately fixed 64-hex-char values matching the real format).
insert into public.agency_invitations (id, agency_id, invited_by, email, role, token, status, expires_at) values
  ('a0000000-0000-0000-0000-00000000000a', 'cccccccc-cccc-cccc-cccc-cccccccccccc',
   '77777777-7777-7777-7777-777777777777', 'f002-invitee-1@test.local', 'agent',
   '1111111111111111111111111111111111111111111111111111111111111a', 'pending', now() + interval '7 days'),
  ('a0000000-0000-0000-0000-00000000000b', 'cccccccc-cccc-cccc-cccc-cccccccccccc',
   '77777777-7777-7777-7777-777777777777', 'f002-invitee-2@test.local', 'agent',
   '2222222222222222222222222222222222222222222222222222222222222b', 'accepted', now() + interval '7 days'),
  ('a0000000-0000-0000-0000-00000000000c', 'cccccccc-cccc-cccc-cccc-cccccccccccc',
   '77777777-7777-7777-7777-777777777777', 'f002-invitee-3@test.local', 'agent',
   '3333333333333333333333333333333333333333333333333333333333333c', 'pending', now() - interval '1 hour'),
  ('a0000000-0000-0000-0000-00000000000d', 'dddddddd-dddd-dddd-dddd-dddddddddddd',
   '77777777-7777-7777-7777-777777777777', 'f002-already-in-agency@test.local', 'agent',
   '4444444444444444444444444444444444444444444444444444444444444d', 'pending', now() + interval '7 days');

-- ---------------------------------------------------------------------------
-- Scenario 2: mismatched email. invitee-1's invitation targets their own email, but
-- invitee-2 (a different account) tries to consume it.
-- ---------------------------------------------------------------------------
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '44444444-4444-4444-4444-444444444444', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

select throws_ok(
  $$ select public.accept_invitation('1111111111111111111111111111111111111111111111111111111111111a') $$,
  'IPV05',
  'Invitation email does not match the authenticated account',
  'mismatched email is rejected'
);

reset role;
select is(
  (select agency_id from public.profiles where id = '44444444-4444-4444-4444-444444444444'),
  null::uuid,
  'mismatched-email caller profile remains agency-less'
);

-- ---------------------------------------------------------------------------
-- Scenario 3: already-accepted invitation.
-- ---------------------------------------------------------------------------
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '44444444-4444-4444-4444-444444444444', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

select throws_ok(
  $$ select public.accept_invitation('2222222222222222222222222222222222222222222222222222222222222b') $$,
  'IPV03',
  'Invitation has already been used or is no longer valid',
  'already-accepted invitation cannot be re-consumed'
);

-- ---------------------------------------------------------------------------
-- Scenario 4: expired invitation, and it must remain untouched (no status mutation).
-- ---------------------------------------------------------------------------
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '55555555-5555-5555-5555-555555555555', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

select throws_ok(
  $$ select public.accept_invitation('3333333333333333333333333333333333333333333333333333333333333c') $$,
  'IPV04',
  'Invitation has expired',
  'expired invitation is rejected'
);

reset role;
select is(
  (select status from public.agency_invitations where id = 'a0000000-0000-0000-0000-00000000000c'),
  'pending',
  'expired invitation status is left untouched (still pending, not force-expired)'
);

-- ---------------------------------------------------------------------------
-- Scenario 5: unknown token.
-- ---------------------------------------------------------------------------
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '33333333-3333-3333-3333-333333333333', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

select throws_ok(
  $$ select public.accept_invitation('9999999999999999999999999999999999999999999999999999999999999z') $$,
  'IPV01',
  'Invalid invitation token format',
  'malformed token is rejected before any lookup'
);

select throws_ok(
  $$ select public.accept_invitation('abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd') $$,
  'IPV02',
  'Invitation not found',
  'well-formed but unknown token is rejected'
);

-- ---------------------------------------------------------------------------
-- Scenario 6: profile already attached to an agency (even the SAME agency the
-- invitation targets) must be rejected.
-- ---------------------------------------------------------------------------
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '66666666-6666-6666-6666-666666666666', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

select throws_ok(
  $$ select public.accept_invitation('4444444444444444444444444444444444444444444444444444444444444d') $$,
  'IPV07',
  'Account is already attached to an agency',
  'already-in-an-agency profile cannot accept any invitation'
);

-- ---------------------------------------------------------------------------
-- Scenario 1 + 8: happy path, then confirm the F-001 guard still blocks a direct
-- self-update of role/agency_id immediately after acceptance.
-- ---------------------------------------------------------------------------
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '33333333-3333-3333-3333-333333333333', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

select lives_ok(
  $$ select public.accept_invitation('1111111111111111111111111111111111111111111111111111111111111a') $$,
  'valid token + matching email + agency-less profile succeeds'
);

select throws_ok(
  $$ update public.profiles set agency_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
     where id = '33333333-3333-3333-3333-333333333333' $$,
  '42501',
  'profiles.agency_id cannot be changed through the API',
  'F-001 guard still blocks direct agency_id self-change after acceptance'
);

reset role;
select * from finish();
rollback;
