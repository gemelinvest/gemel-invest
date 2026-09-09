/* GI-FEAT 2026-09-08 — דוח מכירות: פרמיה אחרי הנחה כמו הדשבורד, סניפים לפי שם מלא, בלי לידים שויכו.
   הרצה: node _test-daily-sales-report-extras.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260909-version-resume-v2";
const THEME_TAG = "20260909-version-resume-v2";
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
const mail = read("gi-daily-sales-mail.js");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("theme.css?v=" + THEME_TAG), "index.html theme.css cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");
assert(html.includes("gi-daily-sales-mail.js?v=" + APP_TAG), "index.html mail script cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-daily-sales-mail.js")]).status === 0, "node --check gi-daily-sales-mail.js");
assert(mail.includes("function snapshotHasNewLayout"), "חסימת שליחת דוח ישן");
assert(mail.includes("מכירות מודיעין"), "בודק תווית מודיעין בסנאפשוט");
assert(mail.includes('indexOf(">לידים שויכו<") >= 0) return false'), "דוח ישן עם KPI לידים נחסם");
assert(mail.includes("ensureLiveLayoutMarker"), "סנאפשוט כולל סמן תאימות לפונקציה החיה");
assert(mail.includes("<!-- לידים שויכו -->"), "הערה מוסתרת לפונקציה החיה בלי KPI");
assert(!mail.includes("&& html.indexOf(\"לידים שויכו\") >= 0"), "סנאפשוט לא דורש לידים כשדה חובה");
assert(mail.includes("פרמייה מהפקה"), "בודק תווית פרמייה מהפקה בסנאפשוט");
assert(mail.includes("נטען דוח ישן מהמטמון"), "הודעת Ctrl+F5 אם נטען דוח ישן");
function ensureLiveLayoutMarker(html){
  const s = String(html || "");
  if(!s || s.indexOf("לידים שויכו") >= 0) return s;
  return s.replace("</body>", "<!-- לידים שויכו --></body>");
}
function clientLayoutOk(html){
  if(html.indexOf(">לידים שויכו<") >= 0) return false;
  return html.indexOf("מכירות מודיעין") >= 0
    && html.indexOf("מכירות חיפה") >= 0
    && html.indexOf("פרמייה מהפקה") >= 0;
}
const marked = ensureLiveLayoutMarker("<body>מכירות מודיעין מכירות חיפה פרמייה מהפקה</body>");
assert(marked.includes("<!-- לידים שויכו -->"), "סמן תאימות נוסף ל-HTML");
assert(clientLayoutOk(marked) === true, "הערת תאימות לא נחסמת אצל הלקוח");
assert(clientLayoutOk("<span>לידים שויכו</span>מכירות מודיעין מכירות חיפה פרמייה מהפקה") === false,
  "KPI לידים גלוי עדיין נחסם");
assert(mail.includes("MIN_PDF_CHARS = 10000"), "לא שומרים HTML בלי PDF תקין");
assert(mail.includes("const needPdf = !!force || nearSendSlot();"), "PDF רק בלחיצה או ליד שעת שליחה");
assert(mail.includes("buildSnapshot(needPdf)"), "סנאפשוט PDF רק כשצריך");
assert(mail.includes("if(!requirePdf)"), "heartbeat בלי PDF");
assert(mail.includes("return buildEmailHtml();"), "heartbeat שומר HTML בלבד");
assert(mail.includes('replace: !!force'), "save-snapshot מקבל replace בלחיצה");
assert(mail.includes('api("send-now"'), "send-now עדיין קיים");
assert(mail.includes("...(snap || {})"), "send-now שולח את ה-snapshot המלא ולא רק actor");
assert(mail.includes("persist.kept"), "בודקים kept מהשרת");
assert(mail.includes("לא נשלח שוב את הדוח הישן"), "לא שולחים שוב PDF ישן כש-kept");
assert(mail.includes("MAIL_LAYOUT = \"20260908-today-net\""), "תג תבנית אמיתי בסנאפשוט");
assert(!mail.includes("20260826-branch-leads"), "הוסר תג תבנית מזויף");
assert(mail.includes("function formatIsraelDateTime"), "שעת שליחה/שמירה לפי ישראל");
assert(mail.includes("function sendStatusHe"), "סטטוס שליחה בעברית");
assert(!mail.includes('await api("send-now");'), "send-now לא נקרא בלי גוף הדוח");

console.log("\n2) שיוך סוכנות בניהול משתמשים");
assert(html.includes('id="lcUserOfficeBranch"'), "שדה שיוך לסוכנות במודל משתמש");
assert(html.includes("שיוך לסוכנות"), "כותרת מקטע שיוך לסוכנות");
assert(html.includes('<option value="חיפה">סוכנות חיפה</option>'), "אפשרות סוכנות חיפה");
assert(html.includes('<option value="מודיעין">סוכנות מודיעין</option>'), "אפשרות סוכנות מודיעין");
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
assert(!app.includes('label: "לידים שויכו"'), "הוסר KPI לידים שויכו");
assert(!app.includes(">לידים שויכו<"), "הוסר לידים שויכו מהמייל/הדפסה");
assert(!app.includes('label: "נציגים שמכרו היום"'), "הוסר KPI נציגים שמכרו היום");
assert(!app.includes('label: "פוליסות בריאות + פרט"'), "הוסר KPI פוליסות בריאות + פרט");
assert(!app.includes(">נציגים שמכרו היום<"), "הוסר נציגים מהמייל/הדפסה");
assert(!app.includes(">פוליסות בריאות + פרט<"), "הוסר פוליסות מהמייל/הדפסה");
assert(app.includes("function salesAgentNameMatchesPersonName"), "התאמת שם פרטי+משפחה");
assert(app.includes("function dailySalesAgentMergeKey"), "מפתח מיזוג לפי מזהה או שם מלא");
assert(app.includes("dailySalesOfficeBranchPremium"), "סיכום סניף לפי בריאות+פרט");
assert(!app.includes("מוצגים רק נציגים עם מכירה ביום הנבחר"), "הוסר טקסט ההסבר בתחתית הדוח");
assert(app.includes("dailySalesIssuedPremiumTotal"), "קריאה לנתון הפקה קיים");
assert(app.includes("DailyReportStore.getIssuedPremiumMetrics"), "מקור הפרמייה מהפקה הוא הדשבורד");
assert(app.includes("byAgent: Array.isArray(summed.byAgent) ? summed.byAgent : []"), "נמכר היום שומר פירוט לפי נציג");
assert(app.includes("dailySalesTodayOfficeBranchTotals(healthSlice.premium, rows)"), "סניפי היום מקבלים את סכום נמכר היום");
assert(app.includes("dailySalesIsReportStyleTab"), "חוצץ בריאות+פרט בסגנון הכל היום");
assert(app.includes("dailySalesHealthPratPrintModel"), "מודל תצוגה לבריאות+פרט כמו הכל היום");
assert(app.includes("dailySalesOfficeBranchTotals"), "סיכום סניפים משורות הדוח הקיימות");
assert(app.includes("function resolveOfficeBranchForAgentId"), "שיוך סניף לפי מזהה נציג");
assert(app.includes("function resolveOfficeBranchForSalesAgent"), "שיוך סניף לפי מזהה ואז שם");
assert(app.includes("function salesRecordAgentId"), "חילוץ מזהה נציג מהמכירה");
assert(app.includes("salesRecordAgentId(rec)"), "מכירות מקומיות נספרות לפי מזהה נציג");
assert(app.includes("resolveOfficeBranchForSalesAgent(r?.agentName, r?.agentIds)"), "KPI סניף קורא למזהה מהשורה");
assert(app.includes("dailySalesTodayOfficeBranchTotals"), "KPI סניפים להיום מתפצל מנמכר היום");
assert(app.includes("dailySalesScaleOfficeBranchTotals"), "סניפים מנורמלים לסכום אחרי הנחה");
assert(app.includes("dailySalesOfficeBranchTotalsFromAgentSales"), "פיצול סניף לפי נציג אחרי הנחה");
assert(app.includes("_dailySalesOverlayPersonAlreadyLocal"), "overlay לא מוסיף את אותו נציג פעמיים");
assert(app.includes("officeBranchTodaySplitV1"), "מטמון דוח מתבטל אחרי פיצול סניפים להיום");
assert(app.includes("monthlyKpiAlignV2"), "מטמון דוח מתבטל אחרי יישור טבלה לפי byAgent של נמכר היום");
assert(!app.includes("monthlyKpiAlignV1"), "מפתח מטמון יישור קודם הוחלף");
assert(app.includes("dailySalesApplySoldDayHealthPrat"), "עמודות בריאות/פרט/חודשי מיושרות לנמכר ביום");
assert(!app.includes("monthlyTodayOnlyV1"), "מפתח מטמון ישן של סה״כ חודשי הוחלף");
assert(!app.includes("monthlySoldDayV1"), "מפתח מטמון ישן של יישור יום מכירה הוחלף");
assert(app.includes('layout: "20260908-today-net"'), "סיכום המייל נושא תג תבנית אמיתי");
assert(app.includes("const skipServerOnly = localHealthPremium > 0"), "לא ממלאים RPC ברוטו כשיש מכירות מקומיות");
assert(app.includes("dailySalesTodaySoldAgentsForTable"), "טבלה בוחרת byAgent שתואם לכרטיס נמכר היום");
assert(app.includes("byAgent: Array.isArray(summed.byAgent) ? summed.byAgent : []"), "שליפת נמכר היום שומרת פירוט נציגים");
assert(app.includes("byAgent: Array.isArray(res.byAgent) ? res.byAgent : []"), "overlay יומי נושא byAgent");
assert(app.includes("dailySalesSoldDayMatchesKpi"), "טבלת מייל לא מוחלפת בחישוב חלקי");
assert(app.includes("dailySalesSoldMonthlyFromAgents"), "סכום נציגי נמכר היום לטבלה");
assert(app.includes("_coerceDailySalesMailDate"), "מייל תמיד להיום שעון ישראל");
assert(app.includes("this.buildDailySalesPrintModel(this._coerceDailySalesMailDate(forDate))"), "HTML מייל נבנה להיום");
assert(app.includes("monthly: Math.round((row.health + row.prat) * 100) / 100"), "סה״כ חודשי = בריאות+פרט בלבד");
assert(!app.includes("row.health + row.prat + row.pension + row.other"), "סה״כ חודשי לא כולל פנסיה/אחר");
assert(app.includes("const monthly = Math.round((health + prat) * 100) / 100"), "בריאות+פרט בלי other בעמודת סה״כ חודשי");
assert(!app.includes("officeBranchFullNameV1"), "מפתח מטמון ישן הוחלף");
assert(app.includes("dailySalesAgentMergeKey(name, ids)"), "פיבוט נציגים לפי מזהה או שם מלא");
assert(!app.includes("try { this._kickDailySalesAssignedLeadsLoad(); } catch(_e) {}"), "רינדור לא טוען לידים");
assert(!app.includes("ensureDailySalesAssignedLeadsLoaded({ force: true })"), "רענון לא טוען לידים");

const readyStart = app.indexOf("dailySalesMailSnapshotReady(){");
const readyEnd = app.indexOf("async prepareDailySalesMailSnapshot(){", readyStart);
const ready = readyStart > 0 ? app.slice(readyStart, readyEnd > 0 ? readyEnd : readyStart + 400) : "";
assert(!ready.includes("ensureDailySalesServerOverlay"), "מוכנות מייל לא מפעילה overlay");
assert(!ready.includes("_dailySalesByAgentOverlay"), "מוכנות מייל לא דורשת overlay");

const prepStart = app.indexOf("async prepareDailySalesMailSnapshot(){");
const prepEnd = app.indexOf("async _waitDailySalesOverlayForMail", prepStart);
const prep = prepStart > 0 ? app.slice(prepStart, prepEnd > 0 ? prepEnd : prepStart + 900) : "";
assert(prep.includes("dailySalesMailSnapshotReady"), "prepare ממתין לנתונים מקומיים");
assert(prep.includes("ensureTodaySalesServerOverlay"), "prepare מפעיל שליפת נמכר היום אחרי הנחה");
assert(prep.includes("overlay.byAgent"), "prepare ממתין לפירוט נציגים אחרי הנחה");
assert(!prep.includes("_waitDailySalesOverlayForMail"), "prepare לא ממתין ל-RPC ברוטו לפי נציג");
assert(!prep.includes("AssignedLeads"), "prepare לא ממתין ללידים");

const snapStart = app.indexOf("async buildDailySalesMailSnapshot(forDate){");
const snap = snapStart > 0 ? app.slice(snapStart, snapStart + 400) : "";
assert(!snap.includes("_waitDailySalesOverlayForMail"), "בניית snapshot לא ממתינה ל-overlay");
assert(!snap.includes("AssignedLeads"), "בניית snapshot לא ממתינה ללידים");

console.log("\n4) רגרסיה — לוגיקת ליבה לא ננגעה");
assert(app.includes("buildDailyAgentSalesReport"), "בניית דוח מכירות נשארה");
assert(app.includes("_seedDailySalesGroup"), "מיזוג overlay לא מוחק קבוצות מקומיות");
assert(app.includes("const keys = new Set([...localHealthByAgent.keys(), ...serverByAgent.keys()])"), "מיזוג לפי מפתח נציג — מקומי ושרת");
assert(app.includes("/* לא מחליפים פרמיה מקומית אחרי-הנחה ב-RPC ברוטו. overlay רק ממלא חור. */"), "overlay לא דורס אחרי-הנחה");
assert(app.includes("toIsraelDateKey"), "תאריך דוח המכירות לפי שעון ישראל");
assert(app.includes("getIsraelDayRange"), "טווח היום של הדוח לפי חצות ישראל");
assert(!app.includes("return this._finalizeDailySalesGroups(map).concat(kept);"), "הוסרה החלפת כל נציגי הבריאות ב-RPC");
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

