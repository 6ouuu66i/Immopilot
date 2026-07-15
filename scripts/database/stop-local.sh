#!/usr/bin/env bash
set -Eeuo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
supabase_bin="${SUPABASE_BIN:-$root_dir/node_modules/.bin/supabase}"

"$supabase_bin" stop --no-backup --project-id immopilot-ci
