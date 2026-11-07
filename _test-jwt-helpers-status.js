/**
 * The JWT helper status file only reads function definitions.
 * Run: node _test-jwt-helpers-status.js
 */
const fs = require("fs");
const path = require("path");
const sql = fs.readFileSync(path.join(__dirname, "supabase-gi-jwt-helpers-status.sql"), "utf8");
const body = sql.replace(/--[^\n]*/g, "");

function assert(cond, msg){
  if(!cond) throw new Error(msg);
}

assert(body.includes("gi_jwt_agent_id"), "reads gi_jwt_agent_id");
assert(body.includes("gi_jwt_is_manager"), "reads gi_jwt_is_manager");
assert(body.includes("gi_jwt_role"), "reads gi_jwt_role");
assert(body.includes("pg_get_functiondef"), "reads the function text");
assert(body.includes("to_regprocedure"), "a missing function is reported");
assert(body.includes("'changed', 'no'"), "reports that nothing changed");
assert(!/create\s+(or\s+replace\s+)?function/i.test(body), "does not replace a function");
assert(!/create\s+policy/i.test(body), "does not create a policy");
assert(!/drop\s+policy/i.test(body), "does not drop a policy");
assert(!/\b(update|delete)\s+/i.test(body), "does not update or delete rows");
assert(!/user_metadata/i.test(body.split("position(")[0] || ""), "does not mention user_metadata outside the search");

console.log("OK _test-jwt-helpers-status.js");
