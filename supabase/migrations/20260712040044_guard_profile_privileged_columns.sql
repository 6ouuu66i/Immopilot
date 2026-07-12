-- F-001 (Critical): prevent authenticated users from self-mutating security-sensitive
-- columns on public.profiles.
--
-- Root cause: policy "Users can update own profile" is FOR UPDATE USING (id = auth.uid())
-- with no WITH CHECK and no column restriction. Postgres reuses USING as WITH CHECK, so the
-- only constraint on the NEW row is id = auth.uid(); a non-admin can therefore set role,
-- agency_id or is_active on their own row (self-promote to admin, jump tenants, or reactivate
-- a deactivated account). See docs/audit/findings.json F-001.
--
-- Fix: a BEFORE UPDATE trigger enforcing an immutable-field policy. A column-level REVOKE was
-- rejected because it cannot distinguish admins (who legitimately change role/is_active on
-- agency members via the is_admin()-gated policy) from regular agents inside the single
-- `authenticated` role.
--
-- Design:
--  * Enforce ONLY for end-user API roles (authenticated/anon). Privileged/backend contexts
--    (postgres, service_role, supabase_admin, and SECURITY DEFINER functions such as the
--    future accept_invitation) run under a different current_user and bypass the guard, so
--    migrations, service-role jobs and controlled onboarding keep working.
--  * role      -> may change only when the caller is an agency admin (public.is_admin()).
--  * is_active -> may change only when the caller is an agency admin.
--  * agency_id -> immutable through the data API; tenant membership is assigned only via a
--    privileged/SECURITY DEFINER path (e.g. accept_invitation, F-002).
--
-- This does not weaken any existing RLS policy; it adds an independent enforcement layer.

CREATE OR REPLACE FUNCTION public.enforce_profile_column_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Only end-user API roles are constrained. Backend/privileged contexts
  -- (postgres, service_role, supabase_admin, supabase_auth_admin, and any SECURITY DEFINER
  -- function executing as its owner) fall through and retain full control.
  IF current_user <> 'authenticated' AND current_user <> 'anon' THEN
    RETURN NEW;
  END IF;

  -- role: privilege-defining column. Only an agency admin may change it.
  IF NEW.role IS DISTINCT FROM OLD.role AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'profiles.role can only be changed by an agency admin'
      USING ERRCODE = '42501';
  END IF;

  -- is_active: gates account access (deactivation). Only an agency admin may change it,
  -- so a deactivated user cannot reactivate themselves.
  IF NEW.is_active IS DISTINCT FROM OLD.is_active AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'profiles.is_active can only be changed by an agency admin'
      USING ERRCODE = '42501';
  END IF;

  -- agency_id: tenant membership. Immutable through the data API for every end-user role,
  -- including admins; reassignment happens only via a privileged/SECURITY DEFINER path.
  IF NEW.agency_id IS DISTINCT FROM OLD.agency_id THEN
    RAISE EXCEPTION 'profiles.agency_id cannot be changed through the API'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_profile_column_guard() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS enforce_profile_column_guard_trigger ON public.profiles;
CREATE TRIGGER enforce_profile_column_guard_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profile_column_guard();

-- Rollback (manual):
--   DROP TRIGGER IF EXISTS enforce_profile_column_guard_trigger ON public.profiles;
--   DROP FUNCTION IF EXISTS public.enforce_profile_column_guard();
