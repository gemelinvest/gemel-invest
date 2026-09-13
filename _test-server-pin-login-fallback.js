/**
 * Contract checks for zero-risk server PIN verify path.
 * Run: node _test-server-pin-login-fallback.js
 */
const fs = require("fs");
const path = require("path");
const app = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
const sql = fs.readFileSync(path.join(__dirname, "supabase-gi-verify-agent-login.sql"), "utf8");

function assert(cond, msg){
  if(!cond) throw new Error(msg);
}

assert(app.includes("async function verifyAgentPinForLogin"), "missing verifyAgentPinForLogin");
assert(app.includes('client.rpc("gi_verify_agent_login"'), "login must call gi_verify_agent_login RPC");
assert(app.includes("GI_VERIFY_AGENT_LOGIN_ERROR") || app.includes("GI_VERIFY_AGENT_LOGIN_FALLBACK"),
  "must log RPC verify errors");
assert(app.includes('source:"local"'), "may still compare in-memory pin if present");
assert(app.includes('source:"server"'), "must support server source");
assert(app.includes('source:"server_unavailable"'), "must fail closed when RPC down and no local pin");
assert((app.match(/verifyAgentPinForLogin\(matched, pin\)/g) || []).length >= 2,
  "Auth._submit must use helper in both pin paths");
assert(!/else if\s*\(\s*pin\s*!==\s*expected\s*\)/.test(app),
  "old direct pin compare in Auth._submit else-branch should be gone");
assert(!/expectedLocal\s*=\s*safeTrim\(agent\?\.pin\)\s*\|\|\s*"0000"/.test(app),
  "must not invent default local PIN 0000 for login");

assert(/create or replace function public\.gi_verify_agent_login/i.test(sql), "SQL must define RPC");
assert(/security definer/i.test(sql), "RPC must be security definer");
assert(sql.includes("'BAD_PIN'"), "SQL must return BAD_PIN");
assert(sql.includes("Never return the pin"), "SQL must document no pin in response");
assert(/grant execute on function public\.gi_verify_agent_login/i.test(sql), "must grant execute");

console.log("OK _test-server-pin-login-fallback.js");
