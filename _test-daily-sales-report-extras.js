/* GI-FEAT 2026-08-26 — דוח מכירות: פרמייה מהפקה, סניפים, לידים שויכו.
   הרצה: node _test-daily-sales-report-extras.js
   בודק תוספת תצוגה בלבד — בלי שינוי חישוב מכירות / אימות / לידים.
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260826-daily-sales-branch-v2";
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
const theme = read("theme.css");
const sw = read("service-worker.js");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("theme.css?v=" + APP_TAG), "index.html theme.css cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");

console.log("\n2) שיוך סניף בניהול משתמשים");
assert(html.includes('id="lcUserOfficeBranch"'), "שדה שיוך לסניף במודל משתמש");
assert(html.includes('<option value="חיפה">חיפה</option>'), "אפשרות חיפה");
assert(html.includes('<option value="מודיעין">מודיעין</option>'), "אפשרות מודיעין");
assert(app.includes("function normalizeOfficeBranchLabel"), "normalizeOfficeBranchLabel");
assert(app.includes("function getAgentOfficeBranch"), "getAgentOfficeBranch");
assert(app.includes("function setAgentOfficeBranch"), "setAgentOfficeBranch");
assert(app.includes("function mergeAgentBranchesMapsByRecency"), "מיזוג meta לפי עדכון אחרון");
assert(app.includes("function lookupOfficeBranchFromDirectory"), "נפילה חזרה לאנשי קשר");
assert(app.includes("suggestOfficeBranchForAgent"), "מילוי מוצע מכרטיס המשתמש");
assert(app.includes("E.officeBranch.value = user ? suggestOfficeBranchForAgent(user)"), "מילוי השדה בפתיחת המודל");
assert(app.includes("setAgentOfficeBranch(a.id, E.officeBranch.value)"), "שמירה בעריכת משתמש");
assert(app.includes("setAgentOfficeBranch(newId, E.officeBranch.value)"), "שמירה במשתמש חדש");
assert(app.includes("agentBranches: normalizeAgentBranchesMap"), "persist ב-meta payload");

console.log("\n3) דוח מכירות — תצוגה");
assert(app.includes('label: "פרמייה מהפקה"'), "KPI פרמייה מהפקה במסך");
assert(app.includes(">פרמייה מהפקה<"), "תווית פרמייה מהפקה במייל/הדפסה");
assert(!app.includes("פרמיה שנתית · אלמנטרי"), "הוסרה פרמיה שנתית אלמנטרי מה-KPI");
assert(app.includes('label: "מכירות מודיעין"'), "KPI מכירות מודיעין");
assert(app.includes('label: "מכירות חיפה"'), "KPI מכירות חיפה");
assert(app.includes('label: "לידים שויכו"'), "KPI לידים שויכו");
assert(!app.includes("מוצגים רק נציגים עם מכירה ביום הנבחר"), "הוסר טקסט ההסבר בתחתית הדוח");
assert(app.includes("dailySalesIssuedPremiumTotal"), "קריאה לנתון הפקה קיים");
assert(app.includes("DailyReportStore.getIssuedPremiumMetrics"), "מקור הפרמייה מהפקה הוא הדשבורד");
assert(app.includes("dailySalesAssignedLeadsCount"), "ספירת לידים שויכו לפי יום הדוח");
assert(app.includes("campaignLeadMatchesDateIL"), "סינון לידים לפי אותו יום כמו מערכת הלידים");
assert(app.includes("dailySalesOfficeBranchTotals"), "סיכום סניפים משורות הדוח הקיימות");
assert(theme.includes("giDailySalesPage__kpiRow--extra"), "CSS לשורת KPI נוספת");
assert(app.includes("ensureDailySalesAssignedLeadsLoaded"), "טעינת לידים ל-KPI אם מערכת הלידים לא נפתחה");
assert(app.includes("_kickDailySalesAssignedLeadsLoad"), "רינדור הדוח מפעיל טעינה חד-פעמית");
assert(app.includes("_paintDailySalesAssignedLeadsKpis"), "צביעת KPI אחרי שהלידים נטענו");
assert(app.includes("try { this._kickDailySalesAssignedLeadsLoad(); } catch(_e) {}"), "renderDailySalesPage קורא לטעינה");
assert(app.includes("ensureDailySalesAssignedLeadsLoaded({ force: true })"), "רענון דוח מרענן גם לידים");

const ensStart = app.indexOf("ensureDailySalesAssignedLeadsLoaded(options = {}){");
const ens = ensStart > 0 ? app.slice(ensStart, ensStart + 1400) : "";
assert(ens.includes("hydrateFromCacheIfEmpty"), "hydrate מהמטמון לפני fetch");
assert(ens.includes("store.fetchAll()"), "קורא ל-fetchAll הקיים — בלי מימוש חדש");
assert(!ens.includes("assignedAgentId ="), "ensure לא משנה שיוך ליד");

const kickStart = app.indexOf("_kickDailySalesAssignedLeadsLoad(){");
const kick = kickStart > 0 ? app.slice(kickStart, kickStart + 400) : "";
assert(kick.includes("if(this._dailySalesLeadsKickStarted) return"), "לא טוען מחדש בכל רינדור");

const prepStart = app.indexOf("async prepareDailySalesMailSnapshot(){");
const prep = prepStart > 0 ? app.slice(prepStart, prepStart + 700) : "";
assert(prep.includes("ensureDailySalesAssignedLeadsLoaded"), "prepare של המייל ממתין ללידים");

const snapStart = app.indexOf("async buildDailySalesMailSnapshot(forDate){");
const snap = snapStart > 0 ? app.slice(snapStart, snapStart + 500) : "";
assert(snap.includes("ensureDailySalesAssignedLeadsLoaded"), "בניית snapshot למייל ממתינה ללידים");

console.log("\n4) רגרסיה — לוגיקת ליבה לא ננגעה");
assert(app.includes("buildDailyAgentSalesReport"), "בניית דוח מכירות נשארה");
assert(app.includes("dailySalesBranchTotals(report)"), "סיכום ענפים (בריאות/אלמנטרי) נשאר");
assert(app.includes('else if(sector === "אלמנטרי") buckets.elementary += prem'), "חישוב אלמנטרי בטבלה נשאר");
assert(app.includes("אלמנטרי (שנתי)"), "עמודת אלמנטרי בטבלת הנציגים נשארה");
assert(app.includes("function getDailyReportIssuedPremiumValue"), "חישוב פרמיית הפקה בדוח היומי לא שונה");
assert(app.includes("function campaignLeadMatchesDateIL"), "סינון לידים לפי יום לא שונה");
assert(app.includes("_persistAgentAndVerify"), "שמירת נציג לשרת נשארה");
assert(app.includes("pinOnlyLogin"), "לוגיקת PIN בלבד נשארה");
assert(app.includes("setAgentSecurity"), "לוגיקת 2FA נשארה");
assert(app.includes("function campaignLeadAgentAccess"), "שיוך לידים לנציג לא שונה");
assert(app.includes("async fetchAll(options = {}){"), "CampaignLeadsStore.fetchAll נשאר");
assert(app.includes("async __fetchAllImpl(scope){"), "מימוש fetchAll לא הוחלף");
const fetchStart = app.indexOf("async fetchAll(options = {}){");
const fetchFn = fetchStart > 0 ? app.slice(fetchStart, fetchStart + 500) : "";
assert(fetchFn.includes("this.resolveFetchScope(options)"), "fetchAll עדיין ב-resolveFetchScope");
assert(fetchFn.includes("this._fetchAllImpl(scope)"), "fetchAll עדיין קורא ל-_fetchAllImpl");

const issuedFnStart = app.indexOf("getIssuedPremiumMetrics(){");
const issuedFn = issuedFnStart > 0 ? app.slice(issuedFnStart, issuedFnStart + 900) : "";
assert(issuedFn.includes("getDailyReportIssuedPremiumValue"), "getIssuedPremiumMetrics עדיין קורא לערך הפקה");
assert(issuedFn.includes("isDailyReportIssuedStatus") || app.includes("getIssuedRows()"), "סינון סטטוס הופק נשאר");

console.log("\n5) לוגיקה טהורה — סניף / מיזוג / סיכום");
function safeTrim(v){ return String(v == null ? "" : v).trim(); }
function normalizeOfficeBranchLabel(value){
  const raw = safeTrim(value).toLowerCase().replace(/[\s_-]+/g, "");
  if(!raw) return "";
  if(raw === "חיפה" || raw === "haifa") return "חיפה";
  if(raw === "מודיעין" || raw === "modiin" || raw === "modi'in" || raw === "מודיעיןמכביםרעות") return "מודיעין";
  return "";
}
function normalizeAgentBranchesMap(raw){
  const out = {};
  if(raw && typeof raw === "object"){
    Object.keys(raw).forEach((k) => {
      const id = safeTrim(k);
      const branch = normalizeOfficeBranchLabel(raw[k]);
      if(id && branch) out[id] = branch;
    });
  }
  return out;
}
assert(normalizeOfficeBranchLabel("haifa") === "חיפה", "haifa → חיפה");
assert(normalizeOfficeBranchLabel("  מודיעין ") === "מודיעין", "מודיעין מנורמל");
assert(normalizeOfficeBranchLabel("תל אביב") === "", "סניף לא מוכר נדחה");
assert(normalizeAgentBranchesMap({ a1: "חיפה", a2: "", a3: "מודעין" }).a1 === "חיפה", "מפה שומרת חיפה");
assert(!normalizeAgentBranchesMap({ a2: "" }).a2, "שיוך ריק לא נשמר");

function dailySalesOfficeBranchTotals(rows, resolveBranch){
  const out = { haifa: { premium: 0, agents: 0 }, modiin: { premium: 0, agents: 0 } };
  const seen = { haifa: new Set(), modiin: new Set() };
  (Array.isArray(rows) ? rows : []).forEach((r) => {
    const branch = resolveBranch(r?.agentName);
    const bucket = branch === "חיפה" ? "haifa" : (branch === "מודיעין" ? "modiin" : "");
    if(!bucket) return;
    out[bucket].premium += Number(r?.monthly) || 0;
    const name = safeTrim(r?.agentName);
    if(name && !seen[bucket].has(name)){
      seen[bucket].add(name);
      out[bucket].agents += 1;
    }
  });
  out.haifa.premium = Math.round(out.haifa.premium * 100) / 100;
  out.modiin.premium = Math.round(out.modiin.premium * 100) / 100;
  return out;
}
const branchMap = { "דנה": "מודיעין", "יוסי": "חיפה" };
const totals = dailySalesOfficeBranchTotals([
  { agentName: "דנה", monthly: 100.555 },
  { agentName: "יוסי", monthly: 50 },
  { agentName: "דנה", monthly: 20 },
  { agentName: "ללא סניף", monthly: 999 }
], (name) => branchMap[name] || "");
assert(totals.modiin.premium === 120.56, "סיכום מודיעין מעוגל משורות קיימות");
assert(totals.haifa.premium === 50, "סיכום חיפה");
assert(totals.modiin.agents === 1, "נציגה אחת במודיעין גם אם שתי שורות");
assert(totals.haifa.agents === 1, "נציג אחד בחיפה");

function countAssignedLeads(list){
  return (list || []).filter((l) => {
    const id = safeTrim(l?.assignedAgentId);
    const name = safeTrim(l?.assignedAgentName);
    if(id) return true;
    return !!(name && name !== "—" && name !== "לא שויך");
  }).length;
}
assert(countAssignedLeads([
  { assignedAgentId: "a1", assignedAgentName: "דנה" },
  { assignedAgentId: "", assignedAgentName: "לא שויך" },
  { assignedAgentId: "", assignedAgentName: "" },
  { assignedAgentId: "", assignedAgentName: "יוסי" }
]) === 2, "נספרים רק לידים ששויכו");

console.log("\n" + (failed ? "FAILED " + failed : "OK") + "  passed=" + passed + " failed=" + failed);
process.exit(failed ? 1 : 0);
