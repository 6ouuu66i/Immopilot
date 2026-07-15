-- F-023: admin-only system health monitoring.
--
-- Freshness thresholds and the ingestion switch live in one internal row so
-- the frontend never invents operational policy. Ingestion is intentionally
-- disabled in Pre-Alpha. A disabled ingestion source is neutral for global
-- health; pipeline, score, signal, market-reference, and matview health remain
-- independently enforced.

CREATE TABLE public.system_health_config (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  ingestion_enabled boolean NOT NULL DEFAULT false,
  pipeline_stale_after interval NOT NULL DEFAULT interval '27 hours' CHECK (pipeline_stale_after > interval '0 seconds'),
  listings_stale_after interval NOT NULL DEFAULT interval '24 hours' CHECK (listings_stale_after > interval '0 seconds'),
  scores_stale_after interval NOT NULL DEFAULT interval '27 hours' CHECK (scores_stale_after > interval '0 seconds'),
  signals_stale_after interval NOT NULL DEFAULT interval '27 hours' CHECK (signals_stale_after > interval '0 seconds'),
  market_reference_stale_after interval NOT NULL DEFAULT interval '27 hours' CHECK (market_reference_stale_after > interval '0 seconds'),
  matview_stale_after interval NOT NULL DEFAULT interval '27 hours' CHECK (matview_stale_after > interval '0 seconds'),
  history_limit integer NOT NULL DEFAULT 10 CHECK (history_limit BETWEEN 1 AND 10),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.system_health_config IS
  'F-023 internal singleton: system-health thresholds and intentional ingestion state. Read only through get_system_health().';
COMMENT ON COLUMN public.system_health_config.ingestion_enabled IS
  'False means intentional disabled state, never a failure.';
COMMENT ON COLUMN public.system_health_config.pipeline_stale_after IS
  'Daily pipeline is stale after 27 hours, allowing three hours of scheduling tolerance.';
COMMENT ON COLUMN public.system_health_config.listings_stale_after IS
  'Listings are stale after 24 hours while ingestion is enabled; neutral while disabled.';
COMMENT ON COLUMN public.system_health_config.scores_stale_after IS
  'Scores are stale after 27 hours.';
COMMENT ON COLUMN public.system_health_config.signals_stale_after IS
  'Signals are stale after 27 hours.';
COMMENT ON COLUMN public.system_health_config.market_reference_stale_after IS
  'Market reference is stale after 27 hours.';
COMMENT ON COLUMN public.system_health_config.matview_stale_after IS
  'Canonical materialized view is stale after 27 hours.';

INSERT INTO public.system_health_config (singleton, ingestion_enabled)
VALUES (true, false);

ALTER TABLE public.system_health_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.system_health_config FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_system_health()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_config public.system_health_config%ROWTYPE;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    WHERE profile.id = auth.uid()
      AND profile.is_active = true
      AND profile.agency_id IS NOT NULL
      AND profile.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Active agency administrator required' USING ERRCODE = '42501';
  END IF;

  SELECT config.*
  INTO STRICT v_config
  FROM public.system_health_config AS config
  WHERE config.singleton = true;

  WITH last_pipeline AS (
    SELECT run.id, run.status, run.started_at, run.finished_at, run.error_count
    FROM public.pipeline_runs AS run
    WHERE run.source = 'cron'
    ORDER BY run.started_at DESC
    LIMIT 1
  ),
  last_pipeline_success AS (
    SELECT run.finished_at
    FROM public.pipeline_runs AS run
    WHERE run.source = 'cron' AND run.status = 'success'
    ORDER BY run.finished_at DESC
    LIMIT 1
  ),
  last_callback AS (
    SELECT run.status, run.started_at, run.finished_at
    FROM public.pipeline_runs AS run
    WHERE run.source = 'scraper_callback'
    ORDER BY run.started_at DESC
    LIMIT 1
  ),
  last_callback_success AS (
    SELECT run.finished_at
    FROM public.pipeline_runs AS run
    WHERE run.source = 'scraper_callback' AND run.status = 'success'
    ORDER BY run.finished_at DESC
    LIMIT 1
  ),
  pipeline_steps AS (
    SELECT
      count(*)::integer AS total_count,
      count(*) FILTER (WHERE step.status = 'success')::integer AS success_count
    FROM public.pipeline_run_steps AS step
    WHERE step.run_id = (SELECT id FROM last_pipeline)
  ),
  last_pipeline_error AS (
    SELECT step.step_name, public._pipeline_clean_error(step.error_message) AS error_message
    FROM public.pipeline_run_steps AS step
    WHERE step.run_id = (SELECT id FROM last_pipeline)
      AND step.status = 'failed'
    ORDER BY step.step_order
    LIMIT 1
  ),
  freshness AS (
    SELECT
      (SELECT max(listing.last_seen_at) FROM public.listings AS listing WHERE listing.status = 'active') AS listings_at,
      (SELECT max(score.computed_at) FROM public.listing_scores AS score) AS scores_at,
      (SELECT max(signal.detected_at) FROM public.listing_signals AS signal WHERE signal.is_active = true) AS signals_at,
      (SELECT max(reference.computed_at) FROM public.market_reference AS reference) AS market_reference_at,
      (
        SELECT max(step.finished_at)
        FROM public.pipeline_run_steps AS step
        WHERE step.step_name = 'refresh_active_properties_canonical'
          AND step.status = 'success'
      ) AS matview_at
  ),
  cron_job AS (
    SELECT job.active, job.schedule
    FROM cron.job AS job
    WHERE job.jobname = 'sync-daily-pipeline'
    LIMIT 1
  ),
  raw AS (
    SELECT
      (SELECT id FROM last_pipeline) AS pipeline_id,
      (SELECT status FROM last_pipeline) AS pipeline_raw_status,
      (SELECT started_at FROM last_pipeline) AS pipeline_started_at,
      (SELECT finished_at FROM last_pipeline) AS pipeline_finished_at,
      (SELECT error_count FROM last_pipeline) AS pipeline_error_count,
      (SELECT finished_at FROM last_pipeline_success) AS pipeline_success_at,
      (SELECT total_count FROM pipeline_steps) AS pipeline_step_count,
      (SELECT success_count FROM pipeline_steps) AS pipeline_success_step_count,
      (SELECT step_name FROM last_pipeline_error) AS failed_step,
      (SELECT error_message FROM last_pipeline_error) AS clean_error,
      (SELECT status FROM last_callback) AS callback_raw_status,
      (SELECT coalesce(finished_at, started_at) FROM last_callback) AS callback_at,
      (SELECT finished_at FROM last_callback_success) AS callback_success_at,
      freshness.listings_at,
      freshness.scores_at,
      freshness.signals_at,
      freshness.market_reference_at,
      freshness.matview_at,
      coalesce((SELECT active FROM cron_job), false) AS cron_active,
      (SELECT schedule FROM cron_job) AS cron_schedule
    FROM freshness
  ),
  states AS (
    SELECT raw.*,
      CASE
        WHEN raw.pipeline_id IS NULL THEN 'unknown'
        WHEN raw.pipeline_raw_status = 'running' THEN 'running'
        WHEN raw.pipeline_raw_status IN ('failed', 'partial') THEN 'failed'
        WHEN raw.pipeline_success_at IS NULL THEN 'unknown'
        WHEN raw.pipeline_success_at < now() - v_config.pipeline_stale_after THEN 'stale'
        ELSE 'healthy'
      END AS pipeline_status,
      CASE WHEN raw.listings_at IS NULL THEN 'unknown'
        WHEN raw.listings_at < now() - v_config.listings_stale_after THEN 'stale'
        ELSE 'healthy' END AS listings_status_raw,
      CASE WHEN raw.scores_at IS NULL THEN 'unknown'
        WHEN raw.scores_at < now() - v_config.scores_stale_after THEN 'stale'
        ELSE 'healthy' END AS scores_status,
      CASE WHEN raw.signals_at IS NULL THEN 'unknown'
        WHEN raw.signals_at < now() - v_config.signals_stale_after THEN 'stale'
        ELSE 'healthy' END AS signals_status,
      CASE WHEN raw.market_reference_at IS NULL THEN 'unknown'
        WHEN raw.market_reference_at < now() - v_config.market_reference_stale_after THEN 'stale'
        ELSE 'healthy' END AS market_reference_status,
      CASE WHEN raw.matview_at IS NULL THEN 'unknown'
        WHEN raw.matview_at < now() - v_config.matview_stale_after THEN 'stale'
        ELSE 'healthy' END AS matview_status
    FROM raw
  ),
  resolved AS (
    SELECT states.*,
      CASE WHEN v_config.ingestion_enabled THEN states.listings_status_raw ELSE 'disabled' END AS listings_status,
      CASE
        WHEN NOT v_config.ingestion_enabled THEN 'disabled'
        WHEN states.callback_raw_status IS NULL THEN 'unknown'
        WHEN states.callback_raw_status = 'running' THEN 'running'
        WHEN states.callback_raw_status IN ('failed', 'partial') THEN 'failed'
        WHEN states.listings_status_raw = 'stale' THEN 'stale'
        ELSE states.listings_status_raw
      END AS ingestion_status,
      CASE WHEN states.cron_active THEN 'healthy' ELSE 'disabled' END AS cron_status,
      CASE
        WHEN states.cron_schedule = '0 3 * * *' AND states.cron_active THEN
          (
            CASE
              WHEN date_trunc('day', now() AT TIME ZONE 'UTC') + interval '3 hours' > now() AT TIME ZONE 'UTC'
                THEN date_trunc('day', now() AT TIME ZONE 'UTC') + interval '3 hours'
              ELSE date_trunc('day', now() AT TIME ZONE 'UTC') + interval '1 day 3 hours'
            END
          ) AT TIME ZONE 'UTC'
        ELSE NULL
      END AS next_run_at
    FROM states
  ),
  final_state AS (
    SELECT resolved.*,
      CASE
        WHEN resolved.pipeline_status = 'failed'
          OR resolved.ingestion_status = 'failed'
          OR resolved.cron_status = 'disabled' THEN 'failed'
        WHEN resolved.pipeline_status = 'running'
          OR resolved.ingestion_status = 'running' THEN 'running'
        WHEN resolved.pipeline_status = 'stale'
          OR resolved.scores_status = 'stale'
          OR resolved.signals_status = 'stale'
          OR resolved.market_reference_status = 'stale'
          OR resolved.matview_status = 'stale'
          OR (v_config.ingestion_enabled AND resolved.listings_status = 'stale') THEN 'stale'
        WHEN resolved.pipeline_status = 'unknown'
          OR resolved.scores_status = 'unknown'
          OR resolved.signals_status = 'unknown'
          OR resolved.market_reference_status = 'unknown'
          OR resolved.matview_status = 'unknown'
          OR (v_config.ingestion_enabled AND resolved.ingestion_status = 'unknown') THEN 'unknown'
        ELSE 'healthy'
      END AS global_status
    FROM resolved
  ),
  recent_history AS (
    SELECT coalesce(jsonb_agg(history.item ORDER BY history.started_at DESC), '[]'::jsonb) AS items
    FROM (
      SELECT run.started_at,
        jsonb_build_object(
          'id', run.id,
          'source', run.source,
          'status', run.status,
          'started_at', run.started_at,
          'finished_at', run.finished_at,
          'duration_ms', CASE WHEN run.finished_at IS NULL THEN NULL
            ELSE greatest(0, round(extract(epoch FROM (run.finished_at - run.started_at)) * 1000))::bigint END,
          'successful_steps', (SELECT count(*) FROM public.pipeline_run_steps AS step WHERE step.run_id = run.id AND step.status = 'success'),
          'total_steps', (SELECT count(*) FROM public.pipeline_run_steps AS step WHERE step.run_id = run.id)
        ) AS item
      FROM public.pipeline_runs AS run
      ORDER BY run.started_at DESC
      LIMIT least(v_config.history_limit, 10)
    ) AS history
  )
  SELECT jsonb_build_object(
    'checked_at', clock_timestamp(),
    'global_status', final_state.global_status,
    'action_required', CASE final_state.global_status
      WHEN 'failed' THEN 'inspect_failed_pipeline'
      WHEN 'stale' THEN 'inspect_stale_data'
      WHEN 'unknown' THEN 'verify_monitoring_configuration'
      ELSE NULL
    END,
    'pipeline', jsonb_build_object(
      'status', final_state.pipeline_status,
      'last_attempt', CASE WHEN final_state.pipeline_id IS NULL THEN NULL ELSE jsonb_build_object(
        'id', final_state.pipeline_id,
        'status', final_state.pipeline_raw_status,
        'started_at', final_state.pipeline_started_at,
        'finished_at', final_state.pipeline_finished_at,
        'duration_ms', CASE WHEN final_state.pipeline_finished_at IS NULL THEN NULL
          ELSE greatest(0, round(extract(epoch FROM (final_state.pipeline_finished_at - final_state.pipeline_started_at)) * 1000))::bigint END,
        'successful_steps', coalesce(final_state.pipeline_success_step_count, 0),
        'total_steps', coalesce(final_state.pipeline_step_count, 0),
        'failed_step', final_state.failed_step,
        'error_message', final_state.clean_error,
        'error_count', coalesce(final_state.pipeline_error_count, 0)
      ) END,
      'last_success_at', final_state.pipeline_success_at,
      'age_seconds', CASE WHEN final_state.pipeline_success_at IS NULL THEN NULL
        ELSE greatest(0, extract(epoch FROM (now() - final_state.pipeline_success_at))::bigint) END,
      'next_run_at', final_state.next_run_at
    ),
    'cron', jsonb_build_object(
      'status', final_state.cron_status,
      'active', final_state.cron_active,
      'schedule', final_state.cron_schedule,
      'next_run_at', final_state.next_run_at
    ),
    'ingestion', jsonb_build_object(
      'enabled', v_config.ingestion_enabled,
      'status', final_state.ingestion_status,
      'last_callback_at', final_state.callback_at,
      'last_success_at', final_state.callback_success_at
    ),
    'freshness', jsonb_build_object(
      'listings', jsonb_build_object('status', final_state.listings_status, 'last_updated_at', final_state.listings_at,
        'age_seconds', CASE WHEN final_state.listings_at IS NULL THEN NULL ELSE greatest(0, extract(epoch FROM (now() - final_state.listings_at))::bigint) END),
      'scores', jsonb_build_object('status', final_state.scores_status, 'last_updated_at', final_state.scores_at,
        'age_seconds', CASE WHEN final_state.scores_at IS NULL THEN NULL ELSE greatest(0, extract(epoch FROM (now() - final_state.scores_at))::bigint) END),
      'signals', jsonb_build_object('status', final_state.signals_status, 'last_updated_at', final_state.signals_at,
        'age_seconds', CASE WHEN final_state.signals_at IS NULL THEN NULL ELSE greatest(0, extract(epoch FROM (now() - final_state.signals_at))::bigint) END),
      'market_reference', jsonb_build_object('status', final_state.market_reference_status, 'last_updated_at', final_state.market_reference_at,
        'age_seconds', CASE WHEN final_state.market_reference_at IS NULL THEN NULL ELSE greatest(0, extract(epoch FROM (now() - final_state.market_reference_at))::bigint) END),
      'canonical_matview', jsonb_build_object('status', final_state.matview_status, 'last_updated_at', final_state.matview_at,
        'age_seconds', CASE WHEN final_state.matview_at IS NULL THEN NULL ELSE greatest(0, extract(epoch FROM (now() - final_state.matview_at))::bigint) END)
    ),
    'thresholds_seconds', jsonb_build_object(
      'pipeline', extract(epoch FROM v_config.pipeline_stale_after)::bigint,
      'listings', extract(epoch FROM v_config.listings_stale_after)::bigint,
      'scores', extract(epoch FROM v_config.scores_stale_after)::bigint,
      'signals', extract(epoch FROM v_config.signals_stale_after)::bigint,
      'market_reference', extract(epoch FROM v_config.market_reference_stale_after)::bigint,
      'canonical_matview', extract(epoch FROM v_config.matview_stale_after)::bigint
    ),
    'history', recent_history.items
  )
  INTO v_result
  FROM final_state
  CROSS JOIN recent_history;

  RETURN v_result;
END;
$$;

ALTER FUNCTION public.get_system_health() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_system_health() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_system_health() TO authenticated;

NOTIFY pgrst, 'reload schema';
