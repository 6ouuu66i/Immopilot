-- F-003 (reclassified Critical): close the transfer_requests deal-ownership hijack.
--
-- Root cause (confirmed live on Pre-Alpha, read-only, before writing this migration):
--   Policy "From agent can resolve transfer" is
--     FOR UPDATE USING (from_agent_id = auth.uid() OR is_admin())
--   with NO WITH CHECK. Postgres reuses USING as WITH CHECK, so the only constraint on
--   the NEW row is that from_agent_id (unchanged) still equals auth.uid() -- nothing
--   restricts deal_id, agency_id, to_agent_id, requested_by, status, resolved_at or
--   refusal_reason. is_admin() is also not agency-scoped in this policy (unlike every
--   other admin-gated policy in the schema). The only table CHECK is
--   `same_agency_transfer CHECK (from_agent_id <> to_agent_id)`, which despite its name
--   enforces nothing about agencies. handle_transfer_notification() is SECURITY DEFINER
--   and, on any status transition to 'accepted', unconditionally runs
--   `UPDATE deals SET owner_id = NEW.to_agent_id` with no revalidation. There was also no
--   INSERT-side protection against directly creating a row already in a terminal status.
--
-- Confirmed live trigger inventory before this migration: exactly ONE trigger exists on
-- transfer_requests -- `transfer_notification_trigger AFTER INSERT OR UPDATE`. There was
-- no BEFORE trigger of any kind, so nothing previously validated INSERT payloads beyond
-- the RLS WITH CHECK boolean expression.
--
-- State machine reconstructed from the live schema and the exact behavior of
-- src/lib/services/transfersService.ts (re-verified against the current file content):
--   status CHECK: 'pending' | 'accepted' | 'refused' | 'cancelled' (only these four).
--   Single resolution timestamp column: resolved_at (no separate accepted_at/responded_at).
--   INSERT (requestTransfer): requested_by = caller, to_agent_id = caller,
--     from_agent_id = deals.owner_id at request time, status='pending' (implicit,
--     matches the column default), resolved_at/refusal_reason never sent.
--   acceptTransfer / refuseTransfer / cancelTransfer all send resolved_at =
--     new Date().toISOString() from the client; only refuseTransfer also sends
--     refusal_reason. Per review decision, the server always overrides resolved_at with
--     its own now() on a valid transition -- the client value is silently ignored, no
--     frontend change required.
--
--   pending -> accepted : actor must be from_agent_id (or agency admin); resolved_at
--     forced to now(); refusal_reason must be NULL.
--   pending -> refused  : actor must be from_agent_id (or agency admin); resolved_at
--     forced to now(); refusal_reason left exactly as the client sends it (matches
--     current frontend: normalizeMessage() may produce NULL or a trimmed string).
--   pending -> cancelled: actor must be requested_by (or agency admin); resolved_at
--     forced to now(); refusal_reason must be NULL.
--   No other transition is ever issued by the application. Terminal statuses are never
--   revisited, and a status-unchanged UPDATE ('pending' -> 'pending') must not be able
--   to sneak a resolved_at/refusal_reason change through.
--
--   Admin scope: agency admins may perform ALL THREE resolutions (accept/refuse/cancel)
--   on any pending request within their OWN agency (OLD.agency_id = current_agency_id()
--   always required alongside is_admin()). No frontend code currently exercises this
--   (adminService.ts only ever reads transfer_requests), but it is kept symmetric with
--   the original policy's intent of allowing an admin to resolve a stuck transfer on
--   behalf of an unavailable/departed agent, extended consistently to cancellation too
--   since there is no functional reason to treat it differently and no existing behavior
--   depends on excluding it.
--
--   IMPORTANT SIDE FINDING (unchanged from the previous review, re-confirmed): the
--   ORIGINAL policy's USING clause never covered requested_by at all, meaning
--   cancelTransfer() -- called by requested_by, who is never from_agent_id (enforced by
--   the same_agency_transfer CHECK) -- could not actually match any row for a non-admin
--   caller. This migration's new USING clause adds requested_by as an allowed matcher
--   (gated to the cancel transition only by the trigger), which is a necessary, in-scope
--   fix to make the application's own intended behavior work.
--
-- This migration does not touch F-001, F-002, any matview migration, or any other table.

