/* GI-DAILY-POL-STATUS — דוח מכירות יומי מפעיל את שורת הפוליסה בתיק.
   התאמה: מספר פוליסה + שם לקוח + חברה + תחילת ביטוח.
   הרצה: node _test-daily-report-policy-status.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
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

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "app.css"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

console.log("1) syntax + wiring");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(app.includes("GI-DAILY-POL-STATUS-START") && app.includes("GI-DAILY-POL-STATUS-END"), "marked block");
assert(app.includes("overlayDailyReportPolicyFromReport"), "overlay helper");
assert(app.includes("DailyReportStore.report"), "active report only");
assert(!/function overlayDailyReportPolicyFromReport[\s\S]{0,500}getViewReport\(/.test(app), "overlay does not read the month archive");
assert(app.includes("renderNewPolicyCard") && app.includes("overlayDailyReportPolicyFromReport(reportPolicy, rec)"), "new policy card");
assert(app.includes("renderPolicyRow(p, rec)"), "wallet row gets the customer");
assert(app.includes("renderOldPolicyTableRow(p, rec)"), "old policy row gets the customer");
assert(app.includes("renderIssuedPolicyBadge(scan, shown)"), "badge uses the report view");
assert(css.includes("GI-DAILY-POL-STATUS"), "status colors");
assert(html.includes("giDailyPol=1"), "cache bust");
assert(!/existingStatus\s*=\s*"פעילה"/.test(app), "does not rewrite stored existingStatus");

function extractFunction(src, name){
  const start = src.indexOf("function " + name + "(");
  if(start < 0) throw new Error("missing " + name);
  let i = src.indexOf("{", start);
  let depth = 0;
  for(; i < src.length; i += 1){
    const ch = src[i];
    if(ch === "{") depth += 1;
    else if(ch === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error("unclosed " + name);
}

const start = app.indexOf("/* GI-DAILY-POL-STATUS-START");
const end = app.indexOf("/* GI-DAILY-POL-STATUS-END */");
assert(start > 0 && end > start, "block bounds");
const block = app.slice(start, end);

const sandbox = {
  safeTrim(v){ return String(v == null ? "" : v).trim(); },
  escapeHtml(v){ return String(v == null ? "" : v); },
  DailyReportStore: { report: null }
};
vm.runInNewContext(
  [
    extractFunction(app, "findDailyReportHeaderCol"),
    extractFunction(app, "getDailyReportCell"),
    extractFunction(app, "normalizeDailyReportAgentToken"),
    extractFunction(app, "isDailyReportIssuedStatus"),
    "function getDailyReportColumnIndexes(report){ const headers = Array.isArray(report && report.headerRow) ? report.headerRow : []; return { status: findDailyReportHeaderCol(headers, ['סטטוס הצעה', 'סטטוס']) }; }",
    block
  ].join("\n"),
  sandbox
);

const {
  overlayDailyReportPolicyOnPolicy,
  normalizeDailyReportPolicyNumber,
  normalizeDailyReportCompanyKey,
  normalizeDailyReportPersonNameKey,
  normalizeDailyReportStartDateKey
} = sandbox;

function report(rows){
  return {
    headerRow: ["שם לקוח", "מספר פוליסה", "חברה", "תחילת ביטוח", "סטטוס", "מבוטח", "פרמיה"],
    dataRows: rows.map((cells, idx) => ({ rowIndex: idx + 2, cells }))
  };
}

const customer = { fullName: "דוד כהן" };
const policy = {
  id: "p1",
  origin: "new",
  company: "כלל",
  policyNumber: "019325742",
  startDate: "2026-09-01",
  badgeText: "חדש",
  badgeClass: "is-new",
  existingStatus: "חדש",
  details: { "סטטוס": "פוליסה חדשה" }
};

console.log("2) normalize");
assert(normalizeDailyReportPolicyNumber(" 0193-25742 ") === "19325742", "policy number digits");
assert(normalizeDailyReportCompanyKey("כלל ביטוח") === "כלל", "company alias");
assert(normalizeDailyReportCompanyKey("מגדל חברה לביטוח") === "מגדל", "migdal alias");
assert(normalizeDailyReportPersonNameKey("כהן דוד") === normalizeDailyReportPersonNameKey("דוד כהן"), "name order");
assert(normalizeDailyReportStartDateKey("01/09/2026") === "2026-09-01", "dmy date");
assert(normalizeDailyReportStartDateKey("01.09.2026") === "2026-09-01", "dotted date");

