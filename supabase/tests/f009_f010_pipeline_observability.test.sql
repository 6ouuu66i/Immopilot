-- F-009/F-010 regression suite.
--
-- Local-only test. Run after all migrations with:
--   supabase start
--   supabase test db
--
-- Every mutation is enclosed in this transaction and rolled back. The scoring
-- idempotence scenario runs against the real compute_listing_scores() function.
-- The orchestration scenarios then replace business-step functions with local,
-- transaction-scoped stubs; the final ROLLBACK restores their real definitions.

begin;
select plan(51);

create temporary table f009_run_ids (
  scenario text primary key,
  run_id uuid not null
) on commit drop;

create temporary table f009_trace (
  seq bigint generated always as identity,
  step_name text not null
) on commit drop;

create temporary table f009_existing_runs (
  run_id uuid primary key
) on commit drop;

create temporary table f009_timing_step_ids (
  step_id uuid primary key
) on commit drop;

-- =============================================================================
-- Scenario 10: wall-clock timestamps and duration survive one transaction.
-- =============================================================================

savepoint sp_real_timing;

insert into pg_temp.f009_run_ids (scenario, run_id)
select 'real_timing', public._pipeline_start_run(
  'cron',
  jsonb_build_object('test', 'real_timing')
);

insert into pg_temp.f009_timing_step_ids (step_id)
select public._pipeline_start_step(
  (select run_id from pg_temp.f009_run_ids where scenario = 'real_timing'),
  'real_timing_step',
  1
);

select pg_sleep(0.02);

select public._pipeline_finish_step(
  (select step_id from pg_temp.f009_timing_step_ids),
  'success'
);

select public._pipeline_finish_run(
  (select run_id from pg_temp.f009_run_ids where scenario = 'real_timing'),
  'success'
);

select ok(
  (select finished_at > started_at
   from public.pipeline_runs
   where id = (select run_id from pg_temp.f009_run_ids where scenario = 'real_timing')),
  'Scenario 10: run finished_at advances beyond started_at in one transaction'
);

select ok(
  (select finished_at > started_at
   from public.pipeline_run_steps
   where id = (select step_id from pg_temp.f009_timing_step_ids)),
  'Scenario 10: step finished_at advances beyond started_at in one transaction'
);

select ok(
  (select duration_ms > 0
   from public.pipeline_run_steps
   where id = (select step_id from pg_temp.f009_timing_step_ids)),
  'Scenario 10: a slept step stores a positive wall-clock duration'
);

select is(
  (select duration_ms
   from public.pipeline_run_steps
   where id = (select step_id from pg_temp.f009_timing_step_ids)),
  (select round(extract(epoch from (finished_at - started_at)) * 1000)::integer
   from public.pipeline_run_steps
   where id = (select step_id from pg_temp.f009_timing_step_ids)),
  'Scenario 10: duration_ms uses the exact persisted finish timestamp'
);

rollback to savepoint sp_real_timing;

-- =============================================================================
-- Scenario 9: real scoring idempotence, before business functions are stubbed.
-- =============================================================================

savepoint sp_scoring_idempotence;

create temporary table f009_scores_before on commit drop as
select
  property_id,
  score,
  raw_score,
  band,
  confidence,
  confidence_score,
  confidence_detail,
  breakdown,
  families_count,
  signals_count,
  score_version
from public.listing_scores;

create temporary table f009_score_stats (
  stage text primary key,
  row_count bigint not null,
  score_sum numeric not null,
  history_count bigint not null
) on commit drop;

insert into f009_score_stats (stage, row_count, score_sum, history_count)
select
  'before',
  count(*),
  coalesce(sum(score), 0),
  (select count(*) from public.listing_score_history)
from public.listing_scores;

select public.compute_listing_scores();

create temporary table f009_scores_after_first on commit drop as
select
  property_id,
  score,
  raw_score,
  band,
  confidence,
  confidence_score,
  confidence_detail,
  breakdown,
  families_count,
  signals_count,
  score_version
from public.listing_scores;

insert into f009_score_stats (stage, row_count, score_sum, history_count)
select
  'after_first',
  count(*),
  coalesce(sum(score), 0),
  (select count(*) from public.listing_score_history)
from public.listing_scores;

select public.compute_listing_scores();

create temporary table f009_scores_after_second on commit drop as
select
  property_id,
  score,
  raw_score,
  band,
  confidence,
  confidence_score,
  confidence_detail,
  breakdown,
  families_count,
  signals_count,
  score_version
