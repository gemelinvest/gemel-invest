/* GI-OPS 2026-09-14 — שלב 7 שיקוף: עריכת טופס מקורי במסך מלא
   (לא מודאל), כל שדות הטופס כולל הצהרת בריאות, מילוי מהתיק.
   הרצה: node _test-ops-mirror-form-inline-editor.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260915-reminder-compact-v1";
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
const editorHtml = extractMethod(app, "_mcHealthFormEditorHtml");
assert(editorHtml.includes("_mcFollowupEditorFields"), "עורך המשך נבנה משאלות הדף");
assert(editorHtml.includes("_mcFollowupEntryFromEditor"), "עורך המשך לא תלוי ב-PDF שכבר נטען");
assert(!/ed\.fields && ed\.fields\.length/.test(editorHtml), "עורך המשך לא מציג רשימת שדות PDF ישנה");
assert(openFollow.includes("_mcFollowupEditorFields"), "שאלון המשך נפתח לפי דף השאלון");
assert(openFollow.includes("_mcParseFollowupType"), "שאלון נפתח גם בלי רשומת PDF במסילה");
assert(!openFollow.includes("listEditablePdfFields"), "שאלון המשך לא שופך את כל שדות ה-PDF");
assert(openFollow.includes("usePdfFields: false"), "עורך שאלון אינו AcroForm גולמי");
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
const clalListFn = extractMethod(app, "_mcClalLetterList");
const aliasFn = extractMethod(app, "_mcQuestionnaireNumAliases");
const overlapFn = extractMethod(app, "_mcQuestionnaireNumsOverlap");
const companyFn = extractMethod(app, "_mcFollowupCompanyKey");
const draftFn = extractMethod(app, "_mcRenderDraftHealthFormHtml");
const isHealthFn = extractMethod(app, "_mcIsHealthPdfField");
assert(qTextFn.includes("resolveHealthQuestionDisplayText"), "תווית שאלה מהקטלוג העברי");
assert(qTextFn.includes("groups[i]?.question?.text"), "לא מחליפים טקסט שאלה בשם מבוטח");
assert(!qTextFn.includes("insured?.label"), "שם מבוטח אינו תווית השאלה");
assert(app.includes("_mcFollowupHitsForQuestion(rec, qKey, insId, questionnaireNos){"), "חיבור שאלון לפי שאלה+חברה+מבוטח");
assert(app.includes("_mcHealthQuestionnaireNosForQKey(rec, qKey){"), "מספר שאלון נשלף גם בלי מטא מוכן");
assert(app.includes("_mcSyntheticFollowupRow(companyKey, insId, qNum, qKey){"), "כן פותח שאלון גם בלי רשומת מסילה");
assert(app.includes("_mcParseFollowupType(type){"), "פתיחת שאלון לפי סוג followup:חברה|מבוטח|מספר");
assert(app.includes("_mcQuestionnaireNumAliases(num){"), "כלל 19 ↔ יט");
assert(app.includes("_mcHealthManualFieldsHtml(qKey, insId, fields, stored, hidden){"), "שדות מילוי ידני לשאלה בלי שאלון");
assert(app.includes('class="mcFormEd__manual"'), "בלוק שדות ידניים בעורך");
assert(css.includes(".mcFormEd__manual{"), "עיצוב שדות ידניים");
assert(css.includes(".mcFormEd__qFollow{"), "רמז מספר שאלון על השאלה");
const yesSlice = sliceBetween(app, "async _mcOnHealthChoiceInEditor(rec, el){", "async _mcReturnFromFollowupEditor(rec){");
assert(yesSlice.includes("ensureGiWizardJsLoaded"), "כן טוען את קטלוג השאלונים לפני הפתיחה");
assert(yesSlice.includes("_mcHealthQuestionnaireNosForQKey(rec, qKey)"), "כן מוצא את מספר השאלון של אותה שאלה");
assert(yesSlice.includes("_mcSyntheticFollowupRow"), "כן פותח שאלון גם אם המסילה עדיין ריקה");
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
    CLAL_LETTERS: ["א","ב","ג","ד","ה","ו","ז","ח","ט","י","יא","יב","יג","יד","טו","טז","יז","יח","יט","כ","כא","כב","כג"],
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
  "      { type: 'followup:clal|ins1|18', entry: { insuredId: 'ins1', companyKey: 'clal', questionnaireNum: '18', qKeys: ['clal_health__tests'] } },\n" +
  "      { type: 'followup:clal|ins1|19', entry: { insuredId: 'ins1', companyKey: 'clal', questionnaireNum: '19', qKeys: ['clal_reproductive'] } }\n" +
  "    ] };\n" +
  "  },\n" +
  qTextFn + ",\n" + clalListFn + ",\n" + aliasFn + ",\n" + overlapFn + ",\n" + companyFn + ",\n" + hitsFn + ",\n" + isHealthFn + "\n}; this.api = api;",
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
const clalLetterHits = qSandbox.api._mcFollowupHitsForQuestion({}, "clal_reproductive", "ins1", ["יט"]);
assert(clalLetterHits.length === 1 && clalLetterHits[0].entry.questionnaireNum === "19", "כלל יט תואם שאלון 19 במסילה");

console.log("\n8) עורך שאלון המשך = דף השאלון בלבד, לכל החברות");
assert(app.includes("getPhoenixFollowupSchemas"), "פניקס — סכמת דף שאלון");
assert(app.includes("getClalFollowupSchemas"), "כלל — סכמת דף שאלון");
assert(app.includes("getHachsharaFollowupSchemas"), "הכשרה — סכמת דף שאלון");
assert(app.includes("getMenoraFollowupSchemas"), "מנורה — סכמת דף שאלון");
assert(app.includes("getAyalonFollowupSchemas"), "איילון — סכמת דף שאלון");
assert(app.includes("getMagdalQuestionnaireMap"), "מגדל — סכמת דף שאלון");
assert(openFollow.includes("ensureGiWizardJsLoaded"), "טוען את קטלוג השאלונים לפני העריכה");
assert(css.includes(".mcFormEd__follow{"), "עיצוב שאלות דף השאלון");
const schemaFn = extractMethod(app, "_mcFollowupWizardSchema");
const editorFn = extractMethod(app, "_mcFollowupEditorFields");
const headerFn = extractMethod(app, "_mcIsFollowupHeaderField");
const labelFn = extractMethod(app, "_mcFollowupFallbackLabel");
const storeFn = extractMethod(app, "_mcFollowupFieldStorageKey");
const valFn = extractMethod(app, "_mcFollowupFieldValue");
const healthValFn = extractMethod(app, "_mcFollowupHealthResponseValues");
const fallbackFieldsFn = extractMethod(app, "_mcFollowupFallbackFields");
const titleFn = extractMethod(app, "_mcFollowupEditorTitle");
const wizardApiFn = extractMethod(app, "_mcWizardApi");
assert(!!schemaFn && !!editorFn, "חולצו עוזרי עורך שאלון");
const fSandbox = {
  safeTrim: (v) => (v == null ? "" : String(v).trim()),
  escapeHtml: (v) => String(v == null ? "" : v),
  GI_FOLLOWUP_ZIP_CONFIG: { CLAL_LETTERS: ["א","ב","ג","ד","ה","ו","ז","ח","ט","י","יא","יב","יג","יד","טו","טז","יז","יח","יט","כ","כא","כב","כג"] },
  Wizard: {
    getPhoenixFollowupSchemas(){ return { "18": { title: "בדיקות", fields: [{ key: "testName", label: "שם הבדיקה", type: "text" }, { key: "findings", label: "ממצאים / אבחנה", type: "textarea" }] } }; },
    getClalFollowupSchemas(){ return { "יט": { title: "שאלון יט׳ — מערכת המין והרבייה", fields: [{ key: "female", label: "נשים: גוש בשד, דימומים, הריון — פרט", type: "textarea" }, { key: "male", label: "גברים: פריון, אשך טמיר — פרט", type: "textarea" }, { key: "testsTreatment", label: "בדיקות/טיפולים/ניתוחים ומצב עדכני", type: "textarea" }] } }; },
    getHachsharaFollowupSchemas(){ return { "1": { title: "אשפוזים", fields: [{ key: "reason", label: "מה הסיבה לאשפוז", type: "text" }] } }; },
    getMenoraFollowupSchemas(){ return { "4": { title: "לב", fields: [{ key: "heartDisease", label: "מחלת לב", type: "textarea" }] } }; },
    getAyalonFollowupSchemas(){ return { "32": { title: "היסטוריה משפחתית", fields: [{ key: "relative", label: "קרוב משפחה מדרגה ראשונה", type: "text" }] } }; },
    getMagdalQuestionnaireMap(){ return { "20": { title: "היסטוריה משפחתית", fields: [{ key: "relatives", label: "איזה קרוב/ים מדרגה ראשונה", type: "textarea" }] } }; }
  }
};
vm.createContext(fSandbox);
vm.runInContext(
  "const api = {\n" +
  "  _getFreshCustomerRecord(){ return { payload: {} }; },\n" +
  "  _mcHumanizePdfFieldName(n){ return n; },\n" +
  clalListFn + ",\n" + aliasFn + ",\n" + overlapFn + ",\n" + companyFn + ",\n" + wizardApiFn + ",\n" +
  schemaFn + ",\n" + editorFn + ",\n" + headerFn + ",\n" + labelFn + ",\n" + storeFn + ",\n" + valFn + ",\n" + healthValFn + ",\n" +
  fallbackFieldsFn + ",\n" + titleFn + "\n}; this.api = api;",
  fSandbox
);
function labelsOf(company, num){
  return fSandbox.api._mcFollowupEditorFields({ companyKey: company, questionnaireNum: num, insuredId: "ins1", followupData: { InsuredHight: "170", InsuredFirstName: "דנה", BusinessDMNumber: "x" } }, {}).map((f) => f.label);
}
function namesOf(company, num){
  return fSandbox.api._mcFollowupEditorFields({ companyKey: company, questionnaireNum: num, insuredId: "ins1", followupData: { InsuredHight: "170" } }, {}).map((f) => f.name);
}
const clalYt = labelsOf("clal", "יט");
assert(clalYt.length === 3 && clalYt[0].indexOf("נשים") >= 0, "כלל יט — רק שאלות דף הרבייה");
assert(clalYt.every((t) => t.indexOf("Insured") < 0 && /[\u0590-\u05FF]/.test(t)), "כלל יט — בלי שמות PDF באנגלית");
assert(labelsOf("clal", "19").some((t) => t.indexOf("נשים") >= 0), "כלל 19 ממופה לאות יט");
assert(labelsOf("phoenix", "18").some((t) => t.indexOf("שם הבדיקה") >= 0), "פניקס 18 — דף בדיקות");
assert(labelsOf("hachshara", "1").some((t) => t.indexOf("אשפוז") >= 0), "הכשרה 1 — דף אשפוזים");
assert(labelsOf("menora", "4").some((t) => t.indexOf("לב") >= 0), "מנורה 4 — דף לב");
assert(labelsOf("ayalon", "32").some((t) => t.indexOf("קרוב") >= 0), "איילון 32 — דף משפחה");
assert(labelsOf("migdal", "20").some((t) => t.indexOf("קרוב") >= 0), "מגדל 20 — דף משפחה");
assert(namesOf("clal", "יט").every((n) => n.indexOf("Insured") < 0 && n.indexOf("Business") < 0), "אין שדות כותרת בשמות השדות");
assert(fSandbox.api._mcIsFollowupHeaderField("InsuredHight") === true, "גובה PDF הוא שדה כותרת");
assert(fSandbox.api._mcIsFollowupHeaderField("BusinessDMNumber") === true, "מספר עסק הוא שדה כותרת");
assert(fSandbox.api._mcIsFollowupHeaderField("CQ6") === true, "CQ6 הוא שדה PDF ולא שאלת השאלון");
assert(fSandbox.api._mcIsFollowupHeaderField("InsurancedName") === true, "InsurancedName הוא שדה PDF");
assert(fSandbox.api._mcIsFollowupHeaderField("DetailLineCQ3") === true, "DetailLine הוא שדה PDF");
assert(fSandbox.api._mcIsFollowupHeaderField("diagnosis") === false, "אבחנה אינה שדה כותרת");
assert(!fSandbox.api._mcFollowupFallbackLabel("InsuredFirstName", ""), "אין תווית אנגלית לשם PDF");
const dumped = fSandbox.api._mcFollowupEditorFields(
  { companyKey: "clal", questionnaireNum: "יט", insuredId: "ins1", followupData: { CQ6: "x", InsurancedName: "דנה", DetailLineCQ3: "z", PIDInsuranced: "1" } },
  { html: { CQ6: "a", PIDInsuranced: "b", InsurancedName: "c" } }
);
assert(dumped.every((f) => String(f.label + f.name).indexOf("CQ") < 0 && String(f.label + f.name).indexOf("Insuranced") < 0), "כלל יט לא מציג שמות AcroForm");
const unknownDump = fSandbox.api._mcFollowupEditorFields(
  { companyKey: "unknown", questionnaireNum: "99", followupData: { CQ6: "x", InsurancedName: "y" } },
  { html: { CQ6: "a", DetailLineCQ2: "b" } }
);
assert(unknownDump.every((f) => /[\u0590-\u05FF]/.test(f.label) && !/^CQ/i.test(f.name) && String(f.label).indexOf("CQ") < 0), "בלי סכמה לא שופכים שדות PDF");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