console.log("3) issued becomes פעילה only on a full match");
const issued = overlayDailyReportPolicyOnPolicy(policy, customer, report([
  ["כהן דוד", "19325742", "כלל ביטוח", "01/09/2026", "הופקה", "דוד כהן", "120"]
]));
assert(issued.badgeText === "פעילה", "הופקה → פעילה");
assert(issued.badgeClass === "is-reportActive", "active class");
assert(issued.dailyReportStatusSummary === "פעילה", "summary");
assert(policy.badgeText === "חדש", "original policy not mutated");
assert(policy.existingStatus === "חדש", "stored status untouched");
assert(issued.details["סטטוס"] === "פעילה", "modal status");
assert(String(issued.details["דוח · דוד כהן"] || issued.details["דוח מכירות"] || "").includes("הופקה"), "report row is copied onto the policy");
assert(String(issued.details["דוח · דוד כהן"] || issued.details["דוח מכירות"] || "").includes("120"), "premium cell is copied");

assert(overlayDailyReportPolicyOnPolicy(policy, { fullName: "רחל לוי" }, report([
  ["כהן דוד", "19325742", "כלל ביטוח", "01/09/2026", "הופקה", "דוד כהן", "120"]
])).badgeText === "חדש", "different customer name does not match");
assert(overlayDailyReportPolicyOnPolicy(policy, customer, report([
  ["כהן דוד", "19325742", "מגדל", "01/09/2026", "הופקה", "דוד כהן", "120"]
])).badgeText === "חדש", "different company does not match");
assert(overlayDailyReportPolicyOnPolicy(policy, customer, report([
  ["כהן דוד", "19325742", "כלל", "02/09/2026", "הופקה", "דוד כהן", "120"]
])).badgeText === "חדש", "different start date does not match");
assert(overlayDailyReportPolicyOnPolicy(policy, customer, report([
  ["כהן דוד", "999", "כלל", "01/09/2026", "הופקה", "דוד כהן", "120"]
])).badgeText === "חדש", "different policy number does not match");
assert(overlayDailyReportPolicyOnPolicy(Object.assign({}, policy, { startDate: "" }), customer, report([
  ["כהן דוד", "19325742", "כלל", "01/09/2026", "הופקה", "דוד כהן", "120"]
])).badgeText === "חדש", "missing start date does not match");

console.log("4) other statuses stay on the same policy number");
const mixed = overlayDailyReportPolicyOnPolicy(policy, customer, report([
  ["דוד כהן", "19325742", "כלל", "01.09.2026", "הופקה", "דוד כהן", "120"],
  ["דוד כהן", "19325742", "כלל", "01/09/2026", "השלמת מידע", "דוד כהן", "120"],
  ["דוד כהן", "19325742", "כלל", "2026-09-01", "דחייה", "רחל כהן", "40"]
]));
assert(mixed.badgeText === "פעילה", "mixed file stays פעילה when one row was issued");
assert(mixed.dailyReportStatusExtras.some((item) => item.indexOf("השלמת מידע") >= 0), "השלמת מידע is shown");
assert(mixed.dailyReportStatusExtras.some((item) => item.indexOf("רחל כהן") >= 0 && item.indexOf("דחייה") >= 0), "rejection names the insured");
assert(Object.keys(mixed.details).filter((key) => key.indexOf("דוח") === 0).length === 3, "every report row is on the policy");

const infoOnly = overlayDailyReportPolicyOnPolicy(policy, customer, report([
  ["דוד כהן", "19325742", "כלל", "01/09/2026", "השלמת מידע", "", "80"]
]));
assert(infoOnly.badgeText === "השלמת מידע", "info only stays השלמת מידע");
assert(infoOnly.badgeText !== "פעילה", "info only does not become פעילה");

const rejectedOnly = overlayDailyReportPolicyOnPolicy(policy, customer, report([
  ["דוד כהן", "19325742", "כלל", "01/09/2026", "נדחה", "רחל כהן", "0"]
]));
assert(rejectedOnly.badgeText === "דחייה", "rejection only stays דחייה");
assert(rejectedOnly.dailyReportStatusExtras.some((item) => item.indexOf("רחל כהן") >= 0), "rejected insured is named");

const waiting = overlayDailyReportPolicyOnPolicy(policy, customer, report([
  ["דוד כהן", "19325742", "כלל", "01/09/2026", "ממתין להפקה", "דוד כהן", "90"]
]));
assert(waiting.badgeText === "ממתין להפקה", "pending issue is shown as itself");
assert(waiting.badgeText !== "פעילה", "pending issue does not become פעילה");

console.log("\n" + (failed ? "FAILED " + failed : "OK") + "  passed=" + passed + " failed=" + failed);
process.exit(failed ? 1 : 0);