from public.listing_scores;

insert into f009_score_stats (stage, row_count, score_sum, history_count)
select
  'after_second',
  count(*),
  coalesce(sum(score), 0),
  (select count(*) from public.listing_score_history)
from public.listing_scores;

select is(
  (select row_count from f009_score_stats where stage = 'before'),
  (select count(*) from f009_scores_before),
  'Scenario 9: the pre-compute score state is captured as a stored snapshot'
);

select ok(
  not exists (
    (select * from f009_scores_after_first except select * from f009_scores_after_second)
    union all
    (select * from f009_scores_after_second except select * from f009_scores_after_first)
  ),
  'Scenario 9: business score columns do not drift after the second compute'
);

select results_eq(
  $$ select row_count, score_sum from f009_score_stats where stage = 'after_first' $$,
  $$ select row_count, score_sum from f009_score_stats where stage = 'after_second' $$,
  'Scenario 9: stored score counts and aggregates are identical after calls one and two'
);

select is(
  (select count(*)::int from (
    select property_id from f009_scores_after_second group by property_id having count(*) > 1
  ) duplicates),
  0,
  'Scenario 9: the second compute creates no duplicate current score key'
);

select is(
  (select history_count from f009_score_stats where stage = 'after_first'),
  (select history_count from f009_score_stats where stage = 'after_second'),
  'Scenario 9: the second identical compute creates no unjustified history snapshot'
);

rollback to savepoint sp_scoring_idempotence;

-- =============================================================================
-- Fixtures for permission checks.
-- =============================================================================

insert into public.agencies (id, name, slug) values
  ('f0090000-0000-0000-0000-000000000001', 'F009 Agency', 'f009-agency');

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', 'f0090001-0000-0000-0000-000000000001',
   'authenticated', 'authenticated', 'f009-agent@test.local', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'f0090001-0000-0000-0000-000000000002',
   'authenticated', 'authenticated', 'f009-admin@test.local', now(), now());

update public.profiles
set agency_id = 'f0090000-0000-0000-0000-000000000001', role = 'agent'
where id = 'f0090001-0000-0000-0000-000000000001';

update public.profiles
set agency_id = 'f0090000-0000-0000-0000-000000000001', role = 'admin'
where id = 'f0090001-0000-0000-0000-000000000002';

-- =============================================================================
-- Transaction-scoped successful business stubs.
-- =============================================================================

create or replace function public.refresh_market_reference()
returns void language plpgsql as $$
begin
  insert into pg_temp.f009_trace (step_name) values ('market');
end;
$$;

create or replace function public.sync_overpriced_signal_batch()
returns void language plpgsql as $$
begin
  insert into pg_temp.f009_trace (step_name) values ('overpriced');
end;
$$;

create or replace function public.sync_stale_dom_relative_signal_batch()
returns void language plpgsql as $$
begin
  insert into pg_temp.f009_trace (step_name) values ('stale_dom');
end;
$$;

create or replace function public.sync_failed_launch_signal_batch()
returns void language plpgsql as $$
begin
  insert into pg_temp.f009_trace (step_name) values ('failed_launch');
end;
$$;

create or replace function public.sync_competition_shock_signal_batch()
returns void language plpgsql as $$
begin
  insert into pg_temp.f009_trace (step_name) values ('competition');
end;
$$;

create or replace function public.sync_agency_mandate_aging_signal()
returns void language plpgsql as $$
begin
  insert into pg_temp.f009_trace (step_name) values ('mandate_aging');
end;
$$;

create or replace function public.compute_listing_scores()
returns void language plpgsql as $$
begin
  insert into pg_temp.f009_trace (step_name) values ('scores');
end;
$$;

create or replace function public.refresh_active_properties_canonical()
returns void language plpgsql as $$
begin
  insert into pg_temp.f009_trace (step_name) values ('matview');
end;
$$;

create or replace function public.purge_listing_score_history()
returns integer language plpgsql as $$
begin
  insert into pg_temp.f009_trace (step_name) values ('purge');
  return 0;
end;
$$;

-- =============================================================================
-- Scenario 1: fully successful cron, identified by its own run_id.
-- =============================================================================

savepoint sp_cron_success;
truncate pg_temp.f009_trace;
truncate pg_temp.f009_existing_runs;
insert into pg_temp.f009_existing_runs select id from public.pipeline_runs;

select public.sync_daily_pipeline();

