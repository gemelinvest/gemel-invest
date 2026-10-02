/**
 * Contract checks for Pד shadow policies (inert until Pה).
 * Run: node _test-pd-shadow-policies.js
 */
const fs = require("fs");
const path = require("path");
const sql = fs.readFileSync(path.join(__dirname, "supabase-gi-pd-shadow-policies.sql"), "utf8");

function assert(cond, msg){
  if(!cond) throw new Error(msg);
}

// Shadow policies are for authenticated only (anon untouched): check the create-policy lines.
const createLines = sql.match(/create policy[\s\S]*?on public\.customers[\s\S]*?for\s+(\w+)\s+to\s+(\w+)/g) || [];
assert(createLines.length >= 4, "must create >=4 policies (select/insert/update/delete)");
assert(createLines.every((l) => /\bto authenticated\b/.test(l)), "every policy must be for authenticated");
assert(!createLines.some((l) => /\bto anon\b/.test(l)), "must NOT create a policy for anon");

// All four commands covered (SELECT/INSERT/UPDATE/DELETE).
for(const cmd of ["select", "insert", "update", "delete"]){
  assert(new RegExp('for ' + cmd + '\\s+to authenticated').test(sql), "must cover " + cmd);
}

// Managers/ops/opsAgent see all (is_manager OR role in ops/opsAgent).
assert(/gi_jwt_is_manager\(\)/.test(sql), "managers via is_manager");
assert(/coalesce\(role, ''\) in \('ops', 'opsAgent'\)/.test(sql), "ops/opsAgent via role");

// Agent sees own (agent_id = jwt).
assert(/agent_id = public\.gi_jwt_agent_id\(\)/.test(sql), "agent sees own");

// teamManager sees self + team (team_manager_id = self OR agent_id = self).
assert(/coalesce\(a\.role, ''\) = 'teamManager'/.test(sql), "teamManager role check");
assert(/team_manager_id, ''\) = public\.gi_jwt_agent_id\(\)/.test(sql), "teamManager via team_manager_id");

// elementary sees pool (role = elementary, agent_id null/empty).
assert(/coalesce\(role, ''\) = 'elementary'/.test(sql), "elementary role check");
assert(/coalesce\(agent_id, ''\) = '' or agent_id is null/.test(sql), "elementary pool (unassigned)");

// CRITICAL: the open 'allow all customers' is LEFT INTACT (inert until Pה) — no DROP of it here.
// Strip SQL line comments (-- ...) before checking, so documentation doesn't trip the check.
const noComments = sql.replace(/^--[^\n]*$/gm, "");
assert(!/drop policy[\s\S]*?allow all customers/i.test(noComments), "must NOT drop the open policy here (inert)");

// Uses the fixed JWT helpers (from Pג-2).
assert(/gi_jwt_is_manager\(\)|gi_jwt_agent_id\(\)/.test(sql), "uses fixed helpers");

// Safe to run now (additive, inert).
assert(/Safe to run now \(inert until Pה\)/i.test(sql), "must document inertness");

console.log("OK _test-pd-shadow-policies.js");
