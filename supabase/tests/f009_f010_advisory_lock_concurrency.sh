#!/usr/bin/env bash
set -euo pipefail

# Real two-session regression for F-009 advisory-lock contention.
# The skipped run is inspected in session B and rolled back, so this test leaves
# no pipeline ledger rows behind.

db_url="${SUPABASE_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
hold_seconds="${F009_LOCK_HOLD_SECONDS:-8}"
max_return_seconds="${F009_MAX_RETURN_SECONDS:-5}"
session_a_log="$(mktemp)"

cleanup() {
  rm -f "$session_a_log"
}
trap cleanup EXIT

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required for the two-connection advisory-lock test" >&2
  exit 127
fi

# Session A owns the transaction-scoped lock long enough for session B to call
# the real orchestrator while contention is guaranteed.
psql "$db_url" -X -v ON_ERROR_STOP=1 >"$session_a_log" 2>&1 <<SQL &
begin;
select pg_advisory_xact_lock(public._pipeline_lock_key());
select pg_sleep(${hold_seconds});
rollback;
SQL
session_a_pid=$!

# Confirm from a distinct connection that session A really owns this key.
lock_ready=false
for _ in $(seq 1 40); do
  if psql "$db_url" -X -Atq -v ON_ERROR_STOP=1 \
      -c "select exists (select 1 from pg_locks where locktype = 'advisory' and granted and classid = 0 and objid = public._pipeline_lock_key());" \
      | grep -qx 't'; then
    lock_ready=true
    break
  fi
  sleep 0.1
done

if [[ "$lock_ready" != true ]]; then
  wait "$session_a_pid" || true
  echo "session A did not acquire the pipeline advisory lock" >&2
  cat "$session_a_log" >&2
  exit 1
fi

started_at=$(date +%s)
result=$(
  psql "$db_url" -X -Atq -F '|' -v ON_ERROR_STOP=1 <<'SQL'
begin;
create temporary table f009_existing_runs on commit drop as
select id from public.pipeline_runs;
select public.sync_daily_pipeline();
select r.status, r.source, count(s.id)
from public.pipeline_runs r
left join public.pipeline_run_steps s on s.run_id = r.id
where r.id = (
  select id
  from public.pipeline_runs
  where source = 'cron'
    and status = 'skipped'
    and metadata ->> 'reason' = 'pipeline_already_running'
    and not exists (
      select 1 from pg_temp.f009_existing_runs existing where existing.id = pipeline_runs.id
    )
  order by started_at desc, id desc
  limit 1
)
group by r.status, r.source;
rollback;
SQL
)
elapsed=$(( $(date +%s) - started_at ))

wait "$session_a_pid"

if [[ "$result" != *"skipped|cron|0"* ]]; then
  echo "expected a skipped cron run with zero steps, got: $result" >&2
  exit 1
fi

if (( elapsed >= max_return_seconds )); then
  echo "contended call took ${elapsed}s; expected less than ${max_return_seconds}s" >&2
  exit 1
fi

echo "ok - real contention returned in ${elapsed}s with skipped|cron|0"