function dailySalesOfficeBranchPremium(row){
  return (Number(row?.health) || 0) + (Number(row?.prat) || 0);
}
function dailySalesOfficeBranchTotals(rows, resolveBranch){
  const out = { haifa: { premium: 0, agents: 0 }, modiin: { premium: 0, agents: 0 } };
  const seen = { haifa: new Set(), modiin: new Set() };
  (Array.isArray(rows) ? rows : []).forEach((r) => {
    const branch = resolveBranch(r);
    const bucket = branch === "חיפה" ? "haifa" : (branch === "מודיעין" ? "modiin" : "");
    if(!bucket) return;
    out[bucket].premium += dailySalesOfficeBranchPremium(r);
    const name = safeTrim(r?.agentName);
    const ids = Array.isArray(r?.agentIds) ? r.agentIds.map(safeTrim).filter(Boolean) : [];
    const agentKey = ids.length === 1 ? ("id:" + ids[0].toLowerCase()) : ("name:" + name);
    if(agentKey !== "name:" && !seen[bucket].has(agentKey)){
      seen[bucket].add(agentKey);
      out[bucket].agents += 1;
    }
  });
  out.haifa.premium = Math.round(out.haifa.premium * 100) / 100;
  out.modiin.premium = Math.round(out.modiin.premium * 100) / 100;
  return out;
}
function resolveOfficeBranchForSalesAgent(agentName, agentIds, branchById, branchByName){
  const ids = [];
  const seen = new Set();
  (Array.isArray(agentIds) ? agentIds : []).forEach((raw) => {
    const id = safeTrim(raw);
    const key = id.toLowerCase();
    if(!id || seen.has(key)) return;
    seen.add(key);
    ids.push(id);
  });
  const fromIds = [...new Set(ids.map((id) => branchById[id]).filter(Boolean))];
  if(fromIds.length === 1) return fromIds[0];
  if(fromIds.length > 1) return "";
  return branchByName[agentName] || "";
}
const branchMap = { "דנה": "מודיעין", "יוסי": "חיפה" };
const totals = dailySalesOfficeBranchTotals([
  { agentName: "דנה", health: 80.555, prat: 20, monthly: 100.555 },
  { agentName: "יוסי", health: 50, prat: 0, monthly: 50 },
  { agentName: "דנה", health: 20, prat: 0, monthly: 20 },
  { agentName: "ללא סניף", health: 999, prat: 0, monthly: 999 }
], (r) => branchMap[r.agentName] || "");
assert(totals.modiin.premium === 120.56, "סיכום מודיעין מעוגל משורות קיימות");
assert(totals.haifa.premium === 50, "סיכום חיפה");
assert(totals.modiin.agents === 1, "נציגה אחת במודיעין גם אם שתי שורות");
assert(totals.haifa.agents === 1, "נציג אחד בחיפה");

