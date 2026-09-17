/* GI-LEAD-TOAST 2026-09-17
   טוסט ליד חדש גדול יותר, ומגיע מיד אחרי שיוך — בלי לפרוץ את מנגנון ההתראות.
   הרצה: node _test-campaign-lead-assign-toast.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260917-lead-toast-v1";
let failed = 0;
let passed = 0;

function assert(cond, msg){
  if(cond){
    passed += 1;
    console.log("  PASS  " + msg);
  } else {
    failed += 1;
    console.error("  FAIL  " + msg);
  }
}

function read(name){
  return fs.readFileSync(path.join(ROOT, name), "utf8");
}

function sliceBetween(src, startMark, endMark){
  const start = src.indexOf(startMark);
  const end = src.indexOf(endMark, start);
  if(start < 0 || end < 0 || end <= start) return "";
  return src.slice(start, end);
}

const app = read("app.js");
const css = read("app.css");
const theme = read("theme.css");
const html = read("index.html");
const sw = read("service-worker.js");

const leadInbox = sliceBetween(
  app,
  "const CampaignLeadAssignInbox = {",
  "const CampaignAgentLeadWatcher = {"
);
const watcher = sliceBetween(
  app,
  "const CampaignAgentLeadWatcher = {",
  "function showLeadTransferAnimation(agentName, options = {}){"
);
const toastApi = sliceBetween(
  app,
  "const AppToast = {",
  "window.showToast = function(message, opts = {}){"
);
const notifyAssigned = sliceBetween(
  leadInbox,
  "notifyAssigned(ev){",
  "notifyLeadRow(row, options = {}){"
);
const flushStart = leadInbox.indexOf("async flushForCurrentUser(){");
const flush = flushStart >= 0 ? leadInbox.slice(flushStart) : "";
const arrival = sliceBetween(
  leadInbox,
  "handleInboxMetaArrival(){",
  "syncAssignNotice(entry){"
);
const leadsUpdate = sliceBetween(
  watcher,
  'event: "UPDATE",',
  "table: SUPABASE_TABLES.meta"
);

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-campaign-lead-assign-toast.js")]).status === 0, "node --check this test");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + TAG), "index.html app.css cache");
assert(html.includes("theme.css?v=" + TAG), "index.html theme.css cache");
assert(sw.includes("gi-v12-" + TAG), "service-worker cache");

console.log("\n2) טוסט ליד גדול יותר — רק נתיב הליד");
assert(notifyAssigned.includes('kind: "lead"'), "lead toast sets kind=lead");
assert(toastApi.includes('safeTrim(merged.kind) === "lead"'), "AppToast accepts optional kind=lead");
assert(toastApi.includes("giGlobalToast--lead"), "lead class is applied on the toast");
assert(toastApi.includes("syncLeadHostClass"), "host class tracks a visible lead toast");
assert(css.includes("GI-LEAD-TOAST 2026-09-17"), "app.css lead toast marker");
assert(css.includes(".giGlobalToast--lead"), "lead toast chrome exists");
assert(css.includes("font-size:22px"), "lead title is larger");
assert(css.includes("font-size:16px"), "lead body is larger");
assert(theme.includes(".giBottomAlerts .giGlobalToastHost--lead"), "theme widens only the lead host");
assert(theme.includes("min(480px, 100%)"), "lead toast host is 480px");
assert(theme.includes("width: min(420px, 100%)"), "other global toasts stay 420px");

console.log("\n3) Realtime מיידי — בלי דילוג על assigned_agent_id זהה");
assert(!!leadsUpdate, "campaign_leads UPDATE handler found");
assert(!leadsUpdate.includes("if(prevAgentId === newAgentId) return"), "UPDATE no longer skips same primary agent");
assert(leadsUpdate.includes("GI-LEAD-TOAST 2026-09-17"), "UPDATE comment marks the no-skip fix");
assert(leadInbox.includes("alreadyMine"), "status updates on an already-owned lead do not toast");
assert(leadInbox.includes("findAgentRecordForSession()"), "realtime notify uses the signed-in agent");
assert(leadInbox.includes("campaignLeadAgentAccess(l, me)"), "already-mine check uses existing access helper");

console.log("\n4) inbox — טוסט מיד, בלי hasLead / fetchAll לפני");
assert(leadInbox.includes("GI-LEAD-TOAST 2026-09-17: הטוסט מנתוני ה-inbox"), "pending inbox toasts without waiting for the row");
assert(!leadInbox.includes("const hasLead = (CampaignLeadsStore.leads || []).some"), "pending inbox dropped hasLead gate");
assert(flush.includes("GI-LEAD-TOAST 2026-09-17: לא מחכים ל-hasLead"), "flush toasts without hasLead");
assert(!flush.includes("const hasLead = (CampaignLeadsStore.leads || []).some"), "flush dropped hasLead gate");
assert(arrival.includes("await this.flushForCurrentUser()"), "meta arrival flushes first");
assert(arrival.includes("GI-LEAD-TOAST 2026-09-17: טוסט קודם"), "meta arrival order is documented");
assert(arrival.indexOf("flushForCurrentUser") < arrival.indexOf("fetchAll"), "flush runs before fetchAll");

console.log("\n5) הלוגיקה הקיימת נשארת");
assert(notifyAssigned.includes('title: "קבלת ליד חדש לטיפול"'), "toast title unchanged");
assert(notifyAssigned.includes('label: "פתח ליד"'), "open-lead action stays");
assert(notifyAssigned.includes("playGiLeadNotifySequence()"), "lead chime still plays");
assert(notifyAssigned.includes('DesktopNotifications?.notify?.("קבלת ליד חדש לטיפול"'), "desktop notification stays");
assert(app.includes("function playGiLeadNotifySequence(options = {}){"), "lead notify engine stays");
assert(app.includes("const GiLeadNotifyBadge = {"), "blocked-audio badge stays");
assert(leadInbox.includes("syncAssignNotice(entry){"), "meta inbox backup stays");
assert(watcher.includes("lightIntervalMs: 15000"), "15s polling backup stays");
assert(leadInbox.includes("wasDelivered(leadId, agentId)"), "delivered keys stay");
assert(leadInbox.includes("markDelivered(leadId, agentId)"), "markDelivered stays");
assert(app.includes("function campaignLeadAgentAccess(lead, agentRec){"), "access helper stays");
assert(app.includes("function campaignLeadRowMatchesCurrentAgent(row){"), "row match helper stays");
assert(!notifyAssigned.includes("shouldNotifyInboxEntry"), "notifyAssigned does not re-check age");
assert(app.includes("GI_CAMPAIGN_LEAD_INBOX_NOTIFY_MAX_AGE_MS"), "20-minute inbox window stays");
assert(app.includes('shouldSkipNetwork?.("CampaignAgentLeadWatcher")'), "watcher still yields to live refresh");
assert(app.includes('shouldSkipNetwork?.("CampaignAgentLeadWatcher.light")'), "light tick still yields");

if(failed){
  console.error("\nFAILED " + failed + " / passed " + passed);
  process.exit(1);
}
console.log("\nOK " + passed + " assertions");
process.exit(0);