-- =============================================================================
-- 1. BEFORE UPDATE trigger: immutable columns + full state-machine enforcement
--    (status transitions, actor authorization, resolved_at/refusal_reason control).
--    Mirrors the F-001 pattern: enforced only for end-user API roles; privileged/backend
--    contexts (postgres, service_role, and any SECURITY DEFINER function executing as
--    its owner, e.g. handle_transfer_notification below) bypass entirely.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.enforce_transfer_request_update_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF current_user <> 'authenticated' AND current_user <> 'anon' THEN
    RETURN NEW;
  END IF;

  -- Identity/audit columns are immutable through the API, always, regardless of actor
  -- or transition. status, resolved_at and refusal_reason are deliberately NOT in this
  -- list -- they are controlled by the transition logic below instead.
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.deal_id IS DISTINCT FROM OLD.deal_id
     OR NEW.agency_id IS DISTINCT FROM OLD.agency_id
     OR NEW.from_agent_id IS DISTINCT FROM OLD.from_agent_id
     OR NEW.to_agent_id IS DISTINCT FROM OLD.to_agent_id
     OR NEW.requested_by IS DISTINCT FROM OLD.requested_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'transfer_requests: id, deal_id, agency_id, from_agent_id, to_agent_id, requested_by and created_at are immutable after creation'
      USING ERRCODE = 'TRQ01';
  END IF;

  -- A resolved (non-pending) request can never be modified again -- no re-resolution,
  -- no bouncing back to pending, no jumping between terminal statuses, no touching
  -- resolved_at/refusal_reason after the fact.
  IF OLD.status <> 'pending' THEN
    RAISE EXCEPTION 'transfer_requests: a resolved transfer request cannot be modified again'
      USING ERRCODE = 'TRQ02';
  END IF;

  -- Status-unchanged update ('pending' -> 'pending'): only `message` may legitimately
  -- change (no app code does even that, but nothing requires locking it). resolved_at
  -- and refusal_reason must not move without an actual status transition.
  IF NEW.status = OLD.status THEN
    IF NEW.resolved_at IS DISTINCT FROM OLD.resolved_at
       OR NEW.refusal_reason IS DISTINCT FROM OLD.refusal_reason
    THEN
      RAISE EXCEPTION 'transfer_requests: resolved_at and refusal_reason cannot change without an actual status transition'
        USING ERRCODE = 'TRQ06';
    END IF;
    RETURN NEW;
  END IF;

  -- Only the three transitions the application actually performs are allowed, each
  -- gated to its correct actor and scoped to the row's own agency. Admins are always
  -- additionally required to match the row's OWN agency (OLD.agency_id =
  -- current_agency_id()), never a global admin bypass. requested_by matching the UPDATE
  -- policy's USING clause (added below, to make cancellation possible at all) does NOT
  -- by itself grant the right to accept or refuse -- only this per-transition check does.
  IF NEW.status = 'accepted' THEN
    IF NOT (
      (OLD.from_agent_id = auth.uid() AND OLD.agency_id = current_agency_id())
      OR (public.is_admin() AND OLD.agency_id = current_agency_id())
    ) THEN
      RAISE EXCEPTION 'transfer_requests: only the current deal owner or an agency admin may accept'
        USING ERRCODE = 'TRQ03';
    END IF;

    IF NEW.refusal_reason IS NOT NULL THEN
      RAISE EXCEPTION 'transfer_requests: refusal_reason must be NULL when accepting'
        USING ERRCODE = 'TRQ07';
    END IF;

    -- Server-authoritative resolution timestamp: whatever the client sent is replaced.
    NEW.resolved_at := now();

  ELSIF NEW.status = 'refused' THEN
    IF NOT (
      (OLD.from_agent_id = auth.uid() AND OLD.agency_id = current_agency_id())
      OR (public.is_admin() AND OLD.agency_id = current_agency_id())
    ) THEN
      RAISE EXCEPTION 'transfer_requests: only the current deal owner or an agency admin may refuse'
        USING ERRCODE = 'TRQ03';
    END IF;

    -- refusal_reason is left as the client sends it (NULL or a string), matching the
    -- current frontend's normalizeMessage() behavior. Not forced either way.
    NEW.resolved_at := now();

  ELSIF NEW.status = 'cancelled' THEN
    IF NOT (
      (OLD.requested_by = auth.uid() AND OLD.agency_id = current_agency_id())
      OR (public.is_admin() AND OLD.agency_id = current_agency_id())
    ) THEN
      RAISE EXCEPTION 'transfer_requests: only the requester or an agency admin may cancel'
        USING ERRCODE = 'TRQ03';
    END IF;

    IF NEW.refusal_reason IS NOT NULL THEN
      RAISE EXCEPTION 'transfer_requests: refusal_reason must be NULL when cancelling'
        USING ERRCODE = 'TRQ07';
    END IF;

    NEW.resolved_at := now();

  ELSE
    RAISE EXCEPTION 'transfer_requests: invalid status transition from % to %', OLD.status, NEW.status
      USING ERRCODE = 'TRQ04';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_transfer_request_update_rules() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS enforce_transfer_request_update_rules_trigger ON public.transfer_requests;
