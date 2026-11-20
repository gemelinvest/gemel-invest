/**
 * Lead fetch queue, two-miss retain, and my-leads paint.
 * Run: node _test-lead-fetch-stall.js
 */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const app = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
let failed = 0;

function assert(cond, msg){
  if(cond) console.log("  PASS  " + msg);
  else {
    failed += 1;
    console.error("  FAIL  " + msg);
  }
}

function sliceBetween(src, startMark, endMark){
  const start = src.indexOf(startMark);
  const end = src.indexOf(endMark, start + startMark.length);
  if(start < 0 || end < 0 || end <= start) return "";
  return src.slice(start, end);
}

function methodSlice(src, signature, nextSignature){
  const start = src.indexOf(signature);
  const end = src.indexOf(nextSignature, start + signature.length);
  if(start < 0 || end < 0) throw new Error("missing " + signature);
  return src.slice(start, end).trim().replace(/,\s*$/, "");
}

console.log("1) a stale response cannot replace a newer list");
const impl = sliceBetween(app, "async __fetchAllImpl(scope){", "applyLocal(lead){");
const gateAt = impl.indexOf("campaignLeadReadSessionGate(token)");
const assignedAt = impl.indexOf('loadRows(scope === "mine" ? "assigned"');
const describedAt = impl.indexOf('loadRows("description")');
const staleAt = impl.indexOf("if(this._fetchWriteSeq !== gen) return { ok: true, leads: this.leads, stale: true };");
const replaceAt = impl.indexOf("this.leads = this._mergeCampaignLeadFetchResults");
assert(gateAt >= 0 && assignedAt > gateAt, "the session gate still runs before any lead load");
assert(describedAt > assignedAt && replaceAt > describedAt, "description rows are added after the direct assignment");
assert(staleAt > describedAt && staleAt < replaceAt, "a stale response returns before it writes the list");
assert(impl.includes("return { ok: false, error: sessionGate.error }"), "a missing session still returns a failure");
assert(impl.includes('if(!described.ok)'), "a failed description scan does not continue into a delete");
assert(!sliceBetween(app, "_previewAssignedLeads(previous, fetched){", "_paintMyLeadsIfCurrent(){").includes("_noteMineMiss"), "the first paint does not count a miss");

console.log("\n2) one miss keeps an agent lead, the second drops it");
const mergeSrc = sliceBetween(app, "_mergeCampaignLeadFetchResults(previous, fetched, scope){", "resolveFetchScope(options = {}){");
const inboxAt = mergeSrc.indexOf("if(hasInbox) return true;");
const missAt = mergeSrc.indexOf("return this._noteMineMiss(id)");
assert(inboxAt >= 0 && missAt > inboxAt, "inbox still keeps every unfetched lead before the miss count");
assert(mergeSrc.includes('if(myIds.has(aid)) return this._noteMineMiss(id);'), "only the signed-in agent's own lead can be dropped");

const context = {
  agentIds: ["a1"],
  hasInbox: false,
  safeTrim(v){ return String(v == null ? "" : v).trim(); },
  normalizeCampaignLead(lead){ return Object.assign({}, lead); },
  getCampaignLeadSessionAgentIds(){ return context.agentIds.slice(); }
};
vm.createContext(context);
const store = vm.runInContext("({" + [
  methodSlice(app, "_shouldRetainRecentSave(id){", "_campaignLeadFetchHasInbox(){"),
  methodSlice(app, "_clearRecentSaveGrace(id){", "_shouldRetainRecentSave(id){"),
  methodSlice(app, "_noteMineMiss(id){", "_overlayFetchedLead(local, lead){"),
  methodSlice(app, "_overlayFetchedLead(local, lead){", "_previewAssignedLeads(previous, fetched){"),
  methodSlice(app, "_previewAssignedLeads(previous, fetched){", "_paintMyLeadsIfCurrent(){"),
  methodSlice(app, "_mergeCampaignLeadFetchResults(previous, fetched, scope){", "resolveFetchScope(options = {}){")
].join(",\n") + "})", context);
store.pendingRemoteSaveIds = new Set();
store._mineMissCounts = new Map();
store._recentSaveGraceUntil = new Map();
store.RECENT_SAVE_GRACE_MS = 3 * 60 * 1000;
store._campaignLeadFetchHasInbox = () => context.hasInbox === true;