insert into pg_temp.f009_run_ids (scenario, run_id)
select 'cron_success', id
from public.pipeline_runs
where source = 'cron'
  and not exists (
    select 1 from pg_temp.f009_existing_runs existing where existing.run_id = pipeline_runs.id
  )
order by started_at desc, id desc
limit 1;

select is(
  (select count(*)::int from public.pipeline_runs
   where id = (select run_id from pg_temp.f009_run_ids where scenario = 'cron_success')
     and source = 'cron'),
  1,
  'Scenario 1: exactly one targeted cron run exists'
);

select results_eq(
  $$ select status, error_count from public.pipeline_runs
     where id = (select run_id from pg_temp.f009_run_ids where scenario = 'cron_success') $$,
  $$ values ('success'::text, 0) $$,
  'Scenario 1: targeted cron run is success with error_count zero'
);

select is(
  (select count(*)::int from public.pipeline_run_steps
   where run_id = (select run_id from pg_temp.f009_run_ids where scenario = 'cron_success')),
  9,
  'Scenario 1: targeted cron run has exactly nine steps'
);

select is(
  (select count(*)::int from public.pipeline_run_steps
   where run_id = (select run_id from pg_temp.f009_run_ids where scenario = 'cron_success')
     and status = 'success'),
  9,
  'Scenario 1: every targeted cron step is successful'
);

select results_eq(
  $$ select step_order, step_name from public.pipeline_run_steps
     where run_id = (select run_id from pg_temp.f009_run_ids where scenario = 'cron_success')
     order by step_order $$,
  $$ values
       (1, 'refresh_market_reference'::text),
       (2, 'sync_overpriced_signal_batch'::text),
       (3, 'sync_stale_dom_relative_signal_batch'::text),
       (4, 'sync_failed_launch_signal_batch'::text),
       (5, 'sync_competition_shock_signal_batch'::text),
       (6, 'sync_agency_mandate_aging_signal'::text),
       (7, 'compute_listing_scores'::text),
       (8, 'refresh_active_properties_canonical'::text),
       (9, 'purge_listing_score_history'::text) $$,
  'Scenario 1: targeted cron step order is exact'
);

select ok(
  (select bool_and(duration_ms is not null and duration_ms >= 0)
   from public.pipeline_run_steps
   where run_id = (select run_id from pg_temp.f009_run_ids where scenario = 'cron_success')),
  'Scenario 1: targeted cron step durations are non-negative'
);

select ok(
  (select bool_and(finished_at is not null and finished_at >= started_at)
   from public.pipeline_run_steps
   where run_id = (select run_id from pg_temp.f009_run_ids where scenario = 'cron_success')),
  'Scenario 1: targeted cron step timestamps are coherent'
);

select ok(
  (select finished_at is not null and finished_at >= started_at
   from public.pipeline_runs
   where id = (select run_id from pg_temp.f009_run_ids where scenario = 'cron_success')),
  'Scenario 1: targeted cron run timestamps are coherent'
);

rollback to savepoint sp_cron_success;

-- =============================================================================
-- Scenario 2: first cron step fails, remaining steps are skipped.
-- =============================================================================

savepoint sp_cron_first_failure;
truncate pg_temp.f009_existing_runs;
insert into pg_temp.f009_existing_runs select id from public.pipeline_runs;

create or replace function public.refresh_market_reference()
returns void language plpgsql as $$
begin
  insert into pg_temp.f009_trace (step_name) values ('market');
  raise exception 'f009-step1 https://secret.example/path ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdef';
end;
$$;

select public.sync_daily_pipeline();

insert into pg_temp.f009_run_ids (scenario, run_id)
select 'cron_first_failure', id
from public.pipeline_runs
where source = 'cron'
  and not exists (
    select 1 from pg_temp.f009_existing_runs existing where existing.run_id = pipeline_runs.id
  )
order by started_at desc, id desc
limit 1;

select results_eq(
  $$ select status, error_count from public.pipeline_runs
     where id = (select run_id from pg_temp.f009_run_ids where scenario = 'cron_first_failure') $$,
  $$ values ('failed'::text, 1) $$,
  'Scenario 2: first-step failure marks the targeted cron run failed with one error'
);

select is(
  (select count(*)::int from public.pipeline_run_steps
   where run_id = (select run_id from pg_temp.f009_run_ids where scenario = 'cron_first_failure')),
  9,
  'Scenario 2: targeted failed cron still records nine steps'
);

