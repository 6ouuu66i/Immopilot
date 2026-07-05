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
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'sync_daily_pipeline failed: %', SQLERRM;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_daily_pipeline() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-agency-mandate-aging-daily') THEN
    PERFORM cron.unschedule('sync-agency-mandate-aging-daily');
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-daily-pipeline') THEN
    PERFORM cron.unschedule('sync-daily-pipeline');
  END IF;
END;
$$;

SELECT cron.schedule(
  'sync-daily-pipeline',
  '0 3 * * *',
  $$ SELECT sync_daily_pipeline(); $$
);
