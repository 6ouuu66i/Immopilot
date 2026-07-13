-- F-009 / F-010 remediation: pipeline observability + freshness signals.
--
-- NOT applied yet. Prepared for review only, per instruction not to call
-- apply_migration before explicit authorization. No migration in this file
-- touches profiles/transfer_requests/accept_invitation (F-001/F-002/F-003
-- remain untouched) and no scoring/signal business logic is modified: the
-- bodies of refresh_market_reference(), sync_overpriced_signal_batch(),
-- sync_stale_dom_relative_signal_batch(), sync_failed_launch_signal_batch(),
-- sync_competition_shock_signal_batch(), sync_agency_mandate_aging_signal(),
-- compute_listing_scores(), refresh_active_properties_canonical() and
-- purge_listing_score_history() are all called exactly as before; only the
-- two orchestrators (sync_daily_pipeline, notify_scan_complete) are
-- rewritten, to add bookkeeping around each existing PERFORM call.
--
-- Live-verified against ImmoPilot Pre-Alpha (read-only) before writing this
-- file: both orchestrators' deployed definitions match the last migration
-- that touched them (20260708165811); compute_listing_scores() reads
-- listings/listing_signals/scoring_config directly (not market_reference or
-- the matview), so it is not technically corrupted by a stale
-- refresh_market_reference() -- see the design-rationale comment above
-- sync_daily_pipeline() below for why a strict linear stop-on-first-failure
-- model was kept anyway.
--
-- IMPORTANT, re-verified against the live deployed function body before
-- writing this second revision: sync_daily_pipeline()'s CURRENT transactional
-- behavior is NOT "stop on first failure with prior steps' effects kept" --
-- it is true all-or-nothing. The whole 9-step sequence today lives inside
-- ONE PL/pgSQL BEGIN...EXCEPTION block (the function body itself), which
-- PL/pgSQL implements as a single implicit savepoint established at block
-- entry. If step 5 raises, Postgres rolls back TO THAT SAVEPOINT -- i.e. it
-- undoes steps 1-4's effects too (REFRESH MATERIALIZED VIEW and table
-- writes are ordinary transactional operations, fully subject to this
-- rollback), not just step 5's. Today, ANY failure anywhere reverts the
-- entire run's database effects back to the pre-run state, then logs one
-- RAISE WARNING (not rolled back, since NOTICE/WARNING protocol messages
-- are not database writes) and returns void normally.
--
-- The rewrite below gives each step its OWN separate nested
-- BEGIN...EXCEPTION block instead of one shared block for all 9. This is a
-- genuine, deliberate transactional semantics change, not just an
-- observability addition: a step's own nested block only rolls back to
-- ITS OWN savepoint (established right before that step's PERFORM), so a
-- later failure no longer undoes earlier steps' already-completed,
-- already-exited-normally effects. Concretely: old = all-or-nothing (one
-- failure anywhere -> zero net DB effect for the whole run); new = partial
-- persistence (steps before the failure keep their effects; the failing
-- step's own attempted writes are undone; steps after it never run at all,
-- recorded 'skipped').
--
-- Two options were considered explicitly rather than silently picking one:
--   1. Partial persistence (implemented below): steps before the failure
--      keep their effects, remaining steps are skipped and recorded as
--      such.
--   2. True all-or-nothing preserved: wrap all 9 PERFORM calls back in one
--      shared savepoint, matching today's behavior byte-for-byte.
-- Option 2 could not be implemented here without ALSO losing step-level
-- bookkeeping durability for the steps that did complete before the
-- failure: if the bookkeeping INSERT/UPDATE calls for steps 1..k-1 live
-- inside that same shared savepoint (the only way to keep them physically
-- next to the business PERFORM calls in plain PL/pgSQL), a rollback to that
-- savepoint on step k's failure would erase those bookkeeping rows too --
-- defeating the entire purpose of this migration. Achieving true
-- all-or-nothing for the business data WHILE independently preserving
-- step-level observability would require an autonomous-transaction
-- mechanism (dblink/pg_background) that adds a new extension dependency
-- and meaningful complexity for a bounded, self-healing benefit (see
-- below) -- judged disproportionate.
--
-- Dependency-based justification for choosing option 1 (partial
-- persistence): the live function body of compute_listing_scores() (read
-- in full during this review) queries public.listings/listing_signals/
-- scoring_config directly -- never market_reference, never the matview.
-- Since sync_daily_pipeline stops at the FIRST failure and never proceeds
-- past it, compute_listing_scores() can only ever run in one of two
-- states: (a) every one of steps 1-6 already fully succeeded this run, or
-- (b) it does not run at all this run (skipped). It can never see a
-- from-this-run partially-updated signal set. Consequently listing_scores/
-- listing_score_history -- the data agents actually see as "the score" --
-- can never become internally inconsistent under option 1: they are either
-- refreshed from a fully-consistent new signal set, or left exactly as the
-- last fully-consistent successful run produced them. The only exposure
-- from partial persistence is confined to market_reference and
-- listing_signals possibly reflecting an uneven mix of "refreshed this
-- run" and "still from the last successful run" family-by-family --
-- bounded, and self-correcting on the very next fully-successful run.
-- Weighed against option 2's cost of discarding a fully valid, expensive,
-- already-complete recomputation whenever a LATE, low-risk step fails
-- (e.g. step 9, purge_listing_score_history, is pure historical cleanup),
-- option 1 is the safer, more defensible default and is what is
-- implemented below. This is a deliberate, disclosed behavior change from
-- today's production semantics, not a silent one.

-- =============================================================================
-- 1. Schema: pipeline_runs / pipeline_run_steps
-- =============================================================================

CREATE TABLE public.pipeline_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('cron', 'scraper_callback', 'manual')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'partial', 'failed', 'skipped')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  error_count integer NOT NULL DEFAULT 0,
  -- Postgres role that executed the run (e.g. 'postgres' for pg_cron,
  -- 'service_role' if ever called directly by service_role). Never an
  -- auth.uid()/email -- there is no end-user identity behind these calls.
  initiated_by text,
  -- Technical metadata only (e.g. {"reason": "pipeline_already_running"}).
  -- Callers must never put tokens, URLs, keys, full payloads or PII here.
  -- Size-bounded defensively; this is not a substitute for code discipline.
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT pipeline_runs_finished_after_started CHECK (finished_at IS NULL OR finished_at >= started_at),
  CONSTRAINT pipeline_runs_metadata_bounded CHECK (pg_column_size(metadata) < 2000)
);

