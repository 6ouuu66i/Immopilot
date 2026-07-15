-- F-023 remote-safe regression suite. Every mutation is rolled back.

begin;
create temporary table f023_tap_results (
  sequence bigint generated always as identity,
  result text not null
) on commit drop;
grant select, insert on pg_temp.f023_tap_results to anon, authenticated;
grant usage, select on sequence pg_temp.f023_tap_results_sequence_seq to anon, authenticated;
insert into pg_temp.f023_tap_results (result) select plan(22);

insert into public.agencies (id, name, slug)
values ('f0230000-0000-0000-0000-000000000001', 'F023 Agency', 'f023-agency');

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', 'f0230001-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'f023-no-agency@test.local', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'f0230001-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'f023-inactive@test.local', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'f0230001-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'f023-agent@test.local', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'f0230001-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'f023-admin@test.local', now(), now());

update public.profiles set role = 'admin', agency_id = null, is_active = true
where id = 'f0230001-0000-0000-0000-000000000001';
update public.profiles set role = 'admin', agency_id = 'f0230000-0000-0000-0000-000000000001', is_active = false
where id = 'f0230001-0000-0000-0000-000000000002';
update public.profiles set role = 'agent', agency_id = 'f0230000-0000-0000-0000-000000000001', is_active = true
where id = 'f0230001-0000-0000-0000-000000000003';
update public.profiles set role = 'admin', agency_id = 'f0230000-0000-0000-0000-000000000001', is_active = true
where id = 'f0230001-0000-0000-0000-000000000004';

create or replace function pg_temp.f023_seed_pipeline(
  p_status text,
  p_started_at timestamptz default clock_timestamp(),
  p_source text default 'cron'
)
returns uuid
language plpgsql
as $$
declare
  v_run_id uuid;
  v_finished_at timestamptz;
begin
  v_finished_at := case when p_status = 'running' then null else p_started_at + interval '1 second' end;
  insert into public.pipeline_runs (source, status, started_at, finished_at, error_count, initiated_by)
  values (p_source, p_status, p_started_at, v_finished_at, case when p_status in ('failed', 'partial') then 1 else 0 end, 'f023-test')
  returning id into v_run_id;

  if p_source = 'cron' then
    insert into public.pipeline_run_steps (
      run_id, step_name, step_order, status, started_at, finished_at, duration_ms, error_message
    )
    select
      v_run_id,
      case when step_order = 8 then 'refresh_active_properties_canonical' else 'f023_step_' || step_order end,
      step_order,
      case
        when p_status in ('failed', 'partial') and step_order = 4 then 'failed'
        when p_status in ('failed', 'partial') and step_order > 4 then 'skipped'
        when p_status = 'running' and step_order = 1 then 'running'
        when p_status = 'running' then 'skipped'
        else 'success'
      end,
      p_started_at,
      case when p_status = 'running' and step_order = 1 then null else v_finished_at end,
      case when p_status = 'running' and step_order = 1 then null else 100 end,
      case when p_status in ('failed', 'partial') and step_order = 4
        then 'failed at https://internal.example/ with token ' || repeat('A', 40)
        else null
      end
    from generate_series(1, 9) as steps(step_order);
  end if;

  return v_run_id;
end;
$$;

select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'f0230001-0000-0000-0000-000000000004', 'role', 'authenticated')::text,
  true
);

update public.system_health_config set
  ingestion_enabled = false,
  pipeline_stale_after = interval '100 years',
  listings_stale_after = interval '100 years',
  scores_stale_after = interval '100 years',
  signals_stale_after = interval '100 years',
  market_reference_stale_after = interval '100 years',
  matview_stale_after = interval '100 years';

