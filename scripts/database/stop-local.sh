#!/usr/bin/env bash
set -Eeuo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
supabase_bin="${SUPABASE_BIN:-$root_dir/node_modules/.bin/supabase}"

if [[ ! -x "$supabase_bin" ]]; then
  echo "Supabase CLI is not installed; no disposable local stack could have been started."
  exit 0
fi

"$supabase_bin" stop --no-backup --project-id immopilot-ci
