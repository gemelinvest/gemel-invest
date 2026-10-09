/* GI-CF-CHROME 2026-10-05
   תיק לקוח: כותרת כחול→לבן כמו התפריט, שורות פוליסה ככרטיסים.
   CSS בלבד — בלי נגיעה בלוגיקת פתיחה/שמירה/סריקה/טאבים.
   הרצה: node _test-cf-file-chrome-visual.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20261007-lead-dup-v1";
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

const app = read("app.js");
const theme = read("theme.css");
const html = read("index.html");
const sw = read("service-worker.js");
const wizard = read("gi-wizard.js");

const fileStart = app.indexOf("const CustomersUI = {");
const fileEnd = app.indexOf("const ArchiveCustomerUI = {");
assert(fileStart > 0 && fileEnd > fileStart, "CustomersUI block found");
const fileBlock = fileStart > 0 && fileEnd > fileStart ? app.slice(fileStart, fileEnd) : "";

console.log("1) syntax + cache (theme only)");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(app.includes('const BUILD = "' + TAG + '"'), "app.js BUILD untouched");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache untouched");
assert(html.includes("theme.css?v=" + TAG), "index.html theme.css cache prefix");
assert(html.includes("giCfUi=1"), "theme.css cache bust for chrome visual");
assert(sw.includes("gi-v12-" + TAG), "service-worker still keyed to BUILD");
assert(sw.includes("cf-ui-v1"), "service-worker cache suffix for chrome visual");

console.log("\n2) header: sidebar blue graded to white");
assert(theme.includes("GI-CF-CHROME 2026-10-05"), "chrome visual mark");
assert(theme.includes("linear-gradient(180deg, #3870ED 0%, #5B8AF1 22%, #A8C4FB 52%, #E8F0FE 78%, #FFFFFF 100%)"), "header blue-to-white gradient");
assert(!theme.includes("linear-gradient(180deg, #FFFFFF 0%, #D6E4FF 48%, #3870ED 155%)"), "old white-to-blue header removed");
assert(theme.includes(".sidebar:not(#\\9):not(#\\9)") && theme.includes("background: var(--gi-navy) !important"), "sidebar navy token unchanged");
assert(theme.includes(".cfFile__idCard:not(#\\9):not(#\\9)"), "identity card CSS remains");

console.log("\n3) policy rows: card chrome, same grid/logic hooks");
assert(theme.includes("border-radius: 14px !important") && theme.includes(".cfNewPolicyCard:not(#\\9):not(#\\9)"), "policy row is a rounded card");
assert(theme.includes("gap: 10px !important") && theme.includes(".cfNewPolicyGrid:not(#\\9):not(#\\9)"), "cards are spaced, not hairline-stacked");
assert(theme.includes(".cfNewPolicyCard:not(#\\9):not(#\\9)::before"), "card left accent");
assert(theme.includes("grid-template-columns: 56px minmax(120px, 1.4fr)"), "shared grid template stays");
assert((theme.match(/116px 232px/g) || []).length >= 2, "premium+actions column widths stay");
assert(theme.includes("max-width: 980px !important"), "policy row stops short of the full file width");
assert(theme.includes("min-height: 48px"), "row keeps comfortable height");
assert(theme.includes("color: #1D4ED8 !important") && theme.includes(".cfNewPolicyCard__prem"), "premium amount uses primary blue");

console.log("\n4) file logic untouched");
[
  "collectPolicies(rec)",
  "collectElementaryProducts(rec)",
  "collectAgentAppointmentPolicies(rec)",
  "getNewPoliciesOnly(policies)",
  "getExistingOldPoliciesOnly(policies)",
  "sumPremiumAfterDiscount(",
  "renderTabBar(rec, policies)",
  "renderSectionContent(rec, policies)",
  "bindSectionActions(rec, policies)",
  "switchSection(section)",
  "renderFileView(rec, opts={})",
  "openById(id, opts={})",
  "openByIdWithLoader",
  "renderPolicyTableView(rec, policies)",
  "renderNewPolicyCard(policy, rec, healthPolicies)",
  "renderIssuedPolicyScanBar(policy, scan)",
  "getHealthCoverRowsForDisplay(rec, policy)",
  "canShowIssuedPolicyUpload()"
].forEach((name) => {
  assert(fileBlock.includes(name), "logic remains: " + name);
});
assert(fileBlock.includes("${this.renderIssuedPolicyScanBar(policy, scan)}"), "scan bar still in the row template");
assert(fileBlock.includes("cell('סכום', amountText)"), "amount cell still rendered from helper");
assert(fileBlock.includes("this.formatCfPolicyStartDate(policy.startDate || rawPol.startDate)"), "start date still formatted");
assert(fileBlock.includes("data-cf-covers-toggle="), "covers toggle hook unchanged");
assert(app.includes("Auth._submit = async function()"), "login submit untouched");
assert(wizard.includes("GI_WIZARD_BUILD"), "wizard build marker untouched");

console.log("\n" + (failed ? ("FAILED: " + failed) : ("OK — " + passed + " checks")));
process.exit(failed ? 1 : 0);
