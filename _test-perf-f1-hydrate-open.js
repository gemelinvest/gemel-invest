/**
 * F1.3 contract: open files hydrate first; regular agents still fill the rest.
 * Mass skip for large / team-manager stays. Login and F1.0–F1.2 unchanged.
 * Run: node _test-perf-f1-hydrate-open.js
 */
const fs = require("fs");
const app = fs.readFileSync("app.js", "utf8");

function assert(cond, msg){
  if(!cond) throw new Error(msg);
}

function sliceBetween(src, start, end){
  const i = src.indexOf(start);
  if(i < 0) return "";
  const j = src.indexOf(end, i + start.length);
  return j > i ? src.slice(i, j) : src.slice(i);
}

assert(app.includes("GI-PERF F1.3"), "missing F1.3 comment");
assert(app.includes("function collectHydrationPriorityIds"), "missing priority helper");
assert(app.includes("hydrateOpenWorkingSetPayloads"), "missing open-file hydrate");
assert(app.includes("getTeamManagerProtectedPayloadIds()"), "priority must reuse open-file ids");
assert(app.includes("priorityIds"), "hydratePayloads must accept priorityIds");
assert(app.includes("The rest still fill — do not cap"), "must not stop the regular fill");
assert(app.includes('Storage.ensureRecordPayload("customers", id)'), "open files use ensureRecordPayload");

const hydrateFn = sliceBetween(app, "async hydratePayloads(options = {}){", "async loadSheets");
assert(hydrateFn.includes("prioritySet"), "hydrate must sort open files first");
assert(!/pending\s*=\s*pending\.slice\(/.test(hydrateFn), "hydrate must not drop the rest of the queue");
assert(hydrateFn.includes("pending = first.concat(rest)"), "priority ids stay at the front");

assert(app.includes("LARGE_SESSION_SKIP_MASS_HYDRATION"), "must keep large-session skip");
assert(app.includes("TEAM_MANAGER_SKIP_MASS_HYDRATION"), "must keep team-manager skip");
assert(app.includes("if(priorityIds.length) this.hydrateOpenWorkingSetPayloads(priorityIds)"),
  "skipped mass hydrate must still fill the open file");

assert(app.includes("async ensureRecordPayload(stateKey, id)"), "must keep on-demand file fetch");
assert(app.includes("function scheduleVisibleViewRender"), "must keep F1.0");
assert(app.includes("const BackgroundSyncGate"), "must keep F1.1");
assert(app.includes("const CAMPAIGN_LEAD_COLUMNS"), "must keep F1.2");
assert(app.includes('client.rpc("gi_verify_agent_login"'), "must not touch login RPC");
assert(app.includes("AGENT_PUBLIC_COLUMNS"), "must keep public agent columns");

console.log("OK _test-perf-f1-hydrate-open.js");
