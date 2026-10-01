/* הוראת קבע: כל שדה הוראת קבע שקיים בטופס מתמלא מהתיק, בשני אזורי החשבון.
   כרטיס אשראי נשאר ריק. הרצה: node _test-standing-order-fill.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { PDFDocument, PDFName } = require("/tmp/pdflib/node_modules/pdf-lib");

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
const start = app.indexOf("const GI_OFFICIAL_FORM_FILL = {");
const end = app.indexOf("try { window.GI_OFFICIAL_FORM_FILL = GI_OFFICIAL_FORM_FILL; }", start);
if(start < 0 || end < 0){
  console.error("helper block missing");
  process.exit(1);
}
const ctx = { window: {}, console };
vm.runInNewContext(app.slice(start, end) + "\nthis.GI_OFFICIAL_FORM_FILL = GI_OFFICIAL_FORM_FILL;", ctx);
const H = ctx.GI_OFFICIAL_FORM_FILL;
ctx.window.PDFLib = require("/tmp/pdflib/node_modules/pdf-lib");

function exportOf(form, name){
  try {
    const field = form.getTextField(name);
    return String(field.getText() || "").trim();
  } catch(_e) {}
  try {
    const field = form.getField(name);
    const v = field.acroField.dict.lookup(PDFName.of("V"));
    return v ? String(v).replace(/^\//, "") : "";
  } catch(_e2) { return ""; }
}

async function loadForm(rel){
  const bytes = fs.readFileSync(path.join(ROOT, rel));
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return doc.getForm();
}

const bank = {
  name: "לאומי",
  branch: "123",
  account: "456789",
  bankNo: "10",
  branchStreet: "הרצל",
  branchCity: "תל אביב",
  ownerName: "דוד כהן",
  ownerId: "123456789",
  ownerStreet: "הרצל",
  ownerHouse: "12",
  ownerCity: "חולון",
  ownerZip: "5821000"
};
const hoPayment = { method: "ho", bank, cc: { cardNumber: "4580123412341234", holderName: "לא לכאן" } };
const ccPayment = {
  method: "cc",
  bank,
  cc: { cardNumber: "4580123412341234", holderName: "דוד כהן", holderId: "123456789", expirationDate: "12/27", monthDigit: "12", yearDigit: "27" }
};

(async () => {
  console.log("1) מנורה ריסק — שני אזורי הוראת קבע, בלי כרטיס");
  {
    const form = await loadForm("forms/menora-risk/menora-risk-join.pdf");
    H.applyStoredPayment(form, hoPayment, null, { textOpts: { visual: false } });
    ["BankName", "BankNameCode", "BankBranch", "BankBranchCode", "BankAccountNumber", "AccountNumber",
      "BankNameB", "BankBranchB", "BankNameCodeB", "BankBranchCodeB", "BankAccountNumberB",
      "BankAccOwner", "BAccOwners", "PIDBankAccOwner", "BAOCity", "BankAddress"].forEach((name) => {
      assert(!!exportOf(form, name), "מנורה ממלא " + name + " (" + exportOf(form, name) + ")");
    });
    assert(exportOf(form, "BankName") === "לאומי", "מנורה שם בנק");
    assert(exportOf(form, "BankNameCode") === "10", "מנורה מספר בנק");
    assert(exportOf(form, "AccountNumber") === "456789", "מנורה מספר חשבון גם בשדה AccountNumber");
    assert(exportOf(form, "BankAccountNumberB") === "456789", "מנורה אזור שני — חשבון");
    assert(exportOf(form, "PayWay") === "3", "מנורה סימון הוראת קבע");
    assert(exportOf(form, "CreditCardNumber") === "", "מנורה לא ממלא כרטיס בהוראת קבע");
    assert(exportOf(form, "BankAccOwner") === "דוד כהן", "מנורה בעל החשבון");
  }

  console.log("\n2) איילון בריאות — הרשאה ואזור שני");
  {
    const form = await loadForm("forms/ayalon-health/ayalon-health-join.pdf");
    H.applyStoredPayment(form, hoPayment, null, { textOpts: { visual: false } });
    assert(exportOf(form, "IncludeAuth") === "True", "איילון מסמן הרשאה להוראת קבע");
    assert(exportOf(form, "BankNameB") === "לאומי", "איילון אזור שני — בנק");
    assert(exportOf(form, "BankAccNumB") === "456789", "איילון אזור שני — חשבון");
    assert(exportOf(form, "BAccOwners") === "דוד כהן", "איילון בעל חשבון באזור השני");
    assert(exportOf(form, "CreditCardNumber") === "", "איילון לא ממלא כרטיס");
  }

  console.log("\n3) הכשרה מחלות קשות — הרשאה כללית ושני מספרי חשבון");
  {
    const form = await loadForm("forms/hachshara-ci/hachshara-ci-join.pdf");
    H.applyStoredPayment(form, hoPayment, null, {
      textOpts: { visual: false },
      hoMarks: [{ field: "CollectionMethod", value: "Hok" }]
    });
    assert(exportOf(form, "GeneralAuth") === "True", "הכשרה מסמנת הרשאה כללית");
    assert(exportOf(form, "AccountNumber1") === "456789", "הכשרה חשבון 1");
    assert(exportOf(form, "AccountNumber2") === "456789", "הכשרה חשבון 2");
    assert(exportOf(form, "BankNameCode") === "10", "הכשרה מספר בנק");
    assert(exportOf(form, "BankNameB") === "לאומי", "הכשרה אזור שני");
    assert(!exportOf(form, "CollectionMethod"), "הכשרה מחלות קשות בלי שדה CollectionMethod לא ממציאה אותו");
  }

  console.log("\n4) הפניקס בריאות וכלל בריאות");
  {
    const phx = await loadForm("forms/phoenix-health/phoenix-health-join.pdf");
    H.applyStoredPayment(phx, hoPayment, null, { textOpts: { visual: false }, bankNameCode: "BankNameCode", bankBranchCode: "BankBranchCode" });
    assert(exportOf(phx, "HetPayBankAccOwner") === "דוד כהן", "הפניקס בעל חשבון להוראת קבע");
    assert(exportOf(phx, "GeneralAuth") === "True", "הפניקס הרשאה כללית");
    assert(exportOf(phx, "BankNameCode") === "10", "הפניקס מספר בנק");
    assert(exportOf(phx, "AccountNumber") === "456789", "הפניקס חשבון");
    assert(exportOf(phx, "CreditCardNumber") === "", "הפניקס לא ממלא כרטיס");

    const clal = await loadForm("forms/clal-health/clal-health-join.pdf");
    H.applyStoredPayment(clal, hoPayment, null, {
      textOpts: { visual: false },
      hoMarks: [{ field: "BankUse", value: "1" }]
    });
    assert(exportOf(clal, "BankUse") === "1", "כלל סימון שימוש בחשבון");
    assert(exportOf(clal, "GeneralAuth") === "True", "כלל הרשאה כללית");
    assert(exportOf(clal, "BankNameCode") === "10", "כלל מספר בנק");
    assert(exportOf(clal, "BAOStreetName") === "הרצל", "כלל רחוב בעל החשבון");
  }

  console.log("\n5) איילון משכנתא — חיים ומבנה, גם באזור השני");
  {
    const form = await loadForm("forms/ayalon-mortgage/ayalon-mortgage-join.pdf");
    H.applyStoredPayment(form, hoPayment, null, {
      textOpts: { visual: false },
      hoMarks: [{ field: "LifeInsuranceHok", value: "1" }, { field: "StructureInsuranceHok", value: "1" }]
    });
    assert(exportOf(form, "LifeInsuranceHok") === "1", "איילון משכנתא הוראת קבע לחיים");
    assert(exportOf(form, "StructureInsuranceHok") === "1", "איילון משכנתא הוראת קבע למבנה");
    assert(exportOf(form, "LifeInsuranceHokB") === "1", "איילון משכנתא אזור שני — חיים");
    assert(exportOf(form, "StructureInsuranceHokB") === "1", "איילון משכנתא אזור שני — מבנה");
    assert(exportOf(form, "IncludeAuth") === "True", "איילון משכנתא הרשאה");
    assert(exportOf(form, "BankName") === "לאומי", "איילון משכנתא שם בנק");
  }

  console.log("\n6) אשראי לא נדרס, והוראת קבע לא נכתבת");
  {
    const form = await loadForm("forms/menora-risk/menora-risk-join.pdf");
    H.applyStoredPayment(form, ccPayment, null, {
      textOpts: { visual: false },
      ccMarks: [{ field: "PayWay", value: "1" }]
    });
    assert(exportOf(form, "CreditCardNumber") === "4580123412341234", "אשראי ממלא מספר כרטיס");
    assert(exportOf(form, "PayWay") === "1", "אשראי מסמן כרטיס");
    assert(exportOf(form, "BankName") === "", "אשראי לא ממלא שם בנק");
    assert(exportOf(form, "BankAccountNumber") === "", "אשראי לא ממלא חשבון");
    assert(exportOf(form, "IncludeAuth") === "" && exportOf(form, "GeneralAuth") === "", "אשראי לא מסמן הוראת קבע");
  }

  console.log("\n7) בלי נתוני בנק לא ממציאים מילוי");
  {
    const pay = H.pickPayment(
      { primary: { paymentMethod: "ho", firstName: "דוד", lastName: "כהן", idNumber: "123456789", ho: {} } },
      { paymentMethod: "ho", firstName: "דוד", lastName: "כהן", idNumber: "123456789", ho: {} }
    );
    assert(pay.isHo === false, "הוראת קבע בלי בנק לא מסומנת");
    const withBank = H.pickPayment(
      { primary: { paymentMethod: "ho", firstName: "דוד", lastName: "כהן", idNumber: "123456789", street: "הרצל", city: "חולון", ho: { bankName: "לאומי", branch: "12", account: "345", bankNo: "10" } } },
      null
    );
    assert(withBank.bank.ownerName === "דוד כהן", "בעל החשבון נלקח מהתיק");
    assert(withBank.bank.ownerId === "123456789", "תעודת זהות בעל החשבון נלקחת מהתיק");
    assert(withBank.cc.cardNumber === "", "הוראת קבע מנקה כרטיס");
  }

  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
