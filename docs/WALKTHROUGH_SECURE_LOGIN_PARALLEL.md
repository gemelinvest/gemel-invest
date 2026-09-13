# Walkthrough — Secure login parallel path (zero login risk)

## What changed
- `app.js`: `verifyAgentPinForLogin()` tries Supabase RPC `gi_verify_agent_login` first; on missing RPC / technical failure falls back to the existing browser PIN compare.
- `supabase-gi-verify-agent-login.sql`: additive SQL to create the RPC (does **not** revoke `agents.pin`).
- Docs/roadmap updated for R9-pre-A / R9-pre-B split.

## Why login cannot break
1. Admin login path unchanged.
2. MFA Auth password path unchanged.
3. Face login unchanged.
4. If the RPC is not deployed yet → local PIN compare runs exactly as before.
5. `agents.pin` column is **not** revoked in this PR.

## How to activate server verify in Production
1. Merge this PR (app already safe with fallback).
2. Run `supabase-gi-verify-agent-login.sql` once in Supabase SQL Editor.
3. Login as a normal agent; confirm entry works.
4. Only later (separate approval): R9-pre-B hide `agents.pin`.

## Test
```bash
node _test-server-pin-login-fallback.js
```
