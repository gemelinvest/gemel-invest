/* GI-OPS — שלב 5: פרמיה אחרי הנחה יושבת צמוד ליד פרמיה לפני הנחה.
   בכרטיס המוצע ובשורת הכיסוי, בלי למתוח אותן לקצוות.
   הרצה: node _test-ops-mirror-premia-beside.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
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

function sliceBetween(src, startMark, endMark){
  const start = src.indexOf(startMark);
  const end = src.indexOf(endMark, start + startMark.length);
  if(start < 0 || end < 0 || end <= start) return "";
  return src.slice(start, end);
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "app.css"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + APP_TAG), "index.html app.css cache");
assert(html.includes("giMcPremBeside=1"), "cache bump for adjacent premiums");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");
assert(sw.includes("mc-prem-beside-v1"), "service-worker premium-beside bump");

console.log("\n2) כרטיס מוצע — לפני ואחרי צמודים");
const premia = sliceBetween(css, ".mcOfferCard__premia{", ".mcOfferCard__fact{");
assert(premia.includes("display:flex"), "שורת הפרמיה flex");
assert(premia.includes("justify-content:flex-start"), "לא מתוחה לקצוות הכרטיס");
assert(!premia.includes("1fr) minmax(0,1fr)"), "בלי שתי עמודות שוות שמרחיקות את הסכומים");
assert(!premia.includes("auto-fit"), "בלי auto-fit");
const premFact = sliceBetween(css, ".mcOfferCard__premia .mcOfferCard__fact{", ".mcOfferCard__fact span{");
assert(premFact.includes("flex:0 0 auto"), "כל סכום תופס רק את רוחבו");

console.log("\n3) שורת כיסוי — אחרי הנחה ליד לפני הנחה");
const coverHtml = sliceBetween(app, "_mcHealthCoverDiscountHtml(rec, p){", "_mcHealthCoverPremiumLines(rec, p){");
assert(coverHtml.includes("mcCoverDisc__pays"), "לפני ואחרי עטופים יחד");
assert(coverHtml.includes("לפני הנחה") && coverHtml.includes("אחרי הנחה"), "שתי התוויות נשארו");
const pays = sliceBetween(css, ".mcCoverDisc__pays{", ".mcCoverDisc__pay{");
assert(pays.includes("display:inline-flex"), "זוג הפרמיות בשורה");
assert(pays.includes("flex:none"), "הזוג לא נדחף לקצה");
const row = sliceBetween(css, ".mcCoverDisc__row{", ".mcCoverDisc__name{");
assert(row.includes("display:flex"), "שורת הכיסוי flex");
assert(row.includes("justify-content:flex-start"), "הסכומים צמודים לשם הכיסוי");
assert(!row.includes("1.4fr"), "בלי עמודה רחבה שמפרידה שם מסכומים");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
