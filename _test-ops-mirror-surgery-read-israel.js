/* GI-OPS — לחצן «להקראה ללקוח» בשלב 5 רק לכיסוי ניתוחים בישראל.
   ניתוחים בחו״ל / מחוץ לישראל לא מקבלים נוסח הקראה.
   הרצה: node _test-ops-mirror-surgery-read-israel.js
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

function sliceMethod(src, signature){
  const start = src.indexOf(signature);
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

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "app.css"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("giMcSurgIL=1"), "cache bump for Israel-only surgery read");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");
assert(sw.includes("mc-surg-il-v1"), "service-worker surgery-read bump");

console.log("\n2) זיהוי כיסוי — בארץ כן, בחו״ל לא");
function safeTrim(v){ return String(v == null ? "" : v).trim(); }
const box = { safeTrim, console, MirrorsUI: { getHealthCoverList(){ return []; } } };
box.ui = {};
vm.createContext(box);
vm.runInContext(
  "ui._mcIsAbroadSurgeryLabel = function " + sliceMethod(app, "_mcIsAbroadSurgeryLabel(label){").replace("_mcIsAbroadSurgeryLabel", "") + ";\n" +
  "ui._mcIsIsraelSurgeryLabel = function " + sliceMethod(app, "_mcIsIsraelSurgeryLabel(label){").replace("_mcIsIsraelSurgeryLabel", "") + ";\n" +
  "ui._mcIsIsraelSurgeryOptionName = function " + sliceMethod(app, "_mcIsIsraelSurgeryOptionName(label){").replace("_mcIsIsraelSurgeryOptionName", "") + ";\n" +
  "ui._mcPolicyCoverLabels = function " + sliceMethod(app, "_mcPolicyCoverLabels(policy){").replace("_mcPolicyCoverLabels", "") + ";\n" +
  "ui._mcPolicyHasIsraelSurgery = function " + sliceMethod(app, "_mcPolicyHasIsraelSurgery(policy){").replace("_mcPolicyHasIsraelSurgery", "") + ";\n" +
  "ui._mcCoverNeedsSurgeryRead = function " + sliceMethod(app, "_mcCoverNeedsSurgeryRead(policy, name){").replace("_mcCoverNeedsSurgeryRead", "") + ";",
  box
);

const israelPolicy = { type: "בריאות", healthCovers: ["ניתוחים בישראל"] };
const abroadPolicy = { type: "בריאות", healthCovers: ["ניתוחים וטיפולים מחליפי ניתוח מחוץ לישראל"] };
const mixedPolicy = { type: "בריאות", healthCovers: ["ניתוחים בישראל", "ניתוחים בחו״ל"] };

assert(box.ui._mcIsIsraelSurgeryLabel("ניתוחים בישראל") === true, "ניתוחים בישראל = כיסוי בארץ");
assert(box.ui._mcIsIsraelSurgeryLabel("ניתוחים בארץ") === true, "ניתוחים בארץ = כיסוי בארץ");
assert(box.ui._mcIsAbroadSurgeryLabel("ניתוחים בחו״ל") === true, "ניתוחים בחו״ל = חו״ל");
assert(box.ui._mcIsAbroadSurgeryLabel("ניתוחים וטיפולים מחליפי ניתוח מחוץ לישראל") === true, "מחוץ לישראל = חו״ל גם כשיש המילה ישראל");
assert(box.ui._mcIsIsraelSurgeryLabel("ניתוחים וטיפולים מחליפי ניתוח מחוץ לישראל") === false, "מחוץ לישראל אינו ניתוח בארץ");
assert(box.ui._mcIsIsraelSurgeryLabel("ניתוחים בחו״ל") === false, "בחו״ל אינו ניתוח בארץ");
assert(box.ui._mcCoverNeedsSurgeryRead(israelPolicy, "ניתוחים בישראל") === true, "לחצן הקראה על ניתוחים בישראל");
assert(box.ui._mcCoverNeedsSurgeryRead(abroadPolicy, "ניתוחים וטיפולים מחליפי ניתוח מחוץ לישראל") === false, "אין לחצן על ניתוחים מחוץ לישראל");
assert(box.ui._mcCoverNeedsSurgeryRead(abroadPolicy, "ניתוחים בחו״ל") === false, "אין לחצן על ניתוחים בחו״ל");
assert(box.ui._mcCoverNeedsSurgeryRead(mixedPolicy, "ניתוחים בחו״ל") === false, "בפוליסה מעורבת אין לחצן על שורת חו״ל");
assert(box.ui._mcCoverNeedsSurgeryRead(mixedPolicy, "ניתוחים בישראל") === true, "בפוליסה מעורבת יש לחצן רק על שורת ישראל");
assert(box.ui._mcCoverNeedsSurgeryRead(israelPolicy, "תרופות מחוץ לסל שירותי הבריאות") === false, "תרופות בלי לחצן הקראה");
assert(box.ui._mcPolicyHasIsraelSurgery(abroadPolicy) === false, "פוליסה עם ניתוח בחו״ל בלבד לא דורשת הקראת ישראל");
assert(box.ui._mcPolicyHasIsraelSurgery(israelPolicy) === true, "פוליסה עם ניתוח בישראל דורשת הקראה");
assert(box.ui._mcCoverNeedsSurgeryRead(israelPolicy, "משלים שבן ללא השתתפות עצמית") === true, "משלים שב״ן נשאר עם לחצן כשיש ניתוח בארץ");
assert(box.ui._mcCoverNeedsSurgeryRead(abroadPolicy, "משלים שבן ללא השתתפות עצמית") === false, "משלים שב״ן בלי ניתוח בארץ לא מקבל לחצן");
const optionPolicy = { type: "בריאות", healthCovers: ["משלים שבן ללא השתתפות עצמית"] };
assert(box.ui._mcCoverNeedsSurgeryRead(optionPolicy, "משלים שבן ללא השתתפות עצמית") === true, "כיסוי שהוזן כמשלים שב״ן מקבל לחצן");
assert(box.ui._mcCoverNeedsSurgeryRead(optionPolicy, "ניתוחים מהשקל הראשון") === true, "ניתוחים מהשקל הראשון מקבל לחצן");
assert(box.ui._mcCoverNeedsSurgeryRead({ type: "בריאות", healthCovers: ["ניתוחים משלים שבן עם השתתפות עצמית"] }, "ניתוחים משלים שבן עם השתתפות עצמית") === true, "משלים שב״ן עם השתתפות מקבל לחצן");
assert(app.includes("נוסח ניתוחים להקראה"), "טקסט הלחצן הוא נוסח ניתוחים להקראה");

console.log("\n3) הציור עדיין נשען על הבדיקה");
assert(app.includes("this._mcCoverNeedsSurgeryRead(p, r.name) ? this._mcIsraelSurgeryReadHtml(p, r.name) : \"\""), "הלחצן מצויר רק אחרי בדיקת הכיסוי");
const coverRow = app.slice(app.indexOf('return `<div class="mcCoverDisc__row">`'), app.indexOf("_mcHealthCoverPremiumLines(rec, p){"));
assert(coverRow.indexOf("mcCoverDisc__name") < coverRow.indexOf("mcCoverDisc__pays") && coverRow.indexOf("mcCoverDisc__pays") < coverRow.indexOf("_mcIsraelSurgeryReadHtml"), "הלחצן אחרי פרמיית לפני ואחרי");
assert(!coverRow.includes("mcCoverDisc__name\">${nameHtml}${this._mcCoverNeedsSurgeryRead"), "הלחצן לא יושב בתוך שם הכיסוי");
assert(css.includes(".mcCoverDisc__row > .mcCoverDisc__read{margin-inline-start:auto;}"), "הלחצן נצמד לצד שמאל");
assert(app.includes("_mcIsAbroadSurgeryLabel(label){"), "עזר זיהוי חו״ל");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
