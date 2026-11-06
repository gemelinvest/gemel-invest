/**
 * Contract checks for Auth password sync trigger.
 * Run: node _test-sync-auth-password.js
 */
const fs = require("fs");
const path = require("path");
const sql = [
  fs.readFileSync(path.join(__dirname, "supabase-gi-sync-auth-password.sql"), "utf8"),
  fs.readFileSync(path.join(__dirname, "supabase-gi-lock-auth-identity.sql"), "utf8"),
].join("\n");

function assert(cond, msg){
  if(!cond) throw new Error(msg);
}

assert(/create or replace function public\.gi_sync_agent_auth_password/i.test(sql), "must define Auth password sync");
assert(/after insert or update of pin on public\.agents/i.test(sql), "must fire after pin writes");
assert(!/GiCrm!/i.test(sql), "the password sync no longer contains the formula");
assert(!/encrypted_password/i.test(sql), "a PIN change does not rewrite the Auth password");
assert(/auth\.mfa_factors/i.test(sql) && /does not create users, change emails, or touch auth\.mfa_factors/i.test(sql), "must document that barcodes stay");
assert(!/delete from auth\.mfa_factors/i.test(sql), "must not delete MFA factors");
assert(!/unenroll/i.test(sql), "must not unenroll MFA");
assert(/return new;/i.test(sql), "the trigger leaves the agent row unchanged");
assert(!/btrim\(new\.pin\)/i.test(sql), "the trigger no longer reads the PIN");
assert(/revoke all on function public\.gi_sync_agent_auth_password/i.test(sql), "must revoke public execute");

console.log("OK _test-sync-auth-password.js");
