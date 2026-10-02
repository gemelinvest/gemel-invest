/**
 * Contract checks for gi-open-agent-session (Pג-3, additive, zero login-risk).
 * Run: node _test-open-agent-session.js
 */
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "supabase/functions/gi-open-agent-session/index.ts"), "utf8");
const cfg = fs.readFileSync(path.join(__dirname, "supabase/config.toml"), "utf8");

function assert(cond, msg){
  if(!cond) throw new Error(msg);
}

// Function exists and is POST-only.
assert(/Deno\.serve\(async \(req: Request\)/.test(src), "must Deno.serve");
assert(/req\.method !== "POST"/.test(src), "must be POST-only");
assert(/req\.method === "OPTIONS"/.test(src), "must handle OPTIONS");

// Verifies PIN via the existing security-definer RPC (brute-force protection reused).
assert(/gi_verify_agent_login/.test(src), "must verify PIN via gi_verify_agent_login RPC");
assert(/p_username/.test(src) && /p_pin/.test(src), "must pass username + pin to RPC");

// Honors LOCKED from the RPC (does not bypass brute-force protection).
assert(src.includes('"ACCOUNT_LOCKED"'), "must honor LOCKED");
assert(/code === "LOCKED" \? "ACCOUNT_LOCKED"/.test(src), "must map LOCKED to a clear code");

// Requires the agent to have an auth_user_id (links to provision_missing).
assert(src.includes('"AGENT_HAS_NO_AUTH_ACCOUNT"'), "must require auth_user_id");
assert(src.includes("Run provision_missing first"), "must hint to run provision_missing first");

// Derives the deterministic password (same formula as gi-provision-agent-auth).
assert(/deriveGiAuthPassword/.test(src), "must derive password deterministically");
assert(/GiCrm!.*#.*!v1/.test(src), "must use the same formula as provision (GiCrm!<pin>#<email>!v1)");

// Signs in via signInWithPassword and returns session tokens.
assert(/sb\.auth\.signInWithPassword/.test(src), "must sign in via signInWithPassword");
assert(/access_token/.test(src) && /refresh_token/.test(src), "must return access_token + refresh_token");

// Additive: on failure, returns fallback: anon (does not break login).
assert(/fallback: "anon"/.test(src), "must fall back to anon on failure (never break login)");

// Never exposes service_role to the browser: no json() response payload includes the key.
const jsonCalls = src.match(/json\(\{[\s\S]*?\}\s*,\s*\d{3,4\}\)/g) || [];
assert(jsonCalls.every((c) => !/service_role|sb_secret_|SUPABASE_SERVICE_ROLE_KEY/.test(c)),
  "no json() response must include the service role key");

// config.toml: verify_jwt stays false (function self-verifies via PIN RPC).
assert(/\[functions\.gi-open-agent-session\]/.test(cfg), "config.toml must register the function");
assert(/verify_jwt = false/.test(cfg.split("[functions.gi-open-agent-session]")[1]), "verify_jwt must stay false");

console.log("OK _test-open-agent-session.js");
