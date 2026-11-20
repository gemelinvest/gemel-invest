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
  const aliases = captureForm([
    "PercentageBeneficiarySpouse1",
    "RelationBeneficiarySpouse1",
    "FullNameBeneficiarySpouse1",
    "BeneficiaryNameSpouse1",
    "BeneficiarypercentageSpouse1",
    "BeneficiaryRelationSpouse1",
    "PIDBeneficiarySpouseSpouse1"
  ]);
  H.applyHeirsAndBeneficiaries(aliases, {
    spouseBeneficiaries: [{ firstName: "יעל", lastName: "כהן", idNumber: "222", relationship: "בת", sharePct: "100" }]
  }, null, {});
  assert(aliases.capture.PercentageBeneficiarySpouse1 === "100", "אחוז בן זוג בשדה PercentageBeneficiarySpouse");
  assert(aliases.capture.RelationBeneficiarySpouse1 === "בת", "קרבה בשדה RelationBeneficiarySpouse");
  assert(aliases.capture.FullNameBeneficiarySpouse1 === "יעל כהן", "שם מלא בשדה FullNameBeneficiarySpouse");
  assert(aliases.capture.BeneficiaryNameSpouse1 === "יעל כהן", "שם מלא בשדה BeneficiaryNameSpouse");
  assert(aliases.capture.BeneficiarypercentageSpouse1 === "100", "אחוז בשדה BeneficiarypercentageSpouse");
  assert(aliases.capture.BeneficiaryRelationSpouse1 === "בת", "קרבה בשדה BeneficiaryRelationSpouse");
  assert(aliases.capture.PIDBeneficiarySpouseSpouse1 === "222", "תעודת זהות בשדה המודפס של כלל");
}

