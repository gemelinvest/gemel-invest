/* GI-HACH-HEALTH-FORM 2026-08-26
   Official Hachshara health join form (2400 / 2498) in customer documents.
   Run: node _test-hachshara-health-form.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const vm = require("vm");

const ROOT = __dirname;
const APP_TAG = "20260826-sales-kpis-v1";
const FORM_TAG = "20260826-hach-health-form-v1";
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

function loadFormModule(helper){
  const src = fs.readFileSync(path.join(ROOT, "gi-hachshara-health-form.js"), "utf8");
  const sandbox = {
    window: { GI_OFFICIAL_FORM_FILL: helper, Auth: { current: { name: "סוכן בדיקה" } } },
    globalThis: null,
    console
  };
  sandbox.globalThis = sandbox.window;
  vm.runInNewContext(src, sandbox, { filename: "gi-hachshara-health-form.js" });
  return sandbox.window.HachsharaHealthForm;
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const form = fs.readFileSync(path.join(ROOT, "gi-hachshara-health-form.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
const pdfPath = path.join(ROOT, "forms", "hachshara-health", "hachshara-health-join.pdf");

console.log("1) syntax + files");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-hachshara-health-form.js")]).status === 0, "node --check gi-hachshara-health-form.js");
assert(fs.existsSync(pdfPath), "official PDF template exists");
assert(fs.statSync(pdfPath).size > 100000, "PDF template is not empty");

console.log("\n2) cache");
assert(html.includes("app.js?v=" + APP_TAG), "index.html bumps app.js cache");
assert(app.includes('GI_HACHSHARA_HEALTH_FORM_HREF = "./gi-hachshara-health-form.js?v=' + FORM_TAG + '"'), "form chunk cache bumped");
assert(sw.includes("gi-v12-" + APP_TAG), "service worker cache bumped");

console.log("\n3) customer-file document");
assert(app.includes('hachsharaHealthForm: "hachshara_health_form"'), "document type registered");
assert(app.includes('"hachshara_health_form"'), "type listed in official join forms");
assert(app.includes("qualifiesForHachsharaHealthForm"), "qualify helper exists");
assert(app.includes("טופס מקורי — בריאות · הכשרה"), "document title is live");
assert(app.includes("data-open-hachshara-health-doc"), "documents tab has open button");
assert(app.includes("openHachsharaHealthForm"), "customer file opens the form");
assert(app.includes("ensureHachsharaHealthFormLoaded"), "form chunk loads on demand");
assert(app.includes("if(type === this.TYPES.hachsharaHealthForm) return this.qualifiesForHachsharaHealthForm(payload, rec);"), "old health docs stay hidden outside period");

console.log("\n4) fill engine");
assert(form.includes("function installHachsharaHealthForm"), "form module wraps itself");
assert(form.includes("buildDraft"), "draft builder exists");
assert(form.includes("fillOriginalTemplate"), "PDF fill exists");
assert(form.includes("Heebo-Bold.ttf"), "bold Hebrew font");
assert(form.includes("cc: draft.payment?.cc"), "passes stored card");
assert(form.includes("HMORadioSpouse"), "spouse HMO uses HMORadioSpouse on this PDF");
assert(form.includes("chkMain"), "marks cover letters chkMain*");
assert(form.includes("chkBzug"), "marks spouse cover letters");
assert(form.includes("chkChild"), "marks child cover letters");
assert(form.includes('map: "health"'), "health yes/no uses dedicated 2400/2498 map");
assert(form.includes("applyMappedHealthYesNo"), "named health map for yes/no");
assert(form.includes("applyInsuredPayerOwner"), "fills payer/owner from stored data");
assert(form.includes("applyStoredPayment"), "fills HO/CC only when stored");
assert(form.includes("renderPdfFieldEditor"), "pre-download editor lists PDF fields");
assert(!form.includes("HachsharaCiForm"), "does not leak CI form global");

console.log("\n5) covers + health Q map");
const helper = loadHelper();
const Form = loadFormModule(helper);
assert(Form.isHachsharaHealthPolicy({ company: "הכשרה", type: "בריאות" }), "בריאות policy qualifies");
assert(!Form.isHachsharaHealthPolicy({ company: "הכשרה", type: "מחלות קשות" }), "CI does not qualify as health");
assert(!Form.isHachsharaHealthPolicy({ company: "הכשרה", type: "ריסק משכנתא" }), "mortgage does not qualify as health");
assert(!Form.isHachsharaHealthPolicy({ company: "הכשרה", type: "ריסק" }), "risk does not qualify as health");
assert(!Form.isHachsharaHealthPolicy({ company: "הפניקס", type: "בריאות" }), "other company does not qualify");

const letters = Form.coverLetters([
  "ניתוחים בישראל מהשקל הראשון",
  "השתלות וטיפולים מיוחדים מחוץ לישראל",
  "תרופות מחוץ לסל שירותי הבריאות",
  "ניתוחים וטיפולים מחליפי ניתוח מחוץ לישראל",
  "משלים שב\"ן ללא השתתפות עצמית",
  "ייעוץ ובדיקות",
  "שירות פרימיום לילד"
]);
assert(letters.indexOf("B") >= 0, "שקל ראשון → B");
assert(letters.indexOf("C") >= 0, "השתלות → C");
assert(letters.indexOf("D") >= 0, "תרופות → D");
assert(letters.indexOf("E") >= 0, "ניתוחים בחו״ל → E");
assert(letters.indexOf("R") >= 0, "משלים שב״ן ללא ה.ע → R");
assert(letters.indexOf("F") >= 0, "ייעוץ ובדיקות → F");
assert(letters.indexOf("M") >= 0, "פרימיום לילד → M");
assert(letters.indexOf("A") < 0, "אין 5000 אז לא A");
const letters5000 = Form.coverLetters(["משלים שב\"ן עם השתתפות עצמית 5,000 ₪"]);
assert(letters5000.indexOf("A") >= 0, "שב״ן 5000 → A");
assert(letters5000.indexOf("R") < 0, "שב״ן 5000 does not also mark R");

const healthRows = helper.hachsharaHealthRows("health");
assert(healthRows[0] && healthRows[0].smoke === true, "health smoking is named onto IsSmoking");
assert(healthRows.filter((r) => r.q).length === 29, "health form has 29 declaration radios");
assert((healthRows.find((r) => r.q === 5)?.keys || []).indexOf("hachshara__breath_chest") >= 0, "Q5 is breath_chest, not memory");
assert((healthRows.find((r) => r.q === 10)?.keys || []).indexOf("hachshara__respiratory") >= 0, "Q10 is respiratory");
assert((healthRows.find((r) => r.q === 10)?.keys || []).indexOf("hachshara__breath_chest") < 0, "Q10 does not steal breath_chest");

const cap = {};
helper.applyMappedHealthYesNo({ __giCapture: cap }, {
  map: "health",
  responses: {
    hachshara__hospitalization: { p1: { answer: "no" } },
    hachshara__breath_chest: { p1: { answer: "yes" } },
    hachshara__respiratory: { p1: { answer: "no" } }
  },
  primaryId: "p1"
});
assert(cap.HealthDecMainQ1 === "2", "health Q1 hospitalization no");
assert(cap.HealthDecMainQ5 === "1", "health Q5 breath_chest yes");
assert(cap.HealthDecMainQ10 === "2", "health Q10 respiratory no");

const rec = {
  agentName: "סוכן בדיקה",
  payload: {
    insuranceStartDate: "2026-09-01",
    companyAgentNumbers: { "הכשרה": "998877" },
    newPolicies: [{
      company: "הכשרה",
      type: "בריאות",
      startDate: "2026-09-01",
      insuredIds: ["ins_primary"],
      healthCovers: ["ניתוחים בישראל מהשקל הראשון", "ייעוץ ובדיקות"]
    }],
    insureds: [{
      id: "ins_primary",
      type: "primary",
      data: {
        firstName: "דוד", lastName: "כהן", idNumber: "123456789",
        birthDate: "1985-03-15", gender: "זכר", maritalStatus: "נשוי",
        phone: "0501234567", email: "david@example.com",
        city: "חולון", street: "הרצל", houseNumber: "12", zip: "5821000",
        occupation: "נהג", clinic: "מכבי", shaban: "אין שב״ן",
        heightCm: "178", weightKg: "82", smokingStatus: "לא",
        paymentMethod: "ho",
        ho: { bankName: "לאומי", branch: "12", account: "345", bankNo: "10" },
        healthDeclaration: {
          responses: {
            hachshara__hospitalization: { ins_primary: { answer: "no" } },
            hachshara__breath_chest: { ins_primary: { answer: "yes" } }
          }
        }
      }
    }]
  }
};
const draft = Form.buildDraft(rec);
assert(draft.primary.firstName === "דוד", "draft primary firstName");
assert(draft.agentNumber === "998877", "draft agent number");
assert((draft.primary.coverLetters || []).indexOf("B") >= 0, "draft marks שקל ראשון cover");
assert((draft.primary.coverLetters || []).indexOf("F") >= 0, "draft marks ambulatory cover");
const capture = Object.create(null);
Form.applyDraftToForm({ __giCapture: capture }, draft, null);
assert(capture.FirstName === "דוד", "fills FirstName");
assert(capture.PID === "123456789", "fills PID");
assert(capture.HMORadio === "1", "מכבי → HMORadio 1");
assert(capture.Gender === "True", "male → True");
assert(capture.chkMainB === "1", "cover B checked");
assert(capture.chkMainF === "1", "cover F checked");
assert(capture.HealthDecMainQ1 === "2", "draft Q1 no");
assert(capture.HealthDecMainQ5 === "1", "draft Q5 yes");
assert(capture.BankName === "לאומי", "fills stored HO bank");

console.log("\n6) isolation");
assert(app.includes("qualifiesForHachsharaCiForm"), "CI qualify remains");
assert(app.includes("טופס מקורי — מחלות קשות · הכשרה"), "CI title remains");
assert(app.includes("טופס מקורי — בריאות · הפניקס"), "Phoenix health title remains");
assert(app.includes("paintDashboardAfterFaceLogin"), "face-login KPI paint remains");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