COMMENT ON TABLE public.pipeline_runs IS
  'F-009/F-010: one row per sync_daily_pipeline/notify_scan_complete invocation. Internal only -- no RLS policy is intentionally defined (see section 2); read via get_pipeline_health()/get_pipeline_health_summary().';

CREATE INDEX idx_pipeline_runs_started_at_desc ON public.pipeline_runs (started_at DESC);
CREATE INDEX idx_pipeline_runs_success_finished ON public.pipeline_runs (finished_at DESC) WHERE status = 'success';
CREATE INDEX idx_pipeline_runs_source_success_finished ON public.pipeline_runs (source, finished_at DESC) WHERE status = 'success';
CREATE INDEX idx_pipeline_runs_status_started ON public.pipeline_runs (status, started_at DESC) WHERE status IN ('failed', 'partial');

CREATE TABLE public.pipeline_run_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.pipeline_runs (id) ON DELETE CASCADE,
  step_name text NOT NULL,
  step_order integer NOT NULL,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed', 'skipped')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  sqlstate text,
  -- Sanitized/truncated via public._pipeline_clean_error(); never the raw
  -- SQLERRM verbatim. See that function for what is stripped.
  error_message text,
  -- Only populated where a step genuinely exposes a number worth keeping
  -- (today: purge_listing_score_history's own exact return value under key
  -- "deleted_count", and a cheap catalog-derived estimate for
  -- refresh_active_properties_canonical under key "estimated_row_count" --
  -- deliberately not an exact count(*), see the orchestrator functions for
  -- why). NULL everywhere else -- not guessed, not fabricated.
  row_counts jsonb,
  CONSTRAINT pipeline_run_steps_finished_after_started CHECK (finished_at IS NULL OR finished_at >= started_at),
  CONSTRAINT pipeline_run_steps_error_message_bounded CHECK (error_message IS NULL OR length(error_message) <= 500),
  CONSTRAINT pipeline_run_steps_unique_order UNIQUE (run_id, step_order),
  CONSTRAINT pipeline_run_steps_unique_name UNIQUE (run_id, step_name)
);

