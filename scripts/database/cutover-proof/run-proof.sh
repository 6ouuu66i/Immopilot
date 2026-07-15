#!/usr/bin/env bash
set -Eeuo pipefail
set +x

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
script_dir="$root_dir/scripts/database/cutover-proof"
supabase_bin="$root_dir/node_modules/.bin/supabase"
proof_root="${RUNNER_TEMP:?RUNNER_TEMP is required}/cutover-schema-proof"
artifact_dir="$proof_root/artifacts"
raw_dir="$proof_root/raw"
local_db_url="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
postgres_image="postgres:17"
restore_status=0
compare_status=0
stack_started=false

cleanup() {
  if [[ "$stack_started" == true ]]; then
    set +e
    "$supabase_bin" stop --no-backup --project-id immopilot-ci >/dev/null 2>&1
    cleanup_status=$?
    set -e
    if (( cleanup_status != 0 )); then
      echo "Disposable Supabase cleanup returned status $cleanup_status." >&2
    fi
  fi
  rm -rf -- "$raw_dir"
}
trap cleanup EXIT

mkdir -p -- "$artifact_dir" "$raw_dir"
if [[ -z "${CUTOVER_DATABASE_URL:-}" ]]; then
  echo "CUTOVER_DATABASE_URL is not configured in the protected environment." >&2
  exit 2
fi
if [[ "$($supabase_bin --version)" != "2.109.1" ]]; then
  echo "The proof requires Supabase CLI 2.109.1." >&2
  exit 2
fi

export DATABASE_URL="$CUTOVER_DATABASE_URL"
export PGOPTIONS="-c default_transaction_read_only=on"

# Capture the official CLI dry-run without ever streaming its raw output.
set +e
"$supabase_bin" db dump --db-url "$DATABASE_URL" --schema public --dry-run \
  >"$raw_dir/dump-dry-run.raw" 2>&1
dry_run_status=$?
set -e
node "$script_dir/sanitize-output.mjs" \
  "$raw_dir/dump-dry-run.raw" "$artifact_dir/dump-dry-run-sanitized.txt"
rm -f -- "$raw_dir/dump-dry-run.raw"
if (( dry_run_status != 0 )); then
  echo "Supabase CLI dump dry-run failed; sanitized output retained locally." >&2
  exit "$dry_run_status"
fi

# Use the official PostgreSQL 17 image for both the read-only assertion and dump.
readonly_state="$(docker run --rm \
  -e DATABASE_URL -e PGOPTIONS \
  "$postgres_image" \
  psql "$DATABASE_URL" -X -Atq -v ON_ERROR_STOP=1 \
  -c "show default_transaction_read_only")"
if [[ "$readonly_state" != "on" ]]; then
  echo "Remote connection did not inherit default_transaction_read_only=on." >&2
  exit 3
fi
printf '%s\n' 'default_transaction_read_only=on' >"$artifact_dir/read-only-proof.txt"

docker run --rm \
  -e DATABASE_URL -e PGOPTIONS \
  -v "$artifact_dir:/proof" \
  "$postgres_image" \
  pg_dump "$DATABASE_URL" \
  --schema-only \
  --schema=public \
  --no-password \
  --file=/proof/public-schema-current.sql

docker run --rm \
  -e DATABASE_URL -e PGOPTIONS \
  -v "$script_dir:/proof-scripts:ro" \
  "$postgres_image" \
  psql "$DATABASE_URL" -X -Atq -v ON_ERROR_STOP=1 \
  -f /proof-scripts/fingerprint.sql \
  >"$artifact_dir/remote-schema-fingerprint.json"

docker run --rm \
  -e DATABASE_URL -e PGOPTIONS \
  -v "$script_dir:/proof-scripts:ro" \
  "$postgres_image" \
  psql "$DATABASE_URL" -X -Atq -v ON_ERROR_STOP=1 \
  -f /proof-scripts/scrape-runs-dependencies.sql \
  >"$artifact_dir/scrape-runs-catalog-dependencies.json"

sha256sum "$artifact_dir/public-schema-current.sql" \
  >"$artifact_dir/public-schema-current.sql.sha256"
node "$script_dir/scan-dump.mjs" \
  "$artifact_dir/public-schema-current.sql" \
  "$artifact_dir/dump-security-report.json"
node "$script_dir/inventory-scrape-runs.mjs" \
  "$root_dir" "$artifact_dir/scrape-runs-source-dependencies.json"
node "$script_dir/write-out-of-dump-inventory.mjs" \
  "$artifact_dir/objects-outside-public-dump.json"
