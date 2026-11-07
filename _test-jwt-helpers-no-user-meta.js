/**
 * The helper cut removes user_metadata and does not touch policies.
 * Run: node _test-jwt-helpers-no-user-meta.js
 */
const fs = require("fs");
const path = require("path");
const sql = fs.readFileSync(path.join(__dirname, "supabase-gi-jwt-helpers-no-user-meta.sql"), "utf8");
const body = sql.replace(/--[^\n]*/g, "");

function assert(cond, msg){
  if(!cond) throw new Error(msg);
}

assert(body.includes("create or replace function public.gi_jwt_agent_id()"), "replaces gi_jwt_agent_id");
assert(body.includes("create or replace function public.gi_jwt_is_manager()"), "replaces gi_jwt_is_manager");
assert(body.includes("create or replace function public.gi_jwt_role()"), "replaces gi_jwt_role");
assert((body.match(/user_metadata/g) || []).length === 3, "user_metadata appears only in the check and the result");
assert(body.includes("raise exception 'jwt helper % still reads user_metadata'"), "stops if user_metadata remains");
assert(body.includes("policy count changed"), "stops if a policy count changes");
assert(!/create\s+policy/i.test(body), "does not create a policy");
assert(!/drop\s+policy/i.test(body), "does not drop a policy");
assert(body.includes("'changed', 'yes'"), "reports the functions changed");

console.log("OK _test-jwt-helpers-no-user-meta.js");
