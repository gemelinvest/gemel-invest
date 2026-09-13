/**
 * F2 contract: LiveRefresh delta uses list columns, never select(*).
 * Existing payloads are kept. Open files still use ensureRecordPayload.
 * Login, hydrate-for-regular-agents, and F1.0–F1.3 stay.
 * Run: node _test-perf-f2-delta-light.js
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

assert(app.includes("GI-PERF F2"), "missing F2 comment");

const deltaFn = sliceBetween(
  app,
  "async loadSheetsDelta(options = {}){",
  "if(!metaRes.ok)"
);
assert(deltaFn.includes("CUSTOMER_LIGHT_COLUMNS"), "delta customers must be light");
assert(deltaFn.includes("PROPOSAL_LIGHT_COLUMNS"), "delta proposals must be light");
assert(!deltaFn.includes(': "*"'), "delta must not fall back to select *");
assert(!deltaFn.includes(', "*"'), "delta must not pass star select");
assert(deltaFn.includes("AGENT_PUBLIC_COLUMNS"), "delta agents stay public columns");

const mergeProp = sliceBetween(app, "mergeProposalsDelta(rawRows){", "consumeDeltaInvalidationIds");
assert(mergeProp.includes("payloadIsEmpty(prev)"), "proposal delta must keep existing payload");
assert(mergeProp.includes("payload: prev.payload"), "proposal delta copies previous payload");

assert(app.includes("דלתא/שורה רזה לא מוחקת payload מלא קיים"), "customer delta still preserves payload");
assert(app.includes("async ensureRecordPayload(stateKey, id)"), "open file still fetches payload");
assert(app.includes("LARGE_SESSION_SKIP_MASS_HYDRATION"), "large-session hydrate skip stays");
assert(app.includes("The rest still fill — do not cap"), "regular agents still hydrate");
assert(app.includes("function scheduleVisibleViewRender"), "must keep F1.0");
assert(app.includes("const BackgroundSyncGate"), "must keep F1.1");
assert(app.includes("const CAMPAIGN_LEAD_COLUMNS"), "must keep F1.2");
assert(app.includes("function collectHydrationPriorityIds"), "must keep F1.3");
assert(app.includes("intervalMs: 120000"), "must not change LiveRefresh interval");
assert(app.includes('client.rpc("gi_verify_agent_login"'), "must not touch login RPC");
assert(app.includes("AGENT_PUBLIC_COLUMNS"), "must keep public agent columns");

console.log("OK _test-perf-f2-delta-light.js");
