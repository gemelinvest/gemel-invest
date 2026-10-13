/**
 * Contract checks for Auth password sync trigger.
 * Run: node _test-sync-auth-password.js
 */
const fs = require("fs");
const path = require("path");
const sql = fs.readFileSync(path.join(__dirname, "supabase-gi-sync-auth-password.sql"), "utf8");

function assert(cond, msg){
  if(!cond) throw new Error(msg);
}

assert(/create or replace function public\.gi_sync_agent_auth_password/i.test(sql), "must define Auth password sync");
assert(/after insert or update of pin on public\.agents/i.test(sql), "must fire after pin writes");
assert(/GiCrm!/i.test(sql), "must use the gi-v1 password formula");
assert(/auth\.mfa_factors/i.test(sql) && /does not create users, change emails, or touch auth\.mfa_factors/i.test(sql), "must document that barcodes stay");
assert(!/delete from auth\.mfa_factors/i.test(sql), "must not delete MFA factors");
assert(!/unenroll/i.test(sql), "must not unenroll MFA");
assert(/new\.auth_user_id is null/i.test(sql), "must skip agents without an Auth user");
assert(/btrim\(new\.pin\) = ''/i.test(sql), "must skip when pin is cleared");
assert(/revoke all on function public\.gi_sync_agent_auth_password/i.test(sql), "must revoke public execute");

console.log("OK _test-sync-auth-password.js");