CREATE TRIGGER enforce_transfer_request_update_rules_trigger
  BEFORE UPDATE ON public.transfer_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_transfer_request_update_rules();

-- =============================================================================
-- 2. UPDATE policy: agency-scoped USING (now correctly including requested_by, fixing
--    the pre-existing cancelTransfer gap) + an explicit WITH CHECK floor. Fine-grained
--    per-transition actor authorization, and all resolved_at/refusal_reason control, is
--    enforced by the trigger above, not here -- RLS boolean expressions cannot cleanly
--    express "this actor may only set status to this specific value, and only this
--    field alongside it" without duplicating the trigger's CASE logic.
-- =============================================================================

DROP POLICY IF EXISTS "From agent can resolve transfer" ON public.transfer_requests;
CREATE POLICY "From agent can resolve transfer" ON public.transfer_requests
FOR UPDATE TO authenticated
USING (
  agency_id = current_agency_id()
  AND (from_agent_id = auth.uid() OR requested_by = auth.uid() OR is_admin())
)
WITH CHECK (
  agency_id = current_agency_id()
);

-- =============================================================================
-- 3. INSERT policy: close both the deal/ownership consistency gap AND the ability to
--    directly create a row already in a terminal state (there is no BEFORE INSERT
--    trigger -- these are static NEW-only conditions, so a WITH CHECK is the correct,
--    sufficient place for them; no trigger needed for INSERT-time constraints).
--
--    Implemented as a WITH CHECK EXISTS subquery rather than a new RPC function, because
--    the caller already has full RLS visibility of their own agency's deals/profiles
--    (unlike F-002's accept_invitation, which needed SECURITY DEFINER specifically
--    because the invitee had NO visibility into agency_invitations before joining). No
--    frontend change is required: transfersService.requestTransfer() already sends
--    exactly agency_id = deal.agency_id, from_agent_id = deal.owner_id, status implicit
--    'pending', and never sends resolved_at/refusal_reason -- this check makes those
--    same invariants mandatory at the database level instead of trusting the client.
--
--    from_agent_id <> to_agent_id needs no additional check here -- already enforced
--    unconditionally by the table CHECK constraint `same_agency_transfer`.
--    to_agent_id's own agency membership needs no separate check either -- it is already
--    structurally guaranteed by `to_agent_id = auth.uid()` AND `agency_id =
--    current_agency_id()` together (to_agent_id is always the caller).
--
--    Added beyond the strict minimum, per review invitation ("idealement, le
--    destinataire est actif"): to_agent_id's own profile must be is_active, matching the
--    existing app-layer is_active check already applied to from_agent_id at request
--    creation (transfersService.requestTransfer checks owner.is_active but never checked
--    the requester's own is_active state).
-- =============================================================================

DROP POLICY IF EXISTS "Create transfer request" ON public.transfer_requests;
CREATE POLICY "Create transfer request" ON public.transfer_requests
FOR INSERT TO authenticated
WITH CHECK (
  agency_id = current_agency_id()
  AND requested_by = auth.uid()
  AND to_agent_id = auth.uid()
  AND status = 'pending'
  AND resolved_at IS NULL
  AND refusal_reason IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.deals d
    WHERE d.id = deal_id
      AND d.agency_id = transfer_requests.agency_id
      AND d.owner_id = from_agent_id
      AND d.closed_at IS NULL
  )
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = to_agent_id
      AND p.is_active = true
  )
);

