/* מין מבוטח וסוג אשראי על טפסי ההצעה.
   הרצה: node _test-form-gender-card.js
   אם pdf-lib זמין, הבדיקה גם ממלאת את ה-PDF המקורי וקוראת את התיבה.
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

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const start = app.indexOf("const GI_OFFICIAL_FORM_FILL = {");
const end = app.indexOf("try { window.GI_OFFICIAL_FORM_FILL = GI_OFFICIAL_FORM_FILL; }", start);
assert(start > 0 && end > start, "helper block found");
const ctx = { window: {}, console, globalThis: {} };
vm.runInNewContext(app.slice(start, end) + "\nthis.GI_OFFICIAL_FORM_FILL = GI_OFFICIAL_FORM_FILL;", ctx);
const H = ctx.GI_OFFICIAL_FORM_FILL;

const AYALON = ["Visa", "Isracart", "Diners", "Other"];
const CLAL_MORTGAGE = ["Visa", "Isracart", "AmericanExp", "Diners", "Other"];
const ISSUER_SPLIT = ["Visa", "Leumi", "Isracart", "Diners", "AmericanExp", "Other"];
const MIGDAL_LIFE = ["Visa", "Isracart", "Diners", "AmericanExp", "MasterCard"];
const MIGDAL_HEALTH = ["Visa", "Isracart", "Diners", "AmericanExp", "Leumi"];

function cardForm(states){
  const names = states ? ["CreditCardType", "CreditCardNumber", "FullNameCreditCardHolder", "PIDCreditCardHolder", "ExpirationDate"] : ["CreditCardNumber"];
  const present = new Set(names);
  const bag = Object.create(null);
  return {
    __giCapture: bag,
    __giOnStates: states ? { CreditCardType: states } : {},
    getField(name){ return present.has(name) ? { name } : null; },
    capture: bag
  };
}

function markedType(states, cardNumber){
  const form = cardForm(states);
  H.applyStoredPayment(form, {
    method: "cc",
    cc: { cardNumber, holderName: "דנה לוי", holderId: "123456782", exp: "12/30" },
    bank: {}
  }, null, { textOpts: { visual: false } });
  return form.capture.CreditCardType || "";
}

console.log("1) זיהוי סוג לפי מספר");
assert(H.mapCreditCardTypeExport({ cardNumber: "4580123412341234" }) === "Visa", "4 → Visa");
assert(H.mapCreditCardTypeExport({ cardNumber: "5326101234567890" }) === "MasterCard", "51-55 → MasterCard");
assert(H.mapCreditCardTypeExport({ cardNumber: "2221001234567890" }) === "MasterCard", "2221-2720 → MasterCard");
assert(H.mapCreditCardTypeExport({ cardNumber: "371449635398431" }) === "AmericanExp", "37 → AmericanExp");
assert(H.mapCreditCardTypeExport({ cardNumber: "36123456789012" }) === "Diners", "36 → Diners");
assert(H.mapCreditCardTypeExport({ cardNumber: "38123456789012" }) === "Diners", "38 → Diners");
assert(H.mapCreditCardTypeExport({ cardNumber: "30569311110104" }) === "Diners", "305 → Diners");
assert(H.mapCreditCardTypeExport({ cardNumber: "123456789" }) === "Isracart", "9 ספרות → Isracart");
assert(H.mapCreditCardTypeExport({ cardNumber: "12345678" }) === "Isracart", "8 ספרות → Isracart");
assert(H.mapCreditCardTypeExport({ cardNumber: "6011000000000000" }) === "", "מספר לא מזוהה לא מסומן כאחר");

console.log("\n2) הסימון לפי התיבות שבטופס");
assert(markedType(MIGDAL_LIFE, "4580123412341234") === "Visa", "מגדל חיים מסמן ויזה");
assert(markedType(MIGDAL_LIFE, "5326101234567890") === "MasterCard", "מגדל חיים מסמן מאסטרקארד");
assert(markedType(MIGDAL_LIFE, "371449635398431") === "AmericanExp", "מגדל חיים מסמן אמריקן אקספרס");
assert(markedType(MIGDAL_LIFE, "38123456789012") === "Diners", "מגדל חיים מסמן דיינרס 38");
assert(markedType(MIGDAL_LIFE, "123456789") === "Isracart", "מגדל חיים מסמן ישראכרט");
assert(markedType(AYALON, "4580123412341234") === "Visa", "איילון מסמן ויזה");
assert(markedType(AYALON, "371449635398431") === "", "איילון בלי תיבת אמריקן לא מסמן אחר");
assert(markedType(AYALON, "5326101234567890") === "", "איילון בלי מאסטרקארד לא מסמן אחר");
assert(markedType(AYALON, "12345678") === "Isracart", "איילון מסמן ישראכרט");
assert(markedType(CLAL_MORTGAGE, "371449635398431") === "AmericanExp", "כלל משכנתא מסמן אמריקן אקספרס");
assert(markedType(ISSUER_SPLIT, "4580123412341234") === "", "ויזה מפוצלת לכאל ולאומי לא מסומנת");
assert(markedType(ISSUER_SPLIT, "5326101234567890") === "", "מאסטרקארד לא מסומן כלאומי קארד");
assert(markedType(ISSUER_SPLIT, "371449635398431") === "AmericanExp", "הכשרה/פניקס/מנורה מסמנים אמריקן אקספרס");
assert(markedType(ISSUER_SPLIT, "30569311110104") === "Diners", "הכשרה/פניקס/מנורה מסמנים דיינרס 305");
assert(markedType(ISSUER_SPLIT, "123456789") === "Isracart", "הכשרה/פניקס/מנורה מסמנים ישראכרט");
assert(markedType(MIGDAL_HEALTH, "4580123412341234") === "Visa", "מגדל בריאות מסמן ויזה");
assert(markedType(MIGDAL_HEALTH, "2221001234567890") === "Leumi", "מגדל בריאות מסמן את תיבת מאסטרקארד");
assert(markedType(null, "4580123412341234") === "", "בלי תיבת סוג לא נכתב CreditCardType");

console.log("\n3) כל מבוטח מקבל זכר/נקבה מהאשף");
const genderFiles = [
  "gi-gap-join-forms.js",
  "gi-phoenix-health-form.js",
  "gi-phoenix-life-form.js",
  "gi-migdal-life-form.js",
  "gi-migdal-mortgage-form.js",
  "gi-migdal-cancer-form.js",
  "gi-ayalon-health-form.js",
  "gi-ayalon-mortgage-form.js",
  "gi-clal-health-form.js",
  "gi-clal-life-couple-form.js",
  "gi-clal-mortgage-form.js",
  "gi-hachshara-ci-form.js",
  "gi-hachshara-health-form.js",
  "gi-hachshara-life-form.js",
  "gi-hachshara-life-short-form.js",
  "gi-hachshara-mortgage-form.js",
  "gi-menora-ci-form.js",
  "gi-menora-mortgage-form.js",
  "gi-menora-risk-form.js"
];
genderFiles.forEach((name) => {
  const src = fs.readFileSync(path.join(ROOT, name), "utf8");
  assert(src.includes('g === "זכר"') && src.includes('return "True"'), name + " זכר → True");
  assert(src.includes('g === "נקבה"') && src.includes('return "False"'), name + " נקבה → False");
  assert(/Gender/.test(src) && /mapGenderExport\(person\.gender\)/.test(src), name + " מסמן את תיבת המין של המבוטח");
});
const lifeCi = fs.readFileSync(path.join(ROOT, "gi-phoenix-life-ci-form.js"), "utf8");
assert(lifeCi.includes("health.applyPerson(form, draft.primary"), "פניקס חיים ומחלות מסמן מין דרך טופס הבריאות");
assert(lifeCi.includes('health.applyPerson(form, child, "child"'), "פניקס חיים ומחלות מסמן מין גם לילד");
const phoenixCi = fs.readFileSync(path.join(ROOT, "gi-phoenix-ci-form.js"), "utf8");
assert(phoenixCi.includes("if(this.isMale(person.gender)) mark(0, 184, y + 4)"), "פניקס מחלות קשות מסמן זכר על העיגול");
assert(phoenixCi.includes("if(this.isFemale(person.gender)) mark(0, 184, y - 8)"), "פניקס מחלות קשות מסמן נקבה על העיגול");

function loadPdfLib(){
  const candidates = ["pdf-lib", "/tmp/pdflib/node_modules/pdf-lib"];
  for(let i = 0; i < candidates.length; i++){
    try { return require(candidates[i]); } catch(_e) {}
  }
  return null;
}

function fieldValue(form, name, PDFLib){
  try {
    const field = form.getField(name);
    const v = field.acroField.dict.lookup(PDFLib.PDFName.of("V"));
    return v ? String(v.encodedName || v).replace(/^\//, "") : "";
  } catch(_e) {
    return "";
  }
}

async function checkRealPdfs(PDFLib){
  ctx.window.PDFLib = PDFLib;
  ctx.globalThis.PDFLib = PDFLib;
  const samples = [
    ["forms/ayalon-life/ayalon-life-join.pdf", "Visa", "4580123412341234"],
    ["forms/ayalon-health/ayalon-health-join.pdf", "Isracart", "123456789"],
    ["forms/clal-mortgage/clal-mortgage-join.pdf", "AmericanExp", "371449635398431"],
    ["forms/clal-health/clal-health-join.pdf", "", "4580123412341234"],
    ["forms/hachshara-life/hachshara-life-join.pdf", "", "4580123412341234"],
    ["forms/hachshara-life/hachshara-life-join.pdf", "Diners", "38123456789012"],
    ["forms/phoenix-health/phoenix-health-join.pdf", "Isracart", "12345678"],
    ["forms/menora-risk/menora-risk-join.pdf", "AmericanExp", "341234567890123"],
    ["forms/migdal-life/migdal-life-join.pdf", "MasterCard", "5326101234567890"],
    ["forms/migdal-mortgage/migdal-mortgage-join.pdf", "Visa", "4580123412341234"],
    ["forms/migdal-health/migdal-health-join.pdf", "Leumi", "2221001234567890"],
    ["forms/migdal-cancer/migdal-cancer-join.pdf", "Diners", "30569311110104"]
  ];
  for(let i = 0; i < samples.length; i++){
    const rel = samples[i][0];
    const expect = samples[i][1];
    const number = samples[i][2];
    const bytes = fs.readFileSync(path.join(ROOT, rel));
    const pdf = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
    const form = pdf.getForm();
    H.applyStoredPayment(form, {
      method: "cc",
      cc: { cardNumber: number, holderName: "דנה לוי", holderId: "123456782", exp: "12/30" },
      bank: {}
    }, null, { textOpts: { visual: false } });
    let actual = "";
    try { actual = fieldValue(form, "CreditCardType", PDFLib); } catch(_e) { actual = ""; }
    const label = rel.split("/")[1] + " " + number.slice(0, 4);
    if(expect) assert(actual === expect, label + " תיבה " + expect + " נקראה " + actual);
    else assert(!actual || actual === "Off", label + " לא סימן סוג (" + actual + ")");
    if(form.getField && samples[i] === samples.find((row) => row[0] === rel)){
      try {
        if(form.getField("Gender")){
          H.setExport(form, "Gender", "True");
          assert(fieldValue(form, "Gender", PDFLib) === "True", rel.split("/")[1] + " זכר נקרא True");
          H.setExport(form, "Gender", "False");
          assert(fieldValue(form, "Gender", PDFLib) === "False", rel.split("/")[1] + " נקבה נקראה False");
        }
      } catch(_g) {}
      try {
        if(form.getField("GenderSpouse")){
          H.setExport(form, "GenderSpouse", "False");
          assert(fieldValue(form, "GenderSpouse", PDFLib) === "False", rel.split("/")[1] + " בן/בת זוג נקבה");
        }
      } catch(_s) {}
      try {
        if(form.getField("GenderChild1")){
          H.setExport(form, "GenderChild1", "True");
          assert(fieldValue(form, "GenderChild1", PDFLib) === "True", rel.split("/")[1] + " ילד זכר");
        }
      } catch(_c) {}
    }
  }
}

const PDFLib = loadPdfLib();
if(!PDFLib){
  console.log("\n4) מילוי PDF מקורי דולג — pdf-lib לא מותקן");
  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
}

checkRealPdfs(PDFLib).then(() => {
  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
