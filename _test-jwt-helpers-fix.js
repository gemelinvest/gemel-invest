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

const agentIdBlock = sql.split("create or replace function public.gi_jwt_agent_id")[1].split("create or replace function public.gi_jwt_is_manager")[0];
const mgrBlock = sql.split("create or replace function public.gi_jwt_is_manager")[1];
assert(!/user_metadata/.test(agentIdBlock), "agent_id does not read user_metadata");
assert(!/user_metadata/.test(mgrBlock), "is_manager does not read user_metadata");
assert(sql.includes("'admin', 'owner', 'manager', 'adminlite', 'מנהל'"), "manager roles list preserved");

console.log("OK _test-jwt-helpers-fix.js");
