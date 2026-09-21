/* GI-DASH-ALIGN 2026-09-21 — לקוחות אחרונים + ביצועים מול יעד
   נמתחים לקו כרטיסיית «פרמיה ממינוי סוכן». עיצוב בלבד, בלי לוגיקה.
   הרצה: node _test-dashboard-recent-goal-align.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const THEME_TAG = "20260921-dash-align-v1";
const APP_TAG = "20260919-exist-pol-status-dd-v1";
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
const theme = read("theme.css");
const css = read("app.css");
const html = read("index.html");

console.log("1) syntax + theme cache only");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("theme.css?v=" + THEME_TAG), "index.html theme.css cache bumped");
assert(html.includes("app.js?v=" + APP_TAG), "app.js cache unchanged");
assert(html.includes("app.css?v=" + APP_TAG), "app.css cache unchanged");
assert(app.includes('BUILD = "' + APP_TAG + '"'), "app.js BUILD unchanged");

console.log("\n2) dashboard columns match 4 KPI cards (10px gap)");
const dashGrid = sliceBetween(theme, "25. DASHBOARD GRID — two columns", "26. DASHBOARD");
assert(dashGrid.includes("grid-template-columns: repeat(4, minmax(0, 1fr)) !important;"), "dashboard uses the same 4 tracks as the KPI row");
assert(!dashGrid.includes("minmax(0, 1.15fr)"), "old 1.15fr side column is gone");
assert(dashGrid.includes("gap: 10px !important;"), "dashboard gap stays 10px");
assert(dashGrid.includes("grid-column: 1 / span 3 !important;"), "recent+goal spans the 3 KPI cards through agent-appointment");
assert(dashGrid.includes("grid-column: 4 !important;"), "ops/service sits in the 4th KPI track");
assert(css.includes("#view-dashboard .bankDash__kpis{ display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; }"), "KPI row is still 4 equal columns");

console.log("\n3) recent customers + goal fill that column");
assert(dashGrid.includes(".bankDash__row--recentGoalCol:not(#\\9):not(#\\9){"), "recent+goal column wrapper stays");
assert(dashGrid.includes("width: 100% !important;"), "column children stretch full width");
assert(theme.includes("#view-dashboard .bankRecent:not(#\\9):not(#\\9)") && /#view-dashboard \.bankRecent:not\(#\\9\):not\(#\\9\)\{[^}]*width: 100% !important;/.test(theme.replace(/\s+/g, " ")), "recent card is 100% width");
assert(theme.includes("#view-dashboard .bankGoal:not(#\\9):not(#\\9)") && /#view-dashboard \.bankGoal:not\(#\\9\):not\(#\\9\)\{[^}]*width: 100% !important;/.test(theme.replace(/\s+/g, " ")), "goal card is 100% width");

console.log("\n4) system logic untouched");
assert(app.includes('he: \'פרמיה ממינוי סוכן\''), "agent-appointment KPI label stays");
assert(app.includes("bankDash__row--recentGoalCol"), "recent+goal column still rendered");
assert(app.includes("renderRecentCustomersHtml()"), "recent customers renderer stays");
assert(app.includes("renderGoalCardHtml(metrics, orgScope)"), "goal renderer stays");
assert(app.includes('<div class="bankGoal__title">ביצועים מול יעד</div>'), "goal title stays");
assert(app.includes("agentAppointmentPremium:"), "appointment premium metric stays");
assert(app.includes("recentCustomersRows(limit = 5)"), "recent customers query stays");
assert(app.includes("formatAgentApptBreakdownHtml(metrics.agentApptItems)"), "appointment breakdown stays");

if(failed){
  console.error("\nFAILED " + failed + " / passed " + passed);
  process.exit(1);
}
console.log("\nOK " + passed + " assertions");
process.exit(0);
