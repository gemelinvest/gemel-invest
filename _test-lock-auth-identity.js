/**
 * Contract checks for the one-Auth-identity lock.
 * Run: node _test-lock-auth-identity.js
 */
const fs = require("fs");
const path = require("path");

const sql = fs.readFileSync(path.join(__dirname, "supabase-gi-lock-auth-identity.sql"), "utf8");
const provision = fs.readFileSync(path.join(__dirname, "supabase/functions/gi-provision-agent-auth/index.ts"), "utf8");
const session = fs.readFileSync(path.join(__dirname, "supabase/functions/gi-open-agent-session/index.ts"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

function assert(cond, msg){
  if(!cond) throw new Error(msg);
}

assert(/gi_pick_agent_auth_user/i.test(sql), "must pick a canonical Auth user");
assert(/auth\.mfa_factors/i.test(sql), "must prefer the verified TOTP user");
assert(/gemel-invest\.internal/i.test(sql), "must not prefer leftover technical Auth users");
assert(/trg_gi_lock_agent_auth_identity/i.test(sql), "must lock identity on agents writes");
assert(/gi_lock_agent_auth_identity/i.test(sql), "must expose a service_role repair RPC");
assert(!/delete from auth\.mfa_factors/i.test(sql), "must not delete MFA factors");
assert(!/unenroll/i.test(sql), "must not unenroll MFA");
assert(/TOTP barcodes stay/i.test(sql), "must document that barcodes stay");
assert(/grant execute on function public\.gi_lock_agent_auth_identity/i.test(sql), "service_role can repair");
assert(/revoke all on function public\.gi_pick_agent_auth_user/i.test(sql), "must not expose pick to public");
assert(/GiCrm!/i.test(sql), "password sync must stay on the gi-v1 formula");

assert(/findAuthUserByEmail\(sb, a\.proposedEmail\)/.test(provision), "provision links existing Auth users");
assert(/gi_pick_agent_auth_user/.test(provision), "provision asks SQL for the TOTP identity");
assert(/gi_lock_agent_auth_identity/.test(session), "session open relocks identity before sign-in");
assert(/safeTrim\(agent\?\.email\) \|\| safeTrim\(sec\.authEmail\)/.test(app), "login uses the roster Auth email first");
assert(html.includes("giAuthLock=1"), "login cache tag bumped");

console.log("OK _test-lock-auth-identity.js");
