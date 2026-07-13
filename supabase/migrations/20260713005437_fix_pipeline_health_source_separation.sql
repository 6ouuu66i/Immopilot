-- F-009/F-010 differential correction on top of
-- 20260712150857_pipeline_observability.sql.
--
-- This migration intentionally does not recreate or alter pipeline tables,
-- constraints, indexes, RLS, policies, grants, or pg_cron jobs. It only replaces
-- the four pipeline/RPC functions whose behavior must change.

-- =============================================================================
-- 1. Daily pipeline: preserve the run row across ordinary unexpected errors.
-- =============================================================================
-- The run is created before the inner exception block. Expected step failures are
-- still handled by their own nested blocks, so completed steps remain durable and
-- later steps are recorded skipped. If an unexpected error escapes that normal
-- instrumentation, the inner block is rolled back but the already-created run row
-- remains available to the fallback handler, which records an internal failed step.
--
-- Honest durability boundary: a fatal connection loss, backend termination, or a
-- rollback of the caller's entire transaction can still prevent all ledger writes
-- from committing. PostgreSQL has no native autonomous transactions, and this
-- migration does not claim to provide one.

CREATE OR REPLACE FUNCTION public.sync_daily_pipeline()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run_id uuid;
  v_step_id uuid;
  v_continue boolean := true;
  v_sqlstate text;
  v_matview_estimated_count bigint;
  v_purged_count integer;
