/* GI-FLOOR 2026-09-19 — רשימת נציגים מחוברים בלבד, בלי fan-out לכל הנציגים.
   הרצה: node _test-agent-floor-activity.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260919-agent-floor-v5";
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

function sliceFunction(src, startToken){
  const start = src.indexOf(startToken);
  if(start < 0) return "";
  let i = src.indexOf("{", start);
  if(i < 0) return "";
  let depth = 0;
  for(; i < src.length; i++){
    const ch = src[i];
    if(ch === "{") depth += 1;
    else if(ch === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, i + 1);
    }
  }
  return "";
}

const app = read("app.js");
const wiz = read("gi-wizard.js");
const html = read("index.html");
const sw = read("service-worker.js");
const css = read("theme.css");
const sql = read("supabase-agent-floor-live.sql");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-agent-floor-activity.js")]).status === 0, "node --check this test");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache");
assert(html.includes("theme.css?v=" + TAG), "index.html theme.css cache");
assert(sw.includes("gi-v12-" + TAG), "service-worker cache");
assert(app.includes('BUILD = "' + TAG + '"'), "app.js BUILD");
assert(app.includes('GI_WIZARD_JS_VERSION = "' + TAG + '"'), "wizard js version");
assert(wiz.includes('GI_WIZARD_BUILD = "' + TAG + '"'), "gi-wizard build");

console.log("\n2) UI במסך מכירות + רשימה");
assert(html.includes('id="btnDailySalesAgentActivity"'), "לחצן פעילות נציג במכירות");
assert(html.includes('id="view-agentActivity"'), "מסך פעילות נציג");
assert(html.includes('id="agentFloorList"'), "רשימת נציגים מחוברים");
assert(html.includes('id="agentFloorSearch"'), "חיפוש נציג");
assert(!html.includes('data-floor-filter="all"'), "אין סינון «הכל» שפותח את כל המשתמשים");
assert(!html.includes('id="agentFloorGrid"'), "אין גריד קוביות");
assert(css.includes("giAgentFloor__row"), "עיצוב שורת נציג");
assert(css.includes("giAgentFloor__list"), "עיצוב רשימה");
assert(css.includes("giAgentFloor__listHead"), "כותרות עמודות ברשימה");
assert(css.includes("gap: 10px"), "רווח הפרדה בין שורות");
assert(!css.includes("giAgentFloor__card"), "אין כרטיסי קוביות");
assert(app.includes('if(safe === "agentActivity" && !DashboardUI.canSeeDailySalesReport'), "goView חסום למי שאינו אדמין/מנהל");
assert(app.includes("אין נציגים מחוברים עכשיו"), "ריק = אין מחוברים");

console.log("\n3) תחבורה ל־5000 מחוברים: REST upsert, בלי Presence משותף");
assert(app.includes('AGENT_FLOOR_LIVE_TABLE = "gi_agent_live"'), "טבלת gi_agent_live");
assert(sql.includes("create table if not exists public.gi_agent_live"), "SQL יוצר טבלה");
assert(sql.includes("alter publication supabase_realtime add table public.gi_agent_live"), "realtime למנהלים");
assert(app.includes('presenceTopic: "invest-chat-presence-room"'), "ערוץ צ׳אט לא שונה");
assert(!app.includes("invest-agent-floor-room"), "אין חדר Presence משותף לכל הנציגים");
assert(app.includes("AGENT_FLOOR_FLUSH_MS"), "debounce לכתיבה");
assert(app.includes("AGENT_FLOOR_HEARTBEAT_MS"), "heartbeat לשמירת online");
assert(app.includes("AGENT_FLOOR_PAGE_SIZE"), "עימוד שורות");
assert(app.includes("deactivate()"), "סגירת realtime ביציאה מהמסך");
assert(app.includes("AgentFloorActivityUI.deactivate"), "goView/logout סוגרים האזנה");
assert(app.includes("startLiveWatch"), "מנהל בלבד מאזין ל-gi_agent_live");
assert(app.includes("_lastFlushAt"), "heartbeat לא נכתב אם כבר נשמר לאחרונה");
assert(app.includes("pagehide"), "סגירת חלון מסמנת לא מחובר");
const presence = sliceBetween(app, "const AgentFloorPresence = {", "const AgentFloorActivityUI = {");
assert(presence.includes("upsertSingleRow"), "נציג כותב שורה משלו");
assert(!presence.includes("presenceChannel.track"), "נציג לא עושה Presence.track");
assert(!presence.includes(".channel(this.topic"), "נציג לא נרשם לחדר Presence");
assert(!presence.includes("client.channel"), "נציג לא מצטרף לחדר שידור");
const floorUi = sliceBetween(app, "const AgentFloorActivityUI = {", "const __chatOriginalGoView");
assert(floorUi.includes("if(!this.isActive() || !AgentFloorPresence.canWatch()) return"), "רק מנהל צופה נרשם ל-realtime");
assert(floorUi.includes("agentFloorConnectedFromPresence"), "הרשימה נבנית רק ממחוברים");
assert(!floorUi.includes("State.data?.agents"), "אין סריקת כל המשתמשים ללוח");
assert(floorUi.includes("row.expanded"), "מסלול ליד רק בשורה פתוחה");
assert(floorUi.includes("_rowHtml"), "רינדור שורה ולא כרטיס");
assert(app.includes('agentFloorVisualSig'), "דילוג על רינדור ב-heartbeat בלי שינוי");

console.log("\n4) פרסום מאשף / ליד / תיק / קובץ / תזכורת");
assert(wiz.includes("function publishAgentFloorFromWizard"), "helper באשף");
assert(wiz.includes('publishAgentFloorFromWizard(this, "saved_draft")'), "שמירת טיוטה מפרסמת");
assert(wiz.includes('publishAgentFloorFromWizard(this, "submitted_proposal"'), "הגשת הצעה מפרסמת");
assert(wiz.includes("sumHealthNewPolicyPremiums"), "סכום פרמיה באשף בריאות");
assert(wiz.includes("premiumBefore"), "פרמיה לפני הוספת פוליסה");
assert(wiz.includes("isCarInsuranceClickFlow"), "זיהוי רכב בקליק");
assert(app.includes("stampCampaignLeadOpened(lead)"), "חתימת נפתח");
assert(app.includes("proposalOpenedAt"), "שדה proposalOpenedAt");
assert(app.includes("publishViewingCustomer"), "תיק לקוח מפרסם שם");
assert(app.includes("publishDownloadingFile"), "הורדת קובץ מפרסמת");
assert(app.includes("publishCreatingReminder"), "תזכורת מפרסמת");
assert(app.includes("publishOpeningReminder"), "פתיחת תזכורת מפרסמת");
assert(app.includes('AgentFloorPresence.publishOpeningReminder()'), "openModal מפרסם לייב");
assert(app.includes("sticky: true"), "פתיחת תזכורת נשארת עד סגירה");
assert(app.includes("publishSurveyorState"), "מצב סוקרת");
assert(app.includes('action: typing ? "typing_lead" : "idle_surveyor"'), "סוקרת מקלידה או אין הקלדה");
assert(sql.includes("premium_now"), "עמודת פרמיה ב-SQL");
assert(sql.includes("extra_label"), "עמודת extra_label ב-SQL");

console.log("\n5) מונה לידים + מסלול + רק מחוברים + עימוד");
const helpers = [
  sliceFunction(app, "function agentFloorViewLabel(view)"),
  sliceFunction(app, "function agentFloorNpStageLabel(npStage)"),
  sliceFunction(app, "function agentFloorFlowLabel(flowType)"),
  sliceFunction(app, "function agentFloorActionLabel(action)"),
  sliceFunction(app, "function agentFloorMoney(n)"),
  sliceFunction(app, "function agentFloorPremiumLine(pres)"),
  sliceFunction(app, "function agentFloorIsSurveyor(pres)"),
  sliceFunction(app, "function campaignLeadBelongsToFloorAgent(lead, agentId, agentName)"),
  sliceFunction(app, "function countAgentFloorLeadsForDay(leads, agentId, agentName, dateKey)"),
  sliceFunction(app, "function buildAgentFloorLeadCountIndex(leads, dateKey)"),
  sliceFunction(app, "function agentFloorCountFromIndex(index, agentId, agentName)"),
  sliceFunction(app, "function buildAgentFloorLeadStatsIndex(leads, dateKey)"),
  sliceFunction(app, "function agentFloorStatsForPerson(stats, agentId, agentName)"),
  sliceFunction(app, "function agentFloorRowIsOnline(row, nowMs)"),
  sliceFunction(app, "function agentFloorVisibleSlice(rows, offset, pageSize)"),
  sliceFunction(app, "function agentFloorVisualSig(row)"),
  sliceFunction(app, "function agentFloorConnectedFromPresence(presenceMap, searchQ, nowMs)"),
  sliceFunction(app, "function buildAgentFloorLeadJourney(lead, presence)")
].join("\n");

const sandbox = {
  console,
  AGENT_FLOOR_ONLINE_MS: 180000,
  AGENT_FLOOR_PAGE_SIZE: 80,
  safeTrim(v){ return String(v == null ? "" : v).trim(); },
  goldLeadClock(iso){ return iso ? "10:00" : ""; },
  campaignLeadMatchesDateIL(lead, dateStr){
    const day = String(dateStr || "");
    if(!day) return true;
    return String(lead.createdAt || "").slice(0, 10) === day;
  },
  normalizeCampaignLeadAdditionalAgents(raw){
    return Array.isArray(raw) ? raw.map((a) => ({ id: String(a.id || ""), name: String(a.name || "") })) : [];
  }
};
vm.createContext(sandbox);
vm.runInContext(helpers, sandbox);

const leads = [
  { id: "l1", assignedAgentId: "a1", assignedAgentName: "דנה", createdAt: "2026-09-19T08:00:00.000Z", additionalAgents: [] },
  { id: "l2", assignedAgentId: "a2", assignedAgentName: "נועה", createdAt: "2026-09-19T09:00:00.000Z", additionalAgents: [{ id: "a1", name: "דנה" }] },
  { id: "l3", assignedAgentId: "a1", assignedAgentName: "דנה", createdAt: "2026-09-18T09:00:00.000Z", additionalAgents: [] }
];
assert(sandbox.countAgentFloorLeadsForDay(leads, "a1", "דנה", "2026-09-19") === 2, "מונה היום כולל additionalAgents");
const idx = sandbox.buildAgentFloorLeadCountIndex(leads, "2026-09-19");
assert(sandbox.agentFloorCountFromIndex(idx, "a1", "דנה") === 2, "אינדקס מונים O(לידים) ולא O(נציגים×לידים)");
assert(sandbox.agentFloorCountFromIndex(idx, "a2", "נועה") === 1, "אינדקס לנועה");

const now = Date.now();
const presenceMap = new Map();
for(let i = 0; i < 5000; i += 1){
  presenceMap.set("u" + i, {
    userId: "u" + i,
    name: "נציג " + i,
    agentId: "a" + i,
    online: i < 120,
    updatedAt: i < 120 ? now : now - 400000,
    view: "dashboard"
  });
}
const connected = sandbox.agentFloorConnectedFromPresence(presenceMap, "", now);
assert(connected.length === 120, "רק 120 מחוברים מתוך 5000 בשורות");
assert(connected.every((r) => r.online === true), "אין שורות למי שלא מחובר");
assert(sandbox.agentFloorConnectedFromPresence(presenceMap, "", now).length !== 5000, "לא מציגים את כל המשתמשים");
const page = sandbox.agentFloorVisibleSlice(connected, 0, 80);
assert(page.length === 80, "עמוד ראשון 80 מתוך המחוברים");
assert(sandbox.agentFloorRowIsOnline({ online: true, updatedAt: now }, now) === true, "שורה טרייה = מחובר");
assert(sandbox.agentFloorRowIsOnline({ online: true, updatedAt: now - 200000 }, now) === false, "שורה ישנה = לא מחובר");
assert(sandbox.agentFloorVisualSig({ userId: "u1", view: "dashboard", online: true, updatedAt: now }) === sandbox.agentFloorVisualSig({ userId: "u1", view: "dashboard", online: true, updatedAt: now + 1000 }), "heartbeat לא משנה חתימה ויזואלית");

const journeyOpen = sandbox.buildAgentFloorLeadJourney({
  id: "l1",
  assignedAgentId: "a1",
  openedAt: "2026-09-19T08:10:00.000Z",
  proposalOpenedAt: "2026-09-19T08:12:00.000Z"
}, { leadId: "l1", wizardOpen: true, stepLabel: "התאמת צרכים", action: "in_wizard" });
assert(journeyOpen.find((s) => s.key === "proposal").done, "מסלול: נפתחה הצעה");
assert(journeyOpen.find((s) => s.key === "step").done, "מסלול: שלב באשף לייב");

const journeySaved = sandbox.buildAgentFloorLeadJourney({
  id: "l1",
  proposalOpenedAt: "2026-09-19T08:12:00.000Z",
  proposalSavedAt: "2026-09-19T08:20:00.000Z"
}, { leadId: "l1", action: "saved_draft", stepLabel: "פרטי משלם" });
assert(journeySaved.find((s) => s.key === "saved").done, "שמירת טיוטה מסומנת");

const leadsReach = [
  { id: "r1", assignedAgentId: "a1", assignedAgentName: "דנה", createdByName: "סופי", createdAt: "2026-09-19T08:00:00.000Z", openedAt: "2026-09-19T08:10:00.000Z", additionalAgents: [] },
  { id: "r2", assignedAgentId: "a1", assignedAgentName: "דנה", createdByName: "סופי", createdAt: "2026-09-19T09:00:00.000Z", openedAt: "", additionalAgents: [] },
  { id: "r3", assignedAgentId: "a2", assignedAgentName: "נועה", createdByName: "סופי", createdAt: "2026-09-19T09:30:00.000Z", openedAt: "", additionalAgents: [] }
];
const stats = sandbox.buildAgentFloorLeadStatsIndex(leadsReach, "2026-09-19");
const dana = sandbox.agentFloorStatsForPerson(stats, "a1", "דנה");
assert(dana.received === 2, "נציג קיבל 2 לידים היום");
assert(dana.opened === 1, "נציג פתח באמת 1 מתוך שנשלחו");
const sofi = sandbox.agentFloorStatsForPerson(stats, "", "סופי");
assert(sofi.created === 3, "סוקרת יצרה 3 לידים היום");
assert(sandbox.agentFloorFlowLabel("car_click") === "אשף רכב בקליק", "תווית רכב בקליק");
assert(sandbox.agentFloorFlowLabel("elementary") === "אשף אלמנטרי", "תווית אלמנטרי");
assert(sandbox.agentFloorActionLabel("typing_lead") === "מקלידה ליד", "תווית הקלדת ליד");
assert(sandbox.agentFloorActionLabel("opening_reminder") === "פותח תזכורת", "תווית פותח תזכורת");
assert(sandbox.agentFloorPremiumLine({ premiumBefore: 200, premiumNow: 350 }).indexOf("לפני") >= 0, "פרמיה לפני ואחרי");
assert(sandbox.agentFloorIsSurveyor({ role: "referent" }) === true, "סוקרת לפי role");
assert(floorUi.includes("קיבל") && floorUi.includes("פתח"), "תצוגת קיבל/פתח בשורה");
assert(floorUi.includes("יצרה היום"), "תצוגת יצרה לסוקרת");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
