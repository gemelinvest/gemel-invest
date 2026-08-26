/* GI-PHOENIX-CI-3148 20260826-phoenix-ci-3148-v1
   Official Phoenix CI / מרפא join form (300101240 / declaration 303)
   in the customer file, plus wizard health questions matching that declaration.
   Run: node _test-phoenix-ci-form.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260826-daily-sales-branch-v4";
const FORM_TAG = "20260826-phoenix-ci-3148-v1";
const WIZARD_TAG = "20260826-migdal-smoke-fu-v1";
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
const form = fs.readFileSync(path.join(ROOT, "gi-phoenix-ci-form.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
const pdfPath = path.join(ROOT, "forms", "phoenix-ci", "phoenix-ci-join.pdf");

console.log("1) syntax + files");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "app.js syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "gi-wizard.js syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-phoenix-ci-form.js")]).status === 0, "gi-phoenix-ci-form.js syntax");
assert(fs.existsSync(pdfPath), "official PDF template exists");
assert(fs.statSync(pdfPath).size > 100000, "PDF template is not empty");

console.log("\n2) cache");
assert(html.includes("app.js?v=" + APP_TAG), "index.html bumps app.js cache");
assert(html.includes("app.css?v=" + APP_TAG), "index.html bumps app.css cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service worker cache bumped");
assert(app.includes('GI_WIZARD_JS_VERSION = "' + WIZARD_TAG + '"'), "app wizard version");
assert(wiz.includes('GI_WIZARD_BUILD = "' + WIZARD_TAG + '"'), "wizard build mark");
assert(app.includes("./gi-phoenix-ci-form.js?v=" + FORM_TAG), "form chunk cache");
assert(form.includes('VERSION: "' + FORM_TAG + '"'), "form VERSION");

console.log("\n3) customer-file document");
assert(app.includes('phoenixCiForm: "phoenix_ci_form"'), "document type registered");
assert(app.includes('"phoenix_ci_form"'), "official join types include phoenix CI");
assert(app.includes("qualifiesForPhoenixCiForm"), "qualify helper");
assert(app.includes("isPhoenixCiPolicy"), "policy matcher");
assert(app.includes("טופס מקורי — מחלות קשות / מרפא · הפניקס"), "document title");
assert(app.includes("doc_phoenix_ci_form"), "virtual inject id");
assert(app.includes("data-open-phoenix-ci-doc"), "open button");
assert(app.includes("openPhoenixCiForm"), "open method");
assert(app.includes("ensurePhoenixCiFormLoaded"), "lazy loader");
assert(app.includes("טופס מקורי — ריסק / משכנתא עד גיל 55 · הפניקס"), "life short form kept");
assert(app.includes("טופס מקורי — בריאות · הפניקס"), "health form kept");

console.log("\n4) wizard declaration 303");
assert(wiz.includes("טופס 300101240"), "catalog cites join form 300101240");
assert(wiz.includes("הצהרה 303"), "catalog cites declaration 303");
assert(!wiz.includes("טופס 300301515 · חלק א׳ + חלק ב׳"), "old 515 A+B catalog removed from CI");
assert(wiz.includes("בשנתיים האחרונות עברת או הומלץ לך"), "tests window is 2 years");
assert(!/critical_illness:[\s\S]{0,1800}בחמש השנים האחרונות/.test(wiz), "CI catalog no longer uses 5-year tests");
assert(wiz.includes("סיגריה אלקטרונית"), "smoking includes e-cig");
assert(wiz.includes("3.7 מחלת סוכרת"), "diabetes 3.7");
assert(wiz.includes("questionnaireNos:['6']"), "diabetes follow-up 6");
assert(wiz.includes("3.9 מחלה נפשית"), "mental 3.9");
assert(wiz.includes("questionnaireNos:['15']"), "mental follow-up 15");
assert(wiz.includes("3.11 האם למיטב ידיעתך"), "family 3.11");
assert(wiz.includes("questionnaireNos:['22']"), "family follow-up 22");
assert(wiz.includes("questionnaireNos:['18','20']"), "tests/hospital follow-ups 18,20");
assert(!/critical_illness:[\s\S]{0,2500}ci_alcohol/.test(wiz), "alcohol question removed from CI");
assert(!/critical_illness:[\s\S]{0,2500}ci_immune/.test(wiz), "HIV question removed from CI");
assert(app.includes("phoenix_critical_illness__ci_diabetes"), "HEALTH_QKEYS includes diabetes");

console.log("\n5) overlay plan from stored file data");
const sandbox = {
  window: {},
  globalThis: {},
  document: {
    getElementById(){ return null; },
    createElement(){ return { style: {}, addEventListener(){}, querySelector(){ return null; }, querySelectorAll(){ return []; } }; },
    head: { appendChild(){} },
    body: { appendChild(){} }
  },
  console,
  GI_OFFICIAL_FORM_FILL: {
    visualHebrew(v){ return String(v); },
    pickPerson(ins){ return (ins && ins.data) || ins || {}; },
    fileFallbacks(){ return []; },
    pickPayment(){ return { method: "ho", isHo: true, bank: { name: "לאומי", branch: "12", account: "345", bankNo: "10" }, cc: {} }; },
    attachDraftHealth(){
      return {
        healthResponses: {
          phoenix_critical_illness__ci_smoking: { p1: { answer: "yes", fields: { cigarettes: "10" } } },
          phoenix_critical_illness__ci_tests: { p1: { answer: "no" } },
          phoenix_critical_illness__ci_heart: { p1: { answer: "no" } }
        },
        primaryId: "p1",
        spouseId: "",
        childIds: []
      };
    },
    healthAnswer(responses, qKey, insId){
      const a = String(responses?.[qKey]?.[insId]?.answer || "").toLowerCase();
      return (a === "yes" || a === "no") ? a : "";
    },
    healthAnswerOrSolo(){ return ""; }
  }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.runInNewContext(form, sandbox);
const PhoenixCiForm = sandbox.PhoenixCiForm;
assert(!!PhoenixCiForm, "PhoenixCiForm exported");
assert(PhoenixCiForm.isPhoenixCiPolicy({ company: "הפניקס", type: "מחלות קשות" }), "CI type qualifies");
assert(PhoenixCiForm.isPhoenixCiPolicy({ company: "הפניקס", type: "סרטן" }), "cancer type qualifies");
assert(!PhoenixCiForm.isPhoenixCiPolicy({ company: "הפניקס", type: "ריסק" }), "risk type does not qualify");
assert(!PhoenixCiForm.isPhoenixCiPolicy({ company: "הפניקס", type: "בריאות" }), "health type does not qualify");
assert(!PhoenixCiForm.isPhoenixCiPolicy({ company: "מנורה", type: "מחלות קשות" }), "other company does not qualify");

const rec = {
  agentName: "סוכן בדיקה",
  payload: {
    insuranceStartDate: "2026-08-26",
    companyAgentNumbers: { "הפניקס": "12345" },
    primary: {
      firstName: "דוד",
      lastName: "כהן",
      idNumber: "123456789",
      birthDate: "1985-03-02",
      gender: "זכר",
      heightCm: "178",
      weightKg: "80",
      paymentMethod: "ho",
      ho: { bankName: "לאומי", branch: "12", account: "345", bankNo: "10" }
    },
    insureds: [{
      id: "p1",
      type: "primary",
      data: {
        firstName: "דוד",
        lastName: "כהן",
        idNumber: "123456789",
        birthDate: "1985-03-02",
        gender: "זכר",
        heightCm: "178",
        weightKg: "80"
      }
    }],
    newPolicies: [{
      company: "הפניקס",
      type: "מחלות קשות",
      phoenixCriticalAmount: "250000",
      startDate: "2026-09-01",
      _addedAt: "2026-08-26T10:00:00.000Z"
    }]
  }
};
const draft = PhoenixCiForm.buildDraft(rec);
assert(draft.primary.firstName === "דוד", "draft keeps first name");
assert(draft.primary.idNumber === "123456789", "draft keeps id");
assert(String(draft.primary.criticalAmount).replace(/[^\d]/g, "") === "250000", "draft fills merape amount");
assert(draft.insuranceBegin === "01/09/2026", "draft formats start date");
const ops = PhoenixCiForm.overlayPlan(draft);
assert(ops.some((op) => op.page === 0 && String(op.text).includes("123456789")), "overlay writes id number on page 1");
assert(ops.some((op) => op.page === 2 && String(op.text).replace(/[^\d]/g, "") === "250000"), "overlay writes CI amount on page 3");
assert(ops.some((op) => op.page === 4 && String(op.text) === "178"), "overlay writes height on declaration page");
assert(ops.some((op) => op.page === 4 && op.text === "X" && Math.abs(op.x - 250.2) < 1), "overlay marks smoking yes");
assert(ops.some((op) => op.page === 4 && op.text === "X" && Math.abs(op.x - 223.8) < 1 && Math.abs(op.y - 524.2) < 1), "overlay marks tests no");
assert(ops.some((op) => op.page === 8 && String(op.text).includes("לאומי")), "overlay writes stored bank name");
assert(form.includes("cc: draft.payment?.cc"), "passes stored card object");
assert(form.includes("visualHebrew"), "uses visual Hebrew for overlay draw");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
