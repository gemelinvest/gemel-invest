/* GI-HACH-FORMS-FILL-AUDIT 2026-08-25
   After customer-create: Hachshara official forms must map stored fields onto real PDF names.
   Run: node _test-hachshara-forms-fill-audit.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const vm = require("vm");
const { execFileSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260826-migdal-smoke-fu-v1";
const TAG = "20260825-hach-fill-audit-v1"; // form module / href cache
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

function pdfFields(pdfPath){
  const py = `
from pypdf import PdfReader
import json
r = PdfReader(${JSON.stringify(pdfPath)})
fields = r.get_fields() or {}
out = {name: str(f.get("/FT") or "") for name, f in fields.items()}
print(json.dumps(out, ensure_ascii=False))
`;
  const raw = execFileSync("python3", ["-c", py], { encoding: "utf8" });
  return JSON.parse(raw);
}

function loadHelper(){
  const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
  const start = app.indexOf("const GI_OFFICIAL_FORM_FILL = {");
  const end = app.indexOf("try { window.GI_OFFICIAL_FORM_FILL = GI_OFFICIAL_FORM_FILL; }", start);
  assert(start > 0 && end > start, "GI_OFFICIAL_FORM_FILL block found");
  const ctx = { window: {}, console };
  vm.runInNewContext(app.slice(start, end) + "\nthis.GI_OFFICIAL_FORM_FILL = GI_OFFICIAL_FORM_FILL;", ctx);
  return ctx.GI_OFFICIAL_FORM_FILL;
}

function loadFormModule(file, globalName){
  const src = fs.readFileSync(path.join(ROOT, file), "utf8");
  const sandbox = {
    window: { GI_OFFICIAL_FORM_FILL: helper, Auth: { current: { name: "סוכן בדיקה" } }, CustomerDocuments: {
      isHachsharaLifeLikePolicy(p){
        return String(p?.company || "") === "הכשרה" && /ריסק|חיים|מגן/.test([p?.type, p?.productName].join(" "));
      },
      hachsharaRiskIsShort(p, payload){
        const n = Number(String(p?.sumInsured || "").replace(/[^\d.]/g, "")) || 0;
        if(n > 0 && n <= 1000000) return true;
        if(n > 1000000) return false;
        return String(payload?.hachsharaRiskAmountMode || "short") !== "full";
      },
      isHachsharaMortgagePolicy(p){
        return String(p?.company || "") === "הכשרה" && /משכנתא/.test(String(p?.type || ""));
      }
    } },
    globalThis: null,
    console
  };
  sandbox.globalThis = sandbox.window;
  vm.runInNewContext(src, sandbox, { filename: file });
  return sandbox.window[globalName];
}

function captureForm(){
  const capture = Object.create(null);
  return {
    __giCapture: capture,
    getCapture(){ return capture; }
  };
}

function samplePerson(extra){
  return Object.assign({
    firstName: "דוד",
    lastName: "כהן",
    idNumber: "123456789",
    birthDate: "1985-03-15",
    gender: "זכר",
    maritalStatus: "נשוי",
    phone: "0501234567",
    email: "david@example.com",
    city: "חולון",
    street: "הרצל",
    houseNumber: "12",
    apartment: "3",
    zip: "5821000",
    occupation: "נהג",
    clinic: "מכבי",
    heightCm: "178",
    weightKg: "82",
    smokingStatus: "לא",
    smokingAmount: ""
  }, extra || {});
}

function basePayload(overrides){
  const primary = samplePerson();
  const spouse = samplePerson({
    firstName: "מיכל", lastName: "כהן", idNumber: "987654321",
    gender: "נקבה", birthDate: "1988-07-20", phone: "0527654321"
  });
  const child = samplePerson({
    firstName: "נועם", lastName: "כהן", idNumber: "111222333",
    gender: "זכר", birthDate: "2015-01-10", phone: ""
  });
  primary.paymentMethod = "ho";
  primary.ho = {
    bankName: "לאומי",
    branch: "123",
    account: "456789",
    bankNo: "10"
  };
  const payload = {
    primary,
    insureds: [
      { id: "ins_primary", type: "primary", label: "מבוטח ראשי", data: primary },
      { id: "ins_spouse", type: "spouse", label: "בן/בת זוג", data: spouse },
      { id: "ins_child", type: "child", label: "ילד", data: child }
    ],
    companyAgentNumbers: { "הכשרה": "998877" },
    insuranceStartDate: "2026-09-01",
    newPolicies: [],
    hachsharaRiskAmountMode: "full",
    healthDeclaration: { responses: {} }
  };
  // attach health answers on primary (wizard shape)
  const responses = {};
  const keys = [
    "hachshara_crit__hospitalization", "hachshara_crit__tests_5y", "hachshara_crit__treatment_5y",
    "hachshara_risk_f__a1", "hachshara_risk_f__a2", "hachshara_risk_s__q1",
    "hachshara_mort_s__q1", "hachshara_mort_f__a1"
  ];
  keys.forEach((k) => {
    responses[k] = { ins_primary: { answer: "no" }, ins_spouse: { answer: "no" } };
  });
  primary.healthDeclaration = { responses };
  payload.primary = primary;
  payload.insureds[0].data = primary;
  return Object.assign(payload, overrides || {});
}

function makeRec(payload){
  return {
    id: "cust_test",
    firstName: "דוד",
    lastName: "כהן",
    idNumber: "123456789",
    phone: "0501234567",
    email: "david@example.com",
    city: "חולון",
    agentName: "סוכן בדיקה",
    payload
  };
}

function requireFields(capture, names, label){
  names.forEach((n) => {
    assert(!!String(capture[n] || "").trim(), label + " fills " + n + " (= " + JSON.stringify(capture[n] || "") + ")");
  });
}

function assertInPdf(fields, names, label){
  names.forEach((n) => {
    assert(!!fields[n], label + " PDF has field " + n);
  });
}

function assertCaptureKeysExistInPdf(capture, fields, label, allowMissing){
  const allow = new Set(allowMissing || []);
  Object.keys(capture).forEach((name) => {
    if(allow.has(name)) return;
    if(!fields[name]){
      failed += 1;
      console.error("  FAIL  " + label + " wrote unknown PDF field: " + name);
    } else {
      passed += 1;
    }
  });
}

console.log("1) cache + syntax");
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-hachshara-ci-form.js")]).status === 0, "ci form syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-hachshara-life-form.js")]).status === 0, "life form syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-hachshara-life-short-form.js")]).status === 0, "life-short form syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-hachshara-mortgage-form.js")]).status === 0, "mortgage form syntax");
assert(html.includes("app.js?v=" + APP_TAG), "index cache");
assert(sw.includes("gi-v12-" + APP_TAG), "SW cache");
assert(app.includes("gi-hachshara-ci-form.js?v=" + TAG), "ci href");
assert(app.includes("gi-hachshara-life-form.js?v=" + TAG), "life href");
assert(app.includes("gi-hachshara-life-short-form.js?v=" + TAG), "life-short href");
assert(app.includes("gi-hachshara-mortgage-form.js?v=" + TAG), "mortgage href");

const helper = loadHelper();
global.GI_OFFICIAL_FORM_FILL = helper;

const ciFields = pdfFields(path.join(ROOT, "forms/hachshara-ci/hachshara-ci-join.pdf"));
const lifeFields = pdfFields(path.join(ROOT, "forms/hachshara-life/hachshara-life-join.pdf"));
const shortFields = pdfFields(path.join(ROOT, "forms/hachshara-life-short/hachshara-life-short-join.pdf"));
const mortFields = pdfFields(path.join(ROOT, "forms/hachshara-mortgage/hachshara-mortgage-join.pdf"));

console.log("\n2) CI — מחלות קשות");
{
  const Form = loadFormModule("gi-hachshara-ci-form.js", "HachsharaCiForm");
  const payload = basePayload({
    newPolicies: [{
      company: "הכשרה",
      type: "מחלות קשות",
      startDate: "2026-09-01",
      hachsharaCriticalAmount: "250000",
      compensationPerInsured: { ins_primary: "250000", ins_spouse: "200000", ins_child: "100000" }
    }]
  });
  const draft = Form.buildDraft(makeRec(payload));
  assert(draft.primary.firstName === "דוד", "CI draft primary firstName");
  assert(draft.primary.compensation.includes("250"), "CI draft primary compensation");
  assert(draft.agentNumber === "998877", "CI draft agent number");
  const form = captureForm();
  Form.applyDraftToForm(form, draft, null);
  const cap = form.getCapture();
  requireFields(cap, [
    "FirstName", "LastName", "PID", "BirthDate", "EmailAddress", "City", "StreetName",
    "HouseNumber", "ZipCode", "CellPhoneNumber", "HMOName", "Hight", "Weight",
    "FirstNameSpouse", "PIDSpouse", "MaximumAmountText", "AgentNumber", "InsuranceBegin",
    "BankName", "BankBranch", "BankAccountNumber", "BankAccOwner"
  ], "CI");
  assert(cap.MaximumAmount === "True", "CI marks MaximumAmount checkbox");
  assert(cap.Gender === "True", "CI gender male → True");
  assert(cap.GenderSpouse === "False", "CI spouse female → False");
  assert(cap.FamilyStatus === "Married", "CI marital → Married");
  assert(cap.HealthDecMainQ1 === "2", "CI health Q1 no → 2");
  assert(!cap.MaximumAmountChild1, "CI does not invent child amount field");
  assertInPdf(ciFields, ["MaximumAmountText", "MaximumAmount", "FirstName", "HealthDecMainQ1"], "CI");
  assert(ciFields.MaximumAmount === "/Btn", "CI MaximumAmount is button");
  assert(ciFields.MaximumAmountText === "/Tx", "CI MaximumAmountText is text");
  assertCaptureKeysExistInPdf(cap, ciFields, "CI", ["CollectionMethod", "FullNameBagir", "FullNameHolder"]);
}

console.log("\n3) Life full — ריסק מעל 1M");
{
  const Form = loadFormModule("gi-hachshara-life-form.js", "HachsharaLifeForm");
  const payload = basePayload({
    hachsharaRiskAmountMode: "full",
    newPolicies: [{
      company: "הכשרה",
      type: "ריסק",
      startDate: "2026-09-01",
      sumInsured: "1500000",
      sumInsuredPerInsured: { ins_primary: "1500000", ins_spouse: "1000000" }
    }]
  });
  const draft = Form.buildDraft(makeRec(payload));
  assert(Form.qualifies(payload), "life full qualifies");
  assert(draft.primary.sumInsured.includes("1"), "life draft sum");
  const form = captureForm();
  Form.applyDraftToForm(form, draft, null);
  const cap = form.getCapture();
  requireFields(cap, [
    "FirstName", "PID", "GiluiTotalRisk", "GiluiTotalRiskSpouse", "Proffession",
    "Address", "FirstNameOwner", "PIDOwner", "CollectionMethod", "AgentNumber"
  ], "Life");
  assert(cap.CollectionMethod === "Hok", "life CollectionMethod Hok");
  assert(cap.InsurancePlanType === "1", "life plan type risk → 1");
  assertCaptureKeysExistInPdf(cap, lifeFields, "Life", ["FullNameBagir", "FullNameHolder"]);
}

console.log("\n4) Life short — ריסק עד 1M");
{
  const Form = loadFormModule("gi-hachshara-life-short-form.js", "HachsharaLifeShortForm");
  const payload = basePayload({
    hachsharaRiskAmountMode: "short",
    newPolicies: [{
      company: "הכשרה",
      type: "ריסק",
      startDate: "2026-09-01",
      sumInsured: "800000",
      sumInsuredPerInsured: { ins_primary: "800000" }
    }]
  });
  assert(Form.qualifies(payload), "life short qualifies");
  const draft = Form.buildDraft(makeRec(payload));
  const form = captureForm();
  Form.applyDraftToForm(form, draft, null);
  const cap = form.getCapture();
  requireFields(cap, ["FirstName", "PID", "GiluiTotalRisk", "BankName", "AgentNumber"], "Short");
  assertCaptureKeysExistInPdf(cap, shortFields, "Short", [
    "CollectionMethod", "FullNameBagir", "FullNameHolder", "BAccOwners", "PayerName", "PayerPID", "PayerRelation"
  ]);
}

console.log("\n5) Mortgage — ריסק משכנתא");
{
  const Form = loadFormModule("gi-hachshara-mortgage-form.js", "HachsharaMortgageForm");
  // local qualify uses CustomerDocuments helper; also accept module's own filter
  Form.isHachsharaMortgagePolicy = (p) => String(p?.company) === "הכשרה" && /משכנתא/.test(String(p?.type || ""));
  Form.listHachsharaMortgagePolicies = (payload) => (payload.newPolicies || []).filter((p) => Form.isHachsharaMortgagePolicy(p));
  const payload = basePayload({
    hachsharaMortgageAmountMode: "short",
    newPolicies: [{
      company: "הכשרה",
      type: "ריסק משכנתא",
      startDate: "2026-09-01",
      sumInsured: "900000",
      mortgagePurchaseType: "דירה",
      pledgeBanks: [
        { bankName: "לאומי", amount: "900000", years: "25", interestType: "פריים", terminationDate: "2051-09-01" }
      ]
    }]
  });
  const draft = Form.buildDraft(makeRec(payload));
  assert(draft.purchaseType === "apartment", "mortgage draft purchaseType apartment");
  assert(draft.loans.length >= 1, "mortgage draft has loan row");
  const form = captureForm();
  Form.applyDraftToForm(form, draft, null);
  const cap = form.getCapture();
  requireFields(cap, [
    "FirstName", "PID", "LoanSum1", "LoanYears1", "MaximumAmountText",
    "ApartmentPurchase", "LandPurchase", "CollectionMethod", "Profession", "Address"
  ], "Mortgage");
  assert(cap.MaximumAmount === "True", "mortgage marks MaximumAmount checkbox");
  assert(cap.ApartmentPurchase === "1", "mortgage apartment = 1");
  assert(cap.LandPurchase === "2", "mortgage land = 2 when apartment");
  assert(cap.CollectionMethod === "Hok", "mortgage CollectionMethod Hok");
  assertCaptureKeysExistInPdf(cap, mortFields, "Mortgage", ["FullNameBagir", "FullNameHolder"]);
}

console.log("\n6) source guards");
const ciSrc = fs.readFileSync(path.join(ROOT, "gi-hachshara-ci-form.js"), "utf8");
const mortSrc = fs.readFileSync(path.join(ROOT, "gi-hachshara-mortgage-form.js"), "utf8");
assert(ciSrc.includes('MaximumAmountText", person.compensation'), "CI writes amount text field");
assert(ciSrc.includes('MaximumAmount", "True"'), "CI checks amount checkbox");
assert(!/setTextSafe\(form,\s*"MaximumAmount",\s*person\.compensation/.test(ciSrc), "CI no longer setText on MaximumAmount button");
assert(mortSrc.includes('ApartmentPurchase", "1"'), "mortgage apartment export 1");
assert(mortSrc.includes('LandPurchase", "1"'), "mortgage land export 1");
assert(!mortSrc.includes('ApartmentPurchase", "True"'), "mortgage no longer uses True for purchase");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