console.log("\n4b) סכום חלוקה לפי מבוטח וקרבה בהפניקס");
{
  const form = captureForm([
    "InsuranceAmountBeneficiary1",
    "InsuranceAmountBeneficiarySpouse1",
    "Beneficiarypercentage1",
    "BeneficiaryRelationR1",
    "RelationBeneficiaryRSpouse1"
  ]);
  form.__giRadioStates = {
    BeneficiaryRelationR1: ["2", "1", "3", "4", "23", "17"],
    RelationBeneficiaryRSpouse1: ["1", "2", "3", "4", "5", "6"]
  };
  H.applyHeirsAndBeneficiaries(form, {
    primary: { sumInsured: "1,000,000" },
    spouse: { sumInsured: "500000" },
    beneficiaries: [{ firstName: "דן", lastName: "כהן", relationship: "בן", sharePct: "40" }],
    spouseBeneficiaries: [{ firstName: "יעל", lastName: "כהן", relationship: "בת זוג", sharePct: "60" }]
  }, null, {});
  assert(form.capture.InsuranceAmountBeneficiary1 === "400000", "40% מסכום הראשי");
  assert(form.capture.InsuranceAmountBeneficiarySpouse1 === "300000", "60% מסכום בן הזוג");
  assert(form.capture.Beneficiarypercentage1 === "40", "האחוז נשאר בשדה האחוז");
  assert(form.capture.BeneficiaryRelationR1 === "1", "בן בטופס חיים של הפניקס הוא ילד");
  assert(form.capture.RelationBeneficiaryRSpouse1 === "1", "בת זוג בטופס משכנתא של הפניקס");
  const plain = captureForm(["BeneficiaryRelation1"]);
  H.applyHeirsAndBeneficiaries(plain, {
    beneficiaries: [{ firstName: "דן", relationship: "אח", sharePct: "100" }],
    primary: { sumInsured: "200000" }
  }, null, {});
  assert(plain.capture.BeneficiaryRelation1 === "אח", "בלי כפתורי הפניקס נשארת הקרבה כטקסט");
  assert(!plain.capture.InsuranceAmountBeneficiary1, "בלי עמודת סכום לא ממציאים שדה");
  assert(H.beneficiaryRelationKind("אחר") === "other", "אחר לא נקרא אח");
  assert(H.beneficiaryRelationKind("סבא") === "", "סבא בלי כפתור מתאים לא מסומן");
  const pledged = {};
  H.enrichOfficialDraft(pledged, {
    payload: {
      insureds: [
        { id: "A", type: "primary" },
        { id: "B", type: "spouse" }
      ],
      newPolicies: [{
        id: "life",
        type: "ריסק",
        insuredIds: ["A", "B"],
        pledge: true,
        pledgeBanks: [{ amount: "600000", bankName: "לאומי" }],
        sumInsuredPerInsured: { A: "1000000", B: "500000" },
        beneficiaries: [{ firstName: "נועה", sharePct: "50" }]
      }]
    }
  });
  assert(pledged.primaryShareBase === "600000", "בסיס הראשי הוא חלקו ביתרה אחרי שיעבוד");
  assert(pledged.spouseShareBase === "300000", "בסיס בן הזוג הוא חלקו ביתרה");
  const amt = captureForm(["InsuranceAmountBeneficiary1"]);
  H.applyHeirsAndBeneficiaries(amt, pledged, null, {});
  assert(amt.capture.InsuranceAmountBeneficiary1 === "300000", "50% מחלקו של הראשי ביתרה");
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
  const later = {};
  H.enrichOfficialDraft(later, {
    payload: {
      insureds: [{ id: "A", type: "primary" }],
      newPolicies: [
        { id: "health", insuredIds: ["A"], type: "בריאות", beneficiaries: [] },
        { id: "life", insuredIds: ["A"], type: "ריסק", beneficiaries: [{ firstName: "דן", lastName: "כהן", relationship: "בן", sharePct: "100" }] }
      ]
    }
  });
  assert(later.beneficiaries && later.beneficiaries[0].firstName === "דן", "מוטב נלקח מהפוליסה שיש בה מוטבים");
  assert(H.coversForInsured({
    healthCovers: ["השתלות"],
    healthCoversPerInsured: { c1: ["שירות פרימיום לילד"] }
  }, { id: "c1" }).indexOf("שירות פרימיום לילד") >= 0, "כיסוי ילד נשאר על הילד");
  assert(H.coversForInsured({
    healthCovers: ["השתלות"],
    healthCoversPerInsured: { c1: ["שירות פרימיום לילד"] }
  }, { id: "a1" }).indexOf("השתלות") >= 0, "בלי רשימה אישית נשארת רשימת הפוליסה");
  const migdalLetters = H.healthCoverLetters(["ניתוחים בישראל מהשקל הראשון", "ייעוץ ובדיקות", "שירות פרימיום לילד"]);
  assert(migdalLetters.indexOf("B") >= 0 && migdalLetters.indexOf("F") >= 0 && migdalLetters.indexOf("M") >= 0, "אותיות כיסוי מגדל");
  const menora = H.menoraHealthCoverBases(["השתלות וטיפולים מיוחדים מחוץ לישראל", "משלים שב\"ן עם השתתפות עצמית", "משלים שב\"ן ללא השתתפות עצמית"]);
  assert(menora.indexOf("MTransplantAbroad") >= 0, "השתלות מנורה");
  assert(menora.indexOf("MShabanWithPart") >= 0, "שב\"ן עם השתתפות");
  assert(menora.indexOf("MShabanNonPart") >= 0, "שב\"ן ללא השתתפות");
  assert(app.includes("formsStale"), "שינוי הצהרה בשיקוף מרענן את הטפסים בתיק");
}

console.log("\n5b) פירוט כן נכתב ל-HealthDecQ כשהשדה קיים");
{
  const form = captureForm(["HealthDecMainQ1", "HealthDecQ1", "HealthDecMainQ2"]);
  H.applyMappedHealthYesNo(form, {
    rows: [{ q: 1, keys: ["q1"] }, { q: 2, keys: ["q2"] }],
    responses: {
      q1: { A: { answer: "yes", fields: { diagnosis: "אסטמה", when: "2020" } } },
      q2: { A: { answer: "no", fields: { diagnosis: "לא רלוונטי" } } }
    },
    primaryId: "A"
  });
  assert(form.capture.HealthDecMainQ1 === "1", "כן נשאר על כפתור השאלה");
  assert(form.capture.HealthDecQ1 === "אסטמה · 2020", "פירוט כן נכתב ל-HealthDecQ");
  assert(!form.capture.HealthDecQ2, "תשובת לא לא נכתבת לפירוט");
}

