#!/usr/bin/env bash
# Keep HaveIBeenPwned leaked-password rejection off, and require new
# passwords to be 8 characters with both a letter and a digit. Agent
# passwords are random and already meet this.
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

PATCH_BODY="$(python3 - <<'PY'
import json
letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
digits = "0123456789"
print(json.dumps({
    "password_hibp_enabled": False,
    "password_min_length": 8,
    "password_required_characters": letters + ":" + digits,
}))
PY
)"
if ! AFTER="$(auth_patch "$PATCH_BODY")"; then
  echo "Auth password policy PATCH failed. The previous policy was left in place."
  exit 1
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
if cfg.get("password_min_length") != 8:
    raise SystemExit("password_min_length is not 8, got %r" % (cfg.get("password_min_length"),))
required = cfg.get("password_required_characters") or ""
for piece in ("abcdefghijklmnopqrstuvwxyz", "0123456789"):
    if piece not in required:
        raise SystemExit("password_required_characters is missing a class")
print("OK leaked-password protection is off and the password floor is 8")
' "$LIVE"
