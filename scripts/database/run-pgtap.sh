#!/usr/bin/env bash
set -Eeuo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
supabase_bin="${SUPABASE_BIN:-$root_dir/node_modules/.bin/supabase}"

cd "$root_dir"
mapfile -t suites < <(find supabase/tests -maxdepth 1 -type f -name '*.test.sql' -printf '%p\n' | sort)
if (( ${#suites[@]} == 0 )); then
  echo "No pgTAP suite discovered." >&2
  exit 1
fi

for suite in "${suites[@]}"; do
  echo "Running pgTAP suite: $(basename "$suite")"
  "$supabase_bin" test db --local "$suite"
done