const mineLead = { id: "L1", assignedAgentId: "a1", status: "new", customerName: "דנה" };
let kept = store._mergeCampaignLeadFetchResults([mineLead], [], "mine");
assert(kept.some((lead) => lead.id === "L1"), "the first mine response that misses the lead keeps it");
assert(store._mineMissCounts.get("L1") === 1, "the first miss is recorded once");
kept = store._mergeCampaignLeadFetchResults(kept, [], "mine");
assert(!kept.some((lead) => lead.id === "L1"), "the second consecutive miss drops the lead");
assert(!store._mineMissCounts.has("L1"), "a dropped lead does not keep a miss count");

store._mineMissCounts.clear();
const other = { id: "L2", assignedAgentId: "other", status: "new" };
kept = store._mergeCampaignLeadFetchResults([mineLead, other], [], "mine");
assert(kept.some((lead) => lead.id === "L2") && store._mineMissCounts.get("L2") == null, "another agent's lead is not counted as a miss");

store._mineMissCounts.set("L1", 1);
kept = store._mergeCampaignLeadFetchResults([mineLead], [{ id: "L1", assignedAgentId: "a1", status: "closed", customerName: "דנה" }], "mine");
assert(kept.length === 1 && kept[0].status === "closed", "a status that comes back replaces the local status");
assert(!store._mineMissCounts.has("L1"), "a lead that comes back clears its miss");

context.hasInbox = true;
store._mineMissCounts.clear();
kept = store._mergeCampaignLeadFetchResults([mineLead], [], "mine");
assert(kept.some((lead) => lead.id === "L1") && store._mineMissCounts.size === 0, "an inbox user still keeps a lead the response did not include");
context.hasInbox = false;

store.pendingRemoteSaveIds.add("L1");
store._mineMissCounts.clear();
kept = store._mergeCampaignLeadFetchResults([mineLead], [], "mine");
assert(kept.some((lead) => lead.id === "L1") && !store._mineMissCounts.has("L1"), "a pending save stays without counting a miss");
store.pendingRemoteSaveIds.clear();

const preview = store._previewAssignedLeads([mineLead], [{ id: "L3", assignedAgentId: "a1", status: "new" }]);
assert(preview.some((lead) => lead.id === "L1") && preview.some((lead) => lead.id === "L3"), "the assigned phase adds a lead and does not drop the ones already shown");
assert(store._mineMissCounts.size === 0, "the assigned phase does not change miss counts");

store._mineMissCounts.set("L9", 1);
kept = store._mergeCampaignLeadFetchResults(
  [{ id: "L9", assignedAgentId: "someone", status: "new" }],
  [{ id: "L9", assignedAgentId: "someone", status: "new", customerName: "נוסף" }],
  "mine"
);
assert(kept.some((lead) => lead.id === "L9" && lead.customerName === "נוסף"), "a description-phase lead is added");
assert(!store._mineMissCounts.has("L9"), "a description-phase lead clears a miss instead of adding one");

console.log("\n3) my leads paints before the refresh, and a full pull waits 60 seconds");
const myRender = sliceBetween(app, "try { CampaignLeadsStore.hydrateFromCacheIfEmpty(); } catch(_e) {}\n      try { this.renderList(); } catch(_e) {}\n      void this.refresh(false)", "async updateStatus(id, status, selectEl){");
assert(myRender.includes("this.renderList()"), "my leads paints the rows already in memory");
assert(myRender.includes("void this.refresh(false).then"), "the refresh continues after the first paint");
assert(!myRender.includes("await this.refresh"), "opening my leads does not wait for the network");
const myUi = sliceBetween(app, "const CampaignMyLeadsUI = {", "const CampaignLeadReassignAgent");
const missingAt = myUi.indexOf("CampaignLeadsStore._readSessionMissing");
const emptyAt = myUi.indexOf("אין לידים משויכים אליך");
assert(missingAt >= 0 && emptyAt > missingAt && myUi.includes('this.els.tbody.innerHTML = ""'), "a missing session still blanks the list");
assert(app.includes("FULL_LEAD_PULL_MIN_MS: 60000"), "a full lead pull is fresh for 60 seconds");
const fetchSrc = sliceBetween(app, "async fetchAll(options = {}){", "async _fetchAllImpl(scope){");
assert(fetchSrc.includes("options.force !== true") && fetchSrc.includes("_fullLeadPullIsFresh()"), "a full pull is skipped unless the caller forces it");
assert(fetchSrc.includes("this._fetchAllPromise && this._fetchAllScope === scope"), "the same scope joins the fetch already running");
assert(fetchSrc.includes("prevTail.then"), "a different scope waits for the fetch already running");
assert(fetchSrc.slice(0, 500).includes("this.resolveFetchScope(options)"), "fetchAll still resolves the scope");
assert(fetchSrc.slice(0, 500).includes("this._fetchAllImpl(scope)"), "fetchAll still calls the existing implementation");
assert(app.includes('CampaignLeadsStore.fetchAll({ scope: "all", force: showToast === true })'), "the lead refresh button forces a new pull");
assert(app.includes('CampaignLeadsStore.fetchAll({ scope: "all" })'), "background callers can still ask for a normal full pull");
const watcherTick = sliceBetween(app, "async tick(){", "function showLeadTransferAnimation");
assert(watcherTick.includes('fetchAll({ scope: "mine", skipDescription: true })'), "the minute poll does not scan the description");
const assignRefresh = sliceBetween(app, "async refreshMyLeadsAfterAssign(){", "handleRealtimeDbRow(row, options = {}){");
assert(assignRefresh.includes('fetchAll({ scope: "mine" })') && !assignRefresh.includes("skipDescription"), "a new assignment still loads the description");
const inboxArrival = sliceBetween(app, "GI-LEAD-TOAST 2026-09-17: טוסט קודם, טעינת הרשימה ברקע.", "syncAssignNotice(entry){");
assert(inboxArrival.includes('fetchAll({ scope: "mine" })') && !inboxArrival.includes("skipDescription"), "the assignment queue still loads the description");
const myRefresh = sliceBetween(app, "async refresh(showToast){", "async render(){");
assert(myRefresh.includes('fetchAll({ scope: "mine" })') && !myRefresh.includes("skipDescription"), "opening and refreshing my leads still scans the description");

