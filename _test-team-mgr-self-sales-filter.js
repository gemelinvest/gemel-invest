/* GI-FEAT 2026-09-06 — מנהל צוות יכול לבחור את עצמו בסינון דוח מכירות
   ולהפיק רק מכירות שמשויכות אליו. בלי שינוי לוגיקת התחברות.
   הרצה: node _test-team-mgr-self-sales-filter.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260906-mirror-script-premiums-v1";
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

function sliceBetween(src, startNeedle, endNeedle){
  const start = src.indexOf(startNeedle);
  if(start < 0) return "";
  const end = src.indexOf(endNeedle, start + startNeedle.length);
  if(end < 0) return src.slice(start);
  return src.slice(start, end);
}

const app = read("app.js");
const html = read("index.html");
const sw = read("service-worker.js");
const wizard = read("gi-wizard.js");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-team-mgr-self-sales-filter.js")]).status === 0, "node --check this test");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + APP_TAG), "index.html app.css cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");
assert(wizard.includes('GI_WIZARD_BUILD = "' + APP_TAG + '"'), "gi-wizard build tag");
assert(app.includes('GI_WIZARD_JS_VERSION = "' + APP_TAG + '"'), "app.js wizard version");

console.log("\n2) מנהל צוות — סינון עצמי בדוח מכירות");
assert(app.includes("function buildTeamManagerDailyReportAgentFilterNames"), "בונה רשימת נציגים כולל מנהל הצוות");
assert(app.includes("function getTeamManagerSelfDailyReportAgentFilterKeys"), "מפתחות שם/משתמש של מנהל הצוות");
assert(app.includes("function teamManagerDailyReportAgentFilterIsSelf"), "זיהוי בחירה עצמית");
assert(app.includes("function filterDailyReportRowsBySelectedAgent"), "סינון שורות לפי נציג נבחר");
assert(app.includes("getTeamManagerSelfDailyReportAgentFilterKeys().forEach((k) => allowed.add(k))"), "מפתחות עצמיים נכנסים ל-allowed");
assert(app.includes("agents = buildTeamManagerDailyReportAgentFilterNames(agents, baseRows)"), "דוח מכירות משתמש בבונה החדש");
assert(app.includes("agents = withDailyReportContext(sheet, () => buildTeamManagerDailyReportAgentFilterNames(agents, baseRows))"), "דוח ביטולים משתמש באותו בונה");

const salesPaint = sliceBetween(app, "const viewReport = DailyReportStore.getViewReport();", "fillSelect(this.els.filterStatus, \"סטטוס — הכל\"");
assert(salesPaint.includes("buildTeamManagerDailyReportAgentFilterNames"), "paintFilterOptions של מכירות קורא לבונה");
assert(!/getManagedAgentRecordsForTeamManager\(safeTrim\(Auth\?\.current\?\.id\)\)\s*\.flatMap/.test(salesPaint), "הוסר הסינון הישן בלי עצמי במכירות");

const cancelPaint = sliceBetween(app, "let agents = CancellationsStore.getAgentSummaryForSheet(sheet)", "fillSelect(this.els.filterTeam, \"צוות — הכל\"");
assert(cancelPaint.includes("buildTeamManagerDailyReportAgentFilterNames"), "paintFilterOptions של ביטולים קורא לבונה");
assert(!/getManagedAgentRecordsForTeamManager\(safeTrim\(Auth\?\.current\?\.id\)\)\s*\.flatMap/.test(cancelPaint), "הוסר הסינון הישן בלי עצמי בביטולים");

const selfFn = sliceBetween(app, "function teamManagerDailyReportAgentFilterIsSelf(filterName){", "function filterDailyReportRowsBySelectedAgent");
assert(selfFn.includes("getTeamManagerSelfDailyReportAgentFilterKeys().has(fKey)"), "בחירה עצמית לפי שם/משתמש");
assert(selfFn.includes("if(!Auth.isTeamManager()) return false"), "רק מנהל צוות מסומן כעצמי");

const filterFn = sliceBetween(app, "function filterDailyReportRowsBySelectedAgent(rows, filterAgent){", "function buildTeamManagerDailyReportAgentFilterNames");
assert(filterFn.includes("teamManagerDailyReportAgentFilterIsSelf(fKey)"), "סינון עצמי לפי פרופיל בעלות");
assert(filterFn.includes("dailyReportRowMatchesOwnershipProfile(row, profile)"), "שורות עצמיות לפי ownership");
assert(filterFn.includes("normalizeDailyReportAgentKey(row.agent) === fKey"), "נציג צוות נשאר סינון לפי שם מדויק");

const salesGet = sliceBetween(app, "getFilteredRows(){\n      const report = DailyReportStore.getViewReport();", "if(fStatus && cols.status >= 0)");
assert(salesGet.includes("filterDailyReportRowsBySelectedAgent(rows, fAgent)"), "getFilteredRows של מכירות משתמש בסינון החדש");

const cancelGet = sliceBetween(app, "getFilteredRows(sheet){\n      if(!sheet) return [];", "if(fTeam && cols.team >= 0)");
assert(cancelGet.includes("filterDailyReportRowsBySelectedAgent(rows, fAgent)"), "getFilteredRows של ביטולים משתמש בסינון החדש");

const salesExport = sliceBetween(app, "async exportToExcel(){\n      try {\n        if(window.GI_LOAD_LIBS?.xlsx) await window.GI_LOAD_LIBS.xlsx();", "dailyReport exportToExcel error");
assert(salesExport.includes(": this.getFilteredRows();"), "הפקת דוח מכירות למנהל צוות מכבדת את סינון הנציג");
assert(salesExport.includes("Auth.isAdmin() || Auth.isManager()"), "אדמין/מנהל עדיין מפיקים את כל השורות");
assert(!salesExport.includes("DailyReportStore.getVisibleRowsFor(report);"), "הפקה לא מתעלמת יותר מהסינון אצל מנהל צוות");

console.log("\n3) ברירת מחדל ורגרסיית תפקידים");
assert(html.includes('id="dailyReportFilterAgent"'), "קיים סינון נציג בדוח מכירות");
assert(html.includes("נציג — הכל"), "ברירת מחדל נציג — הכל נשארה");
assert(app.includes('fillSelect(this.els.filterAgent, "נציג — הכל", agents, this.filterAgent)'), "placeholder הכל נשאר");
assert(app.includes("const canPickAgent = Auth.isAdmin() || Auth.isManager() || Auth.isTeamManager();"), "אדמין/מנהל/מנהל צוות רואים בחירת נציג");

const visibleFn = sliceBetween(app, "function dailyReportRowVisibleToSession(row){", "function dailyReportRowMatchesCurrentAgent");
assert(visibleFn.includes("if(Auth.isAdmin() || Auth.isManager()) return true"), "אדמין/מנהל רואים את כל שורות הדוח");
assert(visibleFn.includes("if(Auth.isTeamManager())"), "מנהל צוות עם היקף צוות");
assert(visibleFn.includes("dailyReportRowMatchesOwnershipProfile(row, getCurrentAgentOwnershipProfile())"), "מנהל צוות עדיין רואה גם את המכירות של עצמו בברירת מחדל");
assert(visibleFn.includes("getManagedAgentOwnershipProfiles()"), "מנהל צוות עדיין רואה נציגים משויכים");

assert(app.includes("getManagedAgentRecordsForTeamManager(managerId).forEach((a) => {"), "נציגי הצוות נשארים ברשימת הסינון");
assert(app.includes("function getManagedAgentRecordsForTeamManager(managerId){"), "getManagedAgentRecordsForTeamManager לא הוסר");

console.log("\n4) לוגיקת התחברות לא ננגעה");
assert(app.includes("function findAgentForLogin(username, agents = []){"), "findAgentForLogin נשאר");
assert(app.includes('if(!label) return { agent:null, error:"נא להזין שם משתמש" }'), "הודעת שם משתמש חסר נשארה");
assert(app.includes("pinOnlyLogin"), "pinOnlyLogin נשאר");
assert(app.includes("setAgentSecurity"), "setAgentSecurity נשאר");
const loginStart = app.indexOf("findAgentForLogin(username, agents = []){");
const loginFn = loginStart > 0 ? app.slice(loginStart, loginStart + 1800) : "";
assert(loginFn.includes("byUsername"), "התחברות לפי שם משתמש לא שונתה");
assert(loginFn.includes("byName"), "התחברות לפי שם תצוגה לא שונתה");
assert(app.indexOf("function findAgentForLogin") < app.indexOf("function buildTeamManagerDailyReportAgentFilterNames"), "helper הסינון מחוץ ל-findAgentForLogin");
const submitStart = app.indexOf("Auth._submit = async function(){");
const submitFn = submitStart > 0 ? app.slice(submitStart, submitStart + 2800) : "";
assert(!!submitFn, "Auth._submit נשאר");
assert(submitFn.includes("findAgentForLogin(username, agents)"), "כניסה עדיין דרך findAgentForLogin");
assert(!submitFn.includes("buildTeamManagerDailyReportAgentFilterNames"), "_submit לא קורא לסינון דוח");
assert(!submitFn.includes("filterDailyReportRowsBySelectedAgent"), "_submit לא קורא לסינון שורות דוח");
assert(submitFn.includes("if(!username) return this._setError('נא להזין שם משתמש')"), "ולידציית שם משתמש בכניסה לא שונתה");
assert(submitFn.includes("if(!pin) return this._setError('נא להזין קוד כניסה')"), "ולידציית PIN בכניסה לא שונתה");

console.log("\n5) לוגיקה טהורה — רשימת סינון כוללת את מנהל הצוות");
function safeTrim(v){ return String(v == null ? "" : v).trim(); }
function normalizeDailyReportAgentKey(value){
  return safeTrim(value).replace(/\s+/g, " ");
}
function collectDailyReportAgentFilterKeysFromPerson(rec){
  const keys = [];
  const n = normalizeDailyReportAgentKey(rec?.name);
  const u = normalizeDailyReportAgentKey(rec?.username);
  if(n) keys.push(n);
  if(u) keys.push(u);
  return keys;
}
function buildNames(reportAgentNames, managed, selfRec, selfVisibleRowNames){
  const allowed = new Set();
  managed.forEach((a) => collectDailyReportAgentFilterKeysFromPerson(a).forEach((k) => allowed.add(k)));
  collectDailyReportAgentFilterKeysFromPerson(selfRec).forEach((k) => allowed.add(k));
  const names = (reportAgentNames || []).filter((name) => allowed.has(normalizeDailyReportAgentKey(name)));
  const seen = new Set(names.map((n) => normalizeDailyReportAgentKey(n)));
  (selfVisibleRowNames || []).forEach((name) => {
    const key = normalizeDailyReportAgentKey(name);
    if(!key || seen.has(key)) return;
    names.push(key);
    seen.add(key);
  });
  const selfLabel = normalizeDailyReportAgentKey(selfRec?.name) || normalizeDailyReportAgentKey(selfRec?.username);
  if(selfLabel && !seen.has(selfLabel)) names.push(selfLabel);
  names.sort((a, b) => a.localeCompare(b, "he"));
  return names;
}

const managed = [{ name: "נועה כהן", username: "noa" }, { name: "יוסי לוי", username: "yossi" }];
const selfRec = { name: "דנה מנהלת", username: "dana-mgr" };
const reportNames = ["נועה כהן", "יוסי לוי", "דנה מנהלת", "נציג צוות אחר"];
const names = buildNames(reportNames, managed, selfRec, []);
assert(names.includes("דנה מנהלת"), "שם מנהלת הצוות מופיע בסינון");
assert(names.includes("נועה כהן") && names.includes("יוסי לוי"), "נציגי הצוות נשארים בסינון");
assert(!names.includes("נציג צוות אחר"), "נציג מחוץ לצוות לא נכנס לסינון");

const namesNoSales = buildNames(["נועה כהן"], managed, selfRec, []);
assert(namesNoSales.includes("דנה מנהלת"), "גם בלי מכירות בדוח — מנהלת הצוות יכולה לבחור את עצמה");
assert(namesNoSales.includes("נועה כהן"), "נציגת צוות עם מכירות נשארת");

const namesAlias = buildNames(["נועה כהן"], managed, selfRec, ["ד. מנהלת"]);
assert(namesAlias.includes("ד. מנהלת"), "כינוי מהדוח היומי של מנהלת הצוות נכנס לסינון");

function filterRows(rows, filterAgent, isSelf){
  const fKey = normalizeDailyReportAgentKey(filterAgent);
  if(isSelf) return rows.filter((row) => row.owner === "self");
  return rows.filter((row) => normalizeDailyReportAgentKey(row.agent) === fKey);
}
const rows = [
  { agent: "דנה מנהלת", owner: "self" },
  { agent: "ד. מנהלת", owner: "self" },
  { agent: "נועה כהן", owner: "team" },
  { agent: "יוסי לוי", owner: "team" }
];
const onlySelf = filterRows(rows, "דנה מנהלת", true);
assert(onlySelf.length === 2 && onlySelf.every((r) => r.owner === "self"), "בחירת עצמי מחזירה רק מכירות של מנהלת הצוות");
const onlyNoa = filterRows(rows, "נועה כהן", false);
assert(onlyNoa.length === 1 && onlyNoa[0].agent === "נועה כהן", "בחירת נציגת צוות מחזירה רק אותה");
assert(rows.length === 4, "ברירת מחדל הכל — כל השורות הנראות נשארות");

console.log("\n" + (failed ? "FAILED " + failed : "OK") + "  passed=" + passed);
process.exit(failed ? 1 : 0);
