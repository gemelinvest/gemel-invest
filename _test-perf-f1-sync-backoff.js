/**
 * F1.1 contract: watchers yield to LiveRefresh; intervals/login unchanged.
 * Run: node _test-perf-f1-sync-backoff.js
 */
const fs = require("fs");
const app = fs.readFileSync("app.js", "utf8");

function assert(cond, msg){
  if(!cond) throw new Error(msg);
}

assert(app.includes("const BackgroundSyncGate"), "missing BackgroundSyncGate");
assert(app.includes("GI-PERF F1.1"), "missing F1.1 comment");
assert(app.includes("BackgroundSyncGate.markLiveStart()"), "LiveRefresh must mark start");
assert(app.includes("BackgroundSyncGate.markLiveEnd()"), "LiveRefresh must mark end");
assert(app.includes('shouldSkipNetwork?.("ProposalAssignWatcher")'), "assign watcher must yield");
assert(app.includes('shouldSkipNetwork?.("ReferralQuietRefresh")'), "referral refresh must yield");
assert(app.includes('shouldSkipNetwork?.("CampaignAgentLeadWatcher")'), "lead watcher must yield");
assert(app.includes('shouldSkipNetwork?.("CampaignAgentLeadWatcher.light")'), "lead light tick must yield");
assert(app.includes('onlyWhileLiveBusy: true'), "toast watchers skip only while LiveRefresh is in flight");

assert(app.includes("lightIntervalMs: 15000"), "must not change assign watcher interval");
assert(app.includes("intervalMs: 2500"), "must not change toast watcher interval");
assert(app.includes("intervalMs: 120000"), "must not change LiveRefresh interval");
assert(app.includes("LIVE_COOLDOWN_MS: 8000"), "cooldown must stay short");

assert(app.includes("function scheduleVisibleViewRender"), "must keep F1.0 scheduler");
assert(app.includes('client.rpc("gi_verify_agent_login"'), "must not touch login RPC");
assert(app.includes("AGENT_PUBLIC_COLUMNS"), "must keep public agent columns");
assert(app.includes("ListRecordRealtime"), "must not remove realtime");

console.log("OK _test-perf-f1-sync-backoff.js");