BEGIN
  IF NOT pg_try_advisory_xact_lock(public._pipeline_lock_key()) THEN
    PERFORM public._pipeline_skipped_run('cron', 'pipeline_already_running');
    RETURN;
  END IF;

  -- Kept outside the fallback subtransaction so an unexpected error below does
  -- not erase the run row before the fallback can mark it failed.
  v_run_id := public._pipeline_start_run('cron');

  BEGIN
    -- Step 1/9: refresh_market_reference
    IF v_continue THEN
      v_step_id := public._pipeline_start_step(v_run_id, 'refresh_market_reference', 1);
      BEGIN
        PERFORM public.refresh_market_reference();
        PERFORM public._pipeline_finish_step(v_step_id, 'success');
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
        PERFORM public._pipeline_finish_step(v_step_id, 'failed', v_sqlstate, public._pipeline_clean_error(SQLERRM));
        RAISE WARNING 'sync_daily_pipeline: refresh_market_reference failed: %', SQLERRM;
        v_continue := false;
      END;
    END IF;

    -- Step 2/9: sync_overpriced_signal_batch
    IF v_continue THEN
      v_step_id := public._pipeline_start_step(v_run_id, 'sync_overpriced_signal_batch', 2);
      BEGIN
        PERFORM public.sync_overpriced_signal_batch();
        PERFORM public._pipeline_finish_step(v_step_id, 'success');
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
        PERFORM public._pipeline_finish_step(v_step_id, 'failed', v_sqlstate, public._pipeline_clean_error(SQLERRM));
        RAISE WARNING 'sync_daily_pipeline: sync_overpriced_signal_batch failed: %', SQLERRM;
        v_continue := false;
      END;
    ELSE
      PERFORM public._pipeline_skip_step(v_run_id, 'sync_overpriced_signal_batch', 2);
    END IF;

    -- Step 3/9: sync_stale_dom_relative_signal_batch
    IF v_continue THEN
      v_step_id := public._pipeline_start_step(v_run_id, 'sync_stale_dom_relative_signal_batch', 3);
      BEGIN
        PERFORM public.sync_stale_dom_relative_signal_batch();
        PERFORM public._pipeline_finish_step(v_step_id, 'success');
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
        PERFORM public._pipeline_finish_step(v_step_id, 'failed', v_sqlstate, public._pipeline_clean_error(SQLERRM));
        RAISE WARNING 'sync_daily_pipeline: sync_stale_dom_relative_signal_batch failed: %', SQLERRM;
        v_continue := false;
      END;
    ELSE
      PERFORM public._pipeline_skip_step(v_run_id, 'sync_stale_dom_relative_signal_batch', 3);
    END IF;

    -- Step 4/9: sync_failed_launch_signal_batch
    IF v_continue THEN
      v_step_id := public._pipeline_start_step(v_run_id, 'sync_failed_launch_signal_batch', 4);
      BEGIN
        PERFORM public.sync_failed_launch_signal_batch();
        PERFORM public._pipeline_finish_step(v_step_id, 'success');
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
        PERFORM public._pipeline_finish_step(v_step_id, 'failed', v_sqlstate, public._pipeline_clean_error(SQLERRM));
        RAISE WARNING 'sync_daily_pipeline: sync_failed_launch_signal_batch failed: %', SQLERRM;
        v_continue := false;
      END;
    ELSE
      PERFORM public._pipeline_skip_step(v_run_id, 'sync_failed_launch_signal_batch', 4);
    END IF;

    -- Step 5/9: sync_competition_shock_signal_batch
    IF v_continue THEN
      v_step_id := public._pipeline_start_step(v_run_id, 'sync_competition_shock_signal_batch', 5);
      BEGIN
        PERFORM public.sync_competition_shock_signal_batch();
        PERFORM public._pipeline_finish_step(v_step_id, 'success');
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
        PERFORM public._pipeline_finish_step(v_step_id, 'failed', v_sqlstate, public._pipeline_clean_error(SQLERRM));
        RAISE WARNING 'sync_daily_pipeline: sync_competition_shock_signal_batch failed: %', SQLERRM;
        v_continue := false;
      END;
    ELSE
      PERFORM public._pipeline_skip_step(v_run_id, 'sync_competition_shock_signal_batch', 5);
    END IF;

    -- Step 6/9: sync_agency_mandate_aging_signal
    IF v_continue THEN
      v_step_id := public._pipeline_start_step(v_run_id, 'sync_agency_mandate_aging_signal', 6);
      BEGIN
        PERFORM public.sync_agency_mandate_aging_signal();
        PERFORM public._pipeline_finish_step(v_step_id, 'success');
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
        PERFORM public._pipeline_finish_step(v_step_id, 'failed', v_sqlstate, public._pipeline_clean_error(SQLERRM));
        RAISE WARNING 'sync_daily_pipeline: sync_agency_mandate_aging_signal failed: %', SQLERRM;
        v_continue := false;
      END;
    ELSE
      PERFORM public._pipeline_skip_step(v_run_id, 'sync_agency_mandate_aging_signal', 6);
    END IF;

    -- Step 7/9: compute_listing_scores
    IF v_continue THEN
      v_step_id := public._pipeline_start_step(v_run_id, 'compute_listing_scores', 7);
      BEGIN
        PERFORM public.compute_listing_scores();
        PERFORM public._pipeline_finish_step(v_step_id, 'success');
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
        PERFORM public._pipeline_finish_step(v_step_id, 'failed', v_sqlstate, public._pipeline_clean_error(SQLERRM));
        RAISE WARNING 'sync_daily_pipeline: compute_listing_scores failed: %', SQLERRM;
        v_continue := false;
      END;
    ELSE
      PERFORM public._pipeline_skip_step(v_run_id, 'compute_listing_scores', 7);
    END IF;

    -- Step 8/9: refresh_active_properties_canonical
    IF v_continue THEN
      v_step_id := public._pipeline_start_step(v_run_id, 'refresh_active_properties_canonical', 8);
      BEGIN
        PERFORM public.refresh_active_properties_canonical();
        SELECT reltuples::bigint INTO v_matview_estimated_count
        FROM pg_class
        WHERE oid = 'public.active_properties_canonical_mat'::regclass;
        PERFORM public._pipeline_finish_step(
          v_step_id,
          'success',
          NULL,
          NULL,
          jsonb_build_object('estimated_row_count', v_matview_estimated_count)
        );
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
        PERFORM public._pipeline_finish_step(v_step_id, 'failed', v_sqlstate, public._pipeline_clean_error(SQLERRM));
        RAISE WARNING 'sync_daily_pipeline: refresh_active_properties_canonical failed: %', SQLERRM;
        v_continue := false;
      END;
    ELSE
      PERFORM public._pipeline_skip_step(v_run_id, 'refresh_active_properties_canonical', 8);
    END IF;

    -- Step 9/9: purge_listing_score_history
    IF v_continue THEN
      v_step_id := public._pipeline_start_step(v_run_id, 'purge_listing_score_history', 9);
      BEGIN
        SELECT public.purge_listing_score_history() INTO v_purged_count;
        PERFORM public._pipeline_finish_step(
          v_step_id,
          'success',
          NULL,
          NULL,
          jsonb_build_object('deleted_count', v_purged_count)
        );
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
        PERFORM public._pipeline_finish_step(v_step_id, 'failed', v_sqlstate, public._pipeline_clean_error(SQLERRM));
        RAISE WARNING 'sync_daily_pipeline: purge_listing_score_history failed: %', SQLERRM;
        v_continue := false;
      END;
    ELSE
      PERFORM public._pipeline_skip_step(v_run_id, 'purge_listing_score_history', 9);
    END IF;

    PERFORM public._pipeline_finish_run(v_run_id, CASE WHEN v_continue THEN 'success' ELSE 'failed' END);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
    RAISE WARNING 'sync_daily_pipeline unexpected instrumentation failure: %', SQLERRM;

    -- All writes from the failed inner block have been rolled back. Record one
    -- durable synthetic step against the run created outside that block.
    BEGIN
      v_step_id := public._pipeline_start_step(v_run_id, '_pipeline_internal_error', 10);
      PERFORM public._pipeline_finish_step(
        v_step_id,
        'failed',
        v_sqlstate,
        public._pipeline_clean_error(SQLERRM)
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'sync_daily_pipeline could not persist internal failure step: %', SQLERRM;
    END;

    BEGIN
      PERFORM public._pipeline_finish_run(v_run_id, 'failed');
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'sync_daily_pipeline could not finish failed run: %', SQLERRM;
    END;
  END;
END;
$$;

-- =============================================================================
-- 2. Scraper callback: market -> scores -> matview, with durable fallback.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.notify_scan_complete()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run_id uuid;
  v_step_id uuid;
  v_sqlstate text;
  v_error_count integer := 0;
  v_matview_estimated_count bigint;
BEGIN
  IF NOT pg_try_advisory_xact_lock(public._pipeline_lock_key()) THEN
    PERFORM public._pipeline_skipped_run('scraper_callback', 'pipeline_already_running');
    RETURN;
  END IF;

  -- Created outside the fallback subtransaction for the same durability reason
  -- documented on sync_daily_pipeline().
  v_run_id := public._pipeline_start_run('scraper_callback');

  BEGIN
    -- Step 1/3: market reference.
    v_step_id := public._pipeline_start_step(v_run_id, 'refresh_market_reference', 1);
    BEGIN
      PERFORM public.refresh_market_reference();
      PERFORM public._pipeline_finish_step(v_step_id, 'success');
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
      PERFORM public._pipeline_finish_step(v_step_id, 'failed', v_sqlstate, public._pipeline_clean_error(SQLERRM));
      RAISE WARNING 'notify_scan_complete refresh_market_reference failed: %', SQLERRM;
      v_error_count := v_error_count + 1;
    END;

    -- Step 2/3: scores must be current before the score-dependent matview refresh.
    v_step_id := public._pipeline_start_step(v_run_id, 'compute_listing_scores', 2);
    BEGIN
      PERFORM public.compute_listing_scores();
      PERFORM public._pipeline_finish_step(v_step_id, 'success');
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
      PERFORM public._pipeline_finish_step(v_step_id, 'failed', v_sqlstate, public._pipeline_clean_error(SQLERRM));
      RAISE WARNING 'notify_scan_complete compute_listing_scores failed: %', SQLERRM;
      v_error_count := v_error_count + 1;
    END;

    -- Step 3/3: materialized view, including the scores computed by step 2 when
    -- that step succeeded. The callback remains independent: this still runs if
    -- an earlier step failed, and the run is then marked partial.
    v_step_id := public._pipeline_start_step(v_run_id, 'refresh_active_properties_canonical', 3);
    BEGIN
      PERFORM public.refresh_active_properties_canonical();
      SELECT reltuples::bigint INTO v_matview_estimated_count
      FROM pg_class
      WHERE oid = 'public.active_properties_canonical_mat'::regclass;
      PERFORM public._pipeline_finish_step(
        v_step_id,
        'success',
        NULL,
        NULL,
        jsonb_build_object('estimated_row_count', v_matview_estimated_count)
      );
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
      PERFORM public._pipeline_finish_step(v_step_id, 'failed', v_sqlstate, public._pipeline_clean_error(SQLERRM));
      RAISE WARNING 'notify_scan_complete refresh_active_properties_canonical failed: %', SQLERRM;
      v_error_count := v_error_count + 1;
    END;

    PERFORM public._pipeline_finish_run(
      v_run_id,
      CASE WHEN v_error_count > 0 THEN 'partial' ELSE 'success' END
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
    RAISE WARNING 'notify_scan_complete unexpected instrumentation failure: %', SQLERRM;

    BEGIN
      v_step_id := public._pipeline_start_step(v_run_id, '_pipeline_internal_error', 4);
      PERFORM public._pipeline_finish_step(
        v_step_id,
        'failed',
        v_sqlstate,
        public._pipeline_clean_error(SQLERRM)
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_scan_complete could not persist internal failure step: %', SQLERRM;
    END;

    BEGIN
      PERFORM public._pipeline_finish_run(v_run_id, 'failed');
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_scan_complete could not finish failed run: %', SQLERRM;
    END;
  END;
END;
$$;

-- =============================================================================
-- 3. Admin health: cron and callback are independent health axes.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_pipeline_health()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_daily_threshold_seconds integer := 97200; -- 27 hours.
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only agency admins can read full pipeline health details'
      USING ERRCODE = '42501';
  END IF;

  WITH last_daily_run AS (
    SELECT id, source, status, started_at, finished_at, error_count, metadata
    FROM public.pipeline_runs
    WHERE source = 'cron'
    ORDER BY started_at DESC
    LIMIT 1
  ),
  last_daily_success AS (
    SELECT id, finished_at
    FROM public.pipeline_runs
    WHERE source = 'cron' AND status = 'success'
    ORDER BY finished_at DESC
    LIMIT 1
  ),
  last_callback_run AS (
    SELECT id, source, status, started_at, finished_at, error_count, metadata
    FROM public.pipeline_runs
    WHERE source = 'scraper_callback'
    ORDER BY started_at DESC
    LIMIT 1
  ),
  last_callback_success AS (
    SELECT id, finished_at
    FROM public.pipeline_runs
    WHERE source = 'scraper_callback' AND status = 'success'
    ORDER BY finished_at DESC
    LIMIT 1
  ),
  daily_raw AS (
    SELECT
      (SELECT status FROM last_daily_run) AS last_status,
      (SELECT coalesce(finished_at, started_at) FROM last_daily_run) AS last_run_at,
      (SELECT finished_at FROM last_daily_success) AS last_success_at
  ),
  daily_state AS (
    SELECT
      last_status,
      last_run_at,
      last_success_at,
      CASE
        WHEN last_success_at IS NULL THEN NULL
        ELSE extract(epoch FROM (now() - last_success_at))::bigint
      END AS age_seconds,
      CASE
        WHEN last_status IS NULL THEN 'unknown'
        WHEN last_status = 'failed' THEN 'failed'
        WHEN last_status = 'partial' THEN 'attention'
        WHEN last_status = 'skipped'
          AND (last_success_at IS NULL OR last_success_at < now() - make_interval(secs => v_daily_threshold_seconds))
          THEN 'attention'
        WHEN last_status = 'skipped' THEN 'skipped'
        WHEN last_success_at IS NULL
          OR last_success_at < now() - make_interval(secs => v_daily_threshold_seconds)
          THEN 'attention'
        ELSE 'success'
      END AS health_status
    FROM daily_raw
  ),
  callback_state AS (
    SELECT
      coalesce((SELECT status FROM last_callback_run), 'unknown') AS health_status,
      (SELECT coalesce(finished_at, started_at) FROM last_callback_run) AS last_run_at,
      (SELECT finished_at FROM last_callback_success) AS last_success_at,
      CASE
        WHEN (SELECT finished_at FROM last_callback_success) IS NULL THEN NULL
        ELSE extract(epoch FROM (now() - (SELECT finished_at FROM last_callback_success)))::bigint
      END AS age_seconds
  ),
  last_failed_step AS (
    SELECT
      r.source,
      s.run_id,
      s.step_name,
      s.sqlstate,
      s.error_message,
      s.finished_at
    FROM public.pipeline_run_steps s
    JOIN public.pipeline_runs r ON r.id = s.run_id
    WHERE s.status = 'failed'
    ORDER BY s.finished_at DESC
    LIMIT 1
  ),
  matview_last_refresh AS (
    SELECT max(s.finished_at) AS refreshed_at
    FROM public.pipeline_run_steps s
    WHERE s.step_name = 'refresh_active_properties_canonical'
      AND s.status = 'success'
  ),
  data_freshness AS (
    SELECT
      (SELECT max(last_seen_at) FROM public.listings WHERE status = 'active') AS listings_last_seen_at,
      (SELECT max(computed_at) FROM public.listing_scores) AS scores_last_computed_at,
      (SELECT max(detected_at) FROM public.listing_signals WHERE is_active = true) AS signals_last_detected_at,
      (SELECT refreshed_at FROM matview_last_refresh) AS matview_last_refreshed_at,
      (SELECT max(last_seen_at) FROM public.active_properties_canonical_mat) AS matview_content_last_seen_at
  ),
  scrape_runs_signal AS (
    SELECT public._pipeline_scrape_runs_signal() AS value
  )
  SELECT jsonb_build_object(
    'global_status', CASE
      WHEN (SELECT health_status FROM daily_state) = 'failed' THEN 'failed'
      WHEN (SELECT health_status FROM daily_state) IN ('unknown', 'attention', 'skipped') THEN 'attention'
      WHEN (SELECT health_status FROM callback_state) IN ('failed', 'partial') THEN 'attention'
      ELSE 'ok'
    END,
    'daily_pipeline_status', (SELECT health_status FROM daily_state),
    'daily_pipeline_last_run_at', (SELECT last_run_at FROM daily_state),
    'daily_pipeline_last_success_at', (SELECT last_success_at FROM daily_state),
    'daily_pipeline_age_seconds', (SELECT age_seconds FROM daily_state),
    'daily_pipeline_error_count', (SELECT error_count FROM last_daily_run),
    'daily_pipeline_metadata', (SELECT metadata FROM last_daily_run),
    'scraper_callback_status', (SELECT health_status FROM callback_state),
    'scraper_callback_last_run_at', (SELECT last_run_at FROM callback_state),
    'scraper_callback_last_success_at', (SELECT last_success_at FROM callback_state),
    'scraper_callback_age_seconds', (SELECT age_seconds FROM callback_state),
    'scraper_callback_freshness_status', 'not_configured',
    'scraper_callback_error_count', (SELECT error_count FROM last_callback_run),
    'scraper_callback_metadata', (SELECT metadata FROM last_callback_run),
    'listings_freshness', jsonb_build_object(
      'last_updated_at', (SELECT listings_last_seen_at FROM data_freshness),
      'age_seconds', (SELECT extract(epoch FROM (now() - listings_last_seen_at))::bigint FROM data_freshness),
      'status', CASE WHEN (SELECT listings_last_seen_at FROM data_freshness) IS NULL THEN 'unknown' ELSE 'not_configured' END
    ),
    'scores_freshness', jsonb_build_object(
      'last_updated_at', (SELECT scores_last_computed_at FROM data_freshness),
      'age_seconds', (SELECT extract(epoch FROM (now() - scores_last_computed_at))::bigint FROM data_freshness),
      'status', CASE WHEN (SELECT scores_last_computed_at FROM data_freshness) IS NULL THEN 'unknown' ELSE 'not_configured' END
    ),
    'signals_freshness', jsonb_build_object(
      'last_updated_at', (SELECT signals_last_detected_at FROM data_freshness),
      'age_seconds', (SELECT extract(epoch FROM (now() - signals_last_detected_at))::bigint FROM data_freshness),
      'status', CASE WHEN (SELECT signals_last_detected_at FROM data_freshness) IS NULL THEN 'unknown' ELSE 'not_configured' END
    ),
    'matview_freshness', jsonb_build_object(
      'last_refreshed_at', (SELECT matview_last_refreshed_at FROM data_freshness),
      'age_seconds', (SELECT extract(epoch FROM (now() - matview_last_refreshed_at))::bigint FROM data_freshness),
      'content_last_seen_at', (SELECT matview_content_last_seen_at FROM data_freshness),
      'status', CASE WHEN (SELECT matview_last_refreshed_at FROM data_freshness) IS NULL THEN 'unknown' ELSE 'not_configured' END
    ),
    'last_failed_step', (SELECT to_jsonb(last_failed_step) FROM last_failed_step),
    'scraper_source', (SELECT value FROM scrape_runs_signal),
    'daily_pipeline_freshness_threshold_seconds', v_daily_threshold_seconds
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- =============================================================================
-- 4. Agent-safe health: same axes, no technical/error details.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_pipeline_health_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_daily_threshold_seconds integer := 97200; -- 27 hours.
BEGIN
  WITH last_daily_run AS (
    SELECT status, started_at, finished_at
    FROM public.pipeline_runs
    WHERE source = 'cron'
    ORDER BY started_at DESC
    LIMIT 1
  ),
  last_daily_success AS (
    SELECT finished_at
    FROM public.pipeline_runs
    WHERE source = 'cron' AND status = 'success'
    ORDER BY finished_at DESC
    LIMIT 1
  ),
  last_callback_run AS (
    SELECT status, started_at, finished_at
    FROM public.pipeline_runs
    WHERE source = 'scraper_callback'
    ORDER BY started_at DESC
    LIMIT 1
  ),
  last_callback_success AS (
    SELECT finished_at
    FROM public.pipeline_runs
    WHERE source = 'scraper_callback' AND status = 'success'
    ORDER BY finished_at DESC
    LIMIT 1
  ),
  daily_raw AS (
    SELECT
      (SELECT status FROM last_daily_run) AS last_status,
      (SELECT coalesce(finished_at, started_at) FROM last_daily_run) AS last_run_at,
      (SELECT finished_at FROM last_daily_success) AS last_success_at
  ),
  daily_state AS (
    SELECT
      last_run_at,
      last_success_at,
      CASE
        WHEN last_success_at IS NULL THEN NULL
        ELSE extract(epoch FROM (now() - last_success_at))::bigint
      END AS age_seconds,
      CASE
        WHEN last_status IS NULL THEN 'unknown'
        WHEN last_status = 'failed' THEN 'failed'
        WHEN last_status = 'partial' THEN 'attention'
        WHEN last_status = 'skipped'
          AND (last_success_at IS NULL OR last_success_at < now() - make_interval(secs => v_daily_threshold_seconds))
          THEN 'attention'
        WHEN last_status = 'skipped' THEN 'skipped'
        WHEN last_success_at IS NULL
          OR last_success_at < now() - make_interval(secs => v_daily_threshold_seconds)
          THEN 'attention'
        ELSE 'success'
      END AS health_status
    FROM daily_raw
  ),
  callback_state AS (
    SELECT
      coalesce((SELECT status FROM last_callback_run), 'unknown') AS health_status,
      (SELECT coalesce(finished_at, started_at) FROM last_callback_run) AS last_run_at,
      (SELECT finished_at FROM last_callback_success) AS last_success_at,
      CASE
        WHEN (SELECT finished_at FROM last_callback_success) IS NULL THEN NULL
        ELSE extract(epoch FROM (now() - (SELECT finished_at FROM last_callback_success)))::bigint
      END AS age_seconds
  ),
  matview_last_refresh AS (
    SELECT max(s.finished_at) AS refreshed_at
    FROM public.pipeline_run_steps s
    WHERE s.step_name = 'refresh_active_properties_canonical'
      AND s.status = 'success'
  ),
  data_freshness AS (
    SELECT
      (SELECT max(last_seen_at) FROM public.listings WHERE status = 'active') AS listings_last_seen_at,
      (SELECT max(computed_at) FROM public.listing_scores) AS scores_last_computed_at,
      (SELECT max(detected_at) FROM public.listing_signals WHERE is_active = true) AS signals_last_detected_at,
      (SELECT refreshed_at FROM matview_last_refresh) AS matview_last_refreshed_at,
      (SELECT max(last_seen_at) FROM public.active_properties_canonical_mat) AS matview_content_last_seen_at
  )
  SELECT jsonb_build_object(
    'global_status', CASE
      WHEN (SELECT health_status FROM daily_state) = 'failed' THEN 'failed'
      WHEN (SELECT health_status FROM daily_state) IN ('unknown', 'attention', 'skipped') THEN 'attention'
      WHEN (SELECT health_status FROM callback_state) IN ('failed', 'partial') THEN 'attention'
      ELSE 'ok'
    END,
    'daily_pipeline_status', (SELECT health_status FROM daily_state),
    'daily_pipeline_last_run_at', (SELECT last_run_at FROM daily_state),
    'daily_pipeline_last_success_at', (SELECT last_success_at FROM daily_state),
    'daily_pipeline_age_seconds', (SELECT age_seconds FROM daily_state),
    'scraper_callback_status', (SELECT health_status FROM callback_state),
    'scraper_callback_last_run_at', (SELECT last_run_at FROM callback_state),
    'scraper_callback_last_success_at', (SELECT last_success_at FROM callback_state),
    'scraper_callback_age_seconds', (SELECT age_seconds FROM callback_state),
    'scraper_callback_freshness_status', 'not_configured',
    'listings_freshness', jsonb_build_object(
      'last_updated_at', (SELECT listings_last_seen_at FROM data_freshness),
      'age_seconds', (SELECT extract(epoch FROM (now() - listings_last_seen_at))::bigint FROM data_freshness),
      'status', CASE WHEN (SELECT listings_last_seen_at FROM data_freshness) IS NULL THEN 'unknown' ELSE 'not_configured' END
    ),
    'scores_freshness', jsonb_build_object(
      'last_updated_at', (SELECT scores_last_computed_at FROM data_freshness),
      'age_seconds', (SELECT extract(epoch FROM (now() - scores_last_computed_at))::bigint FROM data_freshness),
      'status', CASE WHEN (SELECT scores_last_computed_at FROM data_freshness) IS NULL THEN 'unknown' ELSE 'not_configured' END
    ),
    'signals_freshness', jsonb_build_object(
      'last_updated_at', (SELECT signals_last_detected_at FROM data_freshness),
      'age_seconds', (SELECT extract(epoch FROM (now() - signals_last_detected_at))::bigint FROM data_freshness),
      'status', CASE WHEN (SELECT signals_last_detected_at FROM data_freshness) IS NULL THEN 'unknown' ELSE 'not_configured' END
    ),
    'matview_freshness', jsonb_build_object(
      'last_refreshed_at', (SELECT matview_last_refreshed_at FROM data_freshness),
      'age_seconds', (SELECT extract(epoch FROM (now() - matview_last_refreshed_at))::bigint FROM data_freshness),
      'content_last_seen_at', (SELECT matview_content_last_seen_at FROM data_freshness),
      'status', CASE WHEN (SELECT matview_last_refreshed_at FROM data_freshness) IS NULL THEN 'unknown' ELSE 'not_configured' END
    ),
    'daily_pipeline_freshness_threshold_seconds', v_daily_threshold_seconds
  ) INTO v_result;

  RETURN v_result;
END;
$$;
