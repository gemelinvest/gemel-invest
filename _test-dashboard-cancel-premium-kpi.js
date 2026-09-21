/* GI-DASH-CANCEL-KPI 2026-09-21 — כרטיסיית «פרמיה בביטול» בדשבורד
   שואבת מדוח הביטולים לפי הרשאות קיימות. מינוי סוכן עובר לפירוט הנטו.
   לא נוגעים במנוע הדוח / computeCancelStats / סינון שורות.
   הרצה: node _test-dashboard-cancel-premium-kpi.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260921-dash-cancel-kpi-v1";
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
const html = read("index.html");
const sw = read("service-worker.js");
const wiz = read("gi-wizard.js");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache");
assert(sw.includes("gi-v12-" + TAG), "service-worker cache");
assert(app.includes('BUILD = "' + TAG + '"'), "app.js BUILD");

console.log("\n2) dashboard card swap is display-only");
assert(app.includes('he: "פרמיה בביטול"'), "third KPI title is פרמיה בביטול");
assert(app.includes("bankKpi--cancelPremium"), "cancel premium card class");
assert(app.includes("Object.assign({}, cancelPremiumKpi)"), "render uses cancel KPI card");
assert(!app.includes("he: 'פרמיה ממינוי סוכן'"), "appointment is no longer a top-level KPI card");
assert(app.includes("bankKpiTodayRow--agentAppoint"), "appointment row exists in net breakdown");
assert(app.includes('bankKpiTodayRow__label">פרמיה ממינוי סוכן'), "appointment label is the last net-breakdown row");

console.log("\n3) numbers still come from the cancellations report, with existing visibility");
assert(app.includes("getCancelPremiumMetrics(){"), "store exposes a read-only metrics helper");
assert(app.includes("CancellationsUI.computeCancelStats"), "reuses existing cancel stats");
assert(app.includes("this.getVisibleRowsForSheet(sheet)"), "metrics use visible rows per sheet");
assert(app.includes("dailyReportRowVisibleToSession(row)"), "row visibility helper unchanged");
assert(app.includes("if(Auth.isAdmin() || Auth.isManager()) return true;"), "admin/manager still see all report rows");
assert(app.includes("if(Auth.isTeamManager()){"), "team manager still uses managed-agent profiles");
assert(app.includes('cell("סה״כ פרמיית ביטול"'), "report total cell unchanged");
assert(app.includes("function classifyCancellationStatus(value){"), "status classifier unchanged");
assert(app.includes('const CANCEL_TOTAL_KEYS = Object.freeze(["cancelled", "cancelledPartial", "partial"]);'), "cancel total keys unchanged");

console.log("\n4) appointment engine and other screens stay");
assert(app.includes("_applyAppointmentKpi(prem, policies, items, source){"), "appointment KPI engine stays");
assert(app.includes("aggregateAgentAppointmentMetrics"), "appointment aggregation stays");
assert(app.includes("function classifyCancellationStatus(value){"), "cancel classifier stays");
assert(html.includes("id=\"cancellationsStats\""), "cancellations report markup stays");
assert(html.includes("דוח ביטולים"), "cancellations report title stays");
assert(wiz.includes("getPolicyPremiumAfterDiscount"), "wizard discount engine stays");
assert(app.includes("buildDailyReportIssuedPremiumKpi"), "issued premium KPI stays");
assert(app.includes('he: "פרמייה מהפקה"') || app.includes("פרמייה מהפקה"), "issued card stays");

console.log("\n5) net breakdown appends appointment after product rows");
const netFn = sliceBetween(app, "formatNetProductBreakdownHtml(productTotals, apptPremium){", "formatAgentApptBreakdownHtml(agentApptItems){");
assert(netFn.includes("אין מכירות החודש"), "empty product copy stays");
assert(netFn.includes("פרמיה ממינוי סוכן"), "appointment row is inside net breakdown");
assert(netFn.indexOf("אין מכירות החודש") < netFn.indexOf("פרמיה ממינוי סוכן"), "appointment row is after product rows");

if(failed){
  console.error("\nFAILED " + failed + " / passed " + passed);
  process.exit(1);
}
console.log("\nOK " + passed + " assertions");
process.exit(0);