console.log("\n6) שיקוף וקובץ מלא");
assert(app.includes("_mcRecFillSig(rec)"), "חתימת תיק נכנסת למפתח הקאש");
assert(app.includes('parts.push("r:" + this._mcRecFillSig(rec))'), "מפתח הצירוף כולל את התיק");
assert(app.includes("_mcShouldKeepAgentSavedPdf"), "PDF ששמר הנציג נשמר גם אחרי שינוי בתיק");
assert(app.includes("this._mcEnrichOfficialDraft(draft, rec)"), "טיוטת הטופס מתעשרת לפני מילוי");
assert(app.includes("_mcPrepareSummaryFilledForms") && !app.slice(
  app.indexOf("async _mcPrepareSummaryFilledForms(rec){"),
  app.indexOf("_mcHatamaCacheKey(rec){", app.indexOf("async _mcPrepareSummaryFilledForms(rec){"))
).includes("_mcMaterializeEditedForms"), "פתיחת פאנל הטפסים לא בונה PDF");
assert(app.includes("if(this._mcShouldKeepAgentSavedPdf(savedJoin)) return"), "PDF ששמר הנציג לא נדרס בסוף השיחה");
assert(app.includes("if(this._mcShouldKeepAgentSavedPdf(savedFollow)) return"), "שאלון ששמר הנציג לא נדרס בסוף השיחה");