select results_eq(
  $$ select step_order, status from public.pipeline_run_steps
     where run_id = (select run_id from pg_temp.f009_run_ids where scenario = 'cron_first_failure')
     order by step_order $$,
  $$ values
       (1, 'failed'::text),
       (2, 'skipped'::text),
       (3, 'skipped'::text),
       (4, 'skipped'::text),
       (5, 'skipped'::text),
       (6, 'skipped'::text),
       (7, 'skipped'::text),
       (8, 'skipped'::text),
       (9, 'skipped'::text) $$,
  'Scenario 2: only step one fails and steps two through nine are skipped'
);

select ok(
  (select sqlstate = 'P0001'
          and error_message like '%f009-step1%'
          and error_message not like '%https://%'
          and error_message not like '%ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdef%'
          and length(error_message) <= 500
   from public.pipeline_run_steps
   where run_id = (select run_id from pg_temp.f009_run_ids where scenario = 'cron_first_failure')
     and step_order = 1),
  'Scenario 2: stored error is identified, redacted, and bounded'
);

rollback to savepoint sp_cron_first_failure;

-- =============================================================================
-- Scenario 3: intermediate cron failure.
-- =============================================================================

savepoint sp_cron_intermediate_failure;
truncate pg_temp.f009_existing_runs;
insert into pg_temp.f009_existing_runs select id from public.pipeline_runs;

create or replace function public.sync_failed_launch_signal_batch()
returns void language plpgsql as $$
begin
  insert into pg_temp.f009_trace (step_name) values ('failed_launch');
  raise exception 'f009-step4';
end;
$$;

select public.sync_daily_pipeline();

insert into pg_temp.f009_run_ids (scenario, run_id)
select 'cron_intermediate_failure', id
from public.pipeline_runs
where source = 'cron'
  and not exists (
    select 1 from pg_temp.f009_existing_runs existing where existing.run_id = pipeline_runs.id
  )
order by started_at desc, id desc
limit 1;

select results_eq(
  $$ select status, error_count from public.pipeline_runs
     where id = (select run_id from pg_temp.f009_run_ids where scenario = 'cron_intermediate_failure') $$,
  $$ values ('failed'::text, 1) $$,
  'Scenario 3: intermediate failure marks the targeted cron run failed'
);

select results_eq(
  $$ select step_order, status from public.pipeline_run_steps
     where run_id = (select run_id from pg_temp.f009_run_ids where scenario = 'cron_intermediate_failure')
     order by step_order $$,
  $$ values
       (1, 'success'::text),
       (2, 'success'::text),
       (3, 'success'::text),
       (4, 'failed'::text),
       (5, 'skipped'::text),
       (6, 'skipped'::text),
       (7, 'skipped'::text),
       (8, 'skipped'::text),
       (9, 'skipped'::text) $$,
  'Scenario 3: prior steps succeed, step four fails, and later steps are skipped'
);

select ok(
  (select error_message like '%f009-step4%'
   from public.pipeline_run_steps
   where run_id = (select run_id from pg_temp.f009_run_ids where scenario = 'cron_intermediate_failure')
     and step_order = 4),
  'Scenario 3: the targeted intermediate failed step stores its error'
);

rollback to savepoint sp_cron_intermediate_failure;

-- =============================================================================
-- Scenario 4 and 6: callback partial, continuation, and real execution order.
-- =============================================================================

savepoint sp_callback_partial;
truncate pg_temp.f009_trace;
truncate pg_temp.f009_existing_runs;
insert into pg_temp.f009_existing_runs select id from public.pipeline_runs;

create or replace function public.compute_listing_scores()
returns void language plpgsql as $$
begin
  insert into pg_temp.f009_trace (step_name) values ('scores');
  raise exception 'f009-callback-scores';
end;
$$;

select public.notify_scan_complete();

insert into pg_temp.f009_run_ids (scenario, run_id)
select 'callback_partial', id
from public.pipeline_runs
where source = 'scraper_callback'
  and not exists (
    select 1 from pg_temp.f009_existing_runs existing where existing.run_id = pipeline_runs.id
  )
order by started_at desc, id desc
limit 1;

select results_eq(
  $$ select status, error_count from public.pipeline_runs
     where id = (select run_id from pg_temp.f009_run_ids where scenario = 'callback_partial') $$,
  $$ values ('partial'::text, 1) $$,
  'Scenario 4: one callback failure produces a partial run with one error'
);

select is(
  (select count(*)::int from public.pipeline_run_steps
   where run_id = (select run_id from pg_temp.f009_run_ids where scenario = 'callback_partial')),
  3,
  'Scenario 4: targeted callback always records three steps'
);

