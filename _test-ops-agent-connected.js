/* GI-OPS 2026-08-27 — מעקב נציגים בשיחה:
   נציג שמחובר למערכת מוצג כ«מחובר», ועם מונה זמן זמינות כשאינו בשיחה.
   בשיחה נשאר שם לקוח + מונה שיחה. בלי שינוי persist/שיוך/שיחה.
   הרצה: node _test-ops-agent-connected.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20261001-ops-avail-v1";
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
const html = read("index.html");
const css = read("app.css");
const sw = read("service-worker.js");

const dashStart = app.indexOf("const OpsDashboardUI = {");
const dashEnd = app.indexOf("const TypingPacketUI = {");
const dashBlock = dashStart > 0 && dashEnd > dashStart ? app.slice(dashStart, dashEnd) : "";
const chatStart = app.indexOf("buildPresencePayload(extra={}){");
const chatEnd = app.indexOf("getPresenceState(){", chatStart);
const presenceBlock = chatStart > 0 && chatEnd > chatStart ? app.slice(chatStart, chatEnd) : "";

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-ops-agent-connected.js")]).status === 0, "node --check this test");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + APP_TAG), "index.html app.css cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");

console.log("\n2) תצוגה — מחובר + זמן זמינות");
assert(!!dashBlock, "OpsDashboardUI נמצא");
assert(dashBlock.includes("availableSinceIso(sessionStartedAt, lastFinishedAt){"), "עוזר זמן זמינות");
assert(dashBlock.includes("presenceMap(){"), "קורא לנוכחות הצ׳אט");
assert(dashBlock.includes('chipTxt = agent.live ? "בשיחה" : (agent.connected ? "מחובר" : "לא מחובר")'), "סטטוס מחובר / לא מחובר");
assert(dashBlock.includes('opsDashAgent__chip--online'), "תג מחובר כשלא בשיחה");
assert(dashBlock.includes("נציגים מחוברים"), "כותרת נציגים מחוברים");
assert(dashBlock.includes("agentsLive.filter((a) => a.live || a.connected)"), "בדשבורד מוצגים רק נציגים מחוברים");
assert(dashBlock.includes("אין נציגים מחוברים כרגע"), "בלי מחוברים אין רשימת מחלקה");
assert(dashBlock.includes("refreshAgentRows(){"), "ריענון שורות כשהנוכחות משתנה");
assert(css.includes(".opsDashAgent.is-connected"), "עיצוב מחובר");
assert(presenceBlock.includes("sessionStartedAt: extra.sessionStartedAt || this._sessionStartedAt"), "חותמת תחילת סשן בנוכחות");

console.log("\n3) אין נגיעה בלוגיקת שיחה / שיוך");
assert(dashBlock.includes("agentMatchesCall(agent, rec, call){"), "התאמת נציג לשיחה לא הוסרה");
assert(dashBlock.includes("call?.active && safeTrim(call?.startedAt)"), "זיהוי שיחה חיה נשאר לפי callSession");
assert(app.includes("try{ setOpsTouch(rec,{liveState:\"in_call\""), "סימון in_call בתחילת שיחה נשאר");
assert(html.includes('id="mcCallStartBtn"'), "לחצן התחלת שיחה לא נגע");
assert(dashBlock.includes("data-ops-dash-assign"), "שיוך מהתור לא נגע");
assert(dashBlock.includes('kpiCard("waiting_mirror", "ממתינים לשיקוף")'), "כרטיסי KPI לא נגעו");
assert(dashBlock.includes("this.liveCustomerName(liveRec)"), "שם לקוח בשיחה נשאר");

console.log("\n4) התנהגות — זמינות, מחובר, בשיחה");
function safeTrim(v){
  return v == null ? "" : String(v).trim();
}
function escapeHtml(v){
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const nameSrc = sliceBetween(app, "liveCustomerName(rec){", "presenceMap(){");
const helperSrc = sliceBetween(app, "presenceMap(){", "agentMatchesCall(agent, rec, call){");
const matchSrc = sliceBetween(app, "agentMatchesCall(agent, rec, call){", "collectLiveAgents(){");
const collectSrc = sliceBetween(app, "collectLiveAgents(){", "collectRows(){");
const renderSrc = sliceBetween(app, "renderAgentRows(agents){", "refreshAgentRows(){");
assert(!!nameSrc && !!helperSrc && !!matchSrc && !!collectSrc && !!renderSrc, "ניתן לחלץ את עוזרי המעקב");

const sandbox = {
  console,
  safeTrim,
  escapeHtml,
  Date,
  Map,
  State: { data: { agents: [], customers: [] } },
  ChatUI: {
    _map: new Map(),
    getPresenceMap(){ return this._map; },
    userIdFromAgent(agent){ return safeTrim(agent && agent.id); }
  },
  Auth: { current: { id: "ops1", name: "מנהל", role: "ops" } }
};
function getMirrorAssign(rec){
  return rec && rec.payload && rec.payload.mirrorFlow && rec.payload.mirrorFlow.assign
    ? rec.payload.mirrorFlow.assign
    : null;
}
sandbox.getMirrorAssign = getMirrorAssign;
vm.createContext(sandbox);
vm.runInContext(`
  const api = {
    formatCallClock(totalSec){
      const s = Math.max(0, Math.floor(Number(totalSec) || 0));
      const hh = String(Math.floor(s / 3600)).padStart(2, "0");
      const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
      const ss = String(s % 60).padStart(2, "0");
      return hh + ":" + mm + ":" + ss;
    },
    initials(name){
      const parts = safeTrim(name).split(/\\s+/).filter(Boolean);
      if(!parts.length) return "נצ";
      if(parts.length === 1) return parts[0].slice(0, 2);
      return parts[0].slice(0, 1) + parts[1].slice(0, 1);
    },
    getCallStore(rec){
      return rec?.payload?.mirrorFlow?.callSession || {};
    },
    resolveLiveStep(){ return { n: 2, label: "פרטי מבוטח/ים" }; },
    ${nameSrc}
    ${helperSrc}
    ${matchSrc}
    ${collectSrc}
    ${renderSrc}
  };
  this.api = api;
`, sandbox);
const api = sandbox.api;

assert(api.availableSinceIso("2026-08-27T10:00:00.000Z", "2026-08-27T09:00:00.000Z") === "2026-08-27T10:00:00.000Z", "זמן זמינות מתחילת החיבור אם אין שיחה מאוחרת יותר");
assert(api.availableSinceIso("2026-08-27T10:00:00.000Z", "2026-08-27T11:00:00.000Z") === "2026-08-27T11:00:00.000Z", "אחרי סיום שיחה הזמינות מתחילה מסוף השיחה");
assert(api.availableSinceIso("", "2026-08-27T11:00:00.000Z") === "2026-08-27T11:00:00.000Z", "נפילה לסוף שיחה בלי חותמת סשן");
assert(api.availableSinceIso("", "") === "", "בלי חותמות אין זמן זמינות");

const connectedHtml = api.renderAgentRows([{
  id: "a1",
  name: "דנה כהן",
  initials: "דכ",
  tone: 1,
  live: false,
  connected: true,
  paused: false,
  customerId: "",
  customerName: "",
  stepLabel: "זמין",
  startedAt: "2026-08-27T12:00:00.000Z",
  seconds: 125,
  clock: "00:02:05"
}]);
assert(connectedHtml.includes("מחובר"), "נציג מחובר מוצג כמחובר");
assert(connectedHtml.includes("זמין לקליטה"), "תג זמין כשלא בשיחה");
assert(connectedHtml.includes("00:02:05"), "מונה זמן זמינות");
assert(connectedHtml.includes("is-connected"), "מחלקת עיצוב מחובר");
assert(connectedHtml.includes("opsDashAgent__chip--online"), "תג מחובר כשלא בשיחה");
assert(!connectedHtml.includes("בשיחה עם"), "בלי לקוח כשלא בשיחה");

const liveHtml = api.renderAgentRows([{
  id: "a1",
  name: "דנה כהן",
  initials: "דכ",
  tone: 1,
  live: true,
  connected: true,
  paused: false,
  customerId: "c1",
  customerName: "ישראל ישראלי",
  stepLabel: "שלב 2 · פרטי מבוטח/ים",
  startedAt: "2026-08-27T12:00:00.000Z",
  seconds: 90,
  clock: "00:01:30"
}]);
assert(liveHtml.includes("ישראל ישראלי"), "בשיחה נשאר שם הלקוח");
assert(liveHtml.includes("בשיחה"), "בשיחה מוצג סטטוס בשיחה");
assert(liveHtml.includes("opsDashAgent__chip--live"), "בשיחה מוצג תג חי");

const offlineHtml = api.renderAgentRows([{
  id: "a2",
  name: "יוסי לוי",
  initials: "יל",
  tone: 0,
  live: false,
  connected: false,
  paused: false,
  customerId: "",
  customerName: "",
  stepLabel: "לא מחובר",
  startedAt: "",
  seconds: 0,
  clock: "—"
}]);
assert(offlineHtml.includes("לא מחובר"), "נציג לא מחובר מסומן כך");
assert(offlineHtml.includes("is-idle"), "מחלקת לא מחובר");
assert(!offlineHtml.includes("data-ops-agent-started"), "אין מונה לנציג מנותק");

const agent = { id: "oa1", name: "דנה כהן", role: "opsAgent", active: true };
const sessionStart = new Date(Date.now() - 10 * 60 * 1000).toISOString();
sandbox.State.data.agents = [agent];
sandbox.State.data.customers = [];
sandbox.ChatUI._map = new Map([["oa1", { sessionStartedAt: sessionStart }]]);
const connectedRows = api.collectLiveAgents();
assert(connectedRows.length === 1, "נציג תפעול נאסף");
assert(connectedRows[0].connected === true, "נוכחות → מחובר");
assert(connectedRows[0].live === false, "בלי שיחה חיה");
assert(connectedRows[0].clock !== "—", "יש מונה זמינות");
assert(connectedRows[0].startedAt === sessionStart, "הזמינות מתחילת החיבור");
assert(connectedRows[0].seconds >= 9 * 60, "מונה הזמינות סופר דקות מאז החיבור");

const finishedAt = new Date(Date.now() - 2 * 60 * 1000).toISOString();
sandbox.State.data.customers = [{
  id: "c-old",
  fullName: "לקוח ישן",
  payload: {
    mirrorFlow: {
      assign: { agentId: "oa1", agentName: "דנה כהן" },
      callSession: { active: false, startedAt: sessionStart, finishedAt, startedBy: "דנה כהן" }
    }
  }
}];
const afterCall = api.collectLiveAgents();
assert(afterCall[0].connected === true && afterCall[0].live === false, "אחרי שיחה עדיין מחובר ולא בשיחה");
assert(afterCall[0].startedAt === finishedAt, "הזמינות מתחילה מסיום השיחה האחרונה");
assert(afterCall[0].seconds >= 60 && afterCall[0].seconds < 10 * 60, "מונה הזמינות קצר יותר מזמן החיבור");

sandbox.State.data.customers = [{
  id: "c-live",
  fullName: "ישראל ישראלי",
  payload: {
    mirrorFlow: {
      assign: { agentId: "oa1", agentName: "דנה כהן" },
      callSession: { active: true, startedAt: new Date(Date.now() - 90 * 1000).toISOString(), startedBy: "דנה כהן" }
    }
  }
}];
const inCall = api.collectLiveAgents();
assert(inCall[0].live === true, "שיחה חיה מסומנת");
assert(inCall[0].customerName === "ישראל ישראלי", "שם הלקוח בשיחה");
assert(inCall[0].clock !== "—", "מונה שיחה ולא זמינות");

sandbox.ChatUI._map = new Map();
sandbox.State.data.customers = [];
const offline = api.collectLiveAgents();
assert(offline[0].connected === false && offline[0].live === false, "בלי נוכחות → לא מחובר");
assert(offline[0].clock === "—", "אין מונה כשלא מחובר");

console.log("\n5) סטטוס זמינות — מונה מדויק וסיכום יומי");
function extractMethod(src, name){
  let start = src.indexOf("    " + name + "(");
  if(start < 0) return "";
  let i = src.indexOf("{", start);
  let depth = 0;
  for(; i < src.length; i++){
    if(src[i] === "{") depth += 1;
    else if(src[i] === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, i + 1);
    }
  }
  return "";
}
const mathNames = ["availBlank", "availDayKey", "availNormalize", "availCloseOpen", "availApplyMode", "availTotals", "availFromPresence", "availSumAttrs", "availTotalsHtml"];
const mathSrc = mathNames.map((name) => extractMethod(app, name)).join(",\n");
assert(mathNames.every((name) => extractMethod(app, name)), "חולצו עוזרי זמינות");
vm.runInContext("Object.assign(this.api, {\n" + mathSrc + "\n});", sandbox);

const t0 = Date.parse("2026-10-01T09:00:00.000Z");
let st = api.availBlank("2026-10-01");
st = api.availApplyMode(st, "break", t0);
st = api.availApplyMode(st, "free", t0 + 10 * 60 * 1000);
st = api.availApplyMode(st, "break", t0 + 20 * 60 * 1000);
const summed = api.availTotals(st, t0 + 25 * 60 * 1000);
assert(summed.breakMs === 15 * 60 * 1000, "שתי הפסקות באותו יום מסתכמות");
assert(summed.signMs === 0, "הפסקה לא נספרת כהחתמה");
assert(summed.openMs === 5 * 60 * 1000, "המונה החי הוא רק המקטע הפתוח");
st = api.availApplyMode(st, "sign", t0 + 25 * 60 * 1000);
const signed = api.availTotals(st, t0 + 35 * 60 * 1000);
assert(signed.breakMs === 15 * 60 * 1000, "מעבר להחתמה שומר את סה״כ ההפסקה");
assert(signed.signMs === 10 * 60 * 1000, "החתמה נספרת בנפרד");
assert(signed.openMs === 10 * 60 * 1000, "מונה ההחתמה מתחיל מהחותמת");
const nextDay = api.availNormalize(st, "2026-10-02", t0 + 24 * 60 * 60 * 1000);
assert(nextDay.breakMs === 0 && nextDay.signMs === 0 && nextDay.mode === "", "יום חדש מאפס את הסיכום");

sandbox.ChatUI._map = new Map([["oa1", {
  sessionStartedAt: sessionStart,
  opsAvail: { day: api.availDayKey(new Date()), mode: "break", openStartedAt: new Date(Date.now() - 90 * 1000).toISOString(), breakMs: 600000, signMs: 120000 }
}]]);
sandbox.State.data.customers = [];
const onBreak = api.collectLiveAgents();
assert(onBreak[0].availMode === "break", "נוכחות מעבירה סטטוס הפסקה");
assert(onBreak[0].seconds >= 80 && onBreak[0].seconds < 180, "מונה החי נספר מחותמת הפתיחה");
assert(onBreak[0].availBreakMs === 600000, "הפסקות סגורות נשמרות");
const breakHtml = api.renderAgentRows([onBreak[0]]);
assert(breakHtml.includes("הפסקה"), "שורה מציגה הפסקה");
assert(breakHtml.includes("הפסקה היום"), "שורה מציגה סה״כ הפסקה");
assert(breakHtml.includes("החתמה היום"), "שורה מציגה סה״כ החתמה");
assert(breakHtml.includes("data-ops-sum-open"), "הסיכום היומי ממשיך להיפתח מהחותמת");

sandbox.ChatUI._map = new Map([["oa1", {
  sessionStartedAt: sessionStart,
  opsAvail: { day: api.availDayKey(new Date()), mode: "sign", openStartedAt: new Date(Date.now() - 30 * 1000).toISOString(), breakMs: 0, signMs: 0 }
}]]);
sandbox.State.data.customers = [{
  id: "c-live",
  fullName: "ישראל ישראלי",
  payload: {
    mirrorFlow: {
      assign: { agentId: "oa1", agentName: "דנה כהן" },
      callSession: { active: true, startedAt: new Date(Date.now() - 50 * 1000).toISOString(), startedBy: "דנה כהן" }
    }
  }
}];
const callDuringSign = api.collectLiveAgents();
const callHtml = api.renderAgentRows([callDuringSign[0]]);
assert(callDuringSign[0].live === true, "שיחה חיה נשארת שיחה חיה");
assert(callHtml.includes("בשיחה עם"), "בשיחה נשאר שם הלקוח ליד הסטטוס");
assert(callHtml.includes("ישראל ישראלי"), "שם הלקוח לא נעלם");
assert(callHtml.includes("החתמה היום"), "גם בשיחה רואים את סיכום ההחתמה");

assert(app.includes("סה״כ הפסקה היום"), "לנציג מוצג סה״כ ההפסקה");
assert(app.includes('data-ops-avail-mode="${mode}"'), "בחירת הסטטוס מחוברת לכפתור");
assert(app.includes('choice("break", "הפסקה")'), "אפשר לבחור הפסקה");
assert(app.includes('choice("sign", "החתמת מסמכים")'), "אפשר לבחור החתמת מסמכים");
assert(app.includes('choice("free", "זמין לשיחת שיקוף")'), "אפשר לבחור זמין לשיקוף");
assert(dashBlock.includes("renderAvailBar"), "הסרגל נמצא בדשבורד");
assert(!extractMethod(app, "setMyAvailMode").includes("payload"), "שמירת הזמינות לא נוגעת בתיק לקוח");
assert(app.includes('waiting_mirror: "#17324d"'), "פילוח ממתינים לשיקוף בכחול כהה");
assert(app.includes('waiting_typing: "#0e6b6a"'), "פילוח שליחה לחתימות בטורקיז");
assert(app.includes('pending_signatures: "#b45309"'), "פילוח ממתין לחתימות בכתום");
assert(css.includes("#view-dashboard .opsDashLegend__dot--waiting_mirror{ background:#17324d; }"), "נקודת הפילוח כחולה");
assert(css.includes("#view-dashboard .opsDashLegend__dot--waiting_typing{ background:#0e6b6a; }"), "נקודת הפילוח טורקיז");
assert(css.includes("#view-dashboard .opsDashLegend__dot--pending_signatures{ background:#b45309; }"), "נקודת הפילוח כתומה");
assert(css.includes("#view-dashboard .opsDashLegend__dot--total{ background:#94a3b8; }"), "נקודת הסה״כ אפורה");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
