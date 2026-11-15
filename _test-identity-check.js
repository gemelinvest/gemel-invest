/**
 * The identity check only reads the helper, the agent link, and the live row.
 * Run: node _test-identity-check.js
 */
const fs = require("fs");
const path = require("path");
const sql = fs.readFileSync(path.join(__dirname, "supabase-gi-identity-check.sql"), "utf8");
const body = sql.replace(/--[^\n]*/g, "");

function assert(cond, msg){
  if(!cond) throw new Error(msg);
}

assert(body.includes("gi_jwt_agent_id"), "reads the agent id helper");
assert(body.includes("raw_app_meta_data"), "reads the session token id");
assert(body.includes("auth_user_id"), "reads the agents link");
assert(body.includes("gi_agent_live"), "reads the live floor");
assert(body.includes("אדוה"), "names Adva");
assert(body.includes("אוריה"), "names Uriya");
assert(body.includes("יובל"), "names Yuval");
assert(body.includes("'changed', 'no'"), "reports that nothing changed");
assert(body.includes("active_token_differs_from_card"), "counts token mismatches");
assert(!/create\s+(or\s+replace\s+)?function/i.test(body), "does not replace a function");
assert(!/create\s+policy/i.test(body), "does not create a policy");
assert(!/drop\s+policy/i.test(body), "does not drop a policy");
assert(!/\b(update|delete)\s+/i.test(body), "does not update or delete rows");
assert(!/insert\s+into\s+public\./i.test(body), "does not insert into a real table");
assert(!/email/i.test(body), "does not read an email");
assert(!/\bpin\b/i.test(body), "does not read a code");

console.log("OK _test-identity-check.js");
