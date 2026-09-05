/* GI-FEAT 2026-08-26 — דוח מכירות: פרמייה מהפקה, סניפים, לידים שויכו.
   הרצה: node _test-daily-sales-report-extras.js
   בודק תוספת תצוגה בלבד — בלי שינוי חישוב מכירות / אימות / לידים.
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260905-sim-center-all-v1";
const THEME_TAG = "20260830-policy-actions-align-v1";
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
assert(html.includes("gi-daily-sales-mail.js?v=20260903-sales-mail-v1"), "index.html mail script cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-daily-sales-mail.js")]).status === 0, "node --check gi-daily-sales-mail.js");
assert(mail.includes("function snapshotHasNewLayout"), "חסימת שליחת דוח ישן");
assert(mail.includes("מכירות מודיעין"), "בודק תווית מודיעין בסנאפשוט");
assert(mail.includes("לידים שויכו"), "בודק תווית לידים בסנאפשוט");
assert(mail.includes("פרמייה מהפקה"), "בודק תווית פרמייה מהפקה בסנאפשוט");
assert(mail.includes("נטען דוח ישן מהמטמון"), "הודעת Ctrl+F5 אם נטען דוח ישן");
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
assert(app.includes('label: "לידים שויכו"'), "KPI לידים שויכו");
assert(!app.includes('label: "נציגים שמכרו היום"'), "הוסר KPI נציגים שמכרו היום");
assert(!app.includes('label: "פוליסות בריאות + פרט"'), "הוסר KPI פוליסות בריאות + פרט");
assert(!app.includes(">נציגים שמכרו היום<"), "הוסר נציגים מהמייל/הדפסה");
assert(!app.includes(">פוליסות בריאות + פרט<"), "הוסר פוליסות מהמייל/הדפסה");
assert(app.includes("function salesAgentNameMatchesPersonName"), "התאמת שם קצר לשם מלא בסניפים");
assert(app.includes("dailySalesOfficeBranchPremium"), "סיכום סניף לפי בריאות+פרט");
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
assert(prep.includes("ensureDailySalesAssignedLeadsLoaded") || prep.includes("_waitDailySalesAssignedLeadsForMail"), "prepare של המייל ממתין ללידים");
assert(app.includes("_waitDailySalesAssignedLeadsForMail"), "המתנת מייל ללידים עם תקרת זמן");

const snapStart = app.indexOf("async buildDailySalesMailSnapshot(forDate){");
const snap = snapStart > 0 ? app.slice(snapStart, snapStart + 500) : "";
assert(snap.includes("_waitDailySalesAssignedLeadsForMail") || snap.includes("ensureDailySalesAssignedLeadsLoaded"), "בניית snapshot למייל ממתינה ללידים");

console.log("\n4) רגרסיה — לוגיקת ליבה לא ננגעה");
assert(app.includes("buildDailyAgentSalesReport"), "בניית דוח מכירות נשארה");
assert(app.includes("_seedDailySalesGroup"), "מיזוג overlay לא מוחק קבוצות מקומיות");
assert(app.includes("const names = new Set([...localHealthByAgent.keys(), ...serverByAgent.keys()])"), "מיזוג לפי נציג — מקומי ושרת");
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
  return (Number(row?.health) || 0) + (Number(row?.prat) || 0) + (Number(row?.other) || 0);
}
function dailySalesOfficeBranchTotals(rows, resolveBranch){
  const out = { haifa: { premium: 0, agents: 0 }, modiin: { premium: 0, agents: 0 } };
  const seen = { haifa: new Set(), modiin: new Set() };
  (Array.isArray(rows) ? rows : []).forEach((r) => {
    const branch = resolveBranch(r?.agentName);
    const bucket = branch === "חיפה" ? "haifa" : (branch === "מודיעין" ? "modiin" : "");
    if(!bucket) return;
    out[bucket].premium += dailySalesOfficeBranchPremium(r);
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
  { agentName: "דנה", health: 80.555, prat: 20, monthly: 100.555 },
  { agentName: "יוסי", health: 50, prat: 0, monthly: 50 },
  { agentName: "דנה", health: 20, prat: 0, monthly: 20 },
  { agentName: "ללא סניף", health: 999, prat: 0, monthly: 999 }
], (name) => branchMap[name] || "");
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
function agentLabelTokensSubset(allTokens, partTokens){
  return partTokens.length > 0 && partTokens.every((token) =>
    allTokens.some((candidate) => agentLabelTokenMatches(candidate, token))
  );
}
function salesAgentNameMatchesPersonName(salesName, personName){
  const salesKey = safeTrim(salesName).replace(/\s+/g, " ").toLowerCase();
  const personKey = safeTrim(personName).replace(/\s+/g, " ").toLowerCase();
  if(salesKey && personKey && salesKey === personKey) return true;
  const salesTokens = agentLabelTokens(salesName);
  const personTokens = agentLabelTokens(personName);
  if(!salesTokens.length || !personTokens.length) return false;
  return agentLabelTokensSubset(personTokens, salesTokens);
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
  { fullName: "יוסי בורג", agency: "חיפה" }
];
assert(salesAgentNameMatchesPersonName("ואדים", "ואדים שאולוב"), "ואדים מתאים לואדים שאולוב");
assert(salesAgentNameMatchesPersonName("Vadim", "ואדים שאולוב"), "Vadim מתאים לואדים שאולוב");
assert(lookupOfficeBranchFromDirectory("ואדים", contacts) === "חיפה", "ואדים משויך לחיפה מאנשי קשר");
assert(lookupOfficeBranchFromDirectory("Vadim", contacts) === "חיפה", "Vadim משויך לחיפה מאנשי קשר");
assert(lookupOfficeBranchFromDirectory("אביאל", contacts) === "", "אביאל דו-משמעי לא משויך אוטומטית");

const reportRows = [
  { agentName: "יוסי בורג", health: 384, prat: 171 },
  { agentName: "ואדים", health: 309, prat: 121 },
  { agentName: "מודיעין 1", health: 84, prat: 0 }
];
const resolved = {
  "יוסי בורג": "חיפה",
  "ואדים": lookupOfficeBranchFromDirectory("ואדים", contacts),
  "מודיעין 1": "מודיעין"
};
const office = dailySalesOfficeBranchTotals(reportRows, (name) => resolved[name] || "");
const healthPratTotal = reportRows.reduce((n, r) => n + dailySalesOfficeBranchPremium(r), 0);
assert(office.haifa.premium === 985, "חיפה כוללת את ואדים (555+430)");
assert(office.modiin.premium === 84, "מודיעין נשאר 84");
assert(Math.round((office.haifa.premium + office.modiin.premium) * 100) / 100 === healthPratTotal,
  "חיפה+מודיעין שווה לסה״כ בריאות+פרט");

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
assert(fn.includes("refreshSnapshotFromLiveSales"), "send-slot מרענן מכירות חיות");
assert(fn.includes("html: incoming.html || existing?.html || \"\""), "HTML מתעדכן גם כשיש PDF שמור");
assert(fn.includes("const keepPdf = shouldKeepExisting(existing, incoming.pdf_base64, force);"), "keep חל רק על PDF");
assert(!fn.includes("return json({ ok: false, error: NO_SNAPSHOT_ERROR }, 400);") || fn.includes("finishSkip(NO_SNAPSHOT_ERROR)"), "אין חזרה שקטה בלי לוג על חסר סנאפשוט");

const wf = read(".github/workflows/daily-sales-mail.yml");
assert(wf.includes('cron: "*/10 * * * *"'), "Actions סקר כל 10 דקות");
assert(wf.includes('cron: "30 9 * * *"'), "Actions 09:30 UTC");
assert(!wf.includes("window = 35"), "Actions בלי שער 35 דקות");
assert(wf.includes('cron: "0 12 * * *"'), "Actions 12:00 UTC");
assert(wf.includes('cron: "0 17 * * *"'), "Actions 17:00 UTC");
assert(wf.includes('cron: "30 10 * * *"'), "Actions חורף 10:30 UTC");
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
