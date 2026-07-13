-- F-009/F-010 timing correction.
--
-- PostgreSQL now()/transaction_timestamp() is fixed at transaction start. The
-- daily pipeline runs inside one transaction, so using now() for both ends of
-- an operation records artificial zero durations. These helpers use the wall
-- clock instead. Each finish helper captures it once and reuses that exact
-- value for the persisted timestamp and duration calculation.

CREATE OR REPLACE FUNCTION public._pipeline_start_run(
  p_source text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run_id uuid;
  v_started_at timestamptz := clock_timestamp();
BEGIN
  INSERT INTO public.pipeline_runs (source, status, started_at, initiated_by, metadata)
  VALUES (p_source, 'running', v_started_at, current_user, COALESCE(p_metadata, '{}'::jsonb))
  RETURNING id INTO v_run_id;

  RETURN v_run_id;
END;
$$;

CREATE OR REPLACE FUNCTION public._pipeline_skipped_run(p_source text, p_reason text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run_id uuid;
  v_timestamp timestamptz := clock_timestamp();
BEGIN
  INSERT INTO public.pipeline_runs (
    source,
    status,
    started_at,
    finished_at,
    error_count,
    initiated_by,
    metadata
  )
  VALUES (
    p_source,
    'skipped',
    v_timestamp,
    v_timestamp,
    0,
    current_user,
    jsonb_build_object('reason', p_reason)
  )
  RETURNING id INTO v_run_id;

  RETURN v_run_id;
END;
$$;

CREATE OR REPLACE FUNCTION public._pipeline_start_step(
  p_run_id uuid,
  p_step_name text,
  p_step_order integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_step_id uuid;
  v_started_at timestamptz := clock_timestamp();
BEGIN
  INSERT INTO public.pipeline_run_steps (
    run_id,
    step_name,
    step_order,
    status,
    started_at
  )
  VALUES (p_run_id, p_step_name, p_step_order, 'running', v_started_at)
  RETURNING id INTO v_step_id;

  RETURN v_step_id;
END;
$$;

CREATE OR REPLACE FUNCTION public._pipeline_finish_step(
  p_step_id uuid,
  p_status text,
  p_sqlstate text DEFAULT NULL,
  p_error_message text DEFAULT NULL,
  p_row_counts jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_finished_at timestamptz;
BEGIN
  v_finished_at := clock_timestamp();

  UPDATE public.pipeline_run_steps
  SET status = p_status,
      finished_at = v_finished_at,
      duration_ms = GREATEST(
        0,
        ROUND(EXTRACT(EPOCH FROM (v_finished_at - started_at)) * 1000)
      )::integer,
      sqlstate = p_sqlstate,
      error_message = p_error_message,
      row_counts = p_row_counts
  WHERE id = p_step_id;
END;
$$;

CREATE OR REPLACE FUNCTION public._pipeline_skip_step(
  p_run_id uuid,
  p_step_name text,
  p_step_order integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_timestamp timestamptz := clock_timestamp();
BEGIN
  INSERT INTO public.pipeline_run_steps (
    run_id,
    step_name,
    step_order,
    status,
    started_at,
    finished_at,
    duration_ms
  )
  VALUES (
    p_run_id,
    p_step_name,
    p_step_order,
    'skipped',
    v_timestamp,
    v_timestamp,
    0
  );
END;
$$;

CREATE OR REPLACE FUNCTION public._pipeline_finish_run(p_run_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_error_count integer;
  v_finished_at timestamptz;
BEGIN
  SELECT count(*) INTO v_error_count
  FROM public.pipeline_run_steps
  WHERE run_id = p_run_id AND status = 'failed';

  v_finished_at := clock_timestamp();

  UPDATE public.pipeline_runs
  SET status = p_status,
      finished_at = v_finished_at,
      error_count = v_error_count
  WHERE id = p_run_id;
END;
$$;
