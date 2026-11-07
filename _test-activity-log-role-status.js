/**
 * The activity-log role status only reads policies and the agent_id column.
 * Run: node _test-activity-log-role-status.js
 */
const fs = require("fs");
const path = require("path");
const sql = fs.readFileSync(path.join(__dirname, "supabase-gi-activity-log-role-status.sql"), "utf8");
const body = sql.replace(/--[^\n]*/g, "");

function assert(cond, msg){
  if(!cond) throw new Error(msg);
}

assert(body.includes("gi_agent_activity_log"), "names the activity log");
assert(body.includes("agent_id"), "checks the agent_id column");
assert(body.includes("pg_policies"), "reads policies");
assert(body.includes("'changed', 'no'"), "reports that nothing changed");
assert(!/create\s+policy/i.test(body), "does not create a policy");
assert(!/drop\s+policy/i.test(body), "does not drop a policy");
assert(!/from\s+public\.gi_agent_activity_log/i.test(body), "does not read log rows");

console.log("OK _test-activity-log-role-status.js");
