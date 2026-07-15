-- F-008 follow-up: keep the bounded Dashboard aggregation in memory without
-- raising work_mem globally for unrelated database workloads.

ALTER FUNCTION public.get_dashboard_snapshot(integer)
  SET work_mem = '16MB';

COMMENT ON FUNCTION public.get_dashboard_snapshot(integer) IS
  'Guarded Dashboard snapshot backed by active_properties_canonical_mat. Returns market aggregates only; no CRM rows. Uses a bounded 16MB work_mem to avoid temporary-file spill.';
