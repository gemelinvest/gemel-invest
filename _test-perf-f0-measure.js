/**
 * F0 contract: counters only, no login/RLS/behavior changes.
 * Run: node _test-perf-f0-measure.js
 */
const fs = require("fs");
const app = fs.readFileSync("app.js", "utf8");

function assert(cond, msg){
  if(!cond) throw new Error(msg);
}

assert(app.includes("/* GI-PERF F0 — counters only."), "missing F0 counter comment");
assert(app.includes("count(name)"), "GiPerf.count missing");
assert(app.includes("noteTimer(info)"), "GiPerf.noteTimer missing");
assert(app.includes("globalThis.giPerfCounts"), "giPerfCounts export missing");
assert(app.includes("globalThis.giPerfTimers"), "giPerfTimers export missing");
assert(app.includes("globalThis.giPerfResetCounts"), "giPerfResetCounts export missing");

const requiredCounts = [
  'GiPerf.count("goView")',
  'GiPerf.count("goView:alreadyOnView")',
  'GiPerf.count("render:customers")',
  'GiPerf.count("render:proposals")',
  'GiPerf.count("render:dashboard")',
  'GiPerf.count("render:dashboardSchedule")',
  'GiPerf.count("render:activeView")',
  'GiPerf.count("render:opsDashboard")',
  'GiPerf.count("render:elementaryDashboard")',
  'GiPerf.count("timer:LiveRefresh.tick")',
];
for (const needle of requiredCounts) {
  assert(app.includes(needle), "missing counter " + needle);
}

const requiredTimers = [
  'name: "LiveRefresh"',
  'name: "ReferralQuietRefresh"',
  'name: "ProposalAssignWatcher"',
  'name: "MirrorCallAgentToastWatcher"',
  'name: "OpsAgentStatusToastWatcher"',
  'name: "CampaignAgentLeadWatcher"',
];
for (const needle of requiredTimers) {
  assert(app.includes(needle), "missing timer note " + needle);
}

assert(app.includes('client.rpc("gi_verify_agent_login"'), "must not touch login RPC");
assert(app.includes("AGENT_PUBLIC_COLUMNS"), "must keep public agent columns");
assert(!/expectedLocal\s*=\s*safeTrim\(agent\?\.pin\)\s*\|\|\s*"0000"/.test(app),
  "must not restore local 0000 login fallback");

console.log("OK _test-perf-f0-measure.js");
