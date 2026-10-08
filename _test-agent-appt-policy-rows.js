/* GI-AGENT-APPT-ROWS — סטטוס שורת מינוי סוכן לפי כל שורות אותו מספר פוליסה.
   הרצה: node _test-agent-appt-policy-rows.js
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

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(app.includes("agentAppointmentReportRowsForPolicy"), "row collector");
assert(app.includes("presentAgentAppointmentReportStatus"), "status presenter");
assert(app.includes("origin !== \"agent_appointment\""), "overlay still skips other policies");
assert(!/existingStatus\s*=\s*"פעילה"/.test(app), "does not rewrite stored existingStatus");
assert(app.includes("agentApptReportSummary"), "appointment match blocks the sales overlay");

const start = app.indexOf("/* GI-DAILY-POL-STATUS-START");
const end = app.indexOf("/* GI-DAILY-POL-STATUS-END */");
const block = app.slice(start, end);
const sandbox = {
  safeTrim(v){ return String(v == null ? "" : v).trim(); },
  escapeHtml(v){ return String(v == null ? "" : v); }
};
vm.runInNewContext([
  extractFunction(app, "findDailyReportHeaderCol"),
  extractFunction(app, "getDailyReportCell"),
  extractFunction(app, "normalizeDailyReportAgentToken"),
  extractFunction(app, "isDailyReportIssuedStatus"),
  "function getDailyReportColumnIndexes(report){ const headers = Array.isArray(report && report.headerRow) ? report.headerRow : []; return { status: findDailyReportHeaderCol(headers, ['סטטוס הצעה', 'סטטוס']) }; }",
  block,
  extractFunction(app, "normalizeAgentApptPolicyNumber"),
  extractFunction(app, "normalizeAgentApptCompanyKey"),
  extractFunction(app, "isAgentApptReportCompletedStatus"),
  extractFunction(app, "getAgentApptReportColumnIndexes"),
  extractFunction(app, "parseDailyReportMoney"),
  extractFunction(app, "formatAgentApptReportMoney"),
  extractFunction(app, "agentAppointmentCompanyMatches"),
  extractFunction(app, "agentAppointmentReportRowsForPolicy"),
  extractFunction(app, "presentAgentAppointmentReportStatus")
].join("\n"), sandbox);

const { agentAppointmentReportRowsForPolicy, presentAgentAppointmentReportStatus } = sandbox;

function report(rows){
  return {
    headerRow: ["נציג", "מבוטח", "ת.ז", "מס פוליסה", "שם תוכנית", "סטאטוס", "תאריך סטטוס", "חברה", "פרמיה", "הערות", "חודש ביצוע"],
    dataRows: rows.map((cells, idx) => ({ rowIndex: idx + 2, agent: cells[0], cells }))
  };
}

const policy = {
  origin: "agent_appointment",
  policyNumber: "2698210081",
  company: "הפניקס",
  insuredLabel: "ענבל ברכה",
  badgeText: "מינוי סוכן",
  existingStatus: "agent_appoint",
  premiumText: "₪10"
};
const rec = { fullName: "ענבל ברכה", idNumber: "208827261" };
const src = report([
  ["אביאל", "ענבל ברכה", "208827261", "2698210081", "בריאות", "התקבלה חרטה", "01/09/2025", "הפניקס", "0", "נשלח 01/09", "ינואר"],
  ["אביאל", "ברכה ענבל", "208827261", "2698210081", "בריאות", "בוצע", "02/09/2025", "הפניקס", "125", "נשלח 02/09", "ינואר"],
  ["אביאל", "מישהו אחר", "111", "999", "בריאות", "בוצע", "02/09/2025", "מגדל", "80", "", "ינואר"]
]);

console.log("1) all rows of the policy number");
const rows = agentAppointmentReportRowsForPolicy(src, policy, rec);
assert(rows.length === 2, "both statuses of the same policy number are kept");
const view = presentAgentAppointmentReportStatus(rows);
assert(view.badgeText === "פעילה", "בוצע becomes פעילה");
assert(view.premiumText.indexOf("125") >= 0, "premium comes from the completed row");
assert(view.extras.some((item) => item.indexOf("התקבלה חרטה") >= 0), "regret stays visible beside פעילה");
assert(view.plan === "בריאות", "plan name is available for the row");
assert(policy.badgeText === "מינוי סוכן", "source policy is not mutated");
assert(policy.existingStatus === "agent_appoint", "stored status stays");

console.log("2) a single non-completed status is shown as itself");
const regret = presentAgentAppointmentReportStatus(agentAppointmentReportRowsForPolicy(report([
  ["אביאל", "ענבל ברכה", "208827261", "2698210081", "בריאות", "התקבלה חרטה", "01/09/2025", "הפניקס", "0", "נשלח", "ינואר"]
]), policy, rec));
assert(regret.badgeText === "התקבלה חרטה", "regret does not become פעילה");
const blocked = presentAgentAppointmentReportStatus(agentAppointmentReportRowsForPolicy(report([
  ["אביאל", "ענבל ברכה", "208827261", "2698210081", "בריאות", "לא ניתן לבצע", "01/09/2025", "הפניקס", "0", "", "ינואר"]
]), policy, rec));
assert(blocked.badgeText === "לא ניתן לבצע", "blocked status stays");
const cancelled = presentAgentAppointmentReportStatus(agentAppointmentReportRowsForPolicy(report([
  ["אביאל", "ענבל ברכה", "208827261", "2698210081", "בריאות", "מבוטל", "01/09/2025", "הפניקס", "0", "", "ינואר"]
]), policy, rec));
assert(cancelled.badgeText === "מבוטל", "cancelled status stays");

console.log("3) wrong company, number, or person does not match");
assert(agentAppointmentReportRowsForPolicy(src, Object.assign({}, policy, { company: "מגדל" }), rec).length === 0, "different company does not match");
assert(agentAppointmentReportRowsForPolicy(src, Object.assign({}, policy, { policyNumber: "111" }), rec).length === 0, "different policy number does not match");
assert(agentAppointmentReportRowsForPolicy(src, Object.assign({}, policy, { insuredLabel: "רחל לוי" }), { fullName: "רחל לוי", idNumber: "999" }).length === 0, "different person does not match");
assert(agentAppointmentReportRowsForPolicy(src, Object.assign({}, policy, { origin: "new" }), rec).length === 2, "row match itself does not depend on origin");

console.log("\n" + (failed ? "FAILED " + failed : "OK") + "  passed=" + passed + " failed=" + failed);
process.exit(failed ? 1 : 0);
