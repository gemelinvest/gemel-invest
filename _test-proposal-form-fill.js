/* GI-PROPOSAL-FORM-FILL
   זהות שנשמרת בתיק חייבת להגיע לשדה שקיים בטופס:
   דירה (apt מתוך pickPerson), קופ״ח הפניקס, טלפון בעל פוליסה,
   רחוב מגדל, ותאריך לידה / ת.ז. של מנורה בריאות.
   הרצה: node _test-proposal-form-fill.js
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

function loadHelper(){
  const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
  const start = app.indexOf("const GI_OFFICIAL_FORM_FILL = {");
  const end = app.indexOf("try { window.GI_OFFICIAL_FORM_FILL = GI_OFFICIAL_FORM_FILL; }", start);
  const ctx = { window: {}, console };
  vm.runInNewContext(app.slice(start, end) + "\nthis.GI_OFFICIAL_FORM_FILL = GI_OFFICIAL_FORM_FILL;", ctx);
  return ctx.GI_OFFICIAL_FORM_FILL;
}

function loadForm(file, helper){
  const sandbox = {
    window: {
      GI_OFFICIAL_FORM_FILL: helper,
      Auth: { current: { name: "סוכן בדיקה" } },
      CustomerDocuments: {}
    },
    console
  };
  sandbox.globalThis = sandbox.window;
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, file), "utf8"), sandbox, { filename: file });
  return sandbox.window;
}

function captureForm(){
  return { __giCapture: Object.create(null) };
}

const H = loadHelper();

console.log("1) pickPerson keeps the apartment on the names the forms read");
{
  const bag = H.pickPerson({
    data: { firstName: "דוד", apartment: "4", clinic: "מכבי", phone: "0501234567" }
  });
  assert(bag.apt === "4", "apt");
  assert(bag.apartment === "4", "apartment alias");
  assert(bag.aptNumber === "4", "aptNumber alias");
  assert(H.mapHmoExport("מכבי") === "1", "מכבי → 1");
}

const person = {
  firstName: "דוד",
  lastName: "כהן",
  fullName: "דוד כהן",
  idNumber: "123456789",
  birthDate: "15/03/1985",
  phone: "0501234567",
  email: "david@example.com",
  city: "חולון",
  street: "הרצל",
  houseNumber: "12",
  apt: "4",
  zip: "5821000",
  occupation: "נהג",
  clinic: "מכבי",
  gender: "זכר",
  maritalStatus: "נשוי",
  smokingStatus: "כן"
};
const spouse = Object.assign({}, person, {
  firstName: "שרה",
  lastName: "לוי",
  fullName: "שרה לוי",
  idNumber: "987654321",
  birthDate: "02/07/1987",
  phone: "0527654321"
});

console.log("\n2) phoenix life — clinic, profession, owner phone, apartment");
{
  const win = loadForm("gi-phoenix-life-form.js", H);
  const Form = win.PhoenixLifeForm;
  const form = captureForm();
  Form.applyPerson(form, person, "", null);
  Form.applyPerson(form, spouse, "Spouse", null);
  Form.applyOwnerFromPrimary(form, person, null);
  const cap = form.__giCapture;
  assert(cap.HMO === "מכבי", "HMO");
  assert(cap.HMOSpouse === "מכבי", "HMOSpouse");
  assert(cap.Profession === "נהג", "Profession not Proffession");
  assert(!cap.Proffession, "typo field is not written");
  assert(cap.AptNumber === "4", "AptNumber");
  assert(cap.AptNumberSpouse === "4", "AptNumberSpouse");
  assert(cap.PhoneNumberOwner === "0501234567", "owner phone");
}

console.log("\n3) gap forms — migdal street/hmo and menora health identity");
{
  const win = loadForm("gi-gap-join-forms.js", H);
  const migdal = captureForm();
  win.MigdalHealthForm.applyPerson(migdal, person, "primary", null);
  win.MigdalHealthForm.applyPerson(migdal, spouse, "spouse", null);
  assert(migdal.__giCapture.StreetNameCode === "הרצל", "migdal street");
  assert(migdal.__giCapture.StreetNameCodeSpouse === "הרצל", "migdal spouse street");
  assert(migdal.__giCapture.HMORadio === "1", "migdal HMO radio");
  assert(migdal.__giCapture.AptNumber === "4", "migdal apt");
  const menora = captureForm();
  win.MenoraHealthForm.applyPerson(menora, person, "primary", null);
  win.MenoraHealthForm.applyPerson(menora, spouse, "spouse", null);
  const m = menora.__giCapture;
  assert(m.MBirthDate === "15/03/1985", "menora birth");
  assert(m.MBirthDateSpouse === "02/07/1987", "menora spouse birth");
  assert(m.MPID === "123456789", "menora id");
  assert(m.MPIDSpouse === "987654321", "menora spouse id");
  assert(m.MOccupationCode === "נהג", "menora occupation");
  assert(m.Address && m.Address.indexOf("הרצל") >= 0 && m.Address.indexOf("4") >= 0, "menora address line");
  assert(m.FullAddressSpouse && m.FullAddressSpouse.indexOf("שרה") < 0 && m.FullAddressSpouse.indexOf("חולון") >= 0, "menora spouse address");
  assert(m.AptNumber === "4", "menora apt");
}

console.log("\n4) menora risk, ayalon mortgage, migdal cancer");
{
  const risk = loadForm("gi-menora-risk-form.js", H).MenoraRiskForm;
  const riskForm = captureForm();
  risk.applyPerson(riskForm, person, false, null);
  risk.applyPerson(riskForm, spouse, true, null);
  assert(riskForm.__giCapture.AptNumber === "4", "menora risk apt");
  assert(riskForm.__giCapture.AptNumberSpouse === "4", "menora risk spouse apt");
  assert(riskForm.__giCapture.MPIDSpouse === "987654321", "menora risk spouse id");
  const mort = loadForm("gi-ayalon-mortgage-form.js", H).AyalonMortgageForm;
  const mortForm = captureForm();
  mort.applyPerson(mortForm, person, false, null);
  assert(mortForm.__giCapture.AptNumber === "4", "ayalon mortgage apt");
  const cancer = loadForm("gi-migdal-cancer-form.js", H).MigdalCancerForm;
  const cancerForm = captureForm();
  cancer.applyPerson(cancerForm, person, "primary", null);
  assert(cancerForm.__giCapture.AptNumber === "4", "cancer apt");
  assert(cancerForm.__giCapture.HMORadio === "1", "cancer HMO radio");
}

console.log("\n" + passed + " passed, " + failed + " failed");
if(failed) process.exit(1);
