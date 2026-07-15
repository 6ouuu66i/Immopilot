#!/usr/bin/env bash
set -Eeuo pipefail
set +x

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
script_dir="$root_dir/scripts/database/cutover-proof"
supabase_bin="$root_dir/node_modules/.bin/supabase"
proof_root="${RUNNER_TEMP:?RUNNER_TEMP is required}/cutover-schema-proof"
artifact_dir="$proof_root/artifacts"
security_report_dir="$proof_root/security-report-only"
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

mkdir -p -- "$artifact_dir" "$security_report_dir" "$raw_dir"
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

# Record only the credential-free command shape used by the proof.
cat >"$artifact_dir/dump-command-sanitized.txt" <<'EOF'
pg_dump [REDACTED_DATABASE_URL] --schema-only --schema=public --format=plain --no-owner --no-tablespaces --file=[RUNNER_TEMP]/public-schema-current.sql
EOF
node "$script_dir/scan-dump.mjs" \
  "$artifact_dir/dump-command-sanitized.txt" \
  "$artifact_dir/dump-command-security-report.json" --log

# Prove PGOPTIONS and reject any credential with direct, inherited, ownership, or
# SECURITY DEFINER write capabilities before handing it to pg_dump.
pgoptions_state="$(docker run --rm \
  -e DATABASE_URL -e PGOPTIONS \
  "$postgres_image" \
  sh -eu -c 'psql "$DATABASE_URL" -X -Atq -v ON_ERROR_STOP=1 -c "show default_transaction_read_only"')"
readonly_probe="$(docker run --rm \
  -e DATABASE_URL -e PGOPTIONS \
  -v "$script_dir:/proof-scripts:ro" \
  "$postgres_image" \
  sh -eu -c 'psql "$DATABASE_URL" -X -Atq -v ON_ERROR_STOP=1 -f /proof-scripts/verify-readonly-role.sql')"
IFS='|' read -r remote_login_role role_is_readonly <<<"$readonly_probe"
if [[ ! "$remote_login_role" =~ ^cutover_schema_reader_[0-9]{8}$ ]]; then
  echo "Remote credential uses an unexpected login identity." >&2
  exit 3
fi
if [[ "$pgoptions_state" != "on" || "$role_is_readonly" != "true" ]]; then
  echo "Remote credential did not satisfy the strict read-only role contract." >&2
  exit 3
fi
{
  printf '%s\n' 'Supabase CLI: 2.109.1'
  docker run --rm "$postgres_image" pg_dump --version
  docker run --rm "$postgres_image" psql --version
} >"$artifact_dir/tool-versions.txt"
printf '%s\n' '{"pgoptionsProbe":"default_transaction_read_only=on","identityVerified":true,"credentialDefaultTransactionReadOnly":true,"credentialWriteCapabilities":false,"credentialMemberships":false,"credentialOwnerships":false,"publicSecurityDefinerWritePaths":false,"guarantee":"PostgreSQL 17 pg_dump connects directly as the temporary login role without SET ROLE and the credential is rejected on any direct, inherited, ownership, or privileged-function write path"}' \
  >"$artifact_dir/read-only-proof.json"

set +e
docker run --rm \
  -e DATABASE_URL -e PGOPTIONS \
  -v "$artifact_dir:/proof-output" \
  "$postgres_image" \
  sh -eu -c 'exec pg_dump "$DATABASE_URL" \
    --schema-only \
    --schema=public \
    --format=plain \
    --no-owner \
    --no-tablespaces \
    --file=/proof-output/public-schema-current.sql' \
  >"$raw_dir/dump.raw" 2>&1
dump_status=$?
set -e
node "$script_dir/sanitize-output.mjs" \
  "$raw_dir/dump.raw" "$artifact_dir/dump-sanitized.log"
rm -f -- "$raw_dir/dump.raw"
node "$script_dir/scan-dump.mjs" \
  "$artifact_dir/dump-sanitized.log" \
  "$artifact_dir/dump-log-security-report.json" --log
if (( dump_status != 0 )); then
  echo "PostgreSQL 17 schema dump failed; sanitized output retained." >&2
  exit "$dump_status"
fi

docker run --rm \
  -e DATABASE_URL -e PGOPTIONS \
  -v "$script_dir:/proof-scripts:ro" \
  "$postgres_image" \
  sh -eu -c 'psql "$DATABASE_URL" -X -Atq -v ON_ERROR_STOP=1 -f /proof-scripts/fingerprint.sql' \
  >"$artifact_dir/remote-schema-fingerprint.json"

docker run --rm \
  -e DATABASE_URL -e PGOPTIONS \
  -v "$script_dir:/proof-scripts:ro" \
  "$postgres_image" \
  sh -eu -c 'psql "$DATABASE_URL" -X -Atq -v ON_ERROR_STOP=1 -f /proof-scripts/scrape-runs-dependencies.sql' \
  >"$artifact_dir/scrape-runs-catalog-dependencies.json"

sha256sum "$artifact_dir/public-schema-current.sql" \
  >"$artifact_dir/public-schema-current.sql.sha256"
set +e
node "$script_dir/scan-dump.mjs" \
  "$artifact_dir/public-schema-current.sql" \
  "$artifact_dir/dump-security-report.json"
dump_scan_status=$?
set -e
if (( dump_scan_status != 0 )); then
  cp -- "$artifact_dir/dump-security-report.json" "$security_report_dir/dump-security-report.json"
  rm -f -- "$artifact_dir/public-schema-current.sql" "$artifact_dir/public-schema-current.sql.sha256"
  printf '%s\n' 'security_report_only=true' >>"${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"
  exit "$dump_scan_status"
fi
node "$script_dir/inventory-scrape-runs.mjs" \
  "$root_dir" "$artifact_dir/scrape-runs-source-dependencies.json"
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

preexisting_public_objects="$(psql "$local_db_url" -X -Atq -v ON_ERROR_STOP=1 <<'SQL'
SELECT count(*)
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S','f')
  AND NOT EXISTS (
    SELECT 1 FROM pg_depend d
    WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='e'
  );
SQL
)"
if [[ "$preexisting_public_objects" != "0" ]]; then
  echo "Disposable public schema contains duplicate non-extension objects before restore." >&2
  exit 6
fi

psql "$local_db_url" -X -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
SQL

# Preserve the temporary schema ACL during restore without granting it any local login.
psql "$local_db_url" -X -v ON_ERROR_STOP=1 \
  --set=cutover_role="$remote_login_role" <<'SQL' >/dev/null
SELECT format('CREATE ROLE %I NOLOGIN', :'cutover_role') \gexec
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
  node "$script_dir/write-out-of-dump-inventory.mjs" \
    "$artifact_dir/remote-schema-fingerprint.json" \
    "$artifact_dir/local-schema-fingerprint.json" \
    "$artifact_dir/objects-outside-public-dump.json"
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