select results_eq(
  $$ select step_order, step_name, status from public.pipeline_run_steps
     where run_id = (select run_id from pg_temp.f009_run_ids where scenario = 'callback_partial')
     order by step_order $$,
  $$ values
       (1, 'refresh_market_reference'::text, 'success'::text),
       (2, 'compute_listing_scores'::text, 'failed'::text),
       (3, 'refresh_active_properties_canonical'::text, 'success'::text) $$,
  'Scenario 4: callback records market, failed scores, then successful matview'
);

select results_eq(
  $$ select step_name from pg_temp.f009_trace order by seq $$,
  $$ values ('market'::text), ('scores'::text), ('matview'::text) $$,
  'Scenario 6: observed callback execution order is market, scores, matview'
);

rollback to savepoint sp_callback_partial;

-- =============================================================================
-- Scenario 5: failed cron followed by successful callback cannot mask daily health.
-- =============================================================================

savepoint sp_source_separation;
truncate pg_temp.f009_existing_runs;
insert into pg_temp.f009_existing_runs select id from public.pipeline_runs;

create or replace function public.refresh_market_reference()
returns void language plpgsql as $$
begin
  insert into pg_temp.f009_trace (step_name) values ('market');
  raise exception 'f009-daily-failure';
end;
$$;

select public.sync_daily_pipeline();

insert into pg_temp.f009_run_ids (scenario, run_id)
select 'separation_cron', id
from public.pipeline_runs
where source = 'cron'
  and not exists (
    select 1 from pg_temp.f009_existing_runs existing where existing.run_id = pipeline_runs.id
  )
order by started_at desc, id desc
limit 1;

create or replace function public.refresh_market_reference()
returns void language plpgsql as $$
begin
  insert into pg_temp.f009_trace (step_name) values ('market');
end;
$$;

truncate pg_temp.f009_trace;
truncate pg_temp.f009_existing_runs;
insert into pg_temp.f009_existing_runs select id from public.pipeline_runs;
select public.notify_scan_complete();

insert into pg_temp.f009_run_ids (scenario, run_id)
select 'separation_callback', id
from public.pipeline_runs
where source = 'scraper_callback'
  and not exists (
    select 1 from pg_temp.f009_existing_runs existing where existing.run_id = pipeline_runs.id
  )
order by started_at desc, id desc
limit 1;

select results_eq(
  $$ select status from public.pipeline_runs
     where id = (select run_id from pg_temp.f009_run_ids where scenario = 'separation_cron') $$,
  $$ values ('failed'::text) $$,
  'Scenario 5: targeted daily run is failed'
);

select results_eq(
  $$ select status, error_count from public.pipeline_runs
     where id = (select run_id from pg_temp.f009_run_ids where scenario = 'separation_callback') $$,
  $$ values ('success'::text, 0) $$,
  'Scenario 5: later targeted callback succeeds completely'
);

select is(
  (select count(*)::int from public.pipeline_run_steps
   where run_id = (select run_id from pg_temp.f009_run_ids where scenario = 'separation_callback')
     and status = 'success'),
  3,
  'Scenario 5: successful callback has exactly three successful steps'
);

select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'f0090001-0000-0000-0000-000000000002', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

select is(
  public.get_pipeline_health_summary()->>'daily_pipeline_status',
  'failed',
  'Scenario 5: agent summary keeps daily pipeline failed after callback success'
);

select is(
  public.get_pipeline_health_summary()->>'scraper_callback_status',
  'success',
  'Scenario 5: agent summary reports callback success independently'
);

select ok(
  (public.get_pipeline_health_summary()->>'scraper_callback_last_success_at') is not null,
  'Scenario 5: agent summary exposes the callback last-success timestamp'
);

select is(
  public.get_pipeline_health()->>'daily_pipeline_status',
  'failed',
  'Scenario 5: admin detail keeps daily pipeline failed after callback success'
);

select is(
  public.get_pipeline_health()->>'scraper_callback_status',
  'success',
  'Scenario 5: admin detail reports callback success independently'
);

reset role;
rollback to savepoint sp_source_separation;

-- =============================================================================
-- Scenario 7: permission matrix and safe RPC contents.
-- =============================================================================

savepoint sp_permissions;

set local role anon;

select throws_ok(
  $$ select * from public.pipeline_runs limit 1 $$,
  '42501', null,
  'Scenario 7: anon cannot read pipeline_runs'
);

