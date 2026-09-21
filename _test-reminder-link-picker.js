/* GI-REMINDER 2026-09-15 — שיוך לקוח/ליד/הצעה בחיפוש, בלי לגעת במנועי המערכת.
   הרצה: node _test-reminder-link-picker.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260919-exist-pol-status-dd-v1";
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

function sliceBetween(src, startMark, endMark){
  const start = src.indexOf(startMark);
  const end = src.indexOf(endMark, start);
  if(start < 0 || end < 0 || end <= start) return "";
  return src.slice(start, end);
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "app.css"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
const unify = fs.readFileSync(path.join(ROOT, "theme-unify-flat.css"), "utf8");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + TAG), "index.html app.css cache");
assert(sw.includes("gi-v12-" + TAG), "service-worker cache");
assert(app.includes('BUILD = "' + TAG + '"'), "app.js BUILD");

console.log("\n2) dead select is gone; search field is active");
assert(html.includes("id=\"giReminderLinkQuery\""), "search input exists");
assert(!sliceBetween(html, "id=\"giReminderLinkQuery\"", "id=\"giReminderLinkClear\"").includes("placeholder="), "link search has no placeholder");
assert(!html.includes("למשל: להתקשר בנוגע להצעה לביטוח חיים"), "callback note has no example placeholder");
assert(!html.includes("תלוש משכורת אחרון"), "docs list has no example placeholder");
assert(!html.includes("תאריך לידה חסר"), "missing list has no example placeholder");
assert(!html.includes("id=\"giReminderCustomer\""), "old select is removed");
assert(!app.includes("populateCustomerList"), "old name-only select filler is gone");
assert(app.includes("_queryMatchesLink"), "matches name / id / phone");
assert(app.includes("normalizeIdValue"), "id search uses existing id normalizer");
assert(app.includes("normalizePhoneValue"), "phone search uses existing phone normalizer");

console.log("\n3) only the agent's own records, using existing ownership helpers");
assert(app.includes("customerOwnedByCurrentAgent(rec)"), "customers/proposals use existing ownership");
assert(app.includes("agentCanOpenCampaignLead(lead)"), "leads use existing access helper");
const searchFn = sliceBetween(app, "async searchLinkedRecords(query){", "_renderLinkResults(hits, query){");
assert(searchFn.includes("Storage.searchCustomers(q, 20)"), "customer server search is reused, not rewritten");
assert(searchFn.includes("_isMineCustomerOrProposal(c)"), "server hits are still filtered to mine");
const searchEngine = sliceBetween(app, "async searchCustomers(query, limit = 40, options = {}){", "async loadCampaignLeadRows");
assert(searchEngine.includes("id_number.ilike"), "customer search engine still searches id");
assert(searchEngine.includes("phone.ilike"), "customer search engine still searches phone");
assert(searchEngine.includes("_fetchLimitedRowsMergedAgentScope"), "customer search engine agent-scope is unchanged");

console.log("\n4) due alert opens the linked file / lead / proposal");
assert(html.includes("id=\"giReminderAlertOpenCustomer\""), "open customer file button");
assert(html.includes("id=\"giReminderAlertOpenLead\""), "open lead button");
assert(html.includes("id=\"giReminderAlertOpenProposal\""), "open proposal button");
assert(app.includes("CustomersUI.openByIdWithLoader"), "opens customer file with existing opener");
assert(app.includes("LeadDetailsModal.open"), "opens lead with existing modal");
assert(app.includes("ProposalsUI.openById"), "opens proposal with existing opener");
assert(app.includes("lead_id:") && app.includes("proposal_id:") && app.includes("link_kind:"), "persists lead/proposal link");

console.log("\n5) empty red error bar is hidden");
assert(html.includes("id=\"giReminderError\" hidden"), "error box starts hidden");
assert(css.includes(".giReminderModal__error:empty"), "empty error has no box");
assert(css.includes(".giReminderModal__error[hidden]"), "hidden error has no box");
assert(unify.includes("#giReminderModal .giReminderModal__error:empty"), "unify theme hides empty error");
assert(app.includes("this.els.errorBox.hidden = !text"), "JS hides error when there is no message");

console.log("\n6) reminder sound and system engines stay");
assert(app.includes("playGiReminderSound()"), "glass reminder sound stays");
assert(!sliceBetween(app, "_playAlertSound(){", "_sendBrowserNotification(r){").includes("playGiNotifySound()"), "alert still not the old marimba");
assert(app.includes("function playGiLeadNotifySequence"), "lead notify engine unchanged");
assert(app.includes("const GI_ILS_AMOUNT"), "amount helper unchanged");

if(failed){
  console.error("\nFAILED " + failed + " / passed " + passed);
  process.exit(1);
}
console.log("\nOK " + passed + " assertions");
process.exit(0);
