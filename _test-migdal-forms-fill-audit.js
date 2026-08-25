/* GI-MIGDAL-FORMS-FILL-AUDIT 2026-08-25
   Migdal official forms: identity + health declaration mapping after customer create.
   Run: node _test-migdal-forms-fill-audit.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const vm = require("vm");

const ROOT = __dirname;
const TAG = "20260825-migdal-health-fill-v1";
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
  assert(start > 0 && end > start, "GI_OFFICIAL_FORM_FILL block found");
  const ctx = { window: {}, console };
  vm.runInNewContext(app.slice(start, end) + "\nthis.GI_OFFICIAL_FORM_FILL = GI_OFFICIAL_FORM_FILL;", ctx);
  return ctx.GI_OFFICIAL_FORM_FILL;
}

function loadForm(file, globalName, helper){
  const src = fs.readFileSync(path.join(ROOT, file), "utf8");
  const sandbox = {
    window: {
      GI_OFFICIAL_FORM_FILL: helper,
      Auth: { current: { name: "סוכן בדיקה" } },
      CustomerDocuments: {
        canDownloadOfficialJoinForm(){ return true; }
      }
    },
    console
  };
  sandbox.globalThis = sandbox.window;
  vm.runInNewContext(src, sandbox, { filename: file });
  return sandbox.window[globalName];
}

function person(extra){
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
    paymentMethod: "ho",
    ho: { bankName: "לאומי", branch: "123", account: "456789", bankNo: "10" }
  }, extra || {});
}

function makeRec(payload){
  return {
    id: "cust_mig",
    firstName: "דוד",
    lastName: "כהן",
    idNumber: "123456789",
    phone: "0501234567",
    agentName: "סוכן בדיקה",
    payload
  };
}

console.log("1) cache + syntax");
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
["gi-migdal-life-form.js", "gi-migdal-mortgage-form.js", "gi-migdal-cancer-form.js"].forEach((f) => {
  assert(spawnSync(process.execPath, ["--check", path.join(ROOT, f)]).status === 0, f + " syntax");
  assert(app.includes("./" + f + "?v=" + TAG), "href " + f);
});
assert(html.includes("app.js?v=" + TAG), "index cache");
assert(sw.includes("gi-v12-" + TAG), "SW cache");
assert(app.includes("resolveHealthPrimaryId"), "primary health id resolver");
assert(app.includes("migdalMortgageHealthRows"), "mortgage named health rows");
assert(app.includes('detailField: "Text1"'), "cancer family detail field");

const H = loadHelper();

console.log("\n2) life — short risk health (the reported bug)");
{
  const Form = loadForm("gi-migdal-life-form.js", "MigdalLifeForm", H);
  const primary = person();
  const responses = {};
  [
    "magdal_risk2m__hobby", "magdal_risk2m__smoking", "magdal_risk2m__heart",
    "magdal_risk2m__diabetes", "magdal_risk2m__respiratory", "magdal_risk2m__cancer",
    "magdal_risk2m__digestive", "magdal_risk2m__mental", "magdal_risk2m__neuro",
    "magdal_risk2m__kidneys", "magdal_risk2m__immune", "magdal_risk2m__disability",
    "magdal_risk2m__hospital", "magdal_risk2m__tests"
  ].forEach((k) => { responses[k] = { wizard_ins_old: { answer: "no" } }; });
  primary.healthDeclaration = { responses };
  const payload = {
    primary,
    insureds: [{ id: "file_ins_new", type: "primary", label: "מבוטח ראשי", data: primary }],
    companyAgentNumbers: { "מגדל": "112233" },
    insuranceStartDate: "2026-09-01",
    newPolicies: [{ company: "מגדל", type: "ריסק", sumInsured: "800000", startDate: "2026-09-01" }]
  };
  const draft = Form.buildDraft(makeRec(payload));
  assert(draft.primaryId === "wizard_ins_old", "life draft recovers response insured id");
  assert(draft.primary.firstName === "דוד", "life draft first name");
  assert(String(draft.primary.sumInsured).indexOf("800") >= 0, "life draft sum insured");
  const cap = Object.create(null);
  Form.fillOriginalTemplate = null;
  // apply via same path as PDF fill health+person
  const fakeForm = { __giCapture: cap };
  Form.applyPerson(fakeForm, draft.primary, false, null);
  Form.applyPerson(fakeForm, draft.spouse, true, null);
  H.applyMappedHealthYesNo(fakeForm, {
    map: "migdal_life",
    responses: draft.healthResponses,
    primaryId: draft.primaryId,
    spouseId: draft.spouseId,
    childIds: draft.childIds
  });
  assert(cap.FirstName === "דוד", "life FirstName");
  assert(cap.PID === "123456789", "life PID");
  assert(cap.CityCode === "חולון", "life city");
  assert(cap.IsSmoking === "False", "life smoking from health map");
  assert(cap.MGQ1 === "2", "life MGQ1 hobby");
  assert(cap.MGQ6 === "2", "life MGQ6 hospital");
  assert(cap.MGQ16 === "2", "life MGQ16 heart");
  assert(cap.MGQ19 === "2", "life MGQ19 diabetes");
  assert(cap.MGQ20 === "2", "life MGQ20 immune");
  const healthFilled = Object.keys(cap).filter((k) => k === "IsSmoking" || /^MGQ\d+$/.test(k)).length;
  assert(healthFilled >= 14, "life short fills ≥14 health controls (got " + healthFilled + ")");
}

console.log("\n3) life — extended risk");
{
  const cap = {};
  H.applyMappedHealthYesNo({ __giCapture: cap }, {
    map: "migdal_life",
    responses: {
      magdal_riskx__hobby: { p1: { answer: "no" } },
      magdal_riskx__smoking: { p1: { answer: "yes" } },
      magdal_riskx__alcohol: { p1: { answer: "no" } },
      magdal_riskx__family: { p1: { answer: "yes" } },
      magdal_riskx__adl: { p1: { answer: "no" } }
    },
    primaryId: "p1"
  });
  assert(cap.IsSmoking === "True", "extended smoking");
  assert(cap.MGQ1 === "2", "extended hobby");
  assert(cap.MGQ3 === "2", "extended alcohol");
  assert(cap.MGQ9 === "1", "extended family");
  assert(cap.MGQ24 === "2", "extended adl");
}

console.log("\n4) mortgage");
{
  const Form = loadForm("gi-migdal-mortgage-form.js", "MigdalMortgageForm", H);
  const primary = person();
  const responses = {
    magdal_mort__smoking: { p1: { answer: "no" } },
    magdal_mort__cancer: { p1: { answer: "no" } },
    magdal_mort__neuro: { p1: { answer: "no" } },
    magdal_mort__hospital: { p1: { answer: "yes" } },
    magdal_mort__hobby: { p1: { answer: "no" } }
  };
  primary.healthDeclaration = { responses };
  const payload = {
    primary,
    insureds: [{ id: "p1", type: "primary", data: primary }],
    companyAgentNumbers: { "מגדל": "9988" },
    newPolicies: [{
      company: "מגדל",
      type: "ריסק משכנתא",
      sumInsured: "900000",
      startDate: "2026-09-01",
      pledgeBanks: [{ bankName: "לאומי", amount: "900000", years: "25", bankNo: "10", branch: "801" }]
    }]
  };
  const draft = Form.buildDraft(makeRec(payload));
  const cap = Object.create(null);
  const form = { __giCapture: cap };
  Form.applyPerson(form, draft.primary, false, null);
  Form.applyLoaner(form, draft.loaner, null);
  Form.applyLoans(form, draft.loans, null);
  H.applyOfficialHealthAndNames(form, draft, null, { skipHealth: true, visual: false });
  H.applyMappedHealthYesNo(form, {
    map: "migdal_mortgage",
    responses: draft.healthResponses,
    primaryId: draft.primaryId,
    spouseId: draft.spouseId
  });
  assert(cap.FirstName === "דוד", "mortgage FirstName");
  assert(cap.LoanSum1 === "900,000" || cap.LoanSum1 === "900000" || String(cap.LoanSum1).indexOf("900") >= 0, "mortgage loan sum");
  assert(cap.IsSmoking === "False", "mortgage smoking");
  assert(cap.HealthDecMainQ1 === "2", "mortgage cancer → Q1 not smoking");
  assert(cap.HealthDecMainQ11 === "1", "mortgage hospital → Q11");
  assert(cap.HealthDecMainQ14 === "2", "mortgage hobby → Q14");
}

console.log("\n5) cancer");
{
  const Form = loadForm("gi-migdal-cancer-form.js", "MigdalCancerForm", H);
  const primary = person();
  primary.healthDeclaration = {
    responses: {
      magdal_cancer__tests: { p1: { answer: "no" } },
      magdal_cancer__smoking: { p1: { answer: "no" } },
      magdal_cancer__tumors: { p1: { answer: "no" } },
      magdal_cancer__digestive: { p1: { answer: "no" } },
      magdal_cancer__diabetes: { p1: { answer: "no" } },
      magdal_cancer__family: { p1: { answer: "yes", fields: { details: "אב — סרטן המעי בגיל 48" } } }
    }
  };
  const payload = {
    primary,
    insureds: [{ id: "p1", type: "primary", data: primary }],
    companyAgentNumbers: { "מגדל": "1" },
    newPolicies: [{ company: "מגדל", type: "סרטן", startDate: "2026-09-01", compensation: "200000" }]
  };
  const draft = Form.buildDraft(makeRec(payload));
  const cap = Object.create(null);
  H.applyMappedHealthYesNo({ __giCapture: cap }, {
    map: "migdal_cancer",
    responses: draft.healthResponses,
    primaryId: draft.primaryId,
    spouseId: draft.spouseId,
    childIds: draft.childIds
  });
  assert(cap.IsSmoking === "False", "cancer smoking");
  assert(cap.HealthDecMainQ2 === "2", "cancer tests");
  assert(cap.HealthDecMainQ3 === "2", "cancer tumors");
  assert(cap.HealthDecMainQ5 === "2", "cancer diabetes");
  assert(!cap.HealthDecMainQ6, "no bogus Q6");
  assert(String(cap.Text1 || "").indexOf("כן") >= 0, "cancer family → Text1");
  assert(String(cap.Text1 || "").indexOf("אב") >= 0, "cancer family detail text");
}

console.log("\n6) source guards");
const mortSrc = fs.readFileSync(path.join(ROOT, "gi-migdal-mortgage-form.js"), "utf8");
assert(mortSrc.includes('map: "migdal_mortgage"'), "mortgage uses named health map");
assert(!/keys:\s*"migdal_mortgage"/.test(mortSrc), "mortgage no longer zips HEALTH_QKEYS");
assert(mortSrc.includes("helper.setExport") || mortSrc.includes("helper && helper.setExport"), "mortgage setExport via helper");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
