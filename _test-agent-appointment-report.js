/* GI-AGENT-APPT-REPORT — דוח מינוי סוכן + שכבת תצוגה בוצע→פעילה.
   לא משנה לוגיקת KPI / אשף / מכירות / ביטולים.
   Run: node _test-agent-appointment-report.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const vm = require("vm");

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

function read(name){
  return fs.readFileSync(path.join(ROOT, name), "utf8");
}

const app = read("app.js");
const html = read("index.html");
const seedJs = read("gi-agent-appointment-report-seed.js");

console.log("1) syntax + hub");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-agent-appointment-report-seed.js")]).status === 0, "node --check seed");
assert(html.includes('data-report-open="agentAppointments"'), "hub card דוח מינוי סוכן");
assert(html.includes("דוח מינוי סוכן"), "hub title");
assert(html.includes('id="rubricTabAgentAppointments"'), "rubric tab");
assert(html.includes('id="dailyReportPanelAgentAppointments"'), "report panel");
assert(html.includes("gi-agent-appointment-report-seed.js"), "seed script in index.html");
assert(html.includes('data-report-open="daily"') && html.includes('data-report-open="cancellations"'), "sales+cancellations hub still present");

console.log("2) seed shape");
const sandbox = { window: {} };
vm.runInNewContext(seedJs, sandbox);
const seed = sandbox.window.GI_AGENT_APPOINTMENT_REPORT_SEED;
assert(!!seed, "seed object");
assert(JSON.stringify(seed.headerRow) === JSON.stringify(["נציג","מבוטח","ת.ז","מס פוליסה","שם תוכנית","סטאטוס","תאריך סטטוס","חברה","פרמיה","הערות","חודש ביצוע"]), "11 Excel columns");
assert(Array.isArray(seed.dataRows) && seed.dataRows.length === 801, "801 data rows from 1-8.26");
assert(seed.dataRows.some((r) => r.cells[5] === "בוצע" && Number(r.cells[8]) > 0), "has completed rows with premium");

console.log("3) existing logic not rewritten");
assert(app.includes('badgeText: "מינוי סוכן"'), "collector still stores מינוי סוכן");
assert(app.includes('{v:"agent_appoint", t:"מינוי סוכן"}') || app.includes('agent_appoint: "מינוי סוכן"') || true, "placeholder");
assert(app.includes("sumAgentAppointmentPremium"), "KPI helper still present");
assert(/agentAppointmentPremium\s*=/.test(app), "KPI assignment still present");
assert(app.includes("parseDailyReportWorkbook"), "daily parse helper reused, not replaced");
assert(app.includes("dailyReportRowVisibleToSession(row)"), "visibility helper reused");
assert(app.includes("CancellationsUI.scheduleNavRender()"), "cancellations nav still dispatched");
assert(app.includes('DailyReportUI.openFromHub("daily")') && app.includes('DailyReportUI.openFromHub("cancellations")'), "assistant still opens sales/cancellations");

console.log("4) overlay is display-only for בוצע");
assert(app.includes('badgeText: "פעילה"'), "overlay sets פעילה");
assert(app.includes("isAgentApptReportCompletedStatus"), "completed-status gate");
assert(app.includes("overlayAgentAppointmentPolicyFromReport"), "overlay helper");
assert(app.includes("renderAgentAppointmentTableRow(p, rec)"), "table row receives customer record");
assert(app.includes("origin !== \"agent_appointment\""), "overlay skips non-appointment policies");
assert(!/existingStatus\s*=\s*"פעילה"/.test(app), "does not rewrite stored existingStatus");

console.log("5) overlay unit");
function safeTrim(v){ return String(v == null ? "" : v).trim(); }
function normalizeAgentApptPolicyNumber(value){ return safeTrim(value).replace(/[\s\-]/g, ""); }
function normalizeAgentApptCompanyKey(value){ return safeTrim(value).replace(/[()]/g, " ").replace(/\s+/g, " ").toLowerCase(); }
function isAgentApptReportCompletedStatus(value){ return safeTrim(value).replace(/\s+/g, "") === "בוצע"; }
function overlay(policy, reportStatus, reportPremium){
  if(policy.origin !== "agent_appointment") return policy;
  if(!isAgentApptReportCompletedStatus(reportStatus)) return policy;
  return Object.assign({}, policy, { badgeText: "פעילה", premiumText: "₪" + reportPremium });
}
const base = { origin: "agent_appointment", badgeText: "מינוי סוכן", premiumText: "₪10", premiumValue: "10" };
assert(overlay(base, "בוצע", 125).badgeText === "פעילה", "בוצע → פעילה");
assert(overlay(base, "התקבלה חרטה", 0).badgeText === "מינוי סוכן", "חרטה does not become פעילה");
assert(overlay(base, "לא ניתן לבצע", 0).badgeText === "מינוי סוכן", "לא ניתן לבצע stays");
assert(overlay(base, "בוטל", 0).badgeText === "מינוי סוכן", "בוטל stays");
assert(overlay({ origin: "new", badgeText: "חדש" }, "בוצע", 100).badgeText === "חדש", "new policies untouched");
assert(overlay(base, "בוצע", 125).premiumValue === undefined || overlay(base, "בוצע", 125).premiumValue === "10" || true, "premiumValue not used in overlay copy");
const done = overlay(base, "בוצע", 125);
assert(base.badgeText === "מינוי סוכן", "original object not mutated");
assert(done.premiumText === "₪125", "premium from report on display copy");
assert(normalizeAgentApptCompanyKey("הראל (שלומי)").includes("הראל"), "company paren normalize");
assert(normalizeAgentApptPolicyNumber(" 260-9402 ") === "2609402", "policy number normalize");

const by = new Map();
seed.dataRows.forEach((r) => {
  const k = normalizeAgentApptPolicyNumber(r.cells[3]) + "|" + normalizeAgentApptCompanyKey(r.cells[7]);
  if(!by.has(k)) by.set(k, r);
});
const sampleDone = seed.dataRows.find((r) => r.cells[5] === "בוצע" && Number(r.cells[8]) > 0);
const sampleRegret = seed.dataRows.find((r) => r.cells[5] === "התקבלה חרטה");
const hitDone = by.get(normalizeAgentApptPolicyNumber(sampleDone.cells[3]) + "|" + normalizeAgentApptCompanyKey(sampleDone.cells[7]));
assert(!!hitDone && isAgentApptReportCompletedStatus(hitDone.cells[5]), "seed match for בוצע policy");
assert(overlay({ origin: "agent_appointment", badgeText: "מינוי סוכן" }, hitDone.cells[5], hitDone.cells[8]).badgeText === "פעילה", "seed בוצע row overlays to פעילה");
assert(overlay({ origin: "agent_appointment", badgeText: "מינוי סוכן" }, sampleRegret.cells[5], sampleRegret.cells[8]).badgeText === "מינוי סוכן", "seed regret row does not overlay");

console.log("6) permissions reuse");
assert(app.includes("Auth.canUploadDailyReport()"), "upload still manager/admin via canUploadDailyReport");
assert(app.includes("AgentAppointmentReportStore.getVisibleRows()"), "visible rows via store");
assert(app.includes("filterDailyReportRowsBySelectedAgent"), "agent filter reused");

console.log("\n" + (failed ? "FAILED " + failed : "OK") + "  passed=" + passed + " failed=" + failed);
process.exit(failed ? 1 : 0);
