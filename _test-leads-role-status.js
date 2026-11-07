/**
 * The leads role status only reads policies and the assigned column.
 * Run: node _test-leads-role-status.js
 */
const fs = require("fs");
const path = require("path");
const sql = fs.readFileSync(path.join(__dirname, "supabase-gi-leads-role-status.sql"), "utf8");
const body = sql.replace(/--[^\n]*/g, "");

function assert(cond, msg){
  if(!cond) throw new Error(msg);
}

assert(body.includes("campaign_leads"), "names the leads table");
assert(body.includes("assigned_agent_id"), "checks the assigned column");
assert(body.includes("teamManager|opsAgent"), "flags a capital-letter role comparison");
assert(body.includes("pg_policies"), "reads policies");
assert(body.includes("'changed', 'no'"), "reports that nothing changed");
assert(!/create\s+policy/i.test(body), "does not create a policy");
assert(!/drop\s+policy/i.test(body), "does not drop a policy");
assert(!/from\s+public\.campaign_leads/i.test(body), "does not read lead rows");

console.log("OK _test-leads-role-status.js");
