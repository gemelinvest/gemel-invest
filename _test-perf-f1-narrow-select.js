/**
 * F1.2 contract: campaign_leads list uses mapped columns; conflict merge is id-scoped.
 * Does not change login, LiveRefresh interval, or loadSheetsDelta (F3).
 * Run: node _test-perf-f1-narrow-select.js
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

assert(app.includes("const CAMPAIGN_LEAD_COLUMNS"), "missing CAMPAIGN_LEAD_COLUMNS");
assert(app.includes("const CAMPAIGN_LEAD_CUSTOMER_COLUMNS"), "missing CAMPAIGN_LEAD_CUSTOMER_COLUMNS");
assert(app.includes("function campaignLeadSelectColumns"), "missing campaignLeadSelectColumns");
assert(app.includes("GI-PERF F1.2"), "missing F1.2 comment");
assert(app.includes("Storage.loadCampaignLeadRows(scope, campaignLeadSelectColumns"), "list fetch must use mapped columns");
assert(!/async __fetchAllImpl\(scope\)\{[\s\S]*?loadCampaignLeadRows\(scope,\s*["']\*["']\)/.test(app),
  "list fetch must not select *");

const leadCols = (app.match(/const CAMPAIGN_LEAD_COLUMNS = "([^"]+)"/) || [])[1] || "";
const extraCols = (app.match(/const CAMPAIGN_LEAD_CUSTOMER_COLUMNS = "([^"]+)"/) || [])[1] || "";
const allLeadCols = new Set((leadCols + "," + extraCols).split(",").map((s) => s.trim()).filter(Boolean));
const requiredLeadCols = [
  "id", "phone", "customer_name", "description", "campaign_id", "campaign_label",
  "assigned_agent_id", "assigned_agent_name", "status", "source",
  "created_by_name", "updated_by_name", "row_color", "created_at", "updated_at",
  "id_number", "id_issue_date", "birth_date"
];
for(const col of requiredLeadCols){
  assert(allLeadCols.has(col), "CAMPAIGN_LEAD columns missing " + col);
}

const mapper = sliceBetween(app, "function mapCampaignLeadFromDb(row, idx = 0){", "function mapCampaignLeadToDb");
assert(mapper.includes("row.description"), "mapper still reads description (LEAD_META_JSON)");
assert(mapper.includes("row.row_color"), "mapper still reads row_color");

const mergeFn = sliceBetween(
  app,
  "async mergeConflictRemoteTablesIntoState(localState){",
  "async loadSheetsDelta"
);
assert(mergeFn.includes("GI-PERF F1.2"), "merge must be F1.2 id-scoped");
assert(mergeFn.includes("מיזוג קונפליקט לפי מזהים"), "merge must fetch by ids");
assert(mergeFn.includes('CUSTOMER_LIGHT_COLUMNS + ",payload"'), "merge customers keep payload");
assert(mergeFn.includes('PROPOSAL_LIGHT_COLUMNS + ",payload"'), "merge proposals keep payload");
assert(mergeFn.includes("getTeamManagerProtectedPayloadIds()"), "merge must keep open-file ids");
assert(!mergeFn.includes('loadTableRows(SUPABASE_TABLES.customers, "*")'), "merge must not fat-select customers");
assert(!mergeFn.includes('loadTableRows(SUPABASE_TABLES.proposals, "*")'), "merge must not fat-select proposals");

assert(app.includes('this.isTeamManagerLightSession() ? CUSTOMER_LIGHT_COLUMNS : "*"'),
  "loadSheetsDelta must stay unchanged (F3)");
assert(app.includes("function scheduleVisibleViewRender"), "must keep F1.0 scheduler");
assert(app.includes("const BackgroundSyncGate"), "must keep F1.1 gate");
assert(app.includes("intervalMs: 120000"), "must not change LiveRefresh interval");
assert(app.includes('client.rpc("gi_verify_agent_login"'), "must not touch login RPC");
assert(app.includes("AGENT_PUBLIC_COLUMNS"), "must keep public agent columns");

console.log("OK _test-perf-f1-narrow-select.js");
