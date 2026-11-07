/**
 * The cancellations-report role status only reads policies.
 * Run: node _test-cancellations-role-status.js
 */
const fs = require("fs");
const path = require("path");
const sql = fs.readFileSync(path.join(__dirname, "supabase-gi-cancellations-role-status.sql"), "utf8");
const body = sql.replace(/--[^\n]*/g, "");

function assert(cond, msg){
  if(!cond) throw new Error(msg);
}

assert(body.includes("gi_cancellations_report"), "names the cancellations report");
assert(body.includes("pg_policies"), "reads policies");
assert(body.includes("'changed', 'no'"), "reports that nothing changed");
assert(!/create\s+policy/i.test(body), "does not create a policy");
assert(!/drop\s+policy/i.test(body), "does not drop a policy");
assert(!/from\s+public\.gi_cancellations_report/i.test(body), "does not read report rows");

console.log("OK _test-cancellations-role-status.js");
