/**
 * The sales-report role status only reads policies.
 * Run: node _test-daily-report-role-status.js
 */
const fs = require("fs");
const path = require("path");
const sql = fs.readFileSync(path.join(__dirname, "supabase-gi-daily-report-role-status.sql"), "utf8");
const body = sql.replace(/--[^\n]*/g, "");

function assert(cond, msg){
  if(!cond) throw new Error(msg);
}

assert(body.includes("gi_daily_report"), "names the sales report");
assert(body.includes("pg_policies"), "reads policies");
assert(body.includes("'changed', 'no'"), "reports that nothing changed");
assert(!/create\s+policy/i.test(body), "does not create a policy");
assert(!/drop\s+policy/i.test(body), "does not drop a policy");
assert(!/from\s+public\.gi_daily_report/i.test(body), "does not read report rows");

console.log("OK _test-daily-report-role-status.js");