select throws_ok(
  $$ select * from public.pipeline_run_steps limit 1 $$,
  '42501', null,
  'Scenario 7: anon cannot read pipeline_run_steps'
);

select throws_ok(
  $$ select public.get_pipeline_health_summary() $$,
  '42501', null,
  'Scenario 7: anon cannot execute the health summary'
);

select throws_ok(
  $$ select public.get_pipeline_health() $$,
  '42501', null,
  'Scenario 7: anon cannot execute detailed health'
);

reset role;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'f0090001-0000-0000-0000-000000000001', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

select throws_ok(
  $$ select * from public.pipeline_runs limit 1 $$,
  '42501', null,
  'Scenario 7: agent cannot read pipeline_runs directly'
);

select throws_ok(
  $$ select * from public.pipeline_run_steps limit 1 $$,
  '42501', null,
  'Scenario 7: agent cannot read pipeline_run_steps directly'
);

select throws_ok(
  $$ select public._pipeline_lock_key() $$,
  '42501', null,
  'Scenario 7: agent cannot execute internal pipeline helpers'
);

select throws_ok(
  $$ select public.sync_daily_pipeline() $$,
  '42501', null,
  'Scenario 7: agent cannot execute the daily orchestrator'
);

select throws_ok(
  $$ select public.notify_scan_complete() $$,
  '42501', null,
  'Scenario 7: agent cannot execute the scraper callback'
);

select ok(
  public.get_pipeline_health_summary()
    ?& array[
      'global_status',
      'daily_pipeline_status',
      'daily_pipeline_last_run_at',
      'daily_pipeline_last_success_at',
      'daily_pipeline_age_seconds',
      'scraper_callback_status',
      'scraper_callback_last_run_at',
      'scraper_callback_last_success_at',
      'scraper_callback_age_seconds',
      'listings_freshness',
      'scores_freshness',
      'signals_freshness',
      'matview_freshness'
    ],
  'Scenario 7: authenticated agent receives every required safe health field'
);

select ok(
  public.get_pipeline_health_summary()::text !~ '"(error_message|sqlstate|step_name|metadata|function|stack)"',
  'Scenario 7: health summary contains no technical or sensitive field names'
);

select throws_ok(
  $$ select public.get_pipeline_health() $$,
  '42501', null,
  'Scenario 7: non-admin agent cannot execute detailed health'
);

reset role;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'f0090001-0000-0000-0000-000000000002', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

select ok(
  public.get_pipeline_health()
    ?& array[
      'global_status',
      'daily_pipeline_status',
      'daily_pipeline_error_count',
      'daily_pipeline_metadata',
      'scraper_callback_status',
      'scraper_callback_error_count',
      'scraper_callback_metadata',
      'last_failed_step',
      'listings_freshness',
      'scores_freshness',
      'signals_freshness',
      'matview_freshness'
    ],
  'Scenario 7: admin receives detailed source-separated health'
);

reset role;
rollback to savepoint sp_permissions;

-- =============================================================================
-- Scenario 8: unexpected instrumentation error preserves the run row.
-- =============================================================================

savepoint sp_unexpected_instrumentation;
truncate pg_temp.f009_existing_runs;
insert into pg_temp.f009_existing_runs select id from public.pipeline_runs;

create or replace function public._pipeline_start_step(
  p_run_id uuid,
  p_step_name text,
  p_step_order integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'f009-instrumentation-start-step';
end;
$$;

select public.sync_daily_pipeline();

insert into pg_temp.f009_run_ids (scenario, run_id)
select 'unexpected_instrumentation', id
from public.pipeline_runs
where source = 'cron'
  and not exists (
    select 1 from pg_temp.f009_existing_runs existing where existing.run_id = pipeline_runs.id
  )
order by started_at desc, id desc
limit 1;

select results_eq(
  $$ select status from public.pipeline_runs
     where id = (select run_id from pg_temp.f009_run_ids where scenario = 'unexpected_instrumentation') $$,
  $$ values ('failed'::text) $$,
  'Scenario 8: unexpected instrumentation failure preserves and fails the run row'
);

select ok(
  (select finished_at is not null
   from public.pipeline_runs
   where id = (select run_id from pg_temp.f009_run_ids where scenario = 'unexpected_instrumentation')),
  'Scenario 8: preserved failed run is finalized'
);

rollback to savepoint sp_unexpected_instrumentation;

select * from finish();
rollback;