delete from public.pipeline_runs;
select pg_temp.f023_seed_pipeline('success');
insert into pg_temp.f023_tap_results (result) select is(public.get_system_health() #>> '{pipeline,status}', 'healthy', '1. healthy pipeline');

delete from public.pipeline_runs;
select pg_temp.f023_seed_pipeline('failed');
insert into pg_temp.f023_tap_results (result) select is(public.get_system_health() #>> '{pipeline,status}', 'failed', '2. failed pipeline');

delete from public.pipeline_runs;
select pg_temp.f023_seed_pipeline('running');
insert into pg_temp.f023_tap_results (result) select is(public.get_system_health() #>> '{pipeline,status}', 'running', '3. running pipeline');

delete from public.pipeline_runs;
insert into pg_temp.f023_tap_results (result) select is(public.get_system_health() #>> '{pipeline,status}', 'unknown', '4. pipeline never run');

delete from public.pipeline_runs;
select pg_temp.f023_seed_pipeline('success');
update public.listings set last_seen_at = clock_timestamp() - interval '2 days';
update public.system_health_config set ingestion_enabled = true, listings_stale_after = interval '1 microsecond';
insert into pg_temp.f023_tap_results (result) select is(public.get_system_health() #>> '{freshness,listings,status}', 'stale', '5. stale listings');

update public.listing_scores set computed_at = clock_timestamp() - interval '2 days';
update public.system_health_config set ingestion_enabled = false, listings_stale_after = interval '100 years', scores_stale_after = interval '1 microsecond';
insert into pg_temp.f023_tap_results (result) select is(public.get_system_health() #>> '{freshness,scores,status}', 'stale', '6. stale scores');

update public.listing_signals set detected_at = clock_timestamp() - interval '2 days' where is_active = true;
update public.system_health_config set scores_stale_after = interval '100 years', signals_stale_after = interval '1 microsecond';
insert into pg_temp.f023_tap_results (result) select is(public.get_system_health() #>> '{freshness,signals,status}', 'stale', '7. stale signals');

delete from public.pipeline_runs;
select pg_temp.f023_seed_pipeline('success', clock_timestamp() - interval '2 days');
update public.system_health_config set signals_stale_after = interval '100 years', matview_stale_after = interval '1 microsecond';
insert into pg_temp.f023_tap_results (result) select is(public.get_system_health() #>> '{freshness,canonical_matview,status}', 'stale', '8. stale canonical matview');

update public.system_health_config set ingestion_enabled = false, matview_stale_after = interval '100 years';
insert into pg_temp.f023_tap_results (result) select is(public.get_system_health() #>> '{ingestion,status}', 'disabled', '9. intentionally disabled ingestion');
insert into pg_temp.f023_tap_results (result) select isnt(public.get_system_health()->>'global_status', 'failed', '10. disabled ingestion is not a global failure');

delete from public.pipeline_runs;
select pg_temp.f023_seed_pipeline('success');
select pg_temp.f023_seed_pipeline('success', clock_timestamp(), 'scraper_callback');
update public.system_health_config set ingestion_enabled = true, listings_stale_after = interval '1 microsecond';
insert into pg_temp.f023_tap_results (result) select is(public.get_system_health() #>> '{ingestion,status}', 'stale', '11. active stale ingestion');

delete from public.pipeline_runs where source = 'scraper_callback';
update public.system_health_config set listings_stale_after = interval '100 years';
insert into pg_temp.f023_tap_results (result) select is(public.get_system_health() #>> '{ingestion,status}', 'unknown', '12. active ingestion without callback');

reset role;
set local role anon;
insert into pg_temp.f023_tap_results (result) select throws_ok($$ select public.get_system_health() $$, '42501', null, '13. unauthenticated denied');

reset role;
select set_config('request.jwt.claims', json_build_object('sub', 'f0230001-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;
insert into pg_temp.f023_tap_results (result) select throws_ok($$ select public.get_system_health() $$, '42501', null, '14. profile without agency denied');

reset role;
select set_config('request.jwt.claims', json_build_object('sub', 'f0230001-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
set local role authenticated;
insert into pg_temp.f023_tap_results (result) select throws_ok($$ select public.get_system_health() $$, '42501', null, '15. inactive profile denied');

reset role;
select set_config('request.jwt.claims', json_build_object('sub', 'f0230001-0000-0000-0000-000000000003', 'role', 'authenticated')::text, true);
set local role authenticated;
insert into pg_temp.f023_tap_results (result) select throws_ok($$ select public.get_system_health() $$, '42501', null, '16. non-admin agent denied');

reset role;
select set_config('request.jwt.claims', json_build_object('sub', 'f0230001-0000-0000-0000-000000000004', 'role', 'authenticated')::text, true);
set local role authenticated;
insert into pg_temp.f023_tap_results (result) select ok(public.get_system_health() ?& array['global_status', 'pipeline', 'freshness', 'ingestion', 'cron', 'history'], '17. active agency admin allowed');

reset role;
delete from public.pipeline_runs;
select pg_temp.f023_seed_pipeline('failed');
select set_config('request.jwt.claims', json_build_object('sub', 'f0230001-0000-0000-0000-000000000004', 'role', 'authenticated')::text, true);
insert into pg_temp.f023_tap_results (result) select ok(public.get_system_health() #>> '{pipeline,last_attempt,error_message}' like '%[url-redacted]%[token-redacted]%', '18. internal error is cleaned');
insert into pg_temp.f023_tap_results (result) select ok(public.get_system_health()::text !~ '(internal\\.example|AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA)', '19. no URL or token returned');

delete from public.pipeline_runs;
select pg_temp.f023_seed_pipeline('success');
select pg_temp.f023_seed_pipeline('success');
select pg_temp.f023_seed_pipeline('success');
select pg_temp.f023_seed_pipeline('success');
select pg_temp.f023_seed_pipeline('success');
select pg_temp.f023_seed_pipeline('success');
select pg_temp.f023_seed_pipeline('success');
select pg_temp.f023_seed_pipeline('success');
select pg_temp.f023_seed_pipeline('success');
select pg_temp.f023_seed_pipeline('success');
select pg_temp.f023_seed_pipeline('success');
insert into pg_temp.f023_tap_results (result) select is(jsonb_array_length(public.get_system_health()->'history'), 10, '20. history is limited to ten runs');

insert into pg_temp.f023_tap_results (result) select ok((public.get_system_health()->>'checked_at')::timestamptz is not null, '21. timestamps are timezone-aware and parseable');
insert into pg_temp.f023_tap_results (result) select is((select count(*)::integer from public.system_health_config), 1, '22. thresholds have one server-side source');

insert into pg_temp.f023_tap_results (result) select * from finish();
select result from pg_temp.f023_tap_results order by sequence;
rollback;
