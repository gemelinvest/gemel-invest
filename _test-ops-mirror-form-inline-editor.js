/* GI-OPS 2026-09-14 — שלב 7 שיקוף: עריכת טופס מקורי במסך מלא
   (לא מודאל), כל שדות הטופס כולל הצהרת בריאות, מילוי מהתיק.
   הרצה: node _test-ops-mirror-form-inline-editor.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260914-mc-q1to1-followup-v1";
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
const css = read("app.css");
const html = read("index.html");
const sw = read("service-worker.js");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + APP_TAG), "index.html app.css cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");

const healthRender = sliceBetween(app, "_renderHealthDeclarationBody(rec){", "_mcIsExistingHealthProduct(p){");
const openJoin = sliceBetween(app, "async _mcOpenJoinFormFromRail(rec, type){", "async _mcOpenFollowupFromRail(rec, type");
const openFollow = sliceBetween(app, "async _mcOpenFollowupFromRail(rec, type", "_mcShowFullPdfModal(title, url){");
const overlayFn = sliceBetween(app, "async _mcApplyPdfOverlayToBytes(bytes, pdfValues){", "_mcCaptureFormEditsFromModal(modal){");
const stemMap = sliceBetween(app, "_mcPdfFieldStemMap(){", "_mcSplitPdfFieldName(fieldName){");

console.log("\n2) מסך מלא במקום מודאל");
assert(healthRender.includes("_mcHealthFormEditorHtml(rec)"), "גוף שלב 7 מצייר עורך במסך");
assert(healthRender.includes("mcHealthDeclSplit--editor"), "פריסת עורך במסך השיקוף");
assert(app.includes("חזרה להצהרה"), "חזרה מהטופס לסיכום הצהרה");
assert(app.includes("health-form-close"), "פעולת סגירת עורך");
assert(openJoin.includes("listEditablePdfFields"), "טוען את כל שדות ה-PDF הרשמי");
assert(openJoin.includes("fillOriginalTemplate"), "ממלא מהתיק לפני העריכה");
assert(!openJoin.includes("await ui[fnName](rec)"), "לא פותח את מודאל תיק הלקוח");
assert(openFollow.includes('kind: "followup"'), "שאלון המשך נפתח במסך ולא במודאל");
assert(openFollow.includes("_mcFollowupFallbackFields"), "שאלון בלי AcroForm נפתח לעריכה");
assert(!openFollow.includes("<iframe"), "שאלון המשך אינו iframe במסך העריכה");
assert(app.includes("health-followup-save"), "שמירת שאלון וחזרה");
assert(app.includes("_mcReturnFromFollowupEditor(rec){"), "חזרה לטופס או להצהרה אחרי שאלון");
assert(app.includes('data-mc-health-yes="1"'), "כן בהצהרה מסומן לפתיחת שאלון");
assert(app.includes("_mcOnHealthChoiceInEditor(rec, el){"), "לחיצת כן פותחת שאלון המשך");

console.log("\n3) מיפוי הצהרת בריאות לכל הטפסים");
assert(app.includes("_mcJoinTypeHealthMap(type){"), "מפת סוג טופס → מפת הצהרה");
assert(app.includes("phoenix_life_short_form: \"phoenix_life_short\""), "פניקס ריסק מקוצר");
assert(app.includes("phoenix_ci_form: \"phoenix_ci\""), "פניקס מחלות קשות");
assert(app.includes("hachshara_health_form: \"hachshara_health\""), "הכשרה בריאות");
assert(app.includes("clal_health_form: \"clal_health\""), "כלל בריאות");
assert(app.includes("menora_risk_form: \"menora_risk\""), "מנורה ריסק");
assert(app.includes("ayalon_health_form: \"ayalon_health\""), "איילון בריאות");
assert(app.includes("migdal_life_form: \"migdal_life\""), "מגדל חיים");
assert(app.includes("_mcRenderPdfFieldsHtml(type, fields, values){"), "עורך לפי שדות הטופס המקורי");
assert(app.includes("_mcRenderDraftHealthFormHtml(rec, type, draft){"), "נפילה לטופס שטוח (בלי AcroForm)");
assert(app.includes("_mcPdfHealthFieldMeta(type, fieldName){"), "תווית שאלה לפי מיקום בטופס");
assert(app.includes("הצהרת בריאות"), "כותרת אזור הצהרה בעורך");

console.log("\n4) עיצוב מקצועי + שמירה");
assert(css.includes(".mcFormEd__q{"), "שאלות הצהרה ככרטיסים");
assert(css.includes(".mcFormEd__seg{"), "כן/לא כבחירה מקצועית");
assert(css.includes(".mcFormEd__seg{\n  position:relative;"), "כפתור כן לא מכסה את המסך");
assert(css.includes(".mcFormEd__head{"), "כותרת דביקה לעורך");
assert(app.includes("_mcFlushInlineFormEditor(rec){"), "שמירת עריכות לפני ניווט");
assert(app.includes("_mcApplyPdfOverlayToBytes(bytes, pdfValues){"), "כתיבת שדות PDF חזרה לטופס");
assert(overlayFn.includes("{ visual: false }"), "עברית לוגית ב-PDF (לא הפוכה)");
assert(overlayFn.includes('setExport(form, name, "Off")'), "ניקוי צ'קבוקס נכתב Off");
assert(app.includes("if(el.type === \"radio\" && !el.checked) return;"), "רדיו לא דורס ערך ריק");
assert(app.includes("this._mcBytesToPdfDataUrl(outBytes)"), "שאלון המשך נשמר עם העריכות");

console.log("\n4b) תוויות עברית 1:1 לטופס הנייר");
assert(stemMap.includes('ClientMustExistPolicy: "קיימת פוליסה בחברה"'), "קיימת פוליסה");
assert(stemMap.includes('RiskWellPremiaText: "פרמיית ריסק / בריאות"'), "פרמיית ריסק");
assert(stemMap.includes('GiluiTotalRisk15: "סכום ביטוח — 15 שנים"'), "סכום 15 שנים");
assert(stemMap.includes('FamilyIncome: "הכנסה משפחתית"'), "הכנסה משפחתית");
assert(app.includes('_mcPdfFieldLabel(type, fieldName){'), "תווית שדה לעורך");
assert(app.includes('return "שדה בטופס"'), "לא מציגים שם אנגלי גולמי");

console.log("\n5) רגרסיה — לא נפתח מודאל תיק לקוח מהמסילה");
assert(app.includes("_mcOfficialFormOpeners(){"), "מיפוי פותחי טפסים נשאר (לתיק לקוח)");
assert(app.includes("fillOriginalTemplate"), "מנוע מילוי רשמי לא הוסר");
assert(healthRender.includes("כעת נעבור להצהרת הבריאות"), "נוסח הקראה נשאר כשהעורך סגור");

console.log("\n6) תוויות עבריות בזמן ריצה");
function extractMethod(src, name){
  let start = src.indexOf("    async " + name + "(");
  if(start < 0) start = src.indexOf("    " + name + "(");
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
const vm = require("vm");
const humanizeSrc = [
  extractMethod(app, "_mcPdfFieldStemMap"),
  extractMethod(app, "_mcSplitPdfFieldName"),
  extractMethod(app, "_mcHumanizePdfFieldName")
].join(",\n");
assert(humanizeSrc.indexOf("_mcPdfFieldStemMap") >= 0, "חולץ מפת תוויות");
const sandbox = {
  safeTrim: (v) => (v == null ? "" : String(v).trim()),
  GI_OFFICIAL_FORM_FILL: { hebrewPdfFieldLabel: (n) => n }
};
vm.createContext(sandbox);
vm.runInContext("const api = {\n" + humanizeSrc + "\n}; this.api = api;", sandbox);
const labelOf = (name) => sandbox.api._mcHumanizePdfFieldName(name);
assert(labelOf("ClientMustExistPolicy") === "קיימת פוליסה בחברה", "ClientMustExistPolicy בעברית");
assert(labelOf("RiskWellPremiaText") === "פרמיית ריסק / בריאות", "RiskWellPremiaText בעברית");
assert(labelOf("GiluiTotalRisk15") === "סכום ביטוח — 15 שנים", "GiluiTotalRisk15 בעברית");
assert(labelOf("FamilyIncome") === "הכנסה משפחתית", "FamilyIncome בעברית");
assert(labelOf("FirstNameBzug") === "בן/בת זוג — שם פרטי", "FirstNameBzug בעברית");
assert(labelOf("PIDChild1") === "ילד 1 — תעודת זהות", "PIDChild1 בעברית");

console.log("\n7) שאלה↔שאלון 1:1 + עברית במקום מפתח אנגלי");
const qTextFn = extractMethod(app, "_mcHealthQText");
const hitsFn = extractMethod(app, "_mcFollowupHitsForQuestion");
const draftFn = extractMethod(app, "_mcRenderDraftHealthFormHtml");
const isHealthFn = extractMethod(app, "_mcIsHealthPdfField");
assert(qTextFn.includes("resolveHealthQuestionDisplayText"), "תווית שאלה מהקטלוג העברי");
assert(qTextFn.includes("groups[i]?.question?.text"), "לא מחליפים טקסט שאלה בשם מבוטח");
assert(!qTextFn.includes("insured?.label"), "שם מבוטח אינו תווית השאלה");
assert(app.includes("_mcFollowupHitsForQuestion(rec, qKey, insId, questionnaireNos){"), "חיבור שאלון לפי שאלה+חברה+מבוטח");
assert(app.includes("_mcHealthManualFieldsHtml(qKey, insId, fields, stored, hidden){"), "שדות מילוי ידני לשאלה בלי שאלון");
assert(app.includes('class="mcFormEd__manual"'), "בלוק שדות ידניים בעורך");
assert(css.includes(".mcFormEd__manual{"), "עיצוב שדות ידניים");
assert(css.includes(".mcFormEd__qFollow{"), "רמז מספר שאלון על השאלה");
const yesSlice = sliceBetween(app, "async _mcOnHealthChoiceInEditor(rec, el){", "async _mcReturnFromFollowupEditor(rec){");
assert(yesSlice.includes("_mcFollowupHitsForQuestion(fresh, qKey, insId, nos)"), "כן פותח רק שאלון של אותה שאלה");
assert(!yesSlice.includes("_renderHealthDeclarationBody"), "כן לא קופץ חזרה לסיכום/גובה-משקל");
assert(!yesSlice.includes("rail.follow.find"), "אין נפילה לשאלון אקראי של המבוטח");
assert(draftFn.includes('|| "שאלה רפואית"'), "נפילה עברית במקום מפתח אנגלי");
assert(draftFn.includes("_mcHealthQuestionFollowHint"), "מספר שאלון מוצג על השאלה");
assert(isHealthFn.includes("HealthDec"), "שדות הצהרה נשארים באזור הבריאות");
assert(!/Hight\|Weight\|BMI/.test(isHealthFn), "גובה/משקל לא באזור שאלות ההצהרה");

const qSandbox = {
  safeTrim: (v) => (v == null ? "" : String(v).trim()),
  Wizard: {
    resolveHealthQuestionDisplayText(key){
      const map = {
        phoenix_critical_illness__ci_smoking: "2.1 האם הינך מעשן או עישנת במהלך השנתיים האחרונות לרבות סיגריה אלקטרונית? (מגיל 16) — אם כן: כמות סיגריות ותאריך הפסקת עישון",
        phoenix_critical_illness__ci_tests: "2.2 האם בשנתיים האחרונות עברת או הומלץ לך או שהינך מועמד לביצוע בדיקות פולשניות",
        phoenix_critical_illness__ci_heart: "3.1 מחלות לב, כלי דם ודם"
      };
      return map[key] || "שאלה רפואית";
    },
    getHealthQuestionLegacyTextMap(){
      return { short__smoking: "עישון במהלך השנתיים האחרונות" };
    }
  },
  GI_FOLLOWUP_ZIP_CONFIG: {
    companyKeyFromQKey(qKey){
      if(String(qKey).startsWith("phoenix_")) return "phoenix";
      if(String(qKey).startsWith("clal_")) return "clal";
      return "";
    }
  }
};
vm.createContext(qSandbox);
vm.runInContext(
  "const api = {\n" +
  "  _getFreshCustomerRecord(){ return { payload: {} }; },\n" +
  "  _mirrorBuildHealthGroups(){ return []; },\n" +
  "  _mcHealthMetaMap(){ return {}; },\n" +
  "  _mcCollectHealthFormRail(){\n" +
  "    return { follow: [\n" +
  "      { type: 'followup:phoenix|ins1|18', entry: { insuredId: 'ins1', companyKey: 'phoenix', questionnaireNum: '18', qKeys: ['phoenix_critical_illness__ci_tests'] } },\n" +
  "      { type: 'followup:phoenix|ins1|20', entry: { insuredId: 'ins1', companyKey: 'phoenix', questionnaireNum: '20', qKeys: ['phoenix_critical_illness__ci_tests'] } },\n" +
  "      { type: 'followup:phoenix|ins1|2', entry: { insuredId: 'ins1', companyKey: 'phoenix', questionnaireNum: '2', qKeys: ['phoenix_critical_illness__ci_heart'] } },\n" +
  "      { type: 'followup:phoenix|ins1|22', entry: { insuredId: 'ins1', companyKey: 'phoenix', questionnaireNum: '22', qKeys: ['phoenix_critical_illness__ci_family'] } },\n" +
  "      { type: 'followup:clal|ins1|18', entry: { insuredId: 'ins1', companyKey: 'clal', questionnaireNum: '18', qKeys: ['clal_health__tests'] } }\n" +
  "    ] };\n" +
  "  },\n" +
  qTextFn + ",\n" + hitsFn + ",\n" + isHealthFn + "\n}; this.api = api;",
  qSandbox
);
const smokingHe = qSandbox.api._mcHealthQText("phoenix_critical_illness__ci_smoking");
assert(smokingHe.indexOf("2.1") === 0 && smokingHe.indexOf("מעשן") >= 0, "עישון CI בעברית ולא כמפתח");
assert(smokingHe.indexOf("phoenix_critical_illness") < 0, "מפתח CI לא מוצג כתווית");
assert(qSandbox.api._mcHealthQText("phoenix_critical_illness__ci_heart").indexOf("3.1") === 0, "לב CI בעברית");
assert(qSandbox.api._mcIsHealthPdfField("HealthDecMainQ3") === true, "HealthDec באזור הצהרה");
assert(qSandbox.api._mcIsHealthPdfField("IsSmoking") === true, "IsSmoking באזור הצהרה");
assert(qSandbox.api._mcIsHealthPdfField("Hight") === false, "גובה לא באזור שאלות");
assert(qSandbox.api._mcIsHealthPdfField("Weight") === false, "משקל לא באזור שאלות");
const testHits = qSandbox.api._mcFollowupHitsForQuestion({}, "phoenix_critical_illness__ci_tests", "ins1", ["18", "20"]);
assert(testHits.length === 2 && testHits[0].entry.questionnaireNum === "18" && testHits[1].entry.questionnaireNum === "20", "בדיקות CI → שאלונים 18 ו-20 לפי הסדר");
assert(testHits.every((h) => h.entry.companyKey === "phoenix"), "רק שאלוני אותה חברה");
const heartHits = qSandbox.api._mcFollowupHitsForQuestion({}, "phoenix_critical_illness__ci_heart", "ins1", ["2", "3", "4"]);
assert(heartHits.length === 1 && heartHits[0].entry.questionnaireNum === "2", "לב CI → שאלון 2 ולא שאלון בדיקות");
const smokeHits = qSandbox.api._mcFollowupHitsForQuestion({}, "phoenix_critical_illness__ci_smoking", "ins1", []);
assert(smokeHits.length === 0, "עישון CI בלי questionnaireNos לא פותח שאלון זר");
const familyHits = qSandbox.api._mcFollowupHitsForQuestion({}, "phoenix_critical_illness__ci_family", "ins1", ["22"]);
assert(familyHits.length === 1 && familyHits[0].entry.questionnaireNum === "22", "משפחה CI → שאלון 22");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