COMMENT ON TABLE public.pipeline_run_steps IS
  'F-009/F-010: one row per step within a pipeline_runs row. Internal only, same access model as pipeline_runs.';

CREATE INDEX idx_pipeline_run_steps_run_order ON public.pipeline_run_steps (run_id, step_order);
CREATE INDEX idx_pipeline_run_steps_failed ON public.pipeline_run_steps (finished_at DESC) WHERE status = 'failed';

-- =============================================================================
-- 2. Permissions and confidentiality
-- =============================================================================
--
-- Both tables are internal. RLS is enabled with NO policies defined at all
-- (same pattern already used in this schema for scoring_config/
-- scoring_families/scoring_versions -- see the F-009/F-010 audit's advisor
-- read: those are flagged INFO "RLS enabled, no policy", which is the
-- intended lockdown, not an oversight). With RLS enabled and zero policies,
-- anon/authenticated get zero rows even if a table-level GRANT existed --
-- but no such GRANT is issued below either, so direct PostgREST access is
-- blocked at two independent layers. service_role bypasses RLS by default
-- in Supabase (bypassrls) and is not explicitly granted here; if a human
-- operator ever needs raw SQL access, connect as postgres/service_role.

ALTER TABLE public.pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_run_steps ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.pipeline_runs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.pipeline_run_steps FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- 3. Internal helpers (bookkeeping + error sanitization + advisory lock)
-- =============================================================================
-- All REVOKEd from PUBLIC/anon/authenticated: only callable from inside
-- another SECURITY DEFINER function running as the owning role (postgres),
-- exactly the same pattern already used by purge_listing_score_history().