const fetchStore = {
  leads: [{ id: "cached" }],
  _fetchAllPromise: null,
  _fetchAllScope: "",
  _fetchTail: null,
  _lastFullPullAt: 0,
  FULL_LEAD_PULL_MIN_MS: 60000,
  started: [],
  resolveFetchScope(options){ return options.scope; },
  _fullLeadPullIsFresh(){
    const at = Number(this._lastFullPullAt) || 0;
    return at > 0 && (Date.now() - at) < this.FULL_LEAD_PULL_MIN_MS;
  },
  _fetchAllImpl(scope){
    let finish;
    const skipDescription = this._skipDescriptionForFetch === true;
    const gate = new Promise((resolve) => { finish = resolve; });
    this.started.push({ scope, finish, skipDescription });
    return gate.then(() => ({ ok: true, scope, skipDescription }));
  }
};
fetchStore.fetchAll = vm.runInNewContext("({" + methodSlice(app, "async fetchAll(options = {}){", "async _fetchAllImpl(scope){") + "})", {}).fetchAll;
async function checkQueue(){
const firstMine = fetchStore.fetchAll({ scope: "mine" });
const queued = fetchStore._fetchAllPromise;
fetchStore.fetchAll({ scope: "mine" });
assert(fetchStore._fetchAllPromise === queued, "two mine fetches share one promise");
await Promise.resolve();
assert(fetchStore.started.length === 1 && fetchStore.started[0].scope === "mine", "the mine fetch starts once");
const fullPull = fetchStore.fetchAll({ scope: "all" });
await Promise.resolve();
assert(fetchStore.started.length === 1, "the full pull waits while mine is running");
fetchStore.started[0].finish();
await firstMine;
await Promise.resolve();
assert(fetchStore.started.length === 2 && fetchStore.started[1].scope === "all", "the full pull starts after mine finishes");
fetchStore.started[1].finish();
await fullPull;
fetchStore._lastFullPullAt = Date.now();
const cached = await fetchStore.fetchAll({ scope: "all" });
assert(cached.fresh === true && fetchStore.started.length === 2, "a second full pull inside 60 seconds does not start");
const forced = fetchStore.fetchAll({ scope: "all", force: true });
await Promise.resolve();
assert(fetchStore.started.length === 3, "a forced refresh starts a new full pull");
fetchStore.started[2].finish();
await forced;
const assignedOnly = fetchStore.fetchAll({ scope: "mine", skipDescription: true });
await Promise.resolve();
assert(fetchStore.started.length === 4 && fetchStore.started[3].skipDescription === true, "the minute poll loads only the direct assignment");
const withDescription = fetchStore.fetchAll({ scope: "mine" });
await Promise.resolve();
assert(fetchStore.started.length === 4, "a screen fetch does not join a poll that skipped the description");
fetchStore.started[3].finish();
await assignedOnly;
await Promise.resolve();
assert(fetchStore.started.length === 5 && fetchStore.started[4].skipDescription === false, "the screen fetch still scans the description");
fetchStore.started[4].finish();
await withDescription;
}

checkQueue().then(() => {
if(failed){
  console.error("\nFAILED " + failed);
  process.exit(1);
}
console.log("\nOK");
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