console.log("\n7) משלם חריג נשאר בשדות המשלם");
{
  const primary = {
    payerChoice: "external",
    fullName: "משה כהן",
    idNumber: "999",
    firstName: "משה",
    lastName: "כהן",
    paymentMethod: "cc",
    externalPayer: {
      firstName: "דנה",
      lastName: "לוי",
      idNumber: "123456782",
      birthDate: "1990-05-02",
      phone: "0501234567",
      relation: "אחות"
    },
    cc: { holderName: "משה כהן", holderId: "999", cardNumber: "4111111111111111", exp: "12/28" }
  };
  const pay = H.pickPayment({ primary: primary }, primary);
  assert(pay.externalPayer && pay.externalPayer.fullName === "דנה לוי", "המשלם החריג נקרא מהאשף");
  assert(pay.externalPayer.birthDate === "02/05/1990", "תאריך לידה של המשלם נשמר");
  assert(pay.externalPayer.relation === "אחות", "קרבה שמורה נשמרת");
  const form = captureForm([
    "FullNamePayer", "PIDPayer", "BirthDatePayer", "PayerRelationOther",
    "PayerCellPhoneNumber", "BankAccOwner", "PIDBankAccOwner",
    "FullNameCreditCardHolder", "PIDCreditCardHolder", "PayerRelationLink"
  ]);
  const origGet = form.getField.bind(form);
  form.getField = function(name){
    const field = origGet(name);
    if(field && name === "PayerRelationLink") field.select = function(){};
    return field;
  };
  H.applyStoredPayment(form, pay, null, { textOpts: { visual: false } });
  assert(form.capture.FullNamePayer === "דנה לוי", "שם המשלם החריג בשדה המשלם");
  assert(form.capture.PIDPayer === "123456782", "תעודת המשלם בשדה המשלם");
  assert(form.capture.BirthDatePayer === "02/05/1990", "תאריך לידה בשדה קיים");
  assert(form.capture.PayerRelationOther === "אחות", "קרבה בשדה טקסט");
  assert(form.capture.PayerCellPhoneNumber === "0501234567", "טלפון בשדה קיים");
  assert(form.capture.FullNameCreditCardHolder === "משה כהן", "בעל הכרטיס נשאר בעל הכרטיס");
  assert(!form.capture.BankAccOwner, "המשלם החריג לא נכתב לבעל החשבון");
  assert(!form.capture.PayerRelationLink, "לא מנחשים קוד של כפתור קרבה");
  const insuredOwner = captureForm(["BankAccOwner", "PayerName", "PayerPID"]);
  H.applyInsuredPayerOwner(insuredOwner, { fullName: "משה כהן", idNumber: "999" }, null, {});
  assert(insuredOwner.capture.BankAccOwner === "משה כהן", "כשהמבוטח הוא המשלם בעל החשבון נשאר");
  const skipped = captureForm(["BankAccOwner", "PayerName", "PayerPID", "PayerRelation"]);
  H.applyInsuredPayerOwner(skipped, { fullName: "דנה לוי", idNumber: "123456782" }, null, {
    relation: "אחות",
    skipAccountOwner: true
  });
  assert(!skipped.capture.BankAccOwner, "דילוג על בעל חשבון כשהמשלם חריג");
  assert(skipped.capture.PayerName === "דנה לוי", "שם המשלם נכתב גם בדילוג על בעל החשבון");
  const hoPrimary = {
    payerChoice: "external",
    fullName: "משה כהן",
    idNumber: "999",
    paymentMethod: "ho",
    ho: { bankName: "לאומי", branch: "10", account: "20", bankNo: "10" },
    externalPayer: { firstName: "דנה", lastName: "לוי", idNumber: "123", relation: "אחות" }
  };
  const hoPay = H.pickPayment({ primary: hoPrimary }, hoPrimary);
  const hoForm = captureForm(["BankAccOwner", "PIDBankAccOwner", "FullNamePayer", "BankName"]);
  H.applyStoredPayment(hoForm, hoPay, null, { textOpts: { visual: false } });
  assert(hoForm.capture.BankAccOwner === "משה כהן", "הוראת קבע משאירה את המבוטח כבעל החשבון");
  assert(hoForm.capture.FullNamePayer === "דנה לוי", "המשלם החריג בשדה המשלם גם בהוראת קבע");
  const none = H.pickPayment({
    primary: { payerChoice: "insured", fullName: "משה כהן", paymentMethod: "ho", ho: { bankName: "לאומי", branch: "1", account: "2" } }
  }, null);
  assert(none.externalPayer == null, "בלי משלם חריג אין אובייקט משלם");
  assert(none.bank.ownerName === "משה כהן", "בהוראת קבע בעל החשבון הוא המבוטח");
}

console.log("\n8) טופס התאמת צרכים בלי חלוקה מנוחשת");
assert(wiz.includes("GI-NP-NO-SPLIT"), "התצוגה מסומנת כבלי חלוקה");
assert(!wiz.includes("total / pIds.length") && !wiz.includes("/ pIds.length"), "אין חלוקה שווה של פרמיה");
assert(wiz.includes("premiumBeforeLabel: premiumBefore ? this.formatMoneyValue(premiumBefore) : '—'"), "תווית לפני הנחה נשארה");
assert(wiz.includes("sum + getNewPolicyPremiumSafe(policy)"), "הסה״כ נשאר סכום השורות");
assert(app.includes("applyExceptionalPayerFields"), "מילוי המשלם החריג קיים");
assert(fs.readFileSync(path.join(ROOT, "gi-clal-life-couple-form.js"), "utf8").includes("!draft.payer.external"), "כלל לא כותב משלם חריג לבעל חשבון");
assert(fs.readFileSync(path.join(ROOT, "gi-migdal-cancer-form.js"), "utf8").includes("!draft.payer.external"), "מגדל סרטן לא כותב משלם חריג לבעל חשבון");
assert(fs.readFileSync(path.join(ROOT, "gi-hachshara-life-form.js"), "utf8").includes("skipAccountOwner"), "הכשרה מדלגת על בעל חשבון למשלם חריג");

console.log("\n9) אשף וסימולטור דורשים XOR ריבית");
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
