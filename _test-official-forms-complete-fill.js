/* GI-OFFICIAL-FORMS-COMPLETE-FILL 2026-10-07
   אופן גבייה, סוג ריבית, יורשים/מוטבים לפי מבוטח, וקובץ מלא אחרי שיקוף.
   הרצה: node _test-official-forms-complete-fill.js
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

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const wiz = fs.readFileSync(path.join(ROOT, "gi-wizard.js"), "utf8");
const sims = fs.readFileSync(path.join(ROOT, "gi-simulators.js"), "utf8");

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "app.js syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "gi-wizard.js syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-simulators.js")]).status === 0, "gi-simulators.js syntax");

const start = app.indexOf("const GI_OFFICIAL_FORM_FILL = {");
const end = app.indexOf("try { window.GI_OFFICIAL_FORM_FILL = GI_OFFICIAL_FORM_FILL; }", start);
assert(start > 0 && end > start, "helper block found");
const ctx = { window: {}, console };
vm.runInNewContext(app.slice(start, end) + "\nthis.GI_OFFICIAL_FORM_FILL = GI_OFFICIAL_FORM_FILL;", ctx);
const H = ctx.GI_OFFICIAL_FORM_FILL;

function captureForm(names){
  const present = new Set(names);
  const bag = Object.create(null);
  return {
    __giCapture: bag,
    getField(name){ return present.has(name) ? { name } : null; },
    capture: bag
  };
}

console.log("\n2) אופן גבייה מ-paymentMethod בלי spec marks");
{
  const hoForm = captureForm(["PayWay", "CollectionMethod", "BankUse"]);
  H.applyCollectionMethodAutoMarks(hoForm, "ho", Object.create(null));
  assert(hoForm.capture.PayWay === "3", "הוראת קבע מסמנת PayWay=3");
  assert(hoForm.capture.CollectionMethod === "Hok", "הוראת קבע מסמנת CollectionMethod=Hok");
  assert(hoForm.capture.BankUse === "1", "הוראת קבע מסמנת BankUse");
  const missing = captureForm([]);
  H.applyCollectionMethodAutoMarks(missing, "ho", Object.create(null));
  assert(Object.keys(missing.capture).length === 0, "בלי שדה אופן גבייה לא ממציאים שם");
  const ccForm = captureForm(["PayWay", "CollectionMethod", "CreditUse"]);
  H.applyCollectionMethodAutoMarks(ccForm, "cc", Object.create(null));
  assert(ccForm.capture.PayWay === "1", "אשראי מסמן PayWay=1");
  assert(ccForm.capture.CollectionMethod === "Credit", "אשראי מסמן CollectionMethod=Credit");
  assert(ccForm.capture.CreditUse === "1", "אשראי מסמן CreditUse");
}

console.log("\n3) ריבית קבועה / משתנה רק בשדות קיימים");
{
  const form = captureForm(["InterestType1", "LoanInterest1", "FixedInterest1", "VariableInterest1", "LoanInterestShpiz1"]);
  H.applyLoanInterestMarks(form, [{ interestType: "fixed" }], null, { visual: false });
  assert(form.capture.InterestType1 === "1", "קבועה = InterestType /1");
  assert(form.capture.LoanInterest1 === "קבועה", "קבועה נכתבת כטקסט");
  assert(form.capture.FixedInterest1 === "1", "מגדל FixedInterest מסומן");
  assert(form.capture.VariableInterest1 === "Off", "מגדל VariableInterest כבוי");
  const varForm = captureForm(["InterestTypeShpiz1", "LoanInterestShpiz1"]);
  H.applyLoanInterestMarks(varForm, [{ interestType: "variable" }], null, { visual: false });
  assert(varForm.capture.InterestTypeShpiz1 === "2", "משתנה = InterestType /2");
  assert(varForm.capture.LoanInterestShpiz1 === "משתנה", "משתנה נכתבת כטקסט");
  const ghost = captureForm([]);
  H.applyLoanInterestMarks(ghost, [{ interestType: "fixed" }], null, {});
  assert(Object.keys(ghost.capture).length === 0, "בלי שדה ריבית לא ממציאים");
}

console.log("\n4) יורשים חוקיים לא מתערבבים עם מוטבים בשמות");
{
  const form = captureForm(["LegalHeirs", "FirstNameBeneficiary1", "LastNameBeneficiary1"]);
  H.applyHeirsAndBeneficiaries(form, {
    legalHeirs: true,
    beneficiaries: [{ firstName: "רות", lastName: "ישראלי" }]
  }, null, {});
  assert(form.capture.LegalHeirs === "1", "יורשים חוקיים מסומנים");
  assert(!form.capture.FirstNameBeneficiary1, "יורשים חוקיים לא ממלאים שם מוטב");
  const named = captureForm(["LegalHeirs", "FirstNameBeneficiary1", "LastNameBeneficiary1", "FirstNameBeneficiarySpouse1"]);
  H.applyHeirsAndBeneficiaries(named, {
    legalHeirs: false,
    beneficiaries: [{ firstName: "דן", lastName: "כהן", idNumber: "111" }],
    spouseBeneficiaries: [{ firstName: "יעל", lastName: "כהן", idNumber: "222" }]
  }, null, {});
  assert(!named.capture.LegalHeirs, "מוטבים בשמות לא מסמנים יורשים חוקיים");
  assert(named.capture.FirstNameBeneficiary1 === "דן", "מוטב ראשי בעמודה הראשית");
  assert(named.capture.FirstNameBeneficiarySpouse1 === "יעל", "מוטב בן הזוג בעמודת Spouse");
}

console.log("\n5) enrich מפריד שני מבוטחים");
{
  const rec = {
    payload: {
      insureds: [
        { id: "A", type: "primary" },
        { id: "B", type: "spouse" }
      ],
      newPolicies: [
        {
          id: "p1",
          insuredIds: ["A"],
          beneficiariesMode: "legalHeirs",
          beneficiaries: [{ firstName: "לא", lastName: "כאן" }],
          pledgeBanks: [{ interestType: "fixed", bankName: "לאומי" }]
        },
        {
          id: "p2",
          insuredIds: ["B"],
          beneficiariesMode: "named",
          beneficiaries: [{ firstName: "נועה", lastName: "לוי" }],
          pledgeBanks: [{ interestType: "variable", bankName: "פועלים" }]
        }
      ],
      mirrorFlow: { beneficiariesStep: { policies: { p1: { legalHeirs: true }, p2: { legalHeirs: false } } } }
    }
  };
  const draft = {};
  H.enrichOfficialDraft(draft, rec);
  assert(draft.legalHeirs === true, "ראשי = יורשים חוקיים");
  assert(!draft.beneficiaries || !draft.beneficiaries.length, "ראשי בלי שמות כשיש יורשים");
  assert(draft.spouseLegalHeirs === false, "בן זוג לא יורשים חוקיים");
  assert(draft.spouseBeneficiaries[0].firstName === "נועה", "מוטבת בן הזוג נשמרת");
  assert(draft.loans[0].interestType === "fixed", "ריבית הראשי ראשונה");
  assert(draft.loans[1].interestType === "variable", "ריבית בן הזוג אחריו");
}

console.log("\n6) שיקוף וקובץ מלא");
assert(app.includes("_mcRecFillSig(rec)"), "חתימת תיק נכנסת למפתח הקאש");
assert(app.includes('parts.push("r:" + this._mcRecFillSig(rec))'), "מפתח הצירוף כולל את התיק");
assert(app.includes("_mcSavedFillKeyMatches"), "PDF שמור נבדק מול החתימה");
assert(app.includes("this._mcEnrichOfficialDraft(draft, rec)"), "טיוטת הטופס מתעשרת לפני מילוי");
assert(app.includes("_mcPrepareSummaryFilledForms") && !app.slice(
  app.indexOf("async _mcPrepareSummaryFilledForms(rec){"),
  app.indexOf("_mcHatamaCacheKey(rec){", app.indexOf("async _mcPrepareSummaryFilledForms(rec){"))
).includes("_mcMaterializeEditedForms"), "פתיחת פאנל הטפסים לא בונה PDF");
assert(app.includes("if(savedJoin && savedJoin.mirrorAgentSaved === true && this._mcSavedFillKeyMatches(savedJoin, joinKey)) return"), "PDF סוכן ישן לא חוסם מילוי מעודכן");
assert(app.includes("if(savedFollow && savedFollow.mirrorAgentSaved === true && this._mcSavedFillKeyMatches(savedFollow, cacheKey)) return"), "שאלון שמור ישן לא חוסם מילוי מעודכן");

console.log("\n7) אשף וסימולטור דורשים XOR ריבית");
assert(wiz.includes('interestType:""') || wiz.includes('interestType: ""'), "emptyPledgeBank כולל interestType");
assert(wiz.includes("ריבית קבועה") && wiz.includes("ריבית משתנה"), "אשף מציג שתי האפשרויות");
assert(wiz.includes('data-pdraft-interest="fixed"') && wiz.includes('data-pdraft-interest="variable"'), "אשף XOR ריבית");
assert(wiz.includes('k === "interestType" ? !!this.normalizeInterestType(b[k])'), "ולידציית אשף דורשת ריבית");
assert(sims.includes('data-gishell-legal-interest="fixed"') && sims.includes("ריבית משתנה"), "סימולטור מציג ריבית");
assert(sims.includes('["interestType", "סוג ריבית (קבועה או משתנה)"]'), "אישור סימולטור דורש ריבית");
assert(app.includes("data-mc-pledge-interest") && app.includes("_onPledgeInterestToggle"), "שיקוף מסמן ריבית");
assert(app.includes("canLegalHeirs"), "כרטיס המוטבים מרשה יורשים בכל מצבי הריסק");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