node "$script_dir/scan-dump.mjs" \
  "$artifact_dir/remote-schema-fingerprint.json" \
  "$artifact_dir/remote-inventory-security-report.json" --log
node "$script_dir/scan-dump.mjs" \
  "$artifact_dir/scrape-runs-catalog-dependencies.json" \
  "$artifact_dir/scrape-runs-catalog-security-report.json" --log
node "$script_dir/scan-dump.mjs" \
  "$artifact_dir/scrape-runs-source-dependencies.json" \
  "$artifact_dir/scrape-runs-source-security-report.json" --log

set +e
node "$script_dir/assert-no-hard-dependencies.mjs" \
  "$artifact_dir/scrape-runs-catalog-dependencies.json" \
  "$artifact_dir/scrape-runs-source-dependencies.json" \
  "$artifact_dir/scrape-runs-dependency-verdict.json"
dependency_status=$?
set -e
if (( dependency_status != 0 )); then
  printf '%s\n' 'artifact_safe=true' >>"${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"
  exit "$dependency_status"
fi

# Runner-only worktree preparation: legacy migrations leave the active path only here.
node "$script_dir/prepare-local-worktree.mjs" "$root_dir" "$proof_root/legacy-migrations"

set +e
"$supabase_bin" start >"$raw_dir/supabase-start.raw" 2>&1
start_status=$?
set -e
node "$script_dir/sanitize-output.mjs" \
  "$raw_dir/supabase-start.raw" "$artifact_dir/supabase-start-sanitized.log"
rm -f -- "$raw_dir/supabase-start.raw"
if (( start_status != 0 )); then
  node "$script_dir/scan-dump.mjs" \
    "$artifact_dir/supabase-start-sanitized.log" \
    "$artifact_dir/start-log-security-report.json" --log
  printf '%s\n' 'artifact_safe=true' >>"${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"
  exit "$start_status"
fi
stack_started=true

for _ in $(seq 1 30); do
  if psql "$local_db_url" -X -Atq -v ON_ERROR_STOP=1 -c 'select 1' >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
psql "$local_db_url" -X -Atq -v ON_ERROR_STOP=1 -c 'select 1' >/dev/null

managed_prerequisites="$(psql "$local_db_url" -X -Atq -v ON_ERROR_STOP=1 <<'SQL'
SELECT
  to_regnamespace('auth') IS NOT NULL
  AND to_regnamespace('storage') IS NOT NULL
  AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
  AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
  AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role');
SQL
)"
if [[ "$managed_prerequisites" != "t" ]]; then
  echo "Disposable Supabase stack is missing managed schemas or API roles." >&2
  exit 6
fi
printf '%s\n' 'auth/storage schemas and anon/authenticated/service_role roles present' \
  >"$artifact_dir/local-managed-prerequisites.txt"

psql "$local_db_url" -X -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
SQL

set +e
psql "$local_db_url" -X -v ON_ERROR_STOP=1 --single-transaction \
  -f "$artifact_dir/public-schema-current.sql" \
  >"$raw_dir/restore.raw" 2>&1
restore_status=$?
set -e
node "$script_dir/sanitize-output.mjs" \
  "$raw_dir/restore.raw" "$artifact_dir/restore-sanitized.log"
rm -f -- "$raw_dir/restore.raw"

if (( restore_status == 0 )); then
  psql "$local_db_url" -X -Atq -v ON_ERROR_STOP=1 \
    -f "$script_dir/fingerprint.sql" \
    >"$artifact_dir/local-schema-fingerprint.json"
  set +e
  node "$script_dir/compare-fingerprints.mjs" \
    "$artifact_dir/remote-schema-fingerprint.json" \
    "$artifact_dir/local-schema-fingerprint.json" \
    "$artifact_dir/schema-diff.json"
  compare_status=$?
  set -e
else
  node "$script_dir/write-restore-failure.mjs" \
    "$restore_status" "$artifact_dir/schema-diff.json"
fi

node "$script_dir/scan-dump.mjs" \
  "$artifact_dir/restore-sanitized.log" \
  "$artifact_dir/restore-log-security-report.json" --log
if [[ -f "$artifact_dir/local-schema-fingerprint.json" ]]; then
  node "$script_dir/scan-dump.mjs" \
    "$artifact_dir/local-schema-fingerprint.json" \
    "$artifact_dir/local-inventory-security-report.json" --log
fi

printf '%s\n' 'artifact_safe=true' >>"${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"
if (( restore_status != 0 )); then
  exit "$restore_status"
fi
if (( compare_status != 0 )); then
  exit "$compare_status"
fi

echo "Cutover schema proof completed with a restorable dump and no blocking fingerprint differences."
