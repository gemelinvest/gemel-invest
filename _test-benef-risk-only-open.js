/* שלב מוטבים בשיחת שיקוף:
   רק ריסק וריסק משכנתא. השאלה בראש הכרטיס.
   טופס מוטב סגור עד לחיצה על «הוסף מוטבים», באותו עיצוב של «יורשים חוקיים».
   הרצה: node _test-benef-risk-only-open.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
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

function extractObjectMethod(src, methodName){
  const needle = "\n    " + methodName + "(";
  const start = src.indexOf(needle);
  if(start < 0) return "";
  const paren = src.indexOf("(", start);
  let parenDepth = 0;
  let i = paren;
  for(; i < src.length; i += 1){
    if(src[i] === "(") parenDepth += 1;
    else if(src[i] === ")"){
      parenDepth -= 1;
      if(parenDepth === 0){ i += 1; break; }
    }
  }
  const brace = src.indexOf("{", i);
  if(brace < 0) return "";
  let depth = 0;
  for(let j = brace; j < src.length; j += 1){
    const ch = src[j];
    if(ch === "{") depth += 1;
    else if(ch === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, j + 1).trim();
    }
  }
  return "";
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "app.css"), "utf8");

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");

const names = [
  "_isBeneficiaryStepProduct",
  "_isRiskOrMortgageRiskType",
  "_benefModeForPolicy",
  "_policyHasPledge",
  "_benefEmptyRow",
  "_benefRowHasData",
  "_mcBenefFillCardHtml",
  "_onBenefOpenNamedClick",
  "_benefTargetIdsFromCard"
];
let code = "";
names.forEach((name) => {
  const src = extractObjectMethod(app, name);
  assert(!!src, "חולץ " + name);
  if(src) code += "this." + name + " = function" + src.slice(name.length) + ";\n";
});

function escapeHtml(s){
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
function safeTrim(v){ return String(v == null ? "" : v).trim(); }

const host = { escapeHtml, safeTrim, console };
vm.runInNewContext(code, host);
host._policyHasPledge = (policy) => !!(policy && (policy.pledge || policy.beneficiariesMode === "pledged"));
host._mcBenefBaseAmount = () => 0;
host._mcFmtMoney = (n) => String(n);
host._renderPledgeBankBlock = () => `<div class="mcPledgeBank">בנק משעבד</div>`;

console.log("\n2) אילו מוצרים נכנסים לשלב");
assert(host._isBeneficiaryStepProduct("ריסק") === true, "ריסק נכנס");
assert(host._isBeneficiaryStepProduct("ריסק משכנתא") === true, "ריסק משכנתא נכנס");
assert(host._isBeneficiaryStepProduct("מחלות קשות") === false, "מחלות קשות לא נכנסות");
assert(host._isBeneficiaryStepProduct("סרטן") === false, "סרטן לא נכנס");
assert(host._isBeneficiaryStepProduct("בריאות") === false, "בריאות לא נכנסת");
assert(host._benefModeForPolicy({ type: "ריסק" }) === "risk_benef", "ריסק בלי שיעבוד נשאר מוטבים");
assert(host._benefModeForPolicy({ type: "ריסק", pledge: true }) === "risk_pledge_and_bens", "ריסק עם שיעבוד נשאר משעבד ומוטבים");
assert(host._benefModeForPolicy({ type: "ריסק משכנתא" }) === "mortgage_bank", "ריסק משכנתא נשאר בנק משעבד");
assert(host._benefModeForPolicy({ type: "מחלות קשות" }) === "", "מחלות קשות בלי מצב מוטבים");
assert(host._benefModeForPolicy({ type: "סרטן" }) === "", "סרטן בלי מצב מוטבים");
assert(host._isRiskOrMortgageRiskType("ריסק") && host._isRiskOrMortgageRiskType("ריסק משכנתא"), "משעבד רק לריסק וריסק משכנתא");
assert(!host._isRiskOrMortgageRiskType("מחלות קשות"), "מחלות קשות לא מקבלות בנק משעבד");

function card(item, store){
  return host._mcBenefFillCardHtml(item, store || { policies: {} }, ["בן", "בת"]);
}
function riskItem(extra){
  return Object.assign({
    mode: "risk_benef",
    policyId: "r1",
    company: "מנורה",
    product: "ריסק",
    insuredLabel: "מבוטח ראשי · יוסף",
    policy: { id: "r1", type: "ריסק", beneficiaries: [] }
  }, extra || {});
}

console.log("\n3) שאלה ראשית, ואז הנתונים");
const closed = card(riskItem());
const askAt = closed.indexOf("מי תרצה שיהיו המוטבים למקרה מוות בפוליסה?");
const badgeAt = closed.indexOf("mcBenefCard__badge");
const titleAt = closed.indexOf("מנורה · ריסק");
assert(askAt >= 0 && badgeAt > askAt && titleAt > askAt, "השאלה לפני שם המבוטח ולפני החברה והמוצר");
assert(closed.includes("mcBenefCard__ask--lead"), "השאלה מסומנת כשאלה ראשית");
assert(css.includes(".mcBenefCard__ask--lead"), "עיצוב השאלה הראשית");

console.log("\n4) הטופס סגור עד «הוסף מוטבים»");
assert(closed.includes(">יורשים חוקיים</button>"), "לחצן יורשים חוקיים נשאר");
assert(closed.includes(">הוסף מוטבים</button>"), "לחצן הוסף מוטבים");
assert(!closed.includes("או מילוי מוטבים בשמות"), "הטקסט ליד יורשים חוקיים הוחלף בלחצן");
const heirsClass = closed.slice(closed.indexOf("יורשים חוקיים") - 80, closed.indexOf("יורשים חוקיים"));
const addClass = closed.slice(closed.indexOf("הוסף מוטבים") - 80, closed.indexOf("הוסף מוטבים"));
assert(heirsClass.includes("mcBenefCard__heirsBtn") && addClass.includes("mcBenefCard__heirsBtn"), "שני הלחצנים באותו עיצוב");
assert(!closed.includes("mcBenefRow"), "בלי לחיצה אין שדות מוטב");
assert(!closed.includes("data-mc-benef-field"), "בלי לחיצה אין שדות קלט של מוטב");
assert(riskItem().policy.beneficiaries.length === 0, "רינדור לא יוצר שורת מוטב ריקה לבד");

const opened = card(riskItem(), { policies: { r1: { namedBenefOpen: true } } });
assert(opened.includes("mcBenefRow") && opened.includes("שם פרטי"), "אחרי פתיחה מופיע טופס המוטב");
assert(opened.includes('data-mc-benef-open') && opened.includes("is-on"), "הלחצן מסומן כשטופס המוטב פתוח");
assert(opened.includes("data-mc-benef-add"), "בתוך הטופס נשאר הוספת מוטב נוסף");

const heirsOn = card(riskItem(), { policies: { r1: { legalHeirs: true, namedBenefOpen: true } } });
assert(!heirsOn.includes("mcBenefRow"), "יורשים חוקיים משאירים את טופס המוטב סגור");
assert(heirsOn.includes("נבחר «יורשים חוקיים»"), "אישור יורשים חוקיים נשאר");

const filled = riskItem();
filled.policy.beneficiaries = [{ firstName: "רות", lastName: "ישראלי", sharePct: "100" }];
const filledClosed = card(filled, { policies: {} });
assert(!filledClosed.includes("רות") && !filledClosed.includes("mcBenefRow"), "מוטב שכבר קיים לא נפתח לבד");
const filledOpen = card(filled, { policies: { r1: { namedBenefOpen: true } } });
assert(filledOpen.includes("רות") && filledOpen.includes("מוטבים שכבר מולאו באשף"), "פתיחה מציגה מוטב קיים בלי לדרוס אותו");
assert(filled.policy.beneficiaries.length === 1, "פתיחה לא מוסיפה שורה כשכבר יש מוטב");

console.log("\n5) ריסק משכנתא וריסק משועבד");
const mortgage = card({
  mode: "mortgage_bank",
  policyId: "m1",
  company: "כלל",
  product: "ריסק משכנתא",
  insuredLabel: "מבוטח ראשי",
  policy: { id: "m1", type: "ריסק משכנתא", beneficiaries: [], pledge: true }
});
const mortAsk = mortgage.indexOf("פרטי הבנק המשעבד");
assert(mortAsk >= 0 && mortgage.indexOf("mcBenefCard__badge") > mortAsk, "גם במשכנתא השאלה לפני הנתונים");
assert(!mortgage.includes("הוסף מוטבים") && !mortgage.includes("mcBenefRow"), "ריסק משכנתא נשאר מסך בנק, בלי טופס מוטב");
assert(mortgage.includes("יורשים חוקיים"), "ריסק משכנתא מקבל יורשים חוקיים");
assert(mortgage.includes("mcPledgeBank"), "בלוק הבנק המשעבד נשאר");

const pledged = card({
  mode: "risk_pledge_and_bens",
  policyId: "p1",
  company: "הפניקס",
  product: "ריסק",
  insuredLabel: "מבוטח ראשי",
  policy: { id: "p1", type: "ריסק", pledge: true, beneficiaries: [] }
});
assert(pledged.includes("הוסף מוטבים") && !pledged.includes("mcBenefRow"), "ריסק משועבד לא פותח טופס מוטב לבד");
assert(pledged.includes("mcPledgeBank"), "פרטי המשעבד נשארים גלויים");
assert(pledged.includes("יורשים חוקיים"), "ריסק משועבד מקבל יורשים חוקיים");
assert(pledged.includes("מוטבים למקרה מוות רק אם לוחצים"), "הטקסט מבקש לאמת רק את השיעבוד");
assert(!pledged.includes("וגם את המוטבים"), "הטקסט לא מחייב מוטבים כשיש שיעבוד");

console.log("\n6) לחיצה פותחת ולא מוחקת בחירה אחרת");
const policy = { id: "r1", type: "ריסק", beneficiaries: [], beneficiariesMode: "legalHeirs" };
const rec = { payload: { mirrorFlow: { beneficiariesStep: { policies: { r1: { legalHeirs: true, confirmed: true } } } } } };
let rendered = 0;
host._getFreshCustomerRecord = () => rec;
host._mirrorGetBenefStore = (row) => row.payload.mirrorFlow.beneficiariesStep;
host._findRiskPolicyById = () => ({ mode: "risk_benef", policyId: "r1", policy });
host._mcReplaceOpenBenefCard = () => { rendered += 1; return true; };
host._renderBeneficiariesBody = () => { rendered += 1; };
const btn = {
  closest(){ return { getAttribute(n){ return n === "data-mc-benef-policy" ? "r1" : ""; } }; }
};
if(typeof host._onBenefOpenNamedClick !== "function"){
  assert(false, "הלחיצה פותחת את מסך המוטב");
} else {
  host._onBenefOpenNamedClick(btn);
  assert(rec.payload.mirrorFlow.beneficiariesStep.policies.r1.namedBenefOpen === true, "הלחיצה פותחת את מסך המוטב");
  assert(rec.payload.mirrorFlow.beneficiariesStep.policies.r1.legalHeirs === false, "פתיחה מבטלת יורשים חוקיים");
  assert(rec.payload.mirrorFlow.beneficiariesStep.policies.r1.confirmed === false, "פתיחה דורשת אישור מחדש");
  assert(policy.beneficiariesMode === "named", "מצב הפוליסה עובר למוטבים בשמות");
  assert(policy.beneficiaries.length === 1, "נפתחת שורת מוטב אחת כשאין נתונים");
  assert(rendered === 1, "נרענן רק הכרטיס הפתוח");
  const before = policy.beneficiaries.length;
  host._onBenefOpenNamedClick(btn);
  assert(policy.beneficiaries.length === before && rec.payload.mirrorFlow.beneficiariesStep.policies.r1.namedBenefOpen === true, "לחיצה נוספת לא סוגרת ולא מוסיפה שורה");
}

console.log("\n7) ולידציה ושמירה לא הוחלפו");
assert(app.includes("_validateBeneficiariesStep(rec){"), "ולידציית השלב נשארה");
assert(app.includes("יש לאשר מול הלקוח יורשים חוקיים"), "אישור יורשים חוקיים נשאר");
assert(app.includes("יש למלא מוטבים לפוליסה"), "חובת מילוי מוטבים נשארה");
assert(app.includes("_persistBeneficiariesStep(rec){"), "שמירת השלב נשארה");
assert(app.includes('if(mode === "mortgage_bank")'), "מסלול בנק משעבד נשאר");
assert(app.includes('if(mode === "risk_pledge_and_bens")'), "מסלול ריסק משועבד נשאר");

console.log("\n8) ריסק משועבד לא נחסם על מוטבים עד פתיחה");
const vsrc = extractObjectMethod(app, "_validateBeneficiariesStep");
assert(!!vsrc, "חולץ _validateBeneficiariesStep");
if(vsrc){
  vm.runInNewContext("this._validateBeneficiariesStep = function" + vsrc.slice("_validateBeneficiariesStep".length) + ";", host);
}
function validatePledge(meta, beneficiaries){
  const policy = { id: "p1", type: "ריסק", pledge: true, beneficiaries: beneficiaries || [] };
  host._collectRiskBeneficiaryPolicies = () => [{
    mode: "risk_pledge_and_bens",
    policyId: "p1",
    company: "הפניקס",
    product: "ריסק",
    policy
  }];
  host._mirrorGetBenefStore = () => ({ policies: { p1: meta } });
  host._validatePledgeBank = () => ({ ok: true });
  return host._validateBeneficiariesStep({});
}
const closedOk = validatePledge({ confirmed: true }, []);
assert(closedOk.ok === true, "שיעבד מאושר בלי מוטבים ממשיך");
const closedNeedBank = validatePledge({ confirmed: false }, []);
assert(closedNeedBank.ok === false && /הבנק המשעבד/.test(closedNeedBank.message) && !/מוטבים/.test(closedNeedBank.message), "בלי אישור בנק נשארת חסימת הבנק, לא מוטבים");
const openedEmpty = validatePledge({ confirmed: true, namedBenefOpen: true }, []);
assert(openedEmpty.ok === false && /מוטבים/.test(openedEmpty.message), "אחרי הוסף מוטבים בלי מילוי נשארת חובת מוטבים");
host._collectRiskBeneficiaryPolicies = () => [{
  mode: "risk_benef",
  policyId: "r1",
  company: "מנורה",
  product: "ריסק",
  policy: { id: "r1", type: "ריסק", beneficiaries: [] }
}];
host._mirrorGetBenefStore = () => ({ policies: { r1: {} } });
const plain = host._validateBeneficiariesStep({});
assert(plain.ok === false && /מוטבים/.test(plain.message), "ריסק בלי שיעבוד עדיין דורש מוטבים");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
