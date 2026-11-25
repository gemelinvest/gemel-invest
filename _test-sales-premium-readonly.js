/* מסך המכירות קורא פרמיית קמפיין בלי להיכנס למנוע הלידים.
   הרצה: node _test-sales-premium-readonly.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = __dirname;
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
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
  const end = src.indexOf(endMark, start < 0 ? 0 : start);
  if(start < 0 || end < 0 || end <= start) return "";
  return src.slice(start, end);
}

function extractMethod(src, name){
  let start = -1;
  let kind = "";
  for(const mark of ["async function " + name + "(", "function " + name + "("]){
    const at = src.indexOf(mark);
    if(at >= 0){
      start = at;
      kind = "keep";
      break;
    }
  }
  if(start < 0){
    const asyncAt = src.indexOf("async " + name + "(");
    const plainAt = src.indexOf(name + "(");
    if(asyncAt >= 0){
      start = asyncAt;
      kind = "async";
    } else if(plainAt >= 0){
      start = plainAt;
      kind = "plain";
    }
  }
  if(start < 0) return "";
  const paren = src.indexOf("(", start);
  const brace = src.indexOf("{", paren);
  let depth = 0;
  for(let i = brace; i < src.length; i++){
    if(src[i] === "{") depth += 1;
    else if(src[i] === "}"){
      depth -= 1;
      if(depth === 0){
        if(kind === "keep") return src.slice(start, i + 1);
        const paramsAndBody = src.slice(paren, i + 1);
        return (kind === "async" ? "async function " : "function ") + name + paramsAndBody;
      }
    }
  }
  return "";
}

console.log("1) the sales screen reads premium without the lead engine");
const paint = sliceBetween(app, "paintDailySalesCampaignPremium(dateKey){", "renderReferentLeadBoard(){");
assert(paint.includes("loadPremiumSnapshot"), "the sales screen asks for the premium snapshot");
assert(!paint.includes("fetchAll"), "the sales screen does not open a full lead pull");
assert(!paint.includes("collapseBurstDuplicates"), "the sales screen does not collapse duplicates");
assert(!paint.includes("renderDailySalesPage"), "the premium refresh does not rebuild the sales page");
assert(paint.includes("renderCampaignPremiumDayHtml(dateKey, res && res.leads)"), "the table is painted from the snapshot");

const snapshot = [
  extractMethod(app, "_premiumSnapshotIsFresh"),
  extractMethod(app, "loadPremiumSnapshot"),
  extractMethod(app, "_loadPremiumSnapshotRows")
].join("\n");
assert(snapshot.includes("async function loadPremiumSnapshot()"), "the snapshot reader is present");
assert(snapshot.includes('Storage.loadCampaignLeadRows("all", CAMPAIGN_LEAD_PREMIUM_COLUMNS)'), "the read uses only the premium columns");
assert(!/this\.leads\s*=/.test(snapshot), "the snapshot does not replace the lead list");
assert(!snapshot.includes("collapseBurstDuplicates"), "the snapshot does not delete burst duplicates");
assert(!snapshot.includes("_mergeCampaignLeadFetchResults"), "the snapshot does not merge into the lead list");
assert(!snapshot.includes("_deleteLeadRow"), "the snapshot does not delete a lead");
assert(!snapshot.includes("persistRemote"), "the snapshot does not write a lead");
assert(!snapshot.includes("fetchAll"), "the snapshot does not call the lead fetch");
assert(!snapshot.includes("gi_dashboard"), "the snapshot does not touch a dashboard engine");
assert(app.includes('const CAMPAIGN_LEAD_PREMIUM_COLUMNS = "id,campaign_id,campaign_label,description"'), "premium still comes from the description");
assert(app.includes("PREMIUM_SNAPSHOT_MIN_MS: 180000"), "the sales read waits three minutes before scanning again");
assert(html.includes("giLeadRead=1"), "the client cache loads this change");
assert(sw.includes("lead-read-v1"), "the service worker cache loads this change");

console.log("2) assignment, inbox, and the lead screens stay on the existing path");
assert(app.includes('CampaignLeadsStore.fetchAll({ scope: "all" })'), "a full lead pull still exists for the lead screens");
const poll = sliceBetween(app, "startPoll(){", "stopPoll(){");
assert(poll.includes('fetchAll({ scope: "all" })'), "the leads screen still refreshes its own list");
const referent = sliceBetween(app, "renderReferentLeadBoard(){", "/* ===== לקוחות אחרונים");
assert(referent.includes('fetchAll({ scope: "all" })'), "the surveyor board still uses the lead list");
const watcherTick = sliceBetween(app, "async tick(){", "function showLeadTransferAnimation");
assert(watcherTick.includes('fetchAll({ scope: "mine", skipDescription: true })'), "the minute poll still loads only the direct assignment");
const assignRefresh = sliceBetween(app, "async refreshMyLeadsAfterAssign(){", "handleRealtimeDbRow(row, options = {}){");
assert(assignRefresh.includes('fetchAll({ scope: "mine" })') && !assignRefresh.includes("skipDescription"), "a new assignment still loads the description");
const inboxArrival = sliceBetween(app, "GI-LEAD-TOAST 2026-09-17: טוסט קודם, טעינת הרשימה ברקע.", "syncAssignNotice(entry){");
assert(inboxArrival.includes('fetchAll({ scope: "mine" })') && !inboxArrival.includes("skipDescription"), "the assignment queue still loads the description");
const myRefresh = sliceBetween(app, "async refresh(showToast){", "async render(){");
assert(myRefresh.includes('fetchAll({ scope: "mine" })') && !myRefresh.includes("skipDescription"), "opening my leads still scans the description");
const impl = sliceBetween(app, "async __fetchAllImpl(scope){", "applyLocal(lead){");
assert(impl.includes("this.collapseBurstDuplicates()"), "the lead fetch still collapses duplicates");
assert(impl.includes("this.leads = this._mergeCampaignLeadFetchResults"), "the lead fetch still merges its own result");
assert(app.includes(".ilike(\"description\", descriptionIlike)"), "the description scan is unchanged");
assert(app.includes(".in(\"assigned_agent_id\", agentIds)"), "the assignment filter is unchanged");
assert(app.includes("gi_dashboard_net_premium"), "the net premium engine is unchanged");

console.log("3) a sales read does not change the lead list, and the totals match");
const rowsFn = extractMethod(app, "buildCampaignPremiumDayRows");
const moneyFn = extractMethod(app, "campaignLeadMoneyNumber");
assert(rowsFn.startsWith("function buildCampaignPremiumDayRows("), "the premium math function is still there");

const calls = [];
let release;
const pending = new Promise((resolve) => { release = resolve; });
const original = [
  { id: "mine", campaignId: "keep", campaignLabel: "שלי", proposalPremiumMonthly: 10, proposalPremiumAt: "2026-11-25" }
];
const sandbox = {
  CAMPAIGN_LEAD_PREMIUM_COLUMNS: "id,campaign_id,campaign_label,description",
  Storage: {
    loadCampaignLeadRows(scope, columns){
      calls.push([scope, columns]);
      return pending;
    }
  },
  mapCampaignLeadFromDb(row){
    return {
      id: row.id,
      campaignId: row.campaign_id,
      campaignLabel: row.campaign_label,
      proposalPremiumMonthly: row.monthly,
      proposalPremiumAnnual: row.annual,
      proposalPremiumAt: row.at
    };
  },
  safeTrim(value){ return String(value == null ? "" : value).trim(); },
  parseCampaignLeadStampDateIL(raw){ return String(raw || "").slice(0, 10); },
  store: {
    leads: original,
    FULL_LEAD_PULL_MIN_MS: 60000,
    PREMIUM_SNAPSHOT_MIN_MS: 180000,
    _premiumSnapshot: null,
    _premiumSnapshotAt: 0,
    _premiumSnapshotPromise: null,
    _lastFullPullAt: 0
  }
};
vm.createContext(sandbox);
vm.runInContext(
  moneyFn + "\n" + rowsFn + "\n" + snapshot + "\n" +
  "store._premiumSnapshotIsFresh = _premiumSnapshotIsFresh;\n" +
  "store._fullLeadPullIsFresh = function(){ const at = Number(this._lastFullPullAt) || 0; return at > 0 && (Date.now() - at) < this.FULL_LEAD_PULL_MIN_MS; };\n" +
  "store.loadPremiumSnapshot = loadPremiumSnapshot;\n" +
  "store._loadPremiumSnapshotRows = _loadPremiumSnapshotRows;\n",
  sandbox
);

async function main(){
const first = sandbox.store.loadPremiumSnapshot();
const second = sandbox.store.loadPremiumSnapshot();
assert(calls.length === 1, "two paints share one read");
assert(calls[0][0] === "all" && calls[0][1] === "id,campaign_id,campaign_label,description", "the read is the premium column list");
assert(sandbox.store.leads === original, "the lead list is the same object while the read is in flight");
release({
  ok: true,
  data: [
    { id: "a", campaign_id: "c1", campaign_label: "קמפיין א", monthly: 100, annual: 0, at: "2026-11-25T08:00:00.000Z" },
    { id: "b", campaign_id: "c1", campaign_label: "קמפיין א", monthly: 50, annual: 1200, at: "2026-11-25T09:00:00.000Z" },
    { id: "c", campaign_id: "c2", campaign_label: "קמפיין ב", monthly: 0, annual: 0, at: "2026-11-25T09:00:00.000Z" }
  ]
});
const loaded = await first;
const joined = await second;
assert(loaded === joined, "the second paint receives the same result");
assert(loaded.ok === true && loaded.leads.length === 3, "the snapshot keeps every returned row");
assert(sandbox.store.leads === original && sandbox.store.leads.length === 1 && sandbox.store.leads[0].id === "mine", "the lead list is unchanged after the read");
assert(sandbox.store._premiumSnapshot !== sandbox.store.leads, "the snapshot is a separate list");

const fromSnapshot = sandbox.buildCampaignPremiumDayRows(loaded.leads, "2026-11-25");
const fromSameFields = sandbox.buildCampaignPremiumDayRows(loaded.leads.map((lead) => ({
  campaignId: lead.campaignId,
  campaignLabel: lead.campaignLabel,
  proposalPremiumMonthly: lead.proposalPremiumMonthly,
  proposalPremiumAnnual: lead.proposalPremiumAnnual,
  proposalPremiumAt: lead.proposalPremiumAt
})), "2026-11-25");
assert(JSON.stringify(fromSnapshot) === JSON.stringify(fromSameFields), "the sales table uses the same premium math");
assert(fromSnapshot.length === 1 && fromSnapshot[0].monthly === 150 && fromSnapshot[0].annual === 1200 && fromSnapshot[0].customers === 2, "a campaign sums monthly and annual, and a zero row stays out");

const again = await sandbox.store.loadPremiumSnapshot();
assert(calls.length === 1 && again.fresh === true && again.leads === loaded.leads, "a second read inside three minutes does not scan again");

sandbox.store._premiumSnapshotAt = 0;
sandbox.store._lastFullPullAt = Date.now();
const reused = await sandbox.store.loadPremiumSnapshot();
assert(calls.length === 1 && reused.fresh === true && reused.leads.length === 1 && reused.leads[0].id === "mine", "a fresh lead pull is reused instead of scanning again");
assert(sandbox.store.leads === original, "reusing a fresh pull still does not replace the lead list");

sandbox.store._premiumSnapshotAt = 0;
sandbox.store._lastFullPullAt = 0;
sandbox.Storage.loadCampaignLeadRows = () => Promise.resolve({ ok: false, error: "busy" });
const missed = await sandbox.store.loadPremiumSnapshot();
assert(missed.ok === false && sandbox.store.leads === original && sandbox.store.leads[0].id === "mine", "a failed read leaves the lead list in place");

if(failed){
  console.error("\nFAILED " + failed);
  process.exit(1);
}
console.log("\nOK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
