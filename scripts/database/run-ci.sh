#!/usr/bin/env bash
set -Eeuo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
script_dir="$root_dir/scripts/database"
supabase_bin="$root_dir/node_modules/.bin/supabase"
local_db_url="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
expected_cli_version="2.109.1"
stack_may_exist=false

cleanup() {
  initial_status=$?
  trap - EXIT
  cleanup_status=0
  if [[ "$stack_may_exist" == true ]]; then
    set +e
    SUPABASE_BIN="$supabase_bin" bash "$script_dir/stop-local.sh"
    cleanup_status=$?
    set -e
  fi
  if (( initial_status == 0 && cleanup_status != 0 )); then
    exit "$cleanup_status"
  fi
  exit "$initial_status"
}
trap cleanup EXIT

cd "$root_dir"
node "$script_dir/guard-local-only.mjs"
inventory_json="$(node "$script_dir/inventory.mjs")"
migration_count="$(node -e 'const data=JSON.parse(process.argv[1]);process.stdout.write(String(data.migrationCount))' "$inventory_json")"
suite_count="$(node -e 'const data=JSON.parse(process.argv[1]);process.stdout.write(String(data.suiteCount))' "$inventory_json")"
assertion_count="$(node -e 'const data=JSON.parse(process.argv[1]);process.stdout.write(String(data.assertionCount))' "$inventory_json")"
expected_versions="$(node -e 'const data=JSON.parse(process.argv[1]);process.stdout.write(data.migrationVersions.join(","))' "$inventory_json")"

if [[ ! -x "$supabase_bin" ]]; then
  echo "Pinned Supabase CLI is not installed. Run npm ci first." >&2
  exit 1
fi
if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required for database readiness and migration verification." >&2
  exit 127
fi
cli_version="$($supabase_bin --version)"
if [[ "$cli_version" != "$expected_cli_version" ]]; then
  echo "Unexpected Supabase CLI version: $cli_version" >&2
  exit 1
fi

echo "Database CI inventory: migrations=$migration_count suites=$suite_count assertions=$assertion_count cli=$cli_version postgres=17"
stack_may_exist=true
SUPABASE_BIN="$supabase_bin" bash "$script_dir/stop-local.sh"
"$supabase_bin" start

database_ready=false
for _ in $(seq 1 30); do
  if psql "$local_db_url" -X -Atq -v ON_ERROR_STOP=1 -c 'select 1' >/dev/null 2>&1; then
    database_ready=true
    break
  fi
  sleep 1
done
if [[ "$database_ready" != true ]]; then
  echo "Local PostgreSQL did not become ready within 30 seconds." >&2
  exit 1
fi

"$supabase_bin" db reset --local --no-seed
applied_count="$(psql "$local_db_url" -X -Atq -v ON_ERROR_STOP=1 -c 'select count(*) from supabase_migrations.schema_migrations')"
applied_versions="$(psql "$local_db_url" -X -Atq -v ON_ERROR_STOP=1 -c "select string_agg(version, ',' order by version) from supabase_migrations.schema_migrations")"
if [[ "$applied_count" != "$migration_count" || "$applied_versions" != "$expected_versions" ]]; then
  echo "Local migration history does not match the repository inventory." >&2
  exit 1
fi

SUPABASE_BIN="$supabase_bin" bash "$script_dir/run-pgtap.sh"
SUPABASE_DB_URL="$local_db_url" bash "$root_dir/supabase/tests/f009_f010_advisory_lock_concurrency.sh"

echo "Database CI summary: migrations=$applied_count suites=$suite_count assertions=$assertion_count concurrency=passed"
