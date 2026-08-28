/* GI-MIRROR 2026-08-27 — גילוי נאות: סכום פיצוי / סכום ביטוח מההצהרה
   נכנס למקום הריק בנוסח (כולל מנורה ריסק עם רווחים + .₪).
   בלי שינוי נוסח משפטי, בלי פרמיה במקום סכום ביטוח.
   הרצה: node _test-mirror-disclosure-amount.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260828-hach-quest-fill-v1";
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

function extractObjectMethod(src, methodName){
  const needle = "\n    " + methodName + "(";
  const start = src.indexOf(needle);
  if(start < 0) return "";
  const brace = src.indexOf("{", start);
  if(brace < 0) return "";
  let depth = 0;
  for(let i = brace; i < src.length; i += 1){
    const ch = src[i];
    if(ch === "{") depth += 1;
    else if(ch === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, i + 1).trim();
    }
  }
  return "";
}

const app = read("app.js");
const html = read("index.html");
const sw = read("service-worker.js");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");

console.log("\n2) חילוץ עוזרים");
const amountFn = extractObjectMethod(app, "getPolicyDisclosureAmount");
const fillFn = extractObjectMethod(app, "fillDisclosureAmountBlanks");
assert(!!amountFn, "חולץ getPolicyDisclosureAmount");
assert(!!fillFn, "חולץ fillDisclosureAmountBlanks");
assert(fillFn.includes("_{2,}") && fillFn.includes("\\s{2,}"), "מילוי תופס גם קווים וגם רווחים לפני ₪");
assert(amountFn.includes("coverageAmount"), "קורא גם coverageAmount");
assert(amountFn.includes("sumInsuredPerInsured"), "קורא סכום לפי מבוטח");
assert(!amountFn.includes("premium"), "לא לוקח פרמיה במקום סכום ביטוח");

const sandbox = {
  safeTrim(v){ return String(v == null ? "" : v).trim(); },
  CustomersUI: {
    asMoneyNumber(v){
      const n = Number(String(v == null ? "" : v).replace(/[^\d.\-]/g, ""));
      return Number.isFinite(n) ? n : 0;
    }
  }
};
vm.runInNewContext(
  "this.getPolicyDisclosureAmount = function" + amountFn.slice("getPolicyDisclosureAmount".length) + ";\n" +
  "this.fillDisclosureAmountBlanks = function" + fillFn.slice("fillDisclosureAmountBlanks".length) + ";",
  sandbox
);

console.log("\n3) מילוי סכום בנוסח");
const menoraRisk = 'בהתאם למאפייניך האישיים: גילך, עיסוקך ומצבך המשפחתי, ראינו כי סכום הביטוח המתאים עבורך למקרה מוות הינו      .₪ הפוליסה הינה עד גיל 70/80';
const filledMenora = sandbox.fillDisclosureAmountBlanks(menoraRisk, "1000000");
assert(filledMenora.includes("1,000,000") || filledMenora.includes("1000000"), "מנורה ריסק — הסכום נכנס");
assert(filledMenora.includes("₪"), "מנורה ריסק — סימן שקל נשאר");
assert(!/הינו\s{3,}\./.test(filledMenora), "מנורה ריסק — אין יותר רווח ריק לפני ₪");

const classic = sandbox.fillDisclosureAmountBlanks("סכום הביטוח המתאים עבורך למקרה מוות הינו ____ ₪.", "250000");
assert(classic.includes("250,000") || classic.includes("250000"), "____ ₪ מתמלא");

const bank = sandbox.fillDisclosureAmountBlanks("המוטב הבלתי חוזר הוא בנק ____ סניף מספר ____.", "1000000");
assert(bank.includes("בנק ____"), "לא ממלאים קווי בנק בלי ₪");

const noAmount = sandbox.fillDisclosureAmountBlanks(menoraRisk, "");
assert(noAmount === menoraRisk, "בלי סכום בהצהרה — הנוסח לא משתנה");

console.log("\n4) מקור הסכום מההצהרה");
assert(sandbox.getPolicyDisclosureAmount({ type: "ריסק", sumInsured: "800000" }) === "800000", "ריסק מ-sumInsured");
assert(sandbox.getPolicyDisclosureAmount({ type: "מחלות קשות", compensation: "150000" }) === "150000", "מחלות קשות מ-compensation");
assert(sandbox.getPolicyDisclosureAmount({ type: "ריסק", coverageAmount: "900000" }) === "900000", "coverageAmount");
assert(sandbox.getPolicyDisclosureAmount({ type: "ריסק", sumInsuredPerInsured: { a: "300000", b: "200000" } }) === "500000", "סכום לפי מבוטחים מסוכם");
assert(sandbox.getPolicyDisclosureAmount({ type: "ריסק", premiumValue: "320", monthlyPremium: "320" }) === "", "פרמיה לא הופכת לסכום ביטוח");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
