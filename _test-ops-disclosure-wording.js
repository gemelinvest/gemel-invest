/* GI-OPS 2026-10-12 — גילוי נאות לפי הנוסח המקורי:
   בלי דימום עמודות PDF, בלי מיזוג ניתוחים/אמבולטורי, מפתח לכל כיסוי.
   הרצה: node _test-ops-disclosure-wording.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20261007-lead-dup-v1";
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

function walkTexts(lib, visit){
  Object.keys(lib).forEach((company) => {
    const blocks = lib[company] || {};
    Object.keys(blocks).forEach((key) => {
      visit(company, key, String(blocks[key]?.text || ""), String(blocks[key]?.label || ""));
    });
  });
}

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("&giDiscTxt=1"), "index.html app.js נטען מחדש לנוסח הגילוי");
assert(sw.includes("disc-txt-v1"), "service-worker cache לנוסח הגילוי");

const lib = loadLibrary();
const api = loadMappers(lib);
const pick = (company, cover) => api.findDisclosureKeysByCoverLabel(lib[company], cover);

console.log("\n2) בלי דימום OCR / עמודות PDF");
[
  "גיל. 66",
  "OFF- LABLE",
  "מלחת הסרטן",
  "בריאות-סל הזהב",
  "תהא אכשרה של 90יום",
  "₪ 3,000,000לתקופה",
  "יש להבהיר למועמד",
  "פירוט שם הכיסוי תחום"
].forEach((frag) => {
  const hits = [];
  walkTexts(lib, (company, key, text) => {
    if(text.includes(frag)) hits.push(company + "." + key);
  });
  assert(!hits.length, "אין \"" + frag + "\"" + (hits.length ? " ב-" + hits.join(", ") : ""));
});

console.log("\n3) ניתוחים בישראל מפוצלים לפי הכיסוי שנבחר");
["הפניקס", "כלל", "מגדל", "מנורה", "הראל"].forEach((company) => {
  const c = lib[company];
  assert(!c.surgeries_israel, company + " בלי גוש ניתוחים מאוחד");
  assert(!!c.surgeries_israel_5000 && c.surgeries_israel_5000.text.includes("5,000"), company + " משלים 5,000");
  assert(!!c.surgeries_israel_none && (c.surgeries_israel_none.label.includes("ללא") || /ללא (תקרה|השתתפות)|פטור מתשלום השתתפות/.test(c.surgeries_israel_none.text)), company + " משלים ללא השתתפות");
  assert(!!c.surgeries_israel_first && (c.surgeries_israel_first.text.includes("מהשקל") || c.surgeries_israel_first.label.includes("שקל")), company + " שקל ראשון");
  assert(!c.surgeries_israel_5000.text.includes("מהשקל הראשון"), company + " 5,000 לא מכיל את נוסח השקל הראשון");
  assert(pick(company, 'משלים שב"ן עם השתתפות עצמית 5,000 ₪')[0] === "surgeries_israel_5000", company + " מיפוי 5,000");
  assert(pick(company, 'משלים שב"ן ללא השתתפות עצמית')[0] === "surgeries_israel_none", company + " מיפוי ללא השתתפות");
  assert(pick(company, "ניתוחים בישראל מהשקל הראשון")[0] === "surgeries_israel_first", company + " מיפוי שקל ראשון");
});

console.log("\n4) הנוסח המקורי של החברה נשמר");
assert(lib["הפניקס"].critical_illness.text.includes("מרפא"), "הפניקס מרפא");
assert(lib["הפניקס"].critical_illness.text.includes("47 מחלות"), "הפניקס 47 מחלות");
assert(lib["הפניקס"].cancer.text.includes("מרפא סרטן"), "הפניקס מרפא סרטן");
assert(lib["הפניקס"].meds.text.includes("3,000,000 ₪"), "הפניקס תרופות 3 מיליון");
assert(!lib["הפניקס"].surgeries_abroad.text.includes("כיסוי בישראל להוצאות"), "הפניקס ניתוחים בחו\"ל בלי דימום מישראל");
assert(lib["כלל"].meds.text.includes("תהא אכשרה של 90 יום"), "כלל אכשרה מקורית עם רווחים");
assert(lib["כלל"].critical_illness.text.includes("מדיכלל מחלות קשות 33"), "כלל מדיכלל 33");
assert(lib["כלל"].cancer.text.includes("מדיכלל פיצוי לסרטן"), "כלל פיצוי לסרטן");
assert(lib["כלל"].risk.text.includes("ספיר"), "כלל ספיר");
assert(lib["מגדל"].critical_illness.text.includes("מזור מורחב"), "מגדל מזור מורחב");
assert(lib["מגדל"].cancer.text.includes("מזור לסרטן"), "מגדל מזור לסרטן");
assert(!lib["מגדל"].meds.text.includes("מלחת"), "מגדל מחלת הסרטן מתוקן מ-OCR");
assert(lib["מנורה"].critical_illness.text.includes("קרן אור"), "מנורה קרן אור");
assert(lib["מנורה"].cancer.text.includes("____ ₪"), "מנורה סרטן עם מקום לסכום");
assert(!lib["מנורה"].transplants.text.includes("OFF LABEL"), "מנורה השתלות בלי שאריות מתרופות");
assert(!lib["מנורה"].umbrella.text.includes("יתרת ההלוואה"), "מנורה מטריה בלי נוסח משכנתא");
assert(lib["הראל"].critical_illness.text.includes("מענקית זהב"), "הראל מענקית זהב");
assert(lib["הראל"].cancer.text.includes("מענקית סרטן"), "הראל מענקית סרטן");
assert(lib["הכשרה"].meds.text.includes("OFF LABEL"), "הכשרה לא נגענו");
assert(lib["איילון"].risk.text.includes("דרור 1"), "איילון לא נגענו");

console.log("\n5) אמבולטורי וכתבי שירות לא ממזגים מוצרים");
assert(pick("הפניקס", "ייעוץ ובדיקות")[0] === "amb_consult", "הפניקס ייעוץ → amb_consult");
assert(pick("הפניקס", "אבחון מהיר")[0] === "diagnosis_fast", "הפניקס אבחון מהיר");
assert(pick("הפניקס", "התפתחות הילד")[0] === "child_dev", "הפניקס התפתחות הילד");
assert(pick("הפניקס", "מומחה בקליק")[0] === "online", "הפניקס מומחה בקליק");
assert(pick("כלל", "אבחון מהיר")[0] === "diagnosis_fast", "כלל אבחון מהיר");
assert(pick("כלל", "רופא און ליין")[0] === "online", "כלל און ליין");
assert(pick("מגדל", "אמבולטורי מורחב")[0] === "amb_extended", "מגדל אמבולטורי מורחב");
assert(pick("הראל", "ייעוץ ובדיקות מורחב")[0] === "amb_extended", "הראל ייעוץ מורחב");
assert(pick("הראל", "ביקור רופא בבית")[0] === "home", "הראל ביקור רופא בבית");
assert(!lib["הפניקס"].ambulatory.text.includes("התפתחות הילד"), "הפניקס אמבולטורי בלי התפתחות הילד");
assert(!lib["כלל"].ambulatory.text.includes("אבחון מהיר"), "כלל אמבולטורי בלי אבחון מהיר");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " assertions");
