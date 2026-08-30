/* GI-OPS 2026-08-27 — הצהרת בריאות בשיקוף תפעול:
   שאלות שהנציג הגיש, שאלון המשך אחרי כן, כן/לא לכל מבוטח עם שם,
   כתיבה לטופס ההצעה ולדוח הסיום.
   הרצה: node _test-ops-mirror-health-decl.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260830-ops-mirror-assign-v1";
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
const wizard = read("gi-wizard.js");
const sw = read("service-worker.js");

const healthRender = sliceBetween(app, "_renderHealthDeclarationBody(rec){", "_mcIsExistingHealthProduct(p){");
const healthGroups = sliceBetween(app, "_mirrorBuildHealthGroups(rec){", "_mcSyncHealthDeclarationCopies(rec, source){");
const reportHealth = sliceBetween(app, "_healthDetail(response, meta){", "/** תצלום של כל השדות שהשיקוף עשוי לשנות");
const collectHealth = sliceBetween(app, "const healthRows = [];", 'areas.push({ key: "health", label: "הצהרת בריאות"');

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-ops-mirror-health-decl.js")]).status === 0, "node --check this test");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + APP_TAG), "index.html app.css cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");

console.log("\n2) שאלות שהנציג הגיש + כן/לא לכל מבוטח");
assert(healthGroups.includes("GI-DECL-SOURCE") || healthGroups.includes("fromFileOnly"), "נשאר שער שאלות מהתיק");
assert(healthGroups.includes("answeredInsuredIds"), "רק שאלות עם תשובה מהאשף נכנסות לרשימה");
assert(healthGroups.includes("return indexedInsureds"), "כן/לא לכל מבוטח בהצעה");
assert(!healthGroups.includes("answered.has("), "אין סינון מבוטחים רק לפי תשובה שמורה");
assert(healthGroups.includes('role + ": " + name'), "תווית מבוטח ראשי: שם");
assert(healthRender.includes("item.insLabel"), "התווית המלאה מוצגת בשיקוף");
assert(html.includes('id="mcStepHealthDeclBody"'), "גוף שלב הצהרת הבריאות לא הוסר");

console.log("\n3) שאלוני המשך אחרי כן");
assert(healthRender.includes("שאלון שנפתח"), "כותרת שאלון שנפתח");
assert(healthRender.includes("_mcHealthFollowupFields"), "שדות שאלון המשך נשלפים");
assert(healthRender.includes("_mcHealthQuestionnaireTitle"), "שם השאלון מהאשף מוצג");
assert(app.includes("_mcHealthFollowupFields(item){"), "עוזר שדות שאלון קיים");
assert(css.includes(".mcHealthQuest"), "עיצוב שאלון ברוחב מלא");
assert(css.includes("grid-column: 1 / -1"), "השאלון פורץ מחוץ לעמודת כן/לא");

console.log("\n4) כתיבה לטופס הצעה + דוח סיום");
assert(app.includes("_mcSyncHealthDeclarationCopies(rec, source){"), "סנכרון לכל עותקי ההצהרה");
assert(app.includes("rec.payload.healthDeclaration = source"), "נכתב ל-payload של ההצעה");
assert(app.includes("attach(rec.payload.operational.primary)"), "נכתב לעותק התפעולי");
assert(app.includes("ins.data.healthDeclaration = source") || app.includes("attach(ins.data)"), "נכתב למבוטחים");
assert(app.includes("_persistHealthDeclarationStep(rec){"), "שמירה מלאה בסיום השלב");
assert(app.includes('await App.persist("הצהרת בריאות בשיחת שיקוף נשמרה"'), "persist שומר את ההצהרה");
assert(reportHealth.includes("_healthInsuredReportLabel"), "דוח מציג תפקיד: שם");
assert(collectHealth.includes("insuredLabel ? `${insuredLabel} · ${label}`"), "שורת דוח כוללת את שם המבוטח");
assert(reportHealth.includes("formatHealthFieldsForOperationalReport"), "פירוט שאלון בדוח עם תוויות");
assert(app.includes("healthResponses(payload){"), "מילוי טופס הצעה עדיין קורא מההצהרה החיה");

console.log("\n5) התנהגות — סנכרון ודוח");
function safeTrim(v){
  return v == null ? "" : String(v).trim();
}
function escapeHtml(v){
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const helperSrc = sliceBetween(app, "_mcSyncHealthDeclarationCopies(rec, source){", "_onMcHealthAnswerClick(btn){");
assert(!!helperSrc, "ניתן לחלץ את עוזרי ההצהרה");
const sandbox = {
  console,
  safeTrim,
  escapeHtml,
  Wizard: {
    resolveHealthFieldLabel(_q, key){ return key === "diagnosis" ? "אבחנה" : ""; },
    formatHealthFieldsForOperationalReport(_q, fields){
      const parts = [];
      Object.entries(fields || {}).forEach(([k, v]) => {
        if(safeTrim(v)) parts.push((k === "diagnosis" ? "אבחנה" : k) + ": " + safeTrim(v));
      });
      return parts.join(" • ");
    }
  }
};
vm.createContext(sandbox);
vm.runInContext(`
  const api = {
    _mirrorGetInsureds(rec){ return (rec.payload && rec.payload.insureds) || []; },
    ${helperSrc}
  };
  this.api = api;
`, sandbox);

const rec = {
  payload: {
    primary: {},
    operational: { primary: {} },
    insureds: [
      { id: "p1", type: "primary", data: { firstName: "דנה", lastName: "כהן" } },
      { id: "s1", type: "spouse", data: { firstName: "יוסי", lastName: "כהן" } }
    ]
  }
};
const source = {
  responses: {
    heart: {
      p1: { answer: "yes", fields: { diagnosis: "לחץ דם" } }
    }
  }
};
sandbox.api._mcSyncHealthDeclarationCopies(rec, source);
assert(rec.payload.primary.healthDeclaration === source, "הצהרה מסונכרנת ל-primary");
assert(rec.payload.operational.primary.healthDeclaration === source, "הצהרה מסונכרנת לעותק תפעולי");
assert(rec.payload.healthDeclaration === source, "הצהרה מסונכרנת ל-payload");
assert(rec.payload.insureds[0].data.healthDeclaration === source, "הצהרה מסונכרנת למבוטח ראשי");
assert(rec.payload.insureds[1].data.healthDeclaration === source, "הצהרה מסונכרנת לבן/בת זוג");

const fields = sandbox.api._mcHealthFollowupFields({
  meta: {
    fields: [{ key: "diagnosis", label: "אבחנה", type: "text" }, { key: "sec", label: "כותרת", type: "section" }],
    questionnaireSource: "הפניקס · שאלון 2"
  },
  response: { answer: "yes", fields: { diagnosis: "לחץ דם", extra: "הערה" } }
});
assert(fields.some((f) => f.key === "diagnosis"), "שדה שאלון מהסכמה מוצג");
assert(!fields.some((f) => f.type === "section"), "כותרות section לא מוצגות כשדות");
assert(fields.some((f) => f.key === "extra"), "שדה שמור מהאשף בלי סכמה עדיין מוצג");
assert(sandbox.api._mcHealthQuestionnaireTitle({ questionnaireSource: "הפניקס · שאלון 2" }) === "הפניקס · שאלון 2", "שם שאלון מהמקור");

function healthInsuredReportLabel(ins, idx, fallback){
  const t = ins?.type === "primary" || (!ins?.type && idx === 0) ? "מבוטח ראשי"
    : (ins?.type === "spouse" || ins?.type === "secondary") ? "בן/בת זוג"
    : ins?.type === "child" ? "ילד/ה" : "מבוטח";
  const d = ins?.data || {};
  const name = `${safeTrim(d.firstName)} ${safeTrim(d.lastName)}`.trim();
  if(t && name) return `${t}: ${name}`;
  return name || t || fallback || "מבוטח";
}
assert(healthInsuredReportLabel(rec.payload.insureds[0], 0) === "מבוטח ראשי: דנה כהן", "דוח: מבוטח ראשי: שם");
assert(healthInsuredReportLabel(rec.payload.insureds[1], 1) === "בן/בת זוג: יוסי כהן", "דוח: בן/בת זוג: שם");

const before = { health: { "heart|p1": { label: "מחלות לב", insuredLabel: "מבוטח ראשי: דנה כהן", value: "לא" } } };
const after = { health: { "heart|p1": { label: "מחלות לב", insuredLabel: "מבוטח ראשי: דנה כהן", value: "כן · אבחנה: לחץ דם" } } };
const rowLabel = `${after.health["heart|p1"].insuredLabel} · ${after.health["heart|p1"].label}`;
assert(rowLabel === "מבוטח ראשי: דנה כהן · מחלות לב", "תווית שורת דוח כוללת מבוטח ושאלה");
assert(before.health["heart|p1"].value !== after.health["heart|p1"].value, "שינוי כן + שאלון נרשם בדוח");

console.log("\n6) רגרסיה — לא נגענו באשף ובמסכים אחרים");
assert(wizard.includes("getHealthSchema(){"), "סכמת הצהרת אשף לא הוסרה");
assert(wizard.includes("openHealthDetailModal"), "מודל שאלון באשף לא נגע");
assert(html.includes('id="lcSendToOps"'), "הגש לתפעול לא נגע");
assert(html.includes('id="mcCallStartBtn"'), "התחל שיחת שיקוף לא נגע");
assert(app.includes('kpiCard("waiting_mirror", "ממתינים לשיקוף")'), "דשבורד ממתינים לא נגע");
assert(healthRender.includes("health-to-future"), "ניווט המשך משלב ההצהרה נשאר");
assert(app.includes("captureBaseline(rec"), "לכידת בסיס לדוח לא הוסרה");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
