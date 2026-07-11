-- Preserve the security model of the original canonical view after recreation.
ALTER VIEW public.active_properties_canonical
SET (security_invoker = true);
