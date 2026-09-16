#!/usr/bin/env bash
# Disable HaveIBeenPwned leaked-password rejection on hosted Auth so Studio
# (and admin createUser) accepts any password that meets the length floor.
set -euo pipefail

: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN is required}"
PROJECT_REF="${PROJECT_REF:-vhvlkerectggovfihjgm}"
API="https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth"

auth_get() {
  curl -sS -f -X GET "$API" \
    -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
    -H "Content-Type: application/json"
}

auth_patch() {
  curl -sS -f -X PATCH "$API" \
    -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$1"
}

summarize() {
  python3 -c '
import json, sys
cfg = json.load(sys.stdin)
keys = (
  "password_hibp_enabled",
  "password_min_length",
  "password_required_characters",
)
print({k: cfg.get(k) for k in keys})
'
}

echo "Auth password policy before:"
BEFORE="$(auth_get)"
echo "$BEFORE" | summarize

PATCH_BODY='{"password_hibp_enabled":false,"password_min_length":6,"password_required_characters":""}'
if ! AFTER="$(auth_patch "$PATCH_BODY")"; then
  echo "PATCH with empty password_required_characters failed; retrying HIBP + min length only."
  AFTER="$(auth_patch '{"password_hibp_enabled":false,"password_min_length":6}')"
fi

echo "Auth password policy after PATCH:"
echo "$AFTER" | summarize

echo "Auth password policy re-read:"
LIVE="$(auth_get)"
echo "$LIVE" | summarize

python3 -c '
import json, sys
cfg = json.loads(sys.argv[1])
hibp = cfg.get("password_hibp_enabled")
if hibp is True:
    raise SystemExit("password_hibp_enabled is still true")
if hibp is not False:
    raise SystemExit("password_hibp_enabled was not confirmed false, got %r" % (hibp,))
print("OK leaked-password protection is off")
' "$LIVE"
