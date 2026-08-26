/* GI-CF-REMOVE-SUMMARY 2026-08-26
   Remove the customer-file "סיכום תיק" side column without touching file logic.
   Run: node _test-customer-file-summary-removed.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260826-daily-sales-branch-v1";
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
const html = read("index.html");
const css = read("app.css");
const theme = read("theme.css");
const sw = read("service-worker.js");

const fileStart = app.indexOf("const CustomersUI = {");
const fileEnd = app.indexOf("const ArchiveCustomerUI = {");
assert(fileStart > 0 && fileEnd > fileStart, "CustomersUI block found");
const fileBlock = fileStart > 0 && fileEnd > fileStart ? app.slice(fileStart, fileEnd) : "";

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "app.js syntax");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + APP_TAG), "index.html app.css cache");
assert(html.includes("theme.css?v=" + APP_TAG), "index.html theme.css cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");

console.log("\n2) summary column removed");
assert(!html.includes('id="customerFullSide"'), "HTML no longer mounts customerFullSide");
assert(!html.includes("cfFile__side card"), "HTML no longer mounts cfFile__side");
assert(!html.includes('id="customerFullDash"'), "HTML no longer mounts the leftover KPI dash");
assert(!fileBlock.includes("renderSidebar"), "CustomersUI no longer renders a sidebar");
assert(!fileBlock.includes("renderKpiBar"), "CustomersUI no longer paints the KPI summary bar");
assert(!fileBlock.includes("סיכום תיק"), "CustomersUI no longer paints סיכום תיק");
assert(!fileBlock.includes('this.els.side'), "CustomersUI no longer writes els.side");
assert(!fileBlock.includes("this.els.dash"), "CustomersUI no longer writes els.dash");
assert(fileBlock.includes("stripLegacyFileSummary"), "CustomersUI strips leftover summary DOM");
assert(html.includes("giCfSummaryKill"), "HTML injects a hard-kill for leftover summary nodes");

console.log("\n3) layout uses the full width");
assert(css.includes("grid-template-columns: minmax(0, 1fr);"), "app.css customer file grid is one column");
assert(!css.includes("grid-template-columns: minmax(0, 1fr) 280px"), "app.css dropped the 280px summary column");
assert(theme.includes("grid-template-columns: minmax(0, 1fr) !important;"), "theme.css customer file grid is one column");
assert(!theme.includes("grid-template-columns: minmax(0, 1fr) 280px"), "theme.css dropped the 280px summary column");
assert(/#customerFullSide[\s\S]{0,180}display:\s*none !important;/.test(css), "app.css hard-kills leftover side");
assert(/#customerFullSide:not\(#\\9\):not\(#\\9\)[\s\S]{0,180}display:\s*none !important;/.test(theme), "theme.css hard-kills leftover side");
assert(html.includes('id="customerFullTabs"'), "tabs bar remains");
assert(html.includes('id="customerFullMain"'), "main file panel remains");

console.log("\n4) file logic is unchanged");
[
  "collectPolicies(rec)",
  "collectElementaryProducts(rec)",
  "collectAgentAppointmentPolicies(rec)",
  "getNewPoliciesOnly(policies)",
  "getExistingOldPoliciesOnly(policies)",
  "sumPremiumAfterDiscount(",
  "sumElementaryPremium(",
  "sumAgentAppointmentPremium(",
  "renderTabBar(rec, policies)",
  "renderSectionContent(rec, policies)",
  "bindSectionActions(rec, policies)",
  "switchSection(section)",
  "renderFileView(rec, opts={})",
  "openById(id, opts={})",
  "openByIdWithLoader",
  "_openByIdResolved(rec, opts={})",
  "_showFileLoading(rec)",
  "normalizeSection(section)",
  "startOpsCardLoop()"
].forEach((name) => {
  assert(fileBlock.includes(name), "logic remains: " + name);
});
assert(fileBlock.includes("tab('policies', 'פוליסות'"), "policies tab remains");
assert(fileBlock.includes("tab('personal', 'מבוטחים בתיק'"), "insureds tab remains");
assert(fileBlock.includes("tab('medical', 'הצהרת בריאות'"), "health tab remains");
assert(fileBlock.includes("tab('ops', 'תפעול'"), "ops tab remains");
assert(fileBlock.includes("tab('documents', 'מסמכי לקוח'"), "documents tab remains");
assert(fileBlock.includes("CustomersUI.openByIdWithLoader") || app.includes("CustomersUI.openByIdWithLoader"), "full-file open entry remains");
assert(fileBlock.includes("this.els.main.innerHTML = this.renderSectionContent(rec, policies)"), "file view still paints the main section");
assert(fileBlock.includes("this.els.tabs.innerHTML = this.renderTabBar(rec, policies)"), "file view still paints tabs");

console.log("\n-----");
console.log("passed=" + passed + " failed=" + failed);
process.exit(failed ? 1 : 0);
