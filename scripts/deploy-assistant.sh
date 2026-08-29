#!/usr/bin/env bash
# Deploy all GI assistant Edge Functions to project vhvlkerectggovfihjgm.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
BIN="${SUPABASE_BIN:-}"
if [[ -z "$BIN" ]]; then
  if command -v supabase >/dev/null 2>&1; then
    BIN="supabase"
  else
    BIN="npx --yes supabase"
  fi
fi
REF="${SUPABASE_PROJECT_REF:-vhvlkerectggovfihjgm}"
for fn in gi-assistant-pairing gi-assistant-realtime gi-assistant-engine gi-assistant-tools; do
  echo "Deploy $fn"
  $BIN functions deploy "$fn" --project-ref "$REF" --no-verify-jwt
done
echo "OK"
