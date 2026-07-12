-- F-002 (High): implement invitation acceptance end-to-end.
--
-- Root cause: agentsService.createInvitation() generates a '#invite?token=...' link, but
-- there is no server-side path for the invitee to consume it. agency_invitations RLS is
-- FOR ALL USING (agency_id = current_agency_id() AND is_admin()), which an invitee (no
-- agency yet) can never satisfy, and there was no SECURITY DEFINER function to bridge that
-- gap. See docs/audit/findings.json F-002.
--
-- This migration adds ONLY the acceptance function. It does not touch any existing RLS
-- policy, table, trigger, or the F-001 profile guard (supabase/migrations/
-- 20260712040044_guard_profile_privileged_columns.sql). It does not create the 'expired'
-- auto-transition (deferred, separate work item per product decision).
--
-- Product decisions encoded here (final, per review):
--   * Caller must be authenticated (auth.uid() IS NOT NULL).
--   * The caller's auth.users.email must exactly match the invitation's email after
--     lower(trim(...)) normalization on both sides. No fuzzy/alternate-email acceptance
--     in this version.
--   * A user who already belongs to ANY agency (profiles.agency_id IS NOT NULL) is
--     rejected outright, even if that agency matches the invitation's agency_id. Users
--     cannot use this path to change agency.
--   * An invitation can be consumed exactly once (status transitions pending -> accepted
--     under row lock; the final UPDATE re-checks status = 'pending' in its WHERE clause
--     as a second guard).
--   * An expired invitation is rejected WITHOUT being mutated (no side-effect status
--     write) -- per instruction, do not RAISE after an UPDATE in the same statement path,
--     since the exception would roll back that UPDATE anyway; simply leave status as-is
--     and let a future job handle the 'expired' transition.
--   * The token itself is never included in any RAISE EXCEPTION message (only handled by
--     value, compared, never echoed back).
--   * Returns void. The frontend re-fetches the profile after a successful call; no
--     invitation/agency details are returned by this function, so no incidental data
--     leakage is possible via its return value.
--
-- Security model: SECURITY DEFINER, owned by the same privileged role as handle_new_user
-- (confirmed on the live project: owner 'postgres'). Executing as that owner means
-- current_user inside this function's body is NOT 'authenticated'/'anon', so the F-001
-- trigger (enforce_profile_column_guard) on public.profiles lets this function's
-- role/agency_id assignment through -- exactly the "privileged/SECURITY DEFINER path"
-- F-001's own migration comment anticipated. No change to that trigger is needed or made.

CREATE OR REPLACE FUNCTION public.accept_invitation(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_email text;
  v_token text;
  v_invitation public.agency_invitations%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_updated_count int;
BEGIN
  -- 1. Caller must be authenticated.
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to accept an invitation'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Token must be present and match the expected format (64 lowercase hex chars,
  -- matching agency_invitations.token's generation: encode(gen_random_bytes(32),'hex')).
  -- The token value itself is never included in any exception message below.
  v_token := trim(coalesce(p_token, ''));
  IF v_token = '' OR v_token !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invalid invitation token format'
      USING ERRCODE = 'IPV01';
  END IF;

  -- 3. Read the caller's verified account email (never trust client-supplied email).
  SELECT email INTO v_caller_email FROM auth.users WHERE id = v_caller_id;
  IF v_caller_email IS NULL THEN
    RAISE EXCEPTION 'Authenticated account has no email on file'
      USING ERRCODE = 'IPV06';
  END IF;

  -- 4. Lock the invitation row for the duration of this transaction so concurrent
  -- acceptance attempts on the same token serialize instead of racing.
  SELECT * INTO v_invitation
  FROM public.agency_invitations
  WHERE token = v_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found'
      USING ERRCODE = 'IPV02';
  END IF;

  IF v_invitation.status <> 'pending' THEN
    RAISE EXCEPTION 'Invitation has already been used or is no longer valid'
      USING ERRCODE = 'IPV03';
  END IF;

  -- Expired: reject without mutating the row. No UPDATE-then-RAISE here, since the
  -- exception would roll back any prior UPDATE in this statement path anyway; the
  -- automatic 'expired' status transition is a separate, deferred piece of work.
  IF v_invitation.expires_at <= now() THEN
    RAISE EXCEPTION 'Invitation has expired'
      USING ERRCODE = 'IPV04';
  END IF;

  -- 5. Strict, normalized email match. No cross-email acceptance in this version.
  IF lower(trim(v_invitation.email)) <> lower(trim(v_caller_email)) THEN
    RAISE EXCEPTION 'Invitation email does not match the authenticated account'
      USING ERRCODE = 'IPV05';
  END IF;

  -- 6. Lock the caller's own profile row.
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_caller_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for the authenticated account'
      USING ERRCODE = 'IPV06';
  END IF;

  -- 7. Refuse if the user already belongs to ANY agency, even the invitation's own
  -- agency. Invitation acceptance is for first-time agency assignment only; it is not
  -- a mechanism to re-confirm or change an existing membership.
  IF v_profile.agency_id IS NOT NULL THEN
    RAISE EXCEPTION 'Account is already attached to an agency'
      USING ERRCODE = 'IPV07';
  END IF;

  -- 8. Atomically assign agency_id and role. This UPDATE runs as the function owner
  -- (SECURITY DEFINER), so the F-001 profile guard trigger does not block it.
  UPDATE public.profiles
  SET agency_id = v_invitation.agency_id,
      role = v_invitation.role,
      updated_at = now()
  WHERE id = v_caller_id
    AND agency_id IS NULL; -- re-check under lock, cheap extra guard

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  IF v_updated_count <> 1 THEN
    RAISE EXCEPTION 'Profile update did not affect exactly one row'
      USING ERRCODE = 'IPV08';
  END IF;

  -- 9. Mark the invitation consumed. Re-check status = 'pending' in the WHERE clause
  -- as a second guard beyond the row lock already held.
  UPDATE public.agency_invitations
  SET status = 'accepted',
      accepted_at = now()
  WHERE id = v_invitation.id
    AND status = 'pending';

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  IF v_updated_count <> 1 THEN
    RAISE EXCEPTION 'Invitation update did not affect exactly one row'
      USING ERRCODE = 'IPV08';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_invitation(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated;

-- Rollback (manual):
--   REVOKE EXECUTE ON FUNCTION public.accept_invitation(text) FROM authenticated;
--   DROP FUNCTION IF EXISTS public.accept_invitation(text);
