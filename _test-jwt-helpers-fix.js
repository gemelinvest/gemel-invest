/**
 * Contract checks for JWT helpers fix (Pג-2, additive, zero-risk).
 * Run: node _test-jwt-helpers-fix.js
 */
const fs = require("fs");
const path = require("path");
const sql = fs.readFileSync(path.join(__dirname, "supabase-gi-jwt-helpers-fix.sql"), "utf8");

function assert(cond, msg){
  if(!cond) throw new Error(msg);
}

// Both helpers redefined.
assert(/create or replace function public\.gi_jwt_agent_id\(\)/i.test(sql), "must redefine gi_jwt_agent_id");
assert(/create or replace function public\.gi_jwt_is_manager\(\)/i.test(sql), "must redefine gi_jwt_is_manager");

// security definer (so they can read agents during the lookup).
assert(/security definer/i.test(sql), "helpers must be security definer");

// Preferred source: app_metadata (server-set, not user-editable).
assert(/app_metadata' ->> 'agent_id'/.test(sql), "agent_id must prefer app_metadata");
assert(/app_metadata' ->> 'role'/.test(sql), "role must prefer app_metadata");

// Authoritative lookup: agents.role / agents.id via auth_user_id.
assert(/select a\.id from public\.agents a where a\.auth_user_id = auth\.uid\(\)/i.test(sql), "agent_id must lookup agents by auth_user_id");
assert(/select lower\(coalesce\(a\.role, ''\)\) from public\.agents a where a\.auth_user_id = auth\.uid\(\)/i.test(sql),
  "is_manager must lookup agents.role by auth_user_id");

// user_metadata kept ONLY as last-resort backward-compat (no manager loses access).
const agentIdBlock = sql.split("create or replace function public.gi_jwt_agent_id")[1].split("create or replace function public.gi_jwt_is_manager")[0];
assert(/user_metadata' ->> 'agent_id'/.test(agentIdBlock), "agent_id keeps user_metadata as last resort");
const mgrBlock = sql.split("create or replace function public.gi_jwt_is_manager")[1];
assert(/user_metadata' ->> 'role'/.test(mgrBlock), "is_manager keeps user_metadata as last resort");

// Order: app_metadata BEFORE user_metadata (secure source preferred).
const agentIdOrder = agentIdBlock.indexOf("app_metadata' ->> 'agent_id'");
const agentIdUmOrder = agentIdBlock.indexOf("user_metadata' ->> 'agent_id'");
assert(agentIdOrder > -1 && agentIdUmOrder > -1 && agentIdOrder < agentIdUmOrder,
  "app_metadata must come before user_metadata");
const mgrAppOrder = mgrBlock.indexOf("app_metadata' ->> 'role'");
const mgrUmOrder = mgrBlock.indexOf("user_metadata' ->> 'role'");
assert(mgrAppOrder > -1 && mgrUmOrder > -1 && mgrAppOrder < mgrUmOrder,
  "app_metadata role must come before user_metadata role");

// Manager roles list preserved.
assert(sql.includes("'admin', 'owner', 'manager', 'adminlite', 'מנהל'"), "manager roles list preserved");

// Later gated step documented (full drop of user_metadata).
assert(/drop the user_metadata fallback entirely/i.test(sql), "must document later full drop");

console.log("OK _test-jwt-helpers-fix.js");
