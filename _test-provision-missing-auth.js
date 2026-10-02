/**
 * Contract checks for provision_missing / preview_missing (Track Pג step 1).
 * Run: node _test-provision-missing-auth.js
 */
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "supabase/functions/gi-provision-agent-auth/index.ts"), "utf8");

function assert(cond, msg){
  if(!cond) throw new Error(msg);
}

// New actions accepted by the dispatcher.
assert(src.includes('"preview_missing"'), "must accept preview_missing action");
assert(src.includes('"provision_missing"'), "must accept provision_missing action");
assert(!/if\(action !== "sync"\)\s*{[^}]*return/.test(src.split("preview_missing")[0]),
  "dispatcher must not reject before reaching new actions");

// Helpers present.
assert(/function randomPassword\(/.test(src), "must define randomPassword");
assert(/function technicalEmailFor\(/.test(src), "must define technicalEmailFor");
assert(/async function listMissingAgents\(/.test(src), "must define listMissingAgents");
assert(/async function provisionMissing\(/.test(src), "must define provisionMissing");

// Technical email pattern default + configurable via env.
assert(src.includes("agent+<id>@gemel-invest.internal"), "default technical email pattern");
assert(/INTERNAL_AGENT_EMAIL_PATTERN/.test(src), "pattern must be configurable via env");

// Only active agents without auth_user_id are listed.
assert(/\.is\("auth_user_id", null\)/.test(src), "must filter auth_user_id is null");
assert(/r\.active !== false/.test(src), "must keep only active agents");

// Proposed email = existing email if present, else technical.
assert(/normalizeEmail\(r\.email\) \|\| technicalEmailFor/.test(src), "proposed email = existing or technical");

// provision_missing creates Auth user with app_metadata, no MFA, email_confirm.
assert(/sb\.auth\.admin\.createUser\(/.test(src), "must create Auth user");
assert(/app_metadata:\s*\{\s*agent_id/.test(src), "must set app_metadata.agent_id");
assert(/role:\s*a\.role/.test(src), "must set app_metadata.role");
assert(/email_confirm:\s*true/.test(src), "must confirm email");

// MUST NOT touch agents.email (only auth_user_id is updated in provisionMissing).
assert(/update\(\{\s*auth_user_id:\s*authUserId,\s*updated_at:\s*new Date\(\)\.toISOString\(\)\s*\}\)/.test(src),
  "provisionMissing must update auth_user_id only (no agents.email)");

// Random password (agent never types it).
assert(/crypto\.getRandomValues/.test(src), "password must be random + strong");

// preview returns the list without creating.
assert(/action === "preview_missing"/.test(src), "preview branch must exist");
assert(/proposedEmail/.test(src), "preview must return proposedEmail");

// Existing sync action preserved.
assert(/action !== "sync" && action !== "preview_missing" && action !== "provision_missing"/.test(src),
  "sync must remain a valid action");
assert(/skippedAuth:\s*"no_auth_user"/.test(src), "existing sync skippedAuth behavior preserved");

// Brace balance sanity (rough).
const opens = (src.match(/{/g) || []).length;
const closes = (src.match(/}/g) || []).length;
assert(opens === closes, "brace balance off: " + opens + " vs " + closes);

console.log("OK _test-provision-missing-auth.js");
