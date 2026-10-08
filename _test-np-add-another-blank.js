/* הוספת פוליסה נוספת: טופס ריק, והפוליסה שכבר בהצעה לא משתנה.
   הרצה: node _test-np-add-another-blank.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

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

function safeTrim(v){
  return String(v == null ? "" : v).trim();
}

const wiz = fs.readFileSync(path.join(ROOT, "gi-wizard.js"), "utf8");
assert(wiz.includes("beginAnotherNewPolicy(){"), "מתחילים פוליסה נוספת בפונקציה נפרדת");
assert(wiz.includes("on(addMoreBtn, 'click', () => this.beginAnotherNewPolicy())"), "הכפתור קורא להתחלה נקייה");
assert(!wiz.includes("this.editingPolicyId = existingRow.id"), "הוספה חדשה לא הופכת לעריכה של שורה קיימת");
assert(wiz.includes("this._npSimStateBag = {}"), "סשן הסימולטור נמחק לפני הפוליסה הבאה");

const host = new Proxy({
  Wizard: {},
  safeTrim,
  escapeHtml: (s) => String(s == null ? "" : s),
  on(){}, $(){ return null; }, $$(){ return []; },
  nowISO: () => "2026-10-08T08:00:00.000Z",
  RiskSimulators: {
    hasCatalog(){ return true; },
    getHandler(){ return { open(){}, close(){} }; }
  }
}, {
  get(target, prop){
    if(prop in target) return target[prop];
    if(prop === "then") return undefined;
    return () => {};
  }
});

const sandbox = {
  __GI_WIZARD_HOST: host,
  console,
  Auth: { current: { name: "נציג בדיקה", role: "agent", id: "agent-1" } },
  window: { requestAnimationFrame(fn){ fn(); }, setTimeout(fn){ return fn(); }, clearTimeout(){}, showToast(){} },
  document: {
    getElementById(){ return null; },
    createElement(){ return { classList:{ add(){}, remove(){}, contains(){ return false; } }, appendChild(){}, querySelector(){ return null; }, querySelectorAll(){ return []; } }; },
    querySelectorAll(){ return []; },
    querySelector(){ return null; },
    addEventListener(){}, removeEventListener(){},
    body: { appendChild(){}, querySelector(){ return null; } }
  }
};
sandbox.globalThis = sandbox;
sandbox.window.document = sandbox.document;

vm.runInNewContext(wiz, sandbox, { filename: "gi-wizard.js" });
const W = host.Wizard;
assert(typeof W.beginAnotherNewPolicy === "function", "Wizard נטען");
assert(typeof W.purchaseSimulatorInsured === "function", "הוספה מהסימולטור נטענה");

W.render = () => {};
W.isOpen = true;
W.step = 5;
W.isElementaryFlow = () => false;
W.isMedicareCompany = () => false;
W.isCustomerPurchaseMode = () => false;
W.insureds = [
  { id:"i1", type:"primary", label:"אריאל כהן", data:{ firstName:"אריאל", lastName:"כהן" } }
];
W.newPolicies = [];
W.editingPolicyId = null;
W.policyDraft = null;
W._npSimStateBag = {
  i1: { "כלל::סרטן": { sumInsured:"", compensation:"100000", result:{ ok:true, monthlyPremium:258.75 } } }
};
W._npSimDiscountBag = {
  i1: { "כלל::סרטן": { optionId:"clal-c-40", monthlyAfterDiscount:155.25 } }
};
W.ensurePolicyDraft();
W.policyDraft.company = "כלל";
W.policyDraft.type = "סרטן";

const firstId = W.purchaseSimulatorInsured("i1", {
  ok:true, monthlyPremium:258.75, compensation:"100000",
  simDiscount:{ optionId:"clal-c-40", monthlyAfterDiscount:155.25 }
}, null, { skipToast:true, skipRender:true });
const first = (W.newPolicies || []).find((p) => p.id === firstId);
assert(!!first, "הפוליסה הראשונה נשמרה");
const before = JSON.parse(JSON.stringify(first));

W._npSimStateBag = {
  i1: { "כלל::סרטן": { compensation:"100000", result:{ ok:true, monthlyPremium:258.75 } } }
};
W.beginAnotherNewPolicy();
assert(W.editingPolicyId == null, "אחרי הוספה נוספת לא נשארים במצב עריכה");
assert(safeTrim(W.policyDraft.company) === "" && safeTrim(W.policyDraft.type) === "", "חברה ומוצר ריקים עד הבחירה");
assert(!W.policyDraft.sumInsured && !W.policyDraft.premiumMonthly, "שדות הסכום והפרמיה ריקים");
assert(!W._npSimStateBag || !Object.keys(W._npSimStateBag).length, "מצב הסימולטור הקודם נמחק");
const restored = W.buildNpSimRestoreState("כלל", "סרטן", W.buildSimulatorRestoreState(W.policyDraft));
assert(!restored, "בחירת אותה חברה ומוצר לא משחזרת את הפוליסה הקודמת");

W.policyDraft.company = "כלל";
W.policyDraft.type = "סרטן";
const secondId = W.purchaseSimulatorInsured("i1", {
  ok:true, monthlyPremium:90, compensation:"50000",
  simDiscount:{ optionId:"clal-c-20", monthlyAfterDiscount:72 }
}, null, { skipToast:true, skipRender:true });
assert(secondId && secondId !== firstId, "הפוליסה השנייה מקבלת מזהה חדש");
assert((W.newPolicies || []).length === 2, "יש שתי פוליסות בהצעה");
const still = (W.newPolicies || []).find((p) => p.id === firstId);
assert(still && still.company === before.company && still.type === before.type, "חברה ומוצר של הראשונה לא השתנו");
assert(Number(still.premiumPerInsured.i1) === Number(before.premiumPerInsured.i1), "הפרמיה של הראשונה לא השתנתה");
assert(still.simDiscountPerInsured.i1.monthlyAfterDiscount === before.simDiscountPerInsured.i1.monthlyAfterDiscount, "הסכום אחרי הנחה של הראשונה לא השתנה");
const added = (W.newPolicies || []).find((p) => p.id === secondId);
assert(added && Number(added.premiumPerInsured.i1) === 90, "הפוליסה החדשה נשמרת עם הנתונים שמילאו");

W.editingPolicyId = firstId;
W.policyDraft = null;
W.ensurePolicyDraft();
W.policyDraft.company = "כלל";
W.policyDraft.type = "סרטן";
W.policyDraft.insuredIds = ["i1"];
W.policyDraft.insuredId = "i1";
W.policyDraft.premiumMonthly = "300";
W.policyDraft.premiumPerInsured = { i1:"300" };
const editedId = W.addDraftPolicy({ skipRender:true });
assert(editedId === firstId, "עריכה מפורשת מעדכנת את אותה פוליסה");
assert((W.newPolicies || []).length === 2, "עריכה לא מוסיפה שורה שלישית");
const edited = (W.newPolicies || []).find((p) => p.id === firstId);
assert(Number(edited.premiumPerInsured.i1) === 300, "העריכה שמרה את הפרמיה החדשה על השורה שנבחרה");
const untouched = (W.newPolicies || []).find((p) => p.id === secondId);
assert(Number(untouched.premiumPerInsured.i1) === 90, "העריכה לא נגעה בפוליסה השנייה");

console.log("\n" + passed + " passed, " + failed + " failed");
if(failed) process.exit(1);
