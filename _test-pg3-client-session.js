/**
 * Contract checks for Pג-3 (open Auth session after PIN, additive).
 * Run: node _test-pg3-client-session.js
 */
const fs = require("fs");
const path = require("path");
const app = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");

function assert(cond, msg){
  if(!cond) throw new Error(msg);
}

// Helper added.
assert(/async function openAgentSession\(matched, pin\)/.test(app), "must define openAgentSession helper");
assert(/client\.rpc\("gi_open_agent_session"/.test(app), "must call the gi_open_agent_session Edge function");

// Additive: on failure, returns null (login stays anon).
assert(/return null;/.test(app), "must return null on failure");
assert(/catch\(_e\) \{[\s\S]*?console\.warn/.test(app), "must log + swallow errors (never break login)");

// setSession stores the JWT for subsequent requests.
assert(/client\.auth\.setSession\(/.test(app), "must call client.auth.setSession");

// Called from completeAgentLogin after Auth.current is set.
const completeBlock = app.split("const completeAgentLogin")[1].split("function normalizeAgentLabelToken")[0];
assert(/openAgentSession\(matched, Auth\._sessionPin/.test(completeBlock), "must call openAgentSession in completeAgentLogin");

// Existing login behavior preserved (PIN path unchanged).
assert(app.includes('client.rpc("gi_verify_agent_login"'), "PIN verify RPC preserved");
assert(app.includes('source:"local"'), "local fallback preserved");
assert(app.includes('source:"server"'), "server source preserved");

console.log("OK _test-pg3-client-session.js");