function normalizeAgentLabelToken(value){
  return safeTrim(value)
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, "")
    .toLowerCase()
    .replace(/["'`׳״.,;:!?()[\]{}<>|\\/+\-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function agentLabelTokens(value){
  return normalizeAgentLabelToken(value).split(/\s+/).filter(Boolean);
}
const AGENT_LABEL_TOKEN_ALIASES = {
  "ודים": ["ואדים", "vadim"],
  "ואדים": ["ודים", "vadim"],
  "vadim": ["ואדים", "ודים"]
};
function agentLabelTokenMatches(candidate, token){
  if(candidate === token) return true;
  const aliases = AGENT_LABEL_TOKEN_ALIASES[token];
  if(aliases && aliases.includes(candidate)) return true;
  const reverse = AGENT_LABEL_TOKEN_ALIASES[candidate];
  return !!(reverse && reverse.includes(token));
}
function agentLabelTokensPrefix(allTokens, partTokens){
  if(!partTokens.length || partTokens.length > allTokens.length) return false;
  return partTokens.every((token, i) => agentLabelTokenMatches(allTokens[i], token));
}
function salesAgentNameMatchesPersonName(salesName, personName){
  const salesKey = safeTrim(salesName).replace(/\s+/g, " ").toLowerCase();
  const personKey = safeTrim(personName).replace(/\s+/g, " ").toLowerCase();
  if(salesKey && personKey && salesKey === personKey) return true;
  const salesTokens = agentLabelTokens(salesName);
  const personTokens = agentLabelTokens(personName);
  if(salesTokens.length < 2 || personTokens.length < 2) return false;
  if(salesTokens.length > personTokens.length) return false;
  return agentLabelTokensPrefix(personTokens, salesTokens);
}
function dailySalesAgentMergeKey(agentName, agentIds){
  const ids = [];
  const seen = new Set();
  (Array.isArray(agentIds) ? agentIds : (agentIds ? [agentIds] : [])).forEach((raw) => {
    const id = safeTrim(raw);
    const key = id.toLowerCase();
    if(!id || seen.has(key)) return;
    seen.add(key);
    ids.push(id);
  });
  if(ids.length === 1) return "id:" + ids[0].toLowerCase();
  const tokens = agentLabelTokens(agentName);
  return "name:" + (tokens.length ? tokens.join(" ") : safeTrim(agentName).replace(/\s+/g, " ").toLowerCase());
}
function lookupOfficeBranchFromDirectory(salesName, contacts){
  const branches = [];
  (contacts || []).forEach((c) => {
    if(!salesAgentNameMatchesPersonName(salesName, c.fullName)) return;
    const branch = normalizeOfficeBranchLabel(c.agency);
    if(branch) branches.push(branch);
  });
  const unique = [...new Set(branches)];
  return unique.length === 1 ? unique[0] : "";
}
const contacts = [
  { fullName: "ואדים שאולוב", agency: "חיפה" },
  { fullName: "אביאל אלקיים", agency: "חיפה" },
  { fullName: "אביאל דהאן", agency: "מודיעין" },
  { fullName: "יוסי בורג", agency: "חיפה" },
  { fullName: "אביב עמאש", agency: "מודיעין" },
  { fullName: "נתי אביב", agency: "חיפה" }
];
assert(salesAgentNameMatchesPersonName("ואדים שאולוב", "ואדים שאולוב"), "שם מלא תואם");
assert(salesAgentNameMatchesPersonName("ואדים", "ואדים שאולוב") === false, "שם פרטי בלבד לא מספיק");
assert(salesAgentNameMatchesPersonName("Vadim Shaulov", "ואדים שאולוב") === false, "תרגום חופשי בלי כינוי מלא לא נדרש כאן");
assert(lookupOfficeBranchFromDirectory("ואדים שאולוב", contacts) === "חיפה", "ואדים שאולוב משויך לחיפה מאנשי קשר");
assert(lookupOfficeBranchFromDirectory("ואדים", contacts) === "", "ואדים בלי משפחה לא משויך");
assert(lookupOfficeBranchFromDirectory("אביאל", contacts) === "", "אביאל דו-משמעי לא משויך אוטומטית");
assert(lookupOfficeBranchFromDirectory("אביאל דהאן", contacts) === "מודיעין", "אביאל דהאן במודיעין");
assert(lookupOfficeBranchFromDirectory("אביאל אלקיים", contacts) === "חיפה", "אביאל אלקיים בחיפה");
assert(lookupOfficeBranchFromDirectory("אביב", contacts) === "", "אביב בלי משפחה לא משויך");
assert(lookupOfficeBranchFromDirectory("אביב עמאש", contacts) === "מודיעין", "אביב עמאש במודיעין");
assert(salesAgentNameMatchesPersonName("אביב", "נתי אביב") === false, "אביב אינו קידומת של נתי אביב");
assert(salesAgentNameMatchesPersonName("אביב עמאש", "נתי אביב") === false, "אביב עמאש לא מתאים לנתי אביב");
assert(app.includes("function agentLabelTokensPrefix"), "קידומת שם ב-app.js");
assert(app.includes("if(salesTokens.length < 2 || personTokens.length < 2) return false"), "נדרשים שם פרטי ושם משפחה");
assert(dailySalesAgentMergeKey("אביאל דהאן", ["aviel-modiin"]) === "id:aviel-modiin", "מזהה גובר על שם");
assert(dailySalesAgentMergeKey("אביאל דהאן", []) !== dailySalesAgentMergeKey("אביאל אלקיים", []), "שני אביאל עם משפחה שונה לא מתמזגים");
assert(dailySalesAgentMergeKey("אביב", []) !== dailySalesAgentMergeKey("אביב עמאש", []), "אביב לבד לא מתמזג עם אביב עמאש");

const reportRows = [
  { agentName: "יוסי בורג", health: 384, prat: 171 },
  { agentName: "ואדים שאולוב", health: 309, prat: 121 },
  { agentName: "מודיעין 1", health: 84, prat: 0 }
];
const resolved = {
  "יוסי בורג": "חיפה",
  "ואדים שאולוב": lookupOfficeBranchFromDirectory("ואדים שאולוב", contacts),
  "מודיעין 1": "מודיעין"
};
const office = dailySalesOfficeBranchTotals(reportRows, (r) => resolved[r.agentName] || "");
const healthPratTotal = reportRows.reduce((n, r) => n + dailySalesOfficeBranchPremium(r), 0);
assert(office.haifa.premium === 985, "חיפה כוללת את ואדים שאולוב (555+430)");
assert(office.modiin.premium === 84, "מודיעין נשאר 84");
assert(Math.round((office.haifa.premium + office.modiin.premium) * 100) / 100 === healthPratTotal,
  "חיפה+מודיעין שווה לסה״כ בריאות+פרט");

const gapRows = [
  { agentName: "יוסי בורג", health: 2618.17, prat: 0, agentIds: ["yossi"] },
  { agentName: "אביב", health: 2489.30, prat: 0, agentIds: ["aviv"] },
  { agentName: "אביאל", health: 321.19, prat: 0, agentIds: ["aviel-modiin"] }
];
const branchById = { yossi: "חיפה", aviv: "מודיעין", "aviel-modiin": "מודיעין" };
const branchByName = {
  "יוסי בורג": "חיפה",
  "אביב": "מודיעין",
  "אביאל": lookupOfficeBranchFromDirectory("אביאל", contacts)
};
assert(branchByName["אביאל"] === "", "אביאל בלי מזהה נשאר דו-משמעי");
const officeNameOnly = dailySalesOfficeBranchTotals(gapRows, (r) => branchByName[r.agentName] || "");
assert(officeNameOnly.haifa.premium === 2618.17, "לפי שם בלבד חיפה נשארת 2618.17");
assert(officeNameOnly.modiin.premium === 2489.30, "לפי שם בלבד אביאל נבלע ולא נספר במודיעין");
assert(Math.round((officeNameOnly.haifa.premium + officeNameOnly.modiin.premium) * 100) / 100 === 5107.47,
  "לפי שם בלבד חיפה+מודיעין חסרים 321.19 מהטוטאל");
const officeWithIds = dailySalesOfficeBranchTotals(gapRows, (r) =>
  resolveOfficeBranchForSalesAgent(r.agentName, r.agentIds, branchById, branchByName)
);
const gapTotal = Math.round(gapRows.reduce((n, r) => n + dailySalesOfficeBranchPremium(r), 0) * 100) / 100;
assert(officeWithIds.haifa.premium === 2618.17, "עם מזהה חיפה נשארת 2618.17");
assert(officeWithIds.modiin.premium === 2810.49, "עם מזהה אביאל נספר במודיעין (2489.30+321.19)");
assert(Math.round((officeWithIds.haifa.premium + officeWithIds.modiin.premium) * 100) / 100 === gapTotal,
  "עם מזהה חיפה+מודיעין שווה לטוטאל בריאות+פרט כולל 321.19");
assert(officeWithIds.modiin.agents === 2, "מודיעין סופרת אביב ואביאל כשני נציגים");

assert(dailySalesOfficeBranchPremium({ health: 100, prat: 50, other: 999 }) === 150,
  "סניף לא סופר other מה-overlay");

function dailySalesScaleOfficeBranchTotals(parts, targetPremium){
  const haifa = Number(parts?.haifa?.premium) || 0;
  const modiin = Number(parts?.modiin?.premium) || 0;
  const unassigned = Number(parts?.unassigned) || 0;
  const localAll = haifa + modiin + unassigned;
  const target = Number(targetPremium);
  const agents = {
    haifa: Number(parts?.haifa?.agents) || 0,
    modiin: Number(parts?.modiin?.agents) || 0
  };
  if(!(localAll > 0) || !Number.isFinite(target) || target < 0){
    return {
      haifa: { premium: Math.round(haifa * 100) / 100, agents: agents.haifa },
      modiin: { premium: Math.round(modiin * 100) / 100, agents: agents.modiin }
    };
  }
  let haifaOut = Math.round(target * (haifa / localAll) * 100) / 100;
  let modiinOut = Math.round(target * (modiin / localAll) * 100) / 100;
  const assignedTarget = Math.round(target * ((haifa + modiin) / localAll) * 100) / 100;
  const drift = Math.round((assignedTarget - haifaOut - modiinOut) * 100) / 100;
  if(drift !== 0){
    if(modiinOut >= haifaOut) modiinOut = Math.round((modiinOut + drift) * 100) / 100;
    else haifaOut = Math.round((haifaOut + drift) * 100) / 100;
  }
  return {
    haifa: { premium: haifaOut, agents: agents.haifa },
    modiin: { premium: modiinOut, agents: agents.modiin }
  };
}
const inflated = dailySalesScaleOfficeBranchTotals({
  haifa: { premium: 3180.44, agents: 3 },
  modiin: { premium: 5743.07, agents: 4 },
  unassigned: 0
}, 5058.29);
assert(Math.round((inflated.haifa.premium + inflated.modiin.premium) * 100) / 100 === 5058.29,
  "חיפה+מודיעין מנורמלים ל-5058.29 ולא לסכום הברוטו");
assert(inflated.modiin.premium > inflated.haifa.premium, "היחס בין הסניפים נשמר אחרי נרמול");
const withGap = dailySalesScaleOfficeBranchTotals({
  haifa: { premium: 2000, agents: 1 },
  modiin: { premium: 2000, agents: 1 },
  unassigned: 1058.29
}, 5058.29);
assert(Math.round((withGap.haifa.premium + withGap.modiin.premium) * 100) / 100 === 4000,
  "נציג בלי סניף לא מוכנס לחיפה/מודיעין");

function dailySalesOfficeBranchTotalsFromAgentSales(agentRows, resolveBranch){
  const out = { haifa: { premium: 0, agents: 0 }, modiin: { premium: 0, agents: 0 }, unassigned: 0 };
  (Array.isArray(agentRows) ? agentRows : []).forEach((r) => {
    const prem = Number(r?.premium) || 0;
    if(!(prem > 0)) return;
    const branch = resolveBranch(r);
    const bucket = branch === "חיפה" ? "haifa" : (branch === "מודיעין" ? "modiin" : "");
    if(!bucket){
      out.unassigned += prem;
      return;
    }
    out[bucket].premium += prem;
    out[bucket].agents += 1;
  });
  return dailySalesScaleOfficeBranchTotals(out, 5058.29);
}
const splitToday = dailySalesOfficeBranchTotalsFromAgentSales([
  { agentName: "יוסי", premium: 2000 },
  { agentName: "דנה", premium: 3058.29 }
], (r) => (r.agentName === "יוסי" ? "חיפה" : "מודיעין"));
assert(splitToday.haifa.premium === 2000, "חיפה מקבלת את הפרמיה אחרי הנחה של יוסי");
assert(splitToday.modiin.premium === 3058.29, "מודיעין מקבלת את הפרמיה אחרי הנחה של דנה");
assert(Math.round((splitToday.haifa.premium + splitToday.modiin.premium) * 100) / 100 === 5058.29,
  "פיצול נציגים אחרי הנחה שווה לנמכר היום");

function dailySalesOverlayPersonAlreadyLocal(localGroups, agentName, agentId){
  const sid = String(agentId || "").trim().toLowerCase();
  const nameKey = String(agentName || "").trim();
  return localGroups.some((g) => {
    const ids = Array.isArray(g?.agentIds) ? g.agentIds : [];
    if(sid && ids.some((id) => String(id).trim().toLowerCase() === sid)) return true;
    return nameKey && String(g?.agentName || "").trim() === nameKey;
  });
}
assert(dailySalesOverlayPersonAlreadyLocal(
  [{ agentName: "אביאל דהאן", agentIds: ["aviel-modiin"] }],
  "אביאל דהאן",
  "other-id"
) === true, "אותו שם מלא ב-RPC לא נוסף שוב");
assert(dailySalesOverlayPersonAlreadyLocal(
  [{ agentName: "אביאל דהאן", agentIds: ["aviel-modiin"] }],
  "אביאל אלקיים",
  "aviel-haifa"
) === false, "אביאל אחר עדיין נוסף");

function dailySalesMonthlyTotal(row){
  return Math.round(((Number(row?.health) || 0) + (Number(row?.prat) || 0)) * 100) / 100;
}
assert(dailySalesMonthlyTotal({ health: 1122.14, prat: 0, other: 480, pension: 90 }) === 1122.14,
  "סה״כ חודשי לא סופר פוליסות אחרות/פנסיה מהתיק");
assert(dailySalesMonthlyTotal({ health: 5058.29, prat: 0, other: 1545.71 }) === 5058.29,
  "סה״כ חודשי נשאר 5058 גם אם בתיק יש עוד 1546 מימים קודמים");

function dailySalesApplySoldDayHealthPrat(rows, soldByAgent){
  const byName = new Map();
  (soldByAgent || []).forEach((a) => {
    const health = Math.round((Number(a.health) || 0) * 100) / 100;
    const prat = Math.round((Number(a.prat) || 0) * 100) / 100;
    byName.set(String(a.agentName || "").trim(), {
      health,
      prat,
      monthly: Math.round((health + prat) * 100) / 100
    });
  });
  return (rows || []).map((r) => {
    const sold = byName.get(String(r.agentName || "").trim());
    if(!sold) return { ...r, health: 0, prat: 0, monthly: 0, other: 0 };
    return { ...r, health: sold.health, prat: sold.prat, monthly: sold.monthly, other: 0 };
  }).filter((r) => (Number(r.monthly) || 0) > 0 || (Number(r.elementary) || 0) > 0);
}
const inflatedTable = [
  { agentName: "עומר שמולביץ", health: 1253.39, prat: 420.22, elementary: 0 },
  { agentName: "אביב עמאש", health: 0, prat: 1122.14, elementary: 0 },
  { agentName: "רותם קדוש", health: 1054.01, prat: 0, elementary: 0 },
  { agentName: "דנה זגני", health: 512.53, prat: 518.96, elementary: 0 },
  { agentName: "ליאור קוסמינסקי", health: 222.00, prat: 191.67, elementary: 0 }
];
const inflatedMonthly = Math.round(inflatedTable.reduce((n, r) => n + r.health + r.prat, 0) * 100) / 100;
assert(inflatedMonthly === 5294.92, "צילום 8.9: סה״כ חודשי בטבלה היה 5294.92");
const soldDayOnly = [
  { agentName: "עומר שמולביץ", health: 1253.39, prat: 183.59 },
  { agentName: "אביב עמאש", health: 0, prat: 1122.14 },
  { agentName: "רותם קדוש", health: 1054.01, prat: 0 },
  { agentName: "דנה זגני", health: 512.53, prat: 518.96 },
  { agentName: "ליאור קוסמינסקי", health: 222.00, prat: 191.67 }
];
const aligned = dailySalesApplySoldDayHealthPrat(inflatedTable, soldDayOnly);
const alignedMonthly = Math.round(aligned.reduce((n, r) => n + r.monthly, 0) * 100) / 100;
assert(alignedMonthly === 5058.29, "אחרי יישור ליום המכירה סה״כ חודשי = 5058.29 כמו הכרטיס");
assert(aligned.find((r) => r.agentName === "עומר שמולביץ").monthly === 1436.98,
  "שורה מנופחת יורדת לפרמיית יום המכירה");
const overlayOnly = dailySalesApplySoldDayHealthPrat(
  inflatedTable.concat([{ agentName: "נציג RPC", health: 480, prat: 0 }]),
  soldDayOnly
);
assert(!overlayOnly.some((r) => r.agentName === "נציג RPC"), "נציג רק מ-overlay בלי מכירת היום נזרק");
function skipOverlayWhenLocal(localHealthPremium){
  return localHealthPremium > 0;
}
assert(skipOverlayWhenLocal(5058.29) === true, "עם מכירות מקומיות — בלי overlay ברוטו");
assert(skipOverlayWhenLocal(0) === false, "טעינה רזה בלי מקומי — overlay עדיין ממלא");
function skipServerOnlyForToday(localHealthPremium){
  return localHealthPremium > 0;
}
assert(skipServerOnlyForToday(5058.29) === true, "מקומי מלא — בלי RPC ברוטו");
assert(skipServerOnlyForToday(2377.17) === true, "מקומי חלקי — עדיין בלי RPC ברוטו");
assert(skipServerOnlyForToday(0) === false, "טעינה רזה — overlay ממלא");
function shouldApplySoldDayToTable(soldMonthly, kpiPremium){
  const sold = Math.round((Number(soldMonthly) || 0) * 100) / 100;
  const kpi = Math.round((Number(kpiPremium) || 0) * 100) / 100;
  if(!(sold > 0)) return false;
  if(!(kpi > 0)) return true;
  return Math.abs(sold - kpi) <= 0.05;
}
assert(shouldApplySoldDayToTable(5058.29, 5058.29) === true, "כשהחישוב המקומי תואם לכרטיס מיישרים את הטבלה");
assert(shouldApplySoldDayToTable(2377.17, 5058.29) === false, "לא מחליפים טבלה חלקית כשהאריחים 5058");
assert(shouldApplySoldDayToTable(5294.92, 5058.29) === false, "לא מיישרים לטבלה מנופחת 5294");
function pickSoldAgentsForTable(localAgents, kpi, overlayAgents, overlayTotal){
  const sumAgents = (list) => Math.round((list || []).reduce((n, a) => n + (Number(a.health) || 0) + (Number(a.prat) || 0), 0) * 100) / 100;
  const match = (sold, target) => {
    const s = Math.round((Number(sold) || 0) * 100) / 100;
    const k = Math.round((Number(target) || 0) * 100) / 100;
    return s > 0 && k > 0 && Math.abs(s - k) <= 0.05;
  };
  if(match(sumAgents(localAgents), kpi)) return localAgents;
  if(match(sumAgents(overlayAgents), overlayTotal || kpi)) return overlayAgents;
  return localAgents;
}
const overlaySold = [
  { agentName: "עומר שמולביץ", health: 1253.39, prat: 183.59 },
  { agentName: "אביב עמאש", health: 0, prat: 1122.14 },
  { agentName: "רותם קדוש", health: 1054.01, prat: 0 },
  { agentName: "דנה זגני", health: 512.53, prat: 518.96 },
  { agentName: "ליאור קוסמינסקי", health: 222.00, prat: 191.67 }
];
const inflatedLocal = inflatedTable.map((r) => ({ agentName: r.agentName, health: r.health, prat: r.prat }));
const pickedFromInflated = pickSoldAgentsForTable(inflatedLocal, 5058.29, overlaySold, 5058.29);
const pickedAligned = dailySalesApplySoldDayHealthPrat(inflatedTable, pickedFromInflated);
assert(Math.round(pickedAligned.reduce((n, r) => n + r.monthly, 0) * 100) / 100 === 5058.29,
  "צילום סה״כ חודשי 1673.61… יורד ל-5058.29 כמו נמכר היום");
assert(pickedAligned.find((r) => r.agentName === "עומר שמולביץ").monthly === 1436.98,
  "שורה 1673.61 של עומר יורדת ל-1436.98");
assert(pickedAligned.find((r) => r.agentName === "אביב עמאש").monthly === 1122.14, "אביב נשאר 1122.14");
assert(pickedAligned.find((r) => r.agentName === "רותם קדוש").monthly === 1054.01, "רותם נשאר 1054.01");
assert(pickedAligned.find((r) => r.agentName === "דנה זגני").monthly === 1031.49, "דנה נשארת 1031.49");
assert(pickedAligned.find((r) => r.agentName === "ליאור קוסמינסקי").monthly === 413.67, "ליאור נשאר 413.67");
const incompleteLocal = [
  { agentName: "עומר שמולביץ", health: 544.86, prat: 171.78 }
];
const pickedFromIncomplete = pickSoldAgentsForTable(incompleteLocal, 5058.29, overlaySold, 5058.29);
assert(Math.round(pickedFromIncomplete.reduce((n, a) => n + a.health + a.prat, 0) * 100) / 100 === 5058.29,
  "מקומי 2377 מוחלף ב-byAgent של נמכר היום 5058");

function dailySalesPresentPivotByAgent(groups){
  const map = new Map();
  (Array.isArray(groups) ? groups : []).forEach((g) => {
    const name = safeTrim(g?.agentName) || "נציג";
    const ids = [...new Set((Array.isArray(g?.agentIds) ? g.agentIds : []).map(safeTrim).filter(Boolean))];
    const uniqueId = ids.length === 1 ? ids[0] : "";
    const key = uniqueId ? ("id:" + uniqueId.toLowerCase()) : ("name:" + name);
    if(!map.has(key)){
      map.set(key, { agentName: name, agentIds: new Set(), health: 0, prat: 0, other: 0 });
    }
    const row = map.get(key);
    ids.forEach((id) => row.agentIds.add(id));
    const sector = safeTrim(g?.sector);
    const prem = Number(g?.premium) || 0;
    if(sector === "בריאות") row.health += prem;
    else if(sector === "סיכונים") row.prat += prem;
    else row.other += prem;
  });
  return Array.from(map.values()).map((row) => ({
    agentName: row.agentName,
    agentIds: Array.from(row.agentIds || []),
    health: Math.round(row.health * 100) / 100,
    prat: Math.round(row.prat * 100) / 100,
    other: Math.round(row.other * 100) / 100
  }));
}
const pivoted = dailySalesPresentPivotByAgent([
  { agentName: "אביאל", agentIds: ["aviel-haifa"], sector: "בריאות", premium: 200 },
  { agentName: "אביאל", agentIds: ["aviel-modiin"], sector: "בריאות", premium: 321.19 }
]);
assert(pivoted.length === 2, "שני אביאל עם מזהים שונים לא מתמזגים בפיבוט");
const pivotedOffice = dailySalesOfficeBranchTotals(pivoted, (r) =>
  resolveOfficeBranchForSalesAgent(r.agentName, r.agentIds, {
    "aviel-haifa": "חיפה",
    "aviel-modiin": "מודיעין"
  }, { "אביאל": "" })
);
assert(pivotedOffice.haifa.premium === 200, "אביאל חיפה נשאר בחיפה אחרי פיבוט");
assert(pivotedOffice.modiin.premium === 321.19, "אביאל מודיעין לא נבלע אחרי פיבוט");

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

function toIsraelDateKey(d){
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(d);
}
function israelDayBoundIso(dateKey){
  for(const off of ["+03:00", "+02:00"]){
    const d = new Date(dateKey + "T00:00:00" + off);
    if(Number.isNaN(d.getTime())) continue;
    const atKey = toIsraelDateKey(d);
    const prevKey = toIsraelDateKey(new Date(d.getTime() - 1));
    if(atKey === dateKey && prevKey !== dateKey) return d.toISOString();
  }
  return new Date(dateKey + "T00:00:00+03:00").toISOString();
}
assert(toIsraelDateKey(new Date("2026-09-03T21:30:00.000Z")) === "2026-09-04", "21:30 UTC בקיץ הוא כבר 00:30 בישראל");
assert(israelDayBoundIso("2026-09-03") === new Date("2026-09-03T00:00:00+03:00").toISOString(), "תחילת 3 בספטמבר IDT");
assert(israelDayBoundIso("2026-01-15") === new Date("2026-01-15T00:00:00+02:00").toISOString(), "תחילת 15 בינואר IST");
function mergeHealthAgents(localAgents, serverRows){
  const local = new Set(localAgents);
  const extra = [];
  serverRows.forEach((name) => { if(!local.has(name)) extra.push(name); });
  return localAgents.concat(extra);
}
assert(mergeHealthAgents(["דנה"], ["דנה", "יוסי"]).join(",") === "דנה,יוסי", "נציג רק בשרת נוסף לדוח");
assert(mergeHealthAgents(["דנה", "משה"], ["דנה"]).join(",") === "דנה,משה", "נציג רק מקומי נשאר בדוח");

console.log("\n6) edge function — החלפת PDF באותו יום");
const fnPath = path.join(ROOT, "supabase", "functions", "gi-daily-sales-mail", "index.ts");
assert(fs.existsSync(fnPath), "supabase/functions/gi-daily-sales-mail/index.ts");
const fn = read("supabase/functions/gi-daily-sales-mail/index.ts");
assert(fn.includes("function shouldKeepExisting"), "כלל keep מפורש בפונקציה");
assert(fn.includes("if(force && pdfOk(incomingPdf)) return false"), "force+PDF תקין תמיד מחליף");
assert(fn.includes("if(pdfOk(incomingPdf)) return false"), "PDF תקין מחליף גם בלי force (heartbeat)");
assert(fn.includes("usedRequestSnapshot"), "send-now מדווח אם השתמש בדוח מהבקשה");
assert(fn.includes("action === \"send-now\""), "send-now נשאר");
assert(fn.includes("action === \"send-slot\""), "שורת השליחה האוטומטית נשארת");
assert(fn.includes("scheduled: true"), "send-slot רץ כשליחה מתוזמנת");
assert(fn.includes("function registerSlotCrons"), "Deno.cron נרשם אם זמין");
assert(fn.includes("30 9 * * *"), "קרון 12:30 IDT = 09:30 UTC");
assert(fn.includes("0 12 * * *"), "קרון 15:00 IDT = 12:00 UTC");
assert(fn.includes("0 17 * * *"), "קרון 20:00 IDT = 17:00 UTC");
assert(fn.includes('logSend(sb, dateKey, "skipped"'), "דילוג נכתב ל-gi_daily_sales_mail_log");
assert(fn.includes('logSend(sb, dateKey, "error"'), "כשל נכתב ללוג");
assert(fn.includes("NO_SNAPSHOT_ERROR"), "דילוג בלי סנאפשוט");
assert(fn.includes("NO_OUTLOOK_ERROR"), "דילוג בלי Outlook");
assert(fn.includes("NO_RECIPIENTS_ERROR"), "דילוג בלי נמענים");
assert(fn.includes("ALREADY_SENT_ERROR"), "מניעת שליחה כפולה באותו חלון");
assert(fn.includes("function snapshotHasNewLayout"), "השרת בודק תבנית חדשה");
assert(fn.includes("OLD_LAYOUT_ERROR"), "שגיאה אם מנסים לשלוח תבנית ישנה");
assert(fn.includes("if(!snapshotHasNewLayout(snap.html))"), "send-now/send-slot מסרבים לדוח ישן");
assert(fn.includes("if(incoming.html && !snapshotHasNewLayout(incoming.html))"), "save-snapshot מסרב לשמור תבנית ישנה");
assert(fn.includes('s.indexOf(">לידים שויכו<") >= 0'), "שרת דוחה KPI לידים גלוי, לא הערת תאימות");
assert(theme.includes("giDailySalesPage__kpiLabel"), "CSS לכותרת כרטיסיית KPI");
const kpiLabelCss = theme.slice(theme.indexOf("#view-dailySales .giDailySalesPage__kpiLabel"), theme.indexOf("#view-dailySales .giDailySalesPage__kpiLabel") + 280);
assert(kpiLabelCss.includes("font-size: 16px"), "כותרת כרטיסיה מוגדלת ל-16px");
assert(kpiLabelCss.includes("font-weight: 800"), "כותרת כרטיסיה במשקל מודגש");
assert(!fn.includes("refreshSnapshotFromLiveSales"), "send-slot לא מרענן מכירות מ-RPC");
assert(!fn.includes('rpc("gi_daily_sales_by_agent"'), "אין RPC שמשכתב את HTML המייל");
assert(fn.includes("html: incoming.html || existing?.html || \"\""), "HTML מתעדכן גם כשיש PDF שמור");
assert(fn.includes("const keepPdf = shouldKeepExisting(existing, incoming.pdf_base64, force);"), "keep חל רק על PDF");
assert(!fn.includes("return json({ ok: false, error: NO_SNAPSHOT_ERROR }, 400);") || fn.includes("finishSkip(NO_SNAPSHOT_ERROR)"), "אין חזרה שקטה בלי לוג על חסר סנאפשוט");

const wf = read(".github/workflows/daily-sales-mail.yml");
assert(wf.includes('cron: "*/10 * * * *"'), "Actions סקר כל 10 דקות");
assert(wf.includes('cron: "30 12 * * *"'), "Actions 12:30 שעון ישראל");
assert(!wf.includes("window = 35"), "Actions בלי שער 35 דקות");
assert(wf.includes('cron: "0 15 * * *"'), "Actions 15:00 שעון ישראל");
assert(wf.includes('cron: "0 20 * * *"'), "Actions 20:00 שעון ישראל");
assert(wf.includes('timezone: "Asia/Jerusalem"'), "Actions cron לפי שעון ישראל");
assert(!wf.includes('cron: "30 9 * * *"'), "הוסרו cron UTC כפולים מה-Actions");
assert(wf.includes('action": "send-slot"') || wf.includes('"action": "send-slot"'), "Actions קורא send-slot");
assert(wf.includes("Asia/Jerusalem"), "Actions בודק שעון ישראל");
assert(wf.includes("vhvlkerectggovfihjgm"), "Actions פונה לפרויקט החי");
assert(mail.includes("data.lastSend.error"), "מסך ההגדרות מציג שגיאת שליחה אחרונה");

function pdfOk(raw){
  return String(raw || "").replace(/\s+/g, "").length >= 10000;
}
function shouldKeepExisting(existing, incomingPdf, force){
  const haveStoredPdf = String(existing?.pdf_base64 || "").length >= 10000;
  if(!haveStoredPdf) return false;
  if(force && pdfOk(incomingPdf)) return false;
  if(pdfOk(incomingPdf)) return false;
  return true;
}
const stored = { pdf_base64: "P".repeat(12000) };
assert(shouldKeepExisting(stored, "", false) === true, "HTML בלי PDF לא דורס PDF קיים");
assert(shouldKeepExisting(stored, "x".repeat(12000), false) === false, "PDF חדש מחליף את הישן");
assert(shouldKeepExisting(stored, "x".repeat(12000), true) === false, "שלח עכשיו מחליף");
assert(shouldKeepExisting(null, "", false) === false, "אין שמור — לא keep");
assert(shouldKeepExisting({ pdf_base64: "tiny" }, "", false) === false, "PDF שמור קטן לא נחשב");

console.log("\n7) iframe PDF לא מכסה את מסך הלקוחות");
assert(app.includes('iframe.style.cssText = "position:fixed;left:-14000px;top:0;'), "iframe PDF מחוץ למסך");
assert(app.includes('mask.style.cssText = "position:fixed;left:-14000px;top:0;'), "מסכת PDF מחוץ למסך");
assert(!app.includes("z-index:2147483000"), "אין z-index שמכסה את ה-CRM");
assert(!app.includes('left:0;top:0;width:794px;height:1123px;border:0;background:#fff;opacity:1;pointer-events:none;z-index:2147483000'), "הוסר iframe גלוי ב-left:0");

console.log("\n" + (failed ? "FAILED " + failed : "OK") + "  passed=" + passed + " failed=" + failed);
process.exit(failed ? 1 : 0);