-- =============================================================================
-- 4. Business trigger: revalidate live ground truth (deals/profiles as they are RIGHT
--    NOW, never values captured at request-creation time) before reassigning deal
--    ownership. Runs AFTER UPDATE, so any RAISE EXCEPTION here aborts the whole
--    triggering statement -- the transfer_requests row change and the deals.owner_id
--    change stay atomic; there is no partial-write window. SECURITY DEFINER +
--    'postgres' owner means this function's own body is exempt from the BEFORE trigger
--    above (current_user is not 'authenticated'/'anon' inside it), consistent with the
--    F-001/F-002 privileged-path pattern.
--
--    The final UPDATE to deals keeps a restrictive WHERE clause (id + agency_id +
--    owner_id) as a second, independent safety net beyond the preceding SELECT ... FOR
--    UPDATE lock, and verifies via GET DIAGNOSTICS that exactly one row was affected.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_transfer_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deal_reference TEXT;
  v_deal_agency_id UUID;
  v_deal_owner_id UUID;
  v_from_agent_agency_id UUID;
  v_to_agent_agency_id UUID;
  v_to_agent_is_active BOOLEAN;
  v_updated_count INT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT reference INTO v_deal_reference FROM deals WHERE id = NEW.deal_id;

    INSERT INTO notifications (user_id, type, title, body, related_type, related_id, metadata)
    VALUES (
      NEW.from_agent_id,
      'transfer_requested',
      'Demande de transfert reçue',
      'Un agent souhaite reprendre votre deal ' || v_deal_reference,
      'transfer',
      NEW.id,
      jsonb_build_object(
        'deal_id', NEW.deal_id,
        'deal_reference', v_deal_reference,
        'requested_by', NEW.requested_by,
        'to_agent_id', NEW.to_agent_id
      )
    );

  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status IN ('accepted', 'refused') THEN

    IF NEW.status = 'accepted' THEN
      -- Ground-truth revalidation. Lock the deal row so a concurrent acceptance of a
      -- different transfer for the same deal cannot race this one.
      SELECT agency_id, owner_id
        INTO v_deal_agency_id, v_deal_owner_id
      FROM deals
      WHERE id = NEW.deal_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'transfer_requests: target deal no longer exists'
          USING ERRCODE = 'TRQ05';
      END IF;

      IF v_deal_agency_id IS DISTINCT FROM NEW.agency_id THEN
        RAISE EXCEPTION 'transfer_requests: deal no longer belongs to this transfer request''s agency'
          USING ERRCODE = 'TRQ05';
      END IF;

      IF v_deal_owner_id IS DISTINCT FROM NEW.from_agent_id THEN
        RAISE EXCEPTION 'transfer_requests: deal is no longer owned by the agent resolving this transfer'
          USING ERRCODE = 'TRQ05';
      END IF;

      SELECT agency_id INTO v_from_agent_agency_id FROM profiles WHERE id = NEW.from_agent_id;
      SELECT agency_id, is_active INTO v_to_agent_agency_id, v_to_agent_is_active FROM profiles WHERE id = NEW.to_agent_id;

      IF v_from_agent_agency_id IS DISTINCT FROM NEW.agency_id
         OR v_to_agent_agency_id IS DISTINCT FROM NEW.agency_id
      THEN
        RAISE EXCEPTION 'transfer_requests: both agents must currently belong to this transfer request''s agency'
          USING ERRCODE = 'TRQ05';
      END IF;

      IF v_to_agent_is_active IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'transfer_requests: the receiving agent is no longer active'
          USING ERRCODE = 'TRQ05';
      END IF;

      -- Restrictive UPDATE: id + agency_id + owner_id all re-checked in the WHERE
      -- clause itself, independent of the SELECT ... FOR UPDATE above. Exactly one row
      -- must be affected.
      UPDATE deals
      SET owner_id = NEW.to_agent_id, updated_at = NOW()
      WHERE id = NEW.deal_id
        AND agency_id = NEW.agency_id
        AND owner_id = NEW.from_agent_id;

      GET DIAGNOSTICS v_updated_count = ROW_COUNT;
      IF v_updated_count <> 1 THEN
        RAISE EXCEPTION 'transfer_requests: deal ownership update did not affect exactly one row'
          USING ERRCODE = 'TRQ05';
      END IF;

      SELECT reference INTO v_deal_reference FROM deals WHERE id = NEW.deal_id;
    ELSE
      SELECT reference INTO v_deal_reference FROM deals WHERE id = NEW.deal_id;
    END IF;

    INSERT INTO notifications (user_id, type, title, body, related_type, related_id, metadata)
    VALUES (
      NEW.requested_by,
      CASE WHEN NEW.status = 'accepted' THEN 'transfer_accepted' ELSE 'transfer_refused' END,
      CASE WHEN NEW.status = 'accepted'
        THEN 'Transfert accepté pour ' || v_deal_reference
        ELSE 'Transfert refusé pour ' || v_deal_reference END,
      NULL,
      'transfer',
      NEW.id,
      jsonb_build_object(
        'deal_id', NEW.deal_id,
        'deal_reference', v_deal_reference,
        'status', NEW.status,
        'refusal_reason', NEW.refusal_reason
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- =============================================================================
-- ROLLBACK (self-contained -- execute the statements below, in order, to fully revert
-- this migration to the exact state captured live from Pre-Alpha via pg_get_functiondef
-- before this migration was written, on 2026-07-12. No historical migration file needs
-- to be located or replayed; every statement needed is here.)
-- =============================================================================

-- 1. Drop the new BEFORE UPDATE trigger and its function (did not exist before this
--    migration -- a plain DROP is a complete, self-contained rollback for this part).
-- DROP TRIGGER IF EXISTS enforce_transfer_request_update_rules_trigger ON public.transfer_requests;
-- DROP FUNCTION IF EXISTS public.enforce_transfer_request_update_rules();

-- 2. Restore the original UPDATE policy (verbatim, as it existed on Pre-Alpha before
--    this migration).
-- DROP POLICY IF EXISTS "From agent can resolve transfer" ON public.transfer_requests;
-- CREATE POLICY "From agent can resolve transfer" ON public.transfer_requests
--   FOR UPDATE TO authenticated USING (from_agent_id = auth.uid() OR is_admin());

-- 3. Restore the original INSERT policy (verbatim).
-- DROP POLICY IF EXISTS "Create transfer request" ON public.transfer_requests;
-- CREATE POLICY "Create transfer request" ON public.transfer_requests
--   FOR INSERT TO authenticated WITH CHECK (
--     agency_id = current_agency_id() AND requested_by = auth.uid() AND to_agent_id = auth.uid()
--   );

-- 4. Restore the exact original handle_transfer_notification() body, captured live via
--    pg_get_functiondef(...) from Pre-Alpha immediately before this migration was
--    authored (2026-07-12). This is the complete, executable function definition -- not
--    a reference -- so this rollback is fully self-contained and requires no other file.
-- CREATE OR REPLACE FUNCTION public.handle_transfer_notification()
--  RETURNS trigger
--  LANGUAGE plpgsql
--  SECURITY DEFINER
--  SET search_path TO 'public'
-- AS $function$
-- DECLARE
--   v_deal_reference TEXT;
-- BEGIN
--   IF TG_OP = 'INSERT' THEN
--     SELECT reference INTO v_deal_reference FROM deals WHERE id = NEW.deal_id;
--
--     INSERT INTO notifications (user_id, type, title, body, related_type, related_id, metadata)
--     VALUES (
--       NEW.from_agent_id,
--       'transfer_requested',
--       'Demande de transfert reçue',
--       'Un agent souhaite reprendre votre deal ' || v_deal_reference,
--       'transfer',
--       NEW.id,
--       jsonb_build_object(
--         'deal_id', NEW.deal_id,
--         'deal_reference', v_deal_reference,
--         'requested_by', NEW.requested_by,
--         'to_agent_id', NEW.to_agent_id
--       )
--     );
--   ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status IN ('accepted', 'refused') THEN
--     SELECT reference INTO v_deal_reference FROM deals WHERE id = NEW.deal_id;
--
--     INSERT INTO notifications (user_id, type, title, body, related_type, related_id, metadata)
--     VALUES (
--       NEW.requested_by,
--       CASE WHEN NEW.status = 'accepted' THEN 'transfer_accepted' ELSE 'transfer_refused' END,
--       CASE WHEN NEW.status = 'accepted'
--         THEN 'Transfert accepté pour ' || v_deal_reference
--         ELSE 'Transfert refusé pour ' || v_deal_reference END,
--       NULL,
--       'transfer',
--       NEW.id,
--       jsonb_build_object(
--         'deal_id', NEW.deal_id,
--         'deal_reference', v_deal_reference,
--         'status', NEW.status,
--         'refusal_reason', NEW.refusal_reason
--       )
--     );
--
--     IF NEW.status = 'accepted' THEN
--       UPDATE deals SET owner_id = NEW.to_agent_id, updated_at = NOW() WHERE id = NEW.deal_id;
--     END IF;
--   END IF;
--
--   RETURN NEW;
-- END;
-- $function$;
