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
const pledgeFn = extractObjectMethod(app, "fillDisclosurePledgeBlanks");
assert(!!amountFn, "חולץ getPolicyDisclosureAmount");
assert(!!fillFn, "חולץ fillDisclosureAmountBlanks");
assert(!!pledgeFn, "חולץ fillDisclosurePledgeBlanks");
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
  "this.fillDisclosureAmountBlanks = function" + fillFn.slice("fillDisclosureAmountBlanks".length) + ";\n" +
  "this.fillDisclosurePledgeBlanks = function" + pledgeFn.slice("fillDisclosurePledgeBlanks".length) + ";",
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

console.log("\n3b) פרטי בנק משעבד בגילוי נאות");
const mortgageLine = "המוטב הבלתי חוזר הוא בנק ____ סניף מספר ____ כתובת הסניף ____. יתרת ההלוואה היא ____ ₪ לתקופה של ____ שנים עם ריבית קבועה/משתנה של ____%.";
const pledge = { pledge: true, bankName: "לאומי", bankNo: "10", branch: "632", address: "הרצל 4 תל אביב", years: "20", amount: "850000" };
const pledged = sandbox.fillDisclosurePledgeBlanks(mortgageLine, pledge);
assert(pledged.includes("בנק לאומי מס׳ 10"), "שם הבנק ומספרו נכנסים");
assert(pledged.includes("סניף מספר 632"), "מספר הסניף נכנס");
assert(pledged.includes("כתובת הסניף הרצל 4 תל אביב"), "כתובת הסניף נכנסת");
assert(pledged.includes("לתקופה של 20 שנים"), "תקופת השיעבוד נכנסת");
assert(/יתרת ההלוואה היא [\d,]+ ₪/.test(pledged), "יתרת ההלוואה נכנסת ליד ₪");
assert(pledged.includes("____%"), "אחוז הריבית נשאר ריק");
const spaced = sandbox.fillDisclosurePledgeBlanks("המוטב הבלתי חוזר הוא בנק    סניף מספר    כתובת הסניף     . יתרת ההלוואה היא   ₪ לתקופה של    שנים", pledge);
assert(spaced.includes("בנק לאומי"), "רווחים במקום קווים מתמלאים");
const broken = sandbox.fillDisclosurePledgeBlanks("בנק _____ סניף מספר __ _ כתובת הסניף", pledge);
assert(broken.includes("סניף מספר 632"), "קווים עם רווח באמצע מתמלאים");
const idle = sandbox.fillDisclosurePledgeBlanks(mortgageLine, { pledge: false });
assert(idle === mortgageLine, "בלי פרטי בנק שמורים הנוסח לא משתנה");
const savedWithoutFlag = sandbox.fillDisclosurePledgeBlanks(mortgageLine, {
  pledge: false, bankName: "לאומי", branch: "632", years: "20", amount: "850000", interestType: "fixed"
});
assert(savedWithoutFlag.includes("בנק לאומי"), "פרטי בנק שמורים מתמלאים גם בלי דגל שיעבוד");
assert(savedWithoutFlag.includes("ריבית קבועה"), "סוג הריבית הקבועה נכנס");
assert(!savedWithoutFlag.includes("קבועה/משתנה"), "הניסוח הכפול הוחלף");
assert(savedWithoutFlag.includes("____%"), "אחוז הריבית נשאר ריק");
const variable = sandbox.fillDisclosurePledgeBlanks(mortgageLine, { interestType: "variable", bankName: "דיסקונט" });
assert(variable.includes("ריבית משתנה") && variable.includes("____%"), "ריבית משתנה בלי אחוז מומצא");
const apt = 'כתובת הדירה ______,בית פרטי /קומה ____ מתוך __.גודל הדירה ___מ"ר.';
const aptFilled = sandbox.fillDisclosurePledgeBlanks(apt, pledge);
assert(aptFilled.includes("כתובת הדירה ______") && aptFilled.includes("קומה ____") && aptFilled.includes('מ"ר'), "שורות הדירה נשארות ריקות");
const amountAfter = sandbox.fillDisclosureAmountBlanks(pledged, "1000000");
assert(amountAfter.includes("בנק לאומי"), "מילוי הסכום לא מוחק את שם הבנק");

console.log("\n3c) סוג הריבית עובר מהפוליסה להקראה");
const resolveFn = extractObjectMethod(app, "resolvePledge");
assert(!!resolveFn && resolveFn.includes("interestType"), "resolvePledge מחזיר סוג ריבית");
sandbox.fmtMoneyPlain = function(v){
  const n = Number(String(v == null ? "" : v).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? String(Math.round(n)) : "";
};
sandbox.Wizard = {
  normalizeInterestType(value){
    const s = String(value == null ? "" : value).trim().toLowerCase();
    if(s === "fixed" || s === "קבועה") return "fixed";
    if(s === "variable" || s === "משתנה") return "variable";
    return "";
  },
  normalizePledgeBanks(target){
    const list = Array.isArray(target && target.pledgeBanks) ? target.pledgeBanks : [];
    return list.map((b) => Object.assign({
      bankName: "", bankNo: "", branch: "", amount: "", years: "", address: "", interestType: ""
    }, b || {}));
  }
};
vm.runInNewContext(
  "this.resolvePledge = function" + resolveFn.slice("resolvePledge".length) + ";",
  sandbox
);
const resolved = sandbox.resolvePledge({
  pledge: true,
  pledgeBanks: [{ bankName: "הפועלים", branch: "12", address: "הרצל 1", amount: "1030000", years: "25", interestType: "variable" }]
});
assert(resolved.interestType === "variable", "סוג הריבית מהבנק נשמר");
assert(resolved.bankName === "הפועלים" && resolved.years === "25", "שאר שדות הבנק נשמרים");
const readAloud = sandbox.fillDisclosurePledgeBlanks(mortgageLine, resolved);
assert(readAloud.includes("בנק הפועלים") && readAloud.includes("ריבית משתנה") && readAloud.includes("____%"), "ההקראה מתמלאת בלי להמציא אחוז");
const emptyPledge = sandbox.resolvePledge({ pledge: false, pledgeBanks: [{}] });
assert(!emptyPledge.bankName && !emptyPledge.interestType, "בלי נתונים שמורים לא מומצא בנק");

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
