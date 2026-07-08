CREATE INDEX IF NOT EXISTS idx_price_history_change_type_detected
  ON public.price_history (change_type, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_listing_signals_active_detected
  ON public.listing_signals (detected_at DESC)
  WHERE is_active = true;

CREATE OR REPLACE FUNCTION public.purge_listing_score_history(retention_days int DEFAULT 90)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.listing_score_history
  WHERE computed_at < now() - make_interval(days => GREATEST(COALESCE(retention_days, 90), 0));

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purge_listing_score_history(int) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_daily_pipeline()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM refresh_market_reference();
  PERFORM sync_overpriced_signal_batch();
  PERFORM sync_stale_dom_relative_signal_batch();
  PERFORM sync_failed_launch_signal_batch();
  PERFORM sync_competition_shock_signal_batch();
  PERFORM sync_agency_mandate_aging_signal();
  PERFORM compute_listing_scores();
  PERFORM purge_listing_score_history();
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'sync_daily_pipeline failed: %', SQLERRM;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_daily_pipeline() FROM PUBLIC, anon, authenticated;