CREATE OR REPLACE FUNCTION public._pipeline_clean_error(p_raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  -- Best-effort defense in depth. These functions operate purely on
  -- internal tables (no external HTTP calls, no user-supplied payloads),
  -- so SQLERRM here is expected to be plain Postgres error text -- this
  -- redaction exists in case a future step's error text ever echoes back
  -- something URL- or token-shaped.
  SELECT NULLIF(
    left(
      regexp_replace(
        regexp_replace(
          regexp_replace(coalesce(p_raw, ''), 'https?://\S+', '[url-redacted]', 'g'),
          '[A-Za-z0-9_-]{32,}', '[token-redacted]', 'g'
        ),
        '\s+', ' ', 'g'
      ),
      500
    ),
    ''
  );
$$;

REVOKE EXECUTE ON FUNCTION public._pipeline_clean_error(text) FROM PUBLIC, anon, authenticated;

-- Arbitrary constant reserved for ImmoPilot pipeline orchestration's
-- advisory lock. Do not reuse this key for any other advisory lock in this
-- schema. Exposed as a function (rather than inlining the literal in two
-- places) so tests can acquire the same lock to simulate contention.
CREATE OR REPLACE FUNCTION public._pipeline_lock_key()
RETURNS bigint
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 72910042::bigint;
$$;

REVOKE EXECUTE ON FUNCTION public._pipeline_lock_key() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._pipeline_start_run(p_source text, p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run_id uuid;
BEGIN
  INSERT INTO public.pipeline_runs (source, status, started_at, initiated_by, metadata)
  VALUES (p_source, 'running', now(), current_user, COALESCE(p_metadata, '{}'::jsonb))
  RETURNING id INTO v_run_id;
  RETURN v_run_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public._pipeline_start_run(text, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._pipeline_skipped_run(p_source text, p_reason text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run_id uuid;
BEGIN
  INSERT INTO public.pipeline_runs (source, status, started_at, finished_at, error_count, initiated_by, metadata)
  VALUES (p_source, 'skipped', now(), now(), 0, current_user, jsonb_build_object('reason', p_reason))
  RETURNING id INTO v_run_id;
  RETURN v_run_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public._pipeline_skipped_run(text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._pipeline_start_step(p_run_id uuid, p_step_name text, p_step_order integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_step_id uuid;
BEGIN
  INSERT INTO public.pipeline_run_steps (run_id, step_name, step_order, status, started_at)
  VALUES (p_run_id, p_step_name, p_step_order, 'running', now())
  RETURNING id INTO v_step_id;
  RETURN v_step_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public._pipeline_start_step(uuid, text, integer) FROM PUBLIC, anon, authenticated;

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
BEGIN
  UPDATE public.pipeline_run_steps
  SET status = p_status,
      finished_at = now(),
      duration_ms = GREATEST(0, EXTRACT(EPOCH FROM (now() - started_at)) * 1000)::integer,
      sqlstate = p_sqlstate,
      error_message = p_error_message,
      row_counts = p_row_counts
  WHERE id = p_step_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public._pipeline_finish_step(uuid, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._pipeline_skip_step(p_run_id uuid, p_step_name text, p_step_order integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.pipeline_run_steps (run_id, step_name, step_order, status, started_at, finished_at)
  VALUES (p_run_id, p_step_name, p_step_order, 'skipped', now(), now());
END;
$$;

REVOKE EXECUTE ON FUNCTION public._pipeline_skip_step(uuid, text, integer) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._pipeline_finish_run(p_run_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_error_count integer;
BEGIN
  SELECT count(*) INTO v_error_count
  FROM public.pipeline_run_steps
  WHERE run_id = p_run_id AND status = 'failed';

  UPDATE public.pipeline_runs
  SET status = p_status,
      finished_at = now(),
      error_count = v_error_count
  WHERE id = p_run_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public._pipeline_finish_run(uuid, text) FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- 4. sync_daily_pipeline() -- rewritten with instrumentation
-- =============================================================================
--
-- Observable "stop at first failure, mark the rest skipped" behavior is
-- preserved -- it does not introduce a finer-grained dependency graph, and
-- steps still run in the same strict linear order as today. What changes,
-- deliberately and as documented at the top of this file, is the
-- transactional persistence of steps completed BEFORE the failure: see the
-- file header for the full all-or-nothing vs partial-persistence analysis
-- and the reasoning for choosing partial persistence here.
--
-- The RAISE WARNING calls are kept for operator log parity with the
-- current function. The function still returns void normally in every
-- case (including on internal failure) to preserve the current external
-- contract with pg_cron -- pipeline_runs/pipeline_run_steps are now the
-- authoritative status source, cron.job_run_details is not (see the
-- review notes on this point).
--
-- Bookkeeping-vs-crash note (see file header point 2 for the full
-- analysis): _pipeline_start_run/_pipeline_start_step/_pipeline_finish_step
-- all write inside the SAME top-level transaction as the business PERFORM
-- calls (there is no autonomous-transaction mechanism here). This means a
-- step's own nested BEGIN...EXCEPTION correctly transitions that step's row
-- out of 'running' for every ordinary catchable error (constraint
-- violation, division by zero, statement_timeout's query_canceled, etc.).
-- It does NOT mean a 'running' row can survive a fatal interruption of the
-- whole session (backend crash, kill, OOM, forced termination): those abort
-- the entire transaction, and since pipeline_runs' own insert row also lives
-- in that same transaction, NOTHING commits at all in that case -- not a
-- stuck 'running' row, but zero rows for that attempt. See the review notes
-- for why this rules out a "reap stale running rows" mechanism and what an
-- external, absence-based check would need to look for instead.

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

  v_run_id := public._pipeline_start_run('cron');

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
      -- NOT count(*): measured on Pre-Alpha via EXPLAIN (ANALYZE, BUFFERS)
      -- at ~8.5k rows, count(*) already costs a full Index Only Scan
      -- (~20ms execution, 12 buffer hits) -- not free, and scales linearly
      -- with matview size, which is expected to grow. Running that on
      -- every single cron run AND every scraper callback is an
      -- unnecessary recurring full scan purely for observability metadata.
      -- pg_class.reltuples is a planner-statistics estimate (updated by
      -- ANALYZE/autovacuum, not necessarily by this REFRESH itself, so it
      -- can lag slightly behind the exact post-refresh count) but costs
      -- essentially nothing (measured: ~0.09ms, 3 buffer hits, pure catalog
      -- lookup) -- named estimated_row_count, not matview_row_count, so it
      -- is never mistaken for an exact count.
      SELECT reltuples::bigint INTO v_matview_estimated_count
      FROM pg_class WHERE oid = 'public.active_properties_canonical_mat'::regclass;
      PERFORM public._pipeline_finish_step(v_step_id, 'success', NULL, NULL, jsonb_build_object('estimated_row_count', v_matview_estimated_count));
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
      PERFORM public._pipeline_finish_step(v_step_id, 'success', NULL, NULL, jsonb_build_object('deleted_count', v_purged_count));
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
  -- Last-resort safety net (e.g. a bug in the bookkeeping helpers
  -- themselves): best-effort mark the run failed, never let an
  -- instrumentation bug take down the caller's contract.
  RAISE WARNING 'sync_daily_pipeline failed (outer): %', SQLERRM;
  IF v_run_id IS NOT NULL THEN
    BEGIN
      PERFORM public._pipeline_finish_run(v_run_id, 'failed');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_daily_pipeline() FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- 5. notify_scan_complete() -- rewritten with instrumentation
-- =============================================================================
--
-- Behavior preserved on purpose, and unlike sync_daily_pipeline there is NO
-- transactional semantics change here either: today each of the 3 steps
-- ALREADY has its own independent BEGIN/EXCEPTION (confirmed by reading the
-- live deployed function body before writing this migration), so each
-- step's savepoint was already scoped to itself, not to the whole function
-- -- a failure in one already did not undo an earlier step's effects, and
-- already did not prevent later steps from running. The rewrite adds
-- bookkeeping around exactly that pre-existing structure; it does not
-- change what gets persisted or what runs. No new 'skipped' semantics here
-- (unlike sync_daily_pipeline) since there is no evidence any of these
-- three steps is an unsafe prerequisite for the others. The run is marked
-- 'partial' if at least one of the three steps failed, 'success' if all
-- three succeeded.

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

  v_run_id := public._pipeline_start_run('scraper_callback');

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

  v_step_id := public._pipeline_start_step(v_run_id, 'refresh_active_properties_canonical', 2);
  BEGIN
    PERFORM public.refresh_active_properties_canonical();
    -- Catalog estimate, not count(*) -- see the identical note in
    -- sync_daily_pipeline() above. Same reasoning applies here, arguably
    -- more so: this path can run far more often than the daily cron if the
    -- scraper calls back frequently.
    SELECT reltuples::bigint INTO v_matview_estimated_count
    FROM pg_class WHERE oid = 'public.active_properties_canonical_mat'::regclass;
    PERFORM public._pipeline_finish_step(v_step_id, 'success', NULL, NULL, jsonb_build_object('estimated_row_count', v_matview_estimated_count));
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
    PERFORM public._pipeline_finish_step(v_step_id, 'failed', v_sqlstate, public._pipeline_clean_error(SQLERRM));
    RAISE WARNING 'notify_scan_complete refresh_active_properties_canonical failed: %', SQLERRM;
    v_error_count := v_error_count + 1;
  END;

  v_step_id := public._pipeline_start_step(v_run_id, 'compute_listing_scores', 3);
  BEGIN
    PERFORM public.compute_listing_scores();
    PERFORM public._pipeline_finish_step(v_step_id, 'success');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
    PERFORM public._pipeline_finish_step(v_step_id, 'failed', v_sqlstate, public._pipeline_clean_error(SQLERRM));
    RAISE WARNING 'notify_scan_complete compute_listing_scores failed: %', SQLERRM;
    v_error_count := v_error_count + 1;
  END;

  PERFORM public._pipeline_finish_run(v_run_id, CASE WHEN v_error_count > 0 THEN 'partial' ELSE 'success' END);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_scan_complete failed (outer): %', SQLERRM;
  IF v_run_id IS NOT NULL THEN
    BEGIN
      PERFORM public._pipeline_finish_run(v_run_id, 'failed');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_scan_complete() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_scan_complete() TO service_role;

-- =============================================================================
-- 6. Freshness read functions
-- =============================================================================
--
-- Two RPCs, per the "admins get details, all agents get a simplified
-- signal" option:
--   - get_pipeline_health(): full detail (step names, sqlstate, error
--     text), admin-only (is_admin() check inside, matching this schema's
--     existing admin-gated-function style).
--   - get_pipeline_health_summary(): minimal, safe for any authenticated
--     agent -- no step names, no error text, no sqlstate. Exists so the
--     Biens/Dashboard UI can show a subtle "data as of" / degraded
--     indicator to every agent, per F-010's concern that agents act on
--     stale data without knowing.
--
-- Threshold note: the cron cadence is confirmed (0 3 * * * = daily), so a
-- default 27h (24h + 3h buffer) threshold is used for pipeline-run
-- freshness, clearly marked as a tunable default. The scraper's real
-- cadence is NOT defined anywhere in this repo (confirmed by grep across
-- supabase/migrations and CLAUDE.md/AGENTS.md before writing this
-- migration) -- so listings/scraper-callback freshness intentionally
-- returns raw ages only, with threshold fields set to NULL and a
-- 'configurable' flag, rather than inventing a cadence.

-- public.scrape_runs belongs to the external scraper project (not created
-- by any migration in this repo -- see F-026) and is treated as a strictly
-- optional signal. get_pipeline_health() must keep working normally
-- (listings/scores/signals/matview freshness, pipeline run/step history)
-- even if this table is dropped, renamed, has its columns changed, or has
-- had its permissions altered -- none of that should ever make the RPC
-- fail. Confirmed live on Pre-Alpha before writing this: RLS is enabled on
-- scrape_runs with exactly one policy (SELECT, authenticated, USING true)
-- and no INSERT/UPDATE/DELETE policy at all -- so despite that table also
-- carrying broad raw GRANTs (INSERT/UPDATE/DELETE to anon/authenticated),
-- those grants are inert: RLS default-denies every command without a
-- matching permissive policy, regardless of the underlying GRANT. This is
-- read here defensively as a possibly-fragile external dependency, not
-- because it is currently an exploitable authorization gap -- it is not,
-- as verified. This function only ever reads two aggregates, never raw
-- rows, so no scrape_runs content leaks through get_pipeline_health().
CREATE OR REPLACE FUNCTION public._pipeline_scrape_runs_signal()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_expected_columns integer;
BEGIN
  IF to_regclass('public.scrape_runs') IS NULL THEN
    RETURN jsonb_build_object('available', false, 'reason', 'table_not_found');
  END IF;

  SELECT count(*) INTO v_expected_columns
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'scrape_runs'
    AND column_name IN ('status', 'errors_count', 'finished_at');

  IF v_expected_columns < 3 THEN
    RETURN jsonb_build_object('available', false, 'reason', 'schema_mismatch');
  END IF;

  BEGIN
    EXECUTE $q$
      SELECT jsonb_build_object(
        'available', true,
        'last_clean_run_at', max(finished_at) FILTER (WHERE status IN ('completed', 'success') AND coalesce(errors_count, 0) = 0),
        'last_attempt_at', max(finished_at)
      )
      FROM public.scrape_runs
    $q$ INTO v_result;
  EXCEPTION WHEN OTHERS THEN
    -- Any runtime surprise not caught by the checks above (permission
    -- revoked, column type changed, etc.) degrades to "unavailable" --
    -- never propagates to the caller of get_pipeline_health().
    RETURN jsonb_build_object('available', false, 'reason', 'query_failed');
  END;

  RETURN COALESCE(v_result, jsonb_build_object('available', true, 'last_clean_run_at', null, 'last_attempt_at', null));
END;
$$;

REVOKE EXECUTE ON FUNCTION public._pipeline_scrape_runs_signal() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_pipeline_health()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_pipeline_threshold_seconds integer := 97200; -- 27h, see note above; tunable.
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only agency admins can read full pipeline health details' USING ERRCODE = '42501';
  END IF;

  WITH last_run AS (
    SELECT id, source, status, started_at, finished_at, error_count
    FROM public.pipeline_runs
    ORDER BY started_at DESC
    LIMIT 1
  ),
  last_success AS (
    SELECT id, source, finished_at
    FROM public.pipeline_runs
    WHERE status = 'success'
    ORDER BY finished_at DESC
    LIMIT 1
  ),
  last_scraper_callback_success AS (
    SELECT id, finished_at
    FROM public.pipeline_runs
    WHERE source = 'scraper_callback' AND status = 'success'
    ORDER BY finished_at DESC
    LIMIT 1
  ),
  last_scraper_callback_any AS (
    SELECT id, status, finished_at
    FROM public.pipeline_runs
    WHERE source = 'scraper_callback'
    ORDER BY started_at DESC
    LIMIT 1
  ),
  last_failed_step AS (
    SELECT s.step_name, s.sqlstate, s.error_message, s.run_id, s.finished_at
    FROM public.pipeline_run_steps s
    WHERE s.status = 'failed'
    ORDER BY s.finished_at DESC
    LIMIT 1
  ),
  matview_last_refresh AS (
    SELECT max(finished_at) AS refreshed_at
    FROM public.pipeline_run_steps
    WHERE step_name = 'refresh_active_properties_canonical' AND status = 'success'
  ),
  data_freshness AS (
    SELECT
      (SELECT max(last_seen_at) FROM public.listings WHERE status = 'active') AS listings_last_seen_at,
      (SELECT max(computed_at) FROM public.listing_scores) AS scores_last_computed_at,
      (SELECT max(detected_at) FROM public.listing_signals WHERE is_active = true) AS signals_last_detected_at,
      (SELECT max(last_seen_at) FROM public.active_properties_canonical_mat) AS matview_content_last_seen_at
  ),
  -- Best-effort read of the external scraper's own run ledger, via the
  -- defensive helper above -- never queried directly here, so a missing
  -- table/column/permission can never fail this function.
  scrape_runs_signal AS (
    SELECT public._pipeline_scrape_runs_signal() AS v
  )
  SELECT jsonb_build_object(
    'last_run', (SELECT to_jsonb(last_run) FROM last_run),
    'last_pipeline_success_at', (SELECT finished_at FROM last_success),
    'last_pipeline_success_source', (SELECT source FROM last_success),
    'last_scraper_callback_success_at', (SELECT finished_at FROM last_scraper_callback_success),
    'last_scraper_callback_status', (SELECT status FROM last_scraper_callback_any),
    'last_scraper_callback_at', (SELECT finished_at FROM last_scraper_callback_any),
    'last_failed_step', (SELECT to_jsonb(last_failed_step) FROM last_failed_step),
    'matview_last_refreshed_at', (SELECT refreshed_at FROM matview_last_refresh),
    'freshness', jsonb_build_object(
      'listings_last_seen_at', (SELECT listings_last_seen_at FROM data_freshness),
      'listings_last_seen_age_seconds', (SELECT EXTRACT(EPOCH FROM (now() - listings_last_seen_at))::bigint FROM data_freshness),
      'scores_last_computed_at', (SELECT scores_last_computed_at FROM data_freshness),
      'scores_age_seconds', (SELECT EXTRACT(EPOCH FROM (now() - scores_last_computed_at))::bigint FROM data_freshness),
      'signals_last_detected_at', (SELECT signals_last_detected_at FROM data_freshness),
      'signals_age_seconds', (SELECT EXTRACT(EPOCH FROM (now() - signals_last_detected_at))::bigint FROM data_freshness),
      'matview_content_last_seen_at', (SELECT matview_content_last_seen_at FROM data_freshness),
      'matview_content_age_seconds', (SELECT EXTRACT(EPOCH FROM (now() - matview_content_last_seen_at))::bigint FROM data_freshness),
      'scraper_source_available', (SELECT (v->>'available')::boolean FROM scrape_runs_signal),
      'scraper_source_unavailable_reason', (SELECT v->>'reason' FROM scrape_runs_signal),
      'scraper_last_clean_run_at', (SELECT (v->>'last_clean_run_at')::timestamptz FROM scrape_runs_signal),
      'scraper_last_attempt_at', (SELECT (v->>'last_attempt_at')::timestamptz FROM scrape_runs_signal)
    ),
    'pipeline_freshness_threshold_seconds', v_pipeline_threshold_seconds,
    'pipeline_is_fresh', (
      SELECT (finished_at IS NOT NULL AND finished_at >= now() - make_interval(secs => v_pipeline_threshold_seconds))
      FROM last_success
    ),
    'scraper_freshness_threshold_seconds', NULL,
    'scraper_freshness_status', 'unknown',
    'scraper_freshness_note', 'Scraper cadence is not defined in this repository; threshold must be configured once known, not inferred.'
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_pipeline_health() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_pipeline_health() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_pipeline_health_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pipeline_threshold_seconds integer := 97200; -- 27h, same default as get_pipeline_health().
  v_last_success_at timestamptz;
  v_last_run_status text;
  v_data_last_updated_at timestamptz;
  v_status text;
BEGIN
  SELECT finished_at INTO v_last_success_at
  FROM public.pipeline_runs
  WHERE status = 'success'
  ORDER BY finished_at DESC
  LIMIT 1;

  SELECT status INTO v_last_run_status
  FROM public.pipeline_runs
  ORDER BY started_at DESC
  LIMIT 1;

  SELECT max(last_seen_at) INTO v_data_last_updated_at
  FROM public.active_properties_canonical_mat;

  IF v_last_run_status IS NULL THEN
    v_status := 'unknown';
  ELSIF v_last_run_status IN ('failed', 'partial') THEN
    v_status := 'attention';
  ELSIF v_last_success_at IS NULL OR v_last_success_at < now() - make_interval(secs => v_pipeline_threshold_seconds) THEN
    v_status := 'attention';
  ELSE
    v_status := 'ok';
  END IF;

  -- Deliberately does NOT fold data staleness into pipeline_status: a
  -- healthy pipeline run does not imply fresh source data (F-010's core
  -- point). data_last_updated_at is always returned separately so the
  -- caller can judge source freshness independently.
  RETURN jsonb_build_object(
    'pipeline_status', v_status,
    'data_last_updated_at', v_data_last_updated_at
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_pipeline_health_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_pipeline_health_summary() TO authenticated;
