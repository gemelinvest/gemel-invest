/* GI-FLOOR 2026-09-19 — פעילות נציג לייב ממסך המכירות.
   הרצה: node _test-agent-floor-activity.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260919-agent-floor-v1";
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

console.log("\n2) UI במסך מכירות + מסך חדש");
assert(html.includes('id="btnDailySalesAgentActivity"'), "לחצן פעילות נציג במכירות");
assert(html.includes(">פעילות נציג<"), "תווית הלחצן");
assert(html.includes('id="view-agentActivity"'), "מסך פעילות נציג");
assert(html.includes('id="agentFloorGrid"'), "גריד כרטיסי נציגים");
assert(html.includes('id="btnAgentFloorBack"'), "חזרה למכירות");
assert(css.includes("giAgentFloor__card"), "עיצוב כרטיס נציג");
assert(app.includes('UI.goView("agentActivity")'), "לחיצה על הלחצן פותחת את המסך");
assert(app.includes('if(safe === "agentActivity" && !DashboardUI.canSeeDailySalesReport'), "goView חסום למי שאינו אדמין/מנהל");
assert(app.includes('agentActivity: "פעילות נציג"'), "כותרת המסך");
assert(app.includes("view-agentActivity-active"), "body class למסך");

console.log("\n3) Presence נפרד מצ׳אט + payload");
assert(app.includes('AGENT_FLOOR_PRESENCE_TOPIC = "invest-agent-floor-room"'), "ערוץ floor נפרד");
assert(app.includes('presenceTopic: "invest-chat-presence-room"'), "ערוץ צ׳אט לא שונה");
assert(app.includes("const AgentFloorPresence = {"), "מודול AgentFloorPresence");
assert(app.includes("const AgentFloorActivityUI = {"), "מודול UI");
assert(app.includes("wizardOpen"), "payload wizardOpen");
assert(app.includes("stepLabel"), "payload stepLabel");
assert(app.includes("leadId"), "payload leadId");
assert(app.includes('action: "saved_draft"') || app.includes('"saved_draft"'), "פעולת שמירה");
assert(app.includes('action: "paused"') || app.includes('"paused"'), "פעולת עצירה");
assert(app.includes("AgentFloorPresence.publishFromView"), "publish מ-goView");
assert(app.includes("AgentFloorPresence.onLogin"), "חיבור בלוגין");
assert(app.includes("AgentFloorPresence.onLogout"), "ניתוק בלוגאאוט");

console.log("\n4) פרסום מאשף / ליד");
assert(wiz.includes("function publishAgentFloorFromWizard"), "helper באשף");
assert(wiz.includes('publishAgentFloorFromWizard(this, "in_wizard")'), "פתיחה/רינדור מפרסמים שלב");
assert(wiz.includes('publishAgentFloorFromWizard(this, "saved_draft")'), "שמירת טיוטה מפרסמת");
assert(wiz.includes('publishAgentFloorFromWizard(this, this._finishing ? "idle" : "paused")'), "סגירה מפרסמת עצירה");
assert(wiz.includes("stampCampaignLeadProposalEvent?.(lead, \"opened\""), "פתיחת הצעה מליד חותמת");
assert(app.includes("stampCampaignLeadOpened(lead)"), "חתימת נפתח");
assert(app.includes("proposalOpenedAt"), "שדה proposalOpenedAt");
assert(app.includes("proposalSavedAt"), "שדה proposalSavedAt");
assert(app.includes("proposalPausedAt"), "שדה proposalPausedAt");
assert(app.includes("AgentFloorPresence.publishViewingLead"), "פתיחת ליד מפרסמת");

console.log("\n5) מונה לידים + מסלול — התנהגות");
const helpers = [
  sliceFunction(app, "function agentFloorViewLabel(view)"),
  sliceFunction(app, "function agentFloorNpStageLabel(npStage)"),
  sliceFunction(app, "function agentFloorFlowLabel(flowType)"),
  sliceFunction(app, "function agentFloorActionLabel(action)"),
  sliceFunction(app, "function campaignLeadBelongsToFloorAgent(lead, agentId, agentName)"),
  sliceFunction(app, "function countAgentFloorLeadsForDay(leads, agentId, agentName, dateKey)"),
  sliceFunction(app, "function buildAgentFloorLeadJourney(lead, presence)")
].join("\n");
assert(helpers.includes("function countAgentFloorLeadsForDay"), "נספרה countAgentFloorLeadsForDay");
assert(helpers.includes("function buildAgentFloorLeadJourney"), "נספרה buildAgentFloorLeadJourney");

const sandbox = {
  console,
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
const todayCount = sandbox.countAgentFloorLeadsForDay(leads, "a1", "דנה", "2026-09-19");
assert(todayCount === 2, "מונה היום כולל נציג ראשי + additionalAgents (קיבל " + todayCount + ")");
assert(sandbox.countAgentFloorLeadsForDay(leads, "a1", "דנה", "2026-09-18") === 1, "יום אחר לא נספר להיום");

const journeyNew = sandbox.buildAgentFloorLeadJourney({
  id: "l1",
  assignedAgentId: "a1",
  assignedAgentName: "דנה",
  createdAt: "2026-09-19T08:00:00.000Z"
}, {});
assert(journeyNew[0].done === true && journeyNew[0].key === "entered", "מסלול: ליד נכנס");
assert(journeyNew[1].done === true && journeyNew[1].key === "assigned", "מסלול: שויך");
assert(journeyNew[3].done === false, "בלי הצעה — שלב הצעה לא מסומן");

const journeyOpen = sandbox.buildAgentFloorLeadJourney({
  id: "l1",
  assignedAgentId: "a1",
  openedAt: "2026-09-19T08:10:00.000Z",
  proposalOpenedAt: "2026-09-19T08:12:00.000Z"
}, { leadId: "l1", wizardOpen: true, stepLabel: "התאמת צרכים", action: "in_wizard" });
assert(journeyOpen.find((s) => s.key === "opened").done, "מסלול: נפתח");
assert(journeyOpen.find((s) => s.key === "proposal").done, "מסלול: נפתחה הצעה");
assert(journeyOpen.find((s) => s.key === "step").done, "מסלול: שלב באשף לייב");
assert(String(journeyOpen.find((s) => s.key === "step").label).includes("התאמת צרכים"), "תווית השלב מה-presence");

const journeySaved = sandbox.buildAgentFloorLeadJourney({
  id: "l1",
  proposalOpenedAt: "2026-09-19T08:12:00.000Z",
  proposalSavedAt: "2026-09-19T08:20:00.000Z"
}, { leadId: "l1", action: "saved_draft", stepLabel: "פרטי משלם" });
assert(journeySaved.find((s) => s.key === "saved").done, "שמירת טיוטה מסומנת");

const journeyPaused = sandbox.buildAgentFloorLeadJourney({
  id: "l1",
  proposalOpenedAt: "2026-09-19T08:12:00.000Z",
  proposalPausedAt: "2026-09-19T08:22:00.000Z"
}, { leadId: "l1", action: "paused", wizardOpen: false, stepLabel: "הצהרת בריאות" });
assert(journeyPaused.find((s) => s.key === "paused").done, "עצירה באמצע מסומנת");
assert(sandbox.agentFloorFlowLabel("health") === "אשף בריאות וסיכונים", "תווית אשף בריאות");
assert(sandbox.agentFloorActionLabel("saved_draft") === "שמר הצעה", "תווית שמירה");
assert(sandbox.agentFloorActionLabel("paused") === "עצר באמצע", "תווית עצירה");

console.log("\n6) לייב בלי LiveRefresh איטי");
assert(app.includes("startLeadsRealtime"), "realtime ללידים במסך הפעילות");
assert(app.includes("postgres_changes"), "postgres_changes ללידים");
const floorUi = sliceBetween(app, "const AgentFloorActivityUI = {", "const __chatOriginalGoView");
assert(floorUi.includes("scheduleRender"), "רינדור מיידי מ-presence/ליד");
assert(!/LiveRefresh\.tick/.test(floorUi), "המסך לא תלוי בטיק LiveRefresh");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
