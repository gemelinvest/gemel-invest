/**
 * The proposals policy read only lists installed policies.
 * Run: node _test-proposals-policy-read.js
 */
const fs = require("fs");
const path = require("path");
const sql = fs.readFileSync(path.join(__dirname, "supabase-gi-proposals-policy-read.sql"), "utf8");
const body = sql.replace(/--[^\n]*/g, "");

function assert(cond, msg){
  if(!cond) throw new Error(msg);
}

assert(body.includes("public.proposals"), "names the proposals table");
assert(body.includes("pg_policies"), "reads installed policies");
assert(body.includes("gi_jwt_is_manager"), "notes the manager helper");
assert(body.includes("restrictive_count"), "counts restrictive policies");
assert(body.includes("'changed', 'no'"), "reports that nothing changed");
assert(!/from\s+public\.proposals\b/i.test(body), "does not read proposal rows");
assert(!/create\s+(or\s+replace\s+)?function/i.test(body), "does not replace a function");
assert(!/create\s+policy/i.test(body), "does not create a policy");
assert(!/drop\s+policy/i.test(body), "does not drop a policy");
assert(!/\b(update|delete)\s+/i.test(body), "does not update or delete rows");
assert(!/insert\s+into\s+public\./i.test(body), "does not insert into a real table");
assert(!/email/i.test(body), "does not read an email");
assert(!/\bpin\b/i.test(body), "does not read a code");

console.log("OK _test-proposals-policy-read.js");
