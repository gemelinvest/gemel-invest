/**
 * Contract checks for gi-open-agent-session (Pג-3, additive, zero login-risk).
 * Run: node _test-open-agent-session.js
 */
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "supabase/functions/gi-open-agent-session/index.ts"), "utf8");
const cfg = fs.readFileSync(path.join(__dirname, "supabase/config.toml"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");

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
assert(src.includes("desktopSecret") && src.includes("gi_face_sessions") && src.includes("FACE_AUTH_FAILED"), "face login can open a session without replaying PIN");
assert(src.includes("if(!pin && !desktopSecret)"), "PIN still required when there is no face proof");
assert(src.includes("if(pin)") && src.includes("signInWithPassword") && src.includes("generateLink"), "face path issues a JWT via magic link, PIN path still signs in with password");

// Honors LOCKED from the RPC (does not bypass brute-force protection).
assert(src.includes('"ACCOUNT_LOCKED"'), "must honor LOCKED");
assert(/code === "LOCKED" \? "ACCOUNT_LOCKED"/.test(src), "must map LOCKED to a clear code");

// Requires the agent to have an auth_user_id (links to provision_missing).
assert(src.includes('"AGENT_HAS_NO_AUTH_ACCOUNT"'), "must require auth_user_id");
assert(src.includes("Run provision_missing first"), "must hint to run provision_missing first");
assert(src.includes('gi_lock_agent_auth_identity'), "must lock identity to the TOTP Auth user before sign-in");

// Derives the deterministic password (same formula as gi-provision-agent-auth).
assert(/body\.sessionOnly === true/.test(src), "PIN-only can ask for a session without the password path");
assert(/AGENT_HAS_NO_AUTH_EMAIL/.test(src), "session-only does not invent an email");
assert(!/createUser/.test(src), "must not create Auth users");
const sessionOnlyBlock = src.split("if(sessionOnly)")[1].split("Sign in with the Auth user's real email")[0];
assert(sessionOnlyBlock && !/password/.test(sessionOnlyBlock), "session-only must not change the Auth password");
assert(/app_metadata: \{ agent_id: trim\(agent\.id\), role: trim\(agent\.role\) \|\| "agent" \}/.test(sessionOnlyBlock), "session-only copies the existing role");
assert(/deriveGiAuthPassword/.test(src), "must derive password deterministically");
assert(/GiCrm!.*#.*!v1/.test(src), "must use the same formula as provision (GiCrm!<pin>#<email>!v1)");

// Signs in via signInWithPassword and returns session tokens.
assert(/auth\.signInWithPassword/.test(src), "must sign in via signInWithPassword");
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

assert(app.includes("sessionOnly: !safeTrim(options.desktopSecret)"), "PIN login asks for a session without a password change");
assert(app.includes("openAgentSession(matched, pin, { sessionOnly: true, once: true })"), "MFA login opens a session without rewriting the password");
assert(app.includes("once: true"), "the best-effort session is a single attempt");
assert(app.includes("sessionOnly: extra.sessionOnly === true"), "client forwards the session-only flag");
assert(app.includes('if(!opened){\n        return this._setError'), "MFA login still stops when its own session does not open");

console.log("OK _test-open-agent-session.js");
