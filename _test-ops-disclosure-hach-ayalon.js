/* GI-OPS 2026-08-27 — גילוי נאות הכשרה+איילון יוני 2026:
   נוסח לכל כיסוי, בלי הפניית הכשרה לכלל/איילון, קפצים להקראה.
   הרצה: node _test-ops-disclosure-hach-ayalon.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260827-mirror-disc-amount-v1";
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
const css = read("app.css");
const sw = read("service-worker.js");

function loadLibrary(){
  const start = app.indexOf("const MIRROR_DISCLOSURE_LIBRARY = {");
  const end = app.indexOf("\n  const ProcessesUI", start);
  if(start < 0 || end < 0) throw new Error("library slice missing");
  const sandbox = {};
  vm.runInNewContext(app.slice(start, end) + "\nthis.LIB = MIRROR_DISCLOSURE_LIBRARY;", sandbox);
  return sandbox.LIB;
}

function loadMappers(lib){
  const normStart = app.indexOf("normalizeDisclosureKey(value){");
  const mapEnd = app.indexOf("\n    getHealthCoverList(obj){", normStart);
  const findStart = app.indexOf("findDisclosureKeysByCoverLabel(companyLib, cover){");
  const findEnd = app.indexOf("\n    getDisclosureKeysForPolicy(policy){", findStart);
  const libStart = app.indexOf("resolveDisclosureLibraryCompany(company){");
  const libEnd = app.indexOf("\n    findDisclosureKeysByCoverLabel(companyLib, cover){", libStart);
  const resStart = app.indexOf("resolveDisclosureCompany(company, _policy){");
  const resEnd = app.indexOf("\n    /** סכום פיצוי", resStart);
  const code = `
    const safeTrim = (v) => String(v == null ? "" : v).trim();
    const MIRROR_DISCLOSURE_LIBRARY = LIB;
    const api = {
      ${app.slice(normStart, mapEnd)}
      ${app.slice(findStart, findEnd)}
      ${app.slice(libStart, libEnd)}
      ${app.slice(resStart, resEnd)}
    };
    this.api = api;
  `;
  const sandbox = { LIB: lib };
  vm.runInNewContext(code, sandbox);
  return sandbox.api;
}

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-ops-disclosure-hach-ayalon.js")]).status === 0, "node --check this test");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + APP_TAG), "index.html app.css cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");

const lib = loadLibrary();
const api = loadMappers(lib);
const hach = lib["הכשרה"];
const ayalon = lib["איילון"];
const clal = lib["כלל"];
const phoenix = lib["הפניקס"];

console.log("\n2) נוסחי יוני 2026 לפי מוצר — הכשרה");
assert(!!hach && !!hach.meds, "הכשרה כוללת תרופות");
assert(hach.meds.text.includes("3,000,000"), "הכשרה תרופות עד 3 מיליון");
assert(hach.meds.text.includes("OFF LABEL"), "הכשרה תרופות OFF LABEL");
assert(hach.transplants.text.includes("5,000,000"), "הכשרה השתלות תקרה מתורם");
assert(hach.surgeries_abroad.text.includes("מחוץ לישראל"), "הכשרה ניתוחים בחו״ל");
assert(hach.surgeries_israel_5000.text.includes("5,000 ₪"), "הכשרה משלים עם 5,000");
assert(hach.surgeries_israel_none.text.includes("ללא השתתפות עצמית"), "הכשרה משלים ללא השתתפות");
assert(hach.surgeries_israel_first.text.includes("מהשקל הראשון"), "הכשרה מהשקל הראשון");
assert(hach.surgeries_israel_5000.text.includes("פוליסת הבריאות הבסיסית אינה כוללת"), "הערת ניתוחים בישראל במשלים 5,000");
assert(!hach.surgeries_israel, "הכשרה בלי גוש ניתוחים מאוחד");
assert(hach.amb_consult.text.includes("עד 5 התייעצויות"), "הכשרה ייעוץ ובדיקות");
assert(hach.premium_child.text.includes("עד גיל 25"), "הכשרה פרימיום לילד");
assert(hach.critical_illness.text.includes("49 מחלות"), "הכשרה מגן 49 מחלות");
assert(hach.critical_illness.text.includes("____ ₪"), "הכשרה מחלות קשות עם מקום לסכום");
assert(hach.risk.text.includes("מגן 1"), "הכשרה ריסק מגן 1");
assert(hach.mortgage.text.includes("מגן למשכנתא"), "הכשרה משכנתא מגן למשכנתא");
assert(hach.mortgage.text.includes("____ ₪"), "הכשרה משכנתא עם מקום ליתרת הלוואה");

console.log("\n3) נוסחי יוני 2026 לפי מוצר — איילון");
assert(ayalon.meds.text.includes("300 ₪ למרשם"), "איילון תרופות השתתפות עצמית");
assert(ayalon.transplants.text.includes("קצבה חודשית למועמד להשתלה"), "איילון השתלות");
assert(ayalon.surgeries_israel_5000.text.includes("בניגוד לרוב חברות הביטוח"), "איילון משלים 5,000 — מנתח לא בהסדר");
assert(ayalon.surgeries_israel_none.text.includes("ללא השתתפות עצמית"), "איילון משלים ללא");
assert(ayalon.surgeries_israel_first.text.includes("365 ימים"), "איילון שקל ראשון הריון/לידה");
assert(ayalon.amb_consult.text.includes("11,000 ₪"), "איילון אמבולטורי ייעוץ תקרה");
assert(ayalon.amb_extended.text.includes("21,983 ₪"), "איילון אמבולטורי מורחב תקרה");
assert(ayalon.amb_treatments.text.includes("טיפולים פרא"), "איילון אמבולטורי טיפולים");
assert(ayalon.alt_medicine.text.includes("20 טיפולים"), "איילון רפואה משלימה 20 טיפולים");
assert(ayalon.sport.text.includes("איילון ספורטיבי"), "איילון ספורטיבי");
assert(ayalon.home.text.includes("איילון עד הבית"), "איילון עד הבית");
assert(ayalon.critical_illness.text.includes("38 המחלות"), "איילון בשביל החוסן 38 מחלות");
assert(ayalon.cancer.text.includes("בשביל החוסן סרטן"), "איילון סרטן");
assert(ayalon.risk.text.includes("דרור 1"), "איילון דרור 1");
assert(ayalon.disability_income.text.includes("תשוחרר הפוליסה מתשלום הפרמיה"), "איילון אכ\"ע שחרור");
assert(ayalon.diagnosis_fast.text.includes("45 ימים"), "איילון אבחון מהיר נשאר לכיסוי שלא בקובץ החדש");
assert(ayalon.bargafen.text.includes("בר גפן"), "איילון בר גפן נשאר");
assert(ayalon.online.text.includes("אונליין"), "איילון אונליין נשאר");

console.log("\n4) חברות אחרות לא הוחלפו");
assert(clal.meds.text.includes("תהא אכשרה של 90יום") || clal.meds.text.includes("תרופות שאינן בסל"), "כלל תרופות נשאר");
assert(phoenix.critical_illness.text.includes("מרפא"), "הפניקס מחלות קשות נשאר");
assert(clal.surgeries_israel && clal.surgeries_israel.text.length > 80, "כלל עדיין עם גוש ניתוחים מאוחד");
assert(!clal.surgeries_israel_5000, "כלל בלי מפתח 5,000 החדש");

console.log("\n5) מיפוי כיסוי → מפתח לפי חברה");
const pick = (company, cover) => api.findDisclosureKeysByCoverLabel(lib[company], cover);
assert(pick("הכשרה", 'משלים שב"ן עם השתתפות עצמית 5,000 ₪')[0] === "surgeries_israel_5000", "הכשרה 5,000 → מפתח ייעודי");
assert(pick("הכשרה", 'משלים שב"ן ללא השתתפות עצמית')[0] === "surgeries_israel_none", "הכשרה ללא השתתפות → ייעודי");
assert(pick("הכשרה", "ניתוחים בישראל מהשקל הראשון")[0] === "surgeries_israel_first", "הכשרה שקל ראשון → ייעודי");
assert(pick("הכשרה", "ייעוץ ובדיקות")[0] === "amb_consult", "הכשרה ייעוץ ובדיקות");
assert(pick("הכשרה", "שירות פרימיום לילד")[0] === "premium_child", "הכשרה פרימיום לילד");
assert(pick("הכשרה", "תרופות מחוץ לסל שירותי הבריאות")[0] === "meds", "הכשרה תרופות");
assert(pick("איילון", "אמבולטורי מורחב")[0] === "amb_extended", "איילון מורחב");
assert(pick("איילון", "טיפולים אמבולטוריים")[0] === "amb_treatments", "איילון טיפולים אמבולטוריים");
assert(pick("איילון", "איילון ספורטיבי")[0] === "sport", "איילון ספורטיבי מפתח");
assert(pick("איילון", "איילון עד הבית")[0] === "home", "איילון עד הבית מפתח");
assert(pick("איילון", 'משלים שב"ן')[0] === "surgeries_israel_none", "איילון משלים שב״ן ברירת מחדל = ללא השתתפות");
assert(pick("כלל", 'משלים שב"ן עם השתתפות עצמית 5,000 ₪')[0] === "surgeries_israel", "כלל נופל לגוש המאוחד");
assert(pick("כלל", "ייעוץ ובדיקות")[0] === "ambulatory", "כלל ייעוץ נופל לאמבולטורי המאוחד");
assert(pick("הכשרה", "אבחון רפואי מהיר").length === 0, "הכשרה אבחון מהיר בלי נוסח — לא ממציאים");
assert(pick("איילון", "טכנולוגיות מתקדמות ואביזרים רפואיים").length === 0, "איילון טכנולוגיות בלי נוסח — לא נדבק לייעוץ ובדיקות");

console.log("\n6) בלי הפניית הכשרה לחברה אחרת");
assert(api.resolveDisclosureCompany("הכשרה", { type: "בריאות" }) === "הכשרה", "בריאות הכשרה נשארת הכשרה");
assert(api.resolveDisclosureCompany("הכשרה", { type: "ריסק" }) === "הכשרה", "ריסק הכשרה נשאר הכשרה");
assert(api.resolveDisclosureCompany("הכשרה", { type: "ריסק משכנתא" }) === "הכשרה", "משכנתא הכשרה נשארת הכשרה");
assert(api.resolveDisclosureCompany("הכשרה", { type: "מחלות קשות" }) === "הכשרה", "מחלות קשות הכשרה");
assert(!app.includes("בריאות → כלל"), "הוסר התיעוד של הפניית בריאות לכלל");
assert(api.resolveDisclosureCompany("איילון", { type: "בריאות" }) === "איילון", "איילון לא זזה");
assert(api.resolveDisclosureCompany("כלל", { type: "בריאות" }) === "כלל", "כלל לא זזה");

console.log("\n7) קפצים להקראה רק לכיסוי שנבחר");
assert(app.includes("_mcDiscCardHtml(item){"), "עוזר כרטיס גילוי משותף");
assert(app.includes('<details class="mcDiscCard"'), "כרטיס גילוי הוא details");
assert(app.includes('class="mcDiscCard__summary"'), "summary לפתיחה");
assert(!/_renderStep6DisclosureBody[\s\S]{0,2500}<article class="mcDiscCard"/.test(app), "שלב הגילוי בשיחה לא מציג כרטיס פתוח תמיד");
assert(app.includes("פתח רק את הכיסויים שנבחרו במוצרים והקרא ללקוח"), "הנחיית הקראה לנציג");
assert(css.includes(".mcDiscCard__summary"), "עיצוב קפץ");
assert(css.includes(".mcDiscCard__chev"), "חץ פתיחה");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " assertions");
