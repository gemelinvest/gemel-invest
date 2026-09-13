# Walkthrough — R9-pre-B hide agent PINs

## Goal
Stop exposing `agents.pin` through the public Supabase API, while keeping CRM login working via `gi_verify_agent_login`.

## What changed
- **DB (applied in Production):** revoked table `SELECT` on `agents` for `anon`/`authenticated`, then re-granted every column **except** `pin`. Scrubbed legacy `agentsShadow.pin` values from `app_meta`.
- **app.js:** loads agents with `AGENT_PUBLIC_COLUMNS` (no pin); login requires server RPC (no fake local `0000` fallback); users edit modal treats empty PIN as “keep existing”; meta shadow no longer writes/reads pins.

## Verification already run
- `GET /rest/v1/agents?select=id,pin` → permission denied
- `GET /rest/v1/agents?select=*` → permission denied
- `GET /rest/v1/agents?select=id,name,username,role,active` → OK
- `POST /rest/v1/rpc/gi_verify_agent_login` → OK
- `has_column_privilege(anon, agents.pin, SELECT)` → false
- Re-scrubbed `app_meta.agentsShadow` pins (an old CRM tab can rewrite them until this client lands)

## Please smoke-test
1. Hard-refresh the CRM, then login with a normal agent PIN
2. Open Users management → edit a user → leave PIN blank → save (should keep old PIN)
3. Optional: set a new PIN on edit and confirm login with the new PIN
4. After deploy, confirm `agentsShadow` stays without `pin` keys

## Files
- `supabase-gi-hide-agent-pins.sql` (already applied in Production; keep in repo)
- `_test-hide-agent-pins.js`
- `_test-server-pin-login-fallback.js` (updated for fail-closed login)
