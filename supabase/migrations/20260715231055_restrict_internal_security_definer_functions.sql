-- Internal reference generation must remain available to row triggers without
-- exposing its counter mutation capability through PostgREST or application roles.
ALTER FUNCTION public.generate_reference(uuid, text)
  SET search_path = '';

ALTER FUNCTION public.set_contact_reference()
  SECURITY DEFINER;
ALTER FUNCTION public.set_contact_reference()
  SET search_path = '';

ALTER FUNCTION public.set_deal_reference()
  SECURITY DEFINER;
ALTER FUNCTION public.set_deal_reference()
  SET search_path = '';

REVOKE EXECUTE ON FUNCTION public.generate_reference(uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.set_contact_reference()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.set_deal_reference()
  FROM PUBLIC, anon, authenticated, service_role;

-- Trigger invocation does not require callers to hold EXECUTE on the trigger
-- function. Both trigger functions run as their unchanged owner (postgres), which
-- is the only principal that needs to invoke generate_reference(uuid, text).

-- The event trigger remains enabled and owner-operated. It is not an application
-- RPC and must not be directly executable by Data API roles.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()
  FROM PUBLIC, anon, authenticated, service_role;

-- Preserve the authenticated read policy, but remove every table-level mutation
-- capability. In particular, TRUNCATE is not governed by row-level security.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.reference_counters
  FROM anon, authenticated, service_role;
