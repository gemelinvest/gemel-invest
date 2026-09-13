/* GI-CLAL-MORTGAGE-HEALTH-DECL 2026-09-13
   Lock Clal mortgage join PDF health rows to printed order + Yes/No geometry.
   Additional Qs: higher Y = לא, lower Y = כן,פרט (was inverted before this fix).
   Run: node _test-clal-mortgage-health-decl.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");
const { PDFDocument, PDFName } = require("pdf-lib");

const ROOT = __dirname;
const APP_TAG = "20260913-clal-mortgage-health-decl-v1";
const FORM_TAG = "20260913-clal-mortgage-health-decl-v1";
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
  const ctx = { window: { PDFLib: require("pdf-lib") }, console, PDFLib: require("pdf-lib") };
  vm.runInNewContext(app.slice(start, end) + "\nthis.GI_OFFICIAL_FORM_FILL = GI_OFFICIAL_FORM_FILL;", ctx);
  ctx.window.GI_OFFICIAL_FORM_FILL = ctx.GI_OFFICIAL_FORM_FILL;
  return ctx.GI_OFFICIAL_FORM_FILL;
}

function loadForm(helper){
  const src = fs.readFileSync(path.join(ROOT, "gi-clal-mortgage-form.js"), "utf8");
  const sandbox = {
    window: { GI_OFFICIAL_FORM_FILL: helper, PDFLib: require("pdf-lib") },
    globalThis: null,
    console,
    PDFLib: require("pdf-lib")
  };
  sandbox.globalThis = sandbox.window;
  vm.runInNewContext(src, sandbox);
  return sandbox.window.ClalMortgageForm;
}

function fieldOn(form, name){
  const field = form.getCheckBox(name);
  return field.acroField.getWidgets().some((w) => {
    const as = String(w.dict.lookup(PDFName.of("AS")) || "").replace(/^\//, "");
    return as && as !== "Off";
  });
}

function yOf(form, name){
  return form.getCheckBox(name).acroField.getWidgets()[0].getRectangle().y;
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const formSrc = fs.readFileSync(path.join(ROOT, "gi-clal-mortgage-form.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-clal-mortgage-form.js")]).status === 0, "form syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "app.js syntax");
assert(html.includes("app.js?v=" + APP_TAG), "index app.js cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");
assert(app.includes('GI_CLAL_MORTGAGE_FORM_HREF = "./gi-clal-mortgage-form.js?v=' + FORM_TAG + '"'), "form href cache");
assert(formSrc.includes('VERSION: "' + FORM_TAG + '"'), "form VERSION");

console.log("\n2) printed-order named rows (not index-zip)");
assert(formSrc.includes('keys: ["clal_risk_neuro"]'), "row1 neuro");
assert(formSrc.includes('keys: ["clal_risk_rheumatic"]'), "row17 rheumatic");
assert(formSrc.includes('keys: ["clal_mortgage_alcohol"]'), "row18 alcohol");
assert(formSrc.includes('keys: ["clal_mortgage_drugs"]'), "row19 drugs");
assert(formSrc.includes('spouseYes: "fhfgh"'), "musculoskeletal spouse Yes broken AcroForm name");
assert(formSrc.includes('spouseYes: "gfsxbhgf"'), "rheumatic spouse Yes broken AcroForm name");
assert(formSrc.includes('spouseYes: "hnjfhjmkhj"'), "alcohol spouse Yes broken AcroForm name");

console.log("\n3) additional Qs: לא above כן (Y high = No) — was inverted");
assert(formSrc.includes('keys: ["clal_risk_regular_meds"], primaryNo: "Check Box211", primaryYes: "Check Box212"'), "meds No=211 Yes=212");
assert(formSrc.includes('keys: ["clal_risk_future_surgery"], primaryNo: "Check Box213", primaryYes: "Check Box214"'), "future No=213 Yes=214");
assert(formSrc.includes('keys: ["clal_risk_hospital_surgery"], primaryNo: "Check Box215", primaryYes: "Check Box216"'), "hospital No=215 Yes=216");
assert(formSrc.includes('keys: ["clal_risk_disability"], primaryNo: "Check Box217", primaryYes: "Check Box218"'), "disability No=217 Yes=218");
assert(formSrc.includes('spouseNo: "Check Box221", spouseYes: "Check Box222"'), "spouse meds No=221 Yes=222");
assert(formSrc.includes('spouseNo: "Check Box227", spouseYes: "Check Box228"'), "spouse disability No=227 Yes=228");
assert(!formSrc.includes('primaryNo: "Check Box212", primaryYes: "Check Box211"'), "meds not inverted");
assert(!formSrc.includes('primaryNo: "Check Box218", primaryYes: "Check Box217"'), "disability not inverted");

(async () => {
  console.log("\n4) PDF geometry: No widgets sit above Yes widgets");
  const bytes = fs.readFileSync(path.join(ROOT, "forms/clal-mortgage/clal-mortgage-join.pdf"));
  const geoPdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const geoForm = geoPdf.getForm();
  [
    ["Check Box211", "Check Box212"],
    ["Check Box213", "Check Box214"],
    ["Check Box215", "Check Box216"],
    ["Check Box217", "Check Box218"],
    ["Check Box221", "Check Box222"],
    ["Check Box223", "Check Box224"],
    ["Check Box225", "Check Box226"],
    ["Check Box227", "Check Box228"]
  ].forEach(([noName, yesName]) => {
    assert(yOf(geoForm, noName) > yOf(geoForm, yesName), noName + " (לא) above " + yesName + " (כן)");
  });

  console.log("\n5) live fill: yes paints כן, no paints לא");
  const helper = loadHelper();
  const ClalMortgageForm = loadForm(helper);
  assert(!!ClalMortgageForm && typeof ClalMortgageForm.applyHealth === "function", "ClalMortgageForm.applyHealth");

  const fillPdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const fillForm = fillPdf.getForm();
  const draft = {
    primaryId: "p1",
    spouseId: "s1",
    healthResponses: {
      clal_risk_neuro: {
        p1: { answer: "yes" },
        s1: { answer: "no" }
      },
      clal_risk_regular_meds: {
        p1: { answer: "yes", fields: { meds: "אספירין" } },
        s1: { answer: "no" }
      },
      clal_risk_disability: {
        p1: { answer: "no" },
        s1: { answer: "yes", details: "נכות 20%" }
      },
      clal_mortgage_alcohol: {
        p1: { answer: "no" },
        s1: { answer: "yes" }
      }
    }
  };
  ClalMortgageForm.applyHealth(fillForm, draft, null);

  assert(fieldOn(fillForm, "Check Box210"), "primary neuro yes → Check Box210");
  assert(!fieldOn(fillForm, "Check Box209"), "primary neuro yes does not paint No");
  assert(fieldOn(fillForm, "Check Box89"), "spouse neuro no → Check Box89");
  assert(!fieldOn(fillForm, "Check Box88"), "spouse neuro no does not paint Yes");

  assert(fieldOn(fillForm, "Check Box212"), "primary meds yes → Check Box212 (כן,פרט)");
  assert(!fieldOn(fillForm, "Check Box211"), "primary meds yes does not paint לא");
  assert(fieldOn(fillForm, "Check Box221"), "spouse meds no → Check Box221 (לא)");
  assert(!fieldOn(fillForm, "Check Box222"), "spouse meds no does not paint כן");

  assert(fieldOn(fillForm, "Check Box217"), "primary disability no → Check Box217");
  assert(!fieldOn(fillForm, "Check Box218"), "primary disability no does not paint כן");
  assert(fieldOn(fillForm, "Check Box228"), "spouse disability yes → Check Box228");
  assert(!fieldOn(fillForm, "Check Box227"), "spouse disability yes does not paint לא");

  assert(fieldOn(fillForm, "Check Box445454"), "primary alcohol no");
  assert(fieldOn(fillForm, "hnjfhjmkhj"), "spouse alcohol yes → broken-name field");

  try {
    const medsText = fillForm.getTextField("Text1").getText();
    assert(/אספירין/.test(medsText || ""), "primary meds detail → Text1");
  } catch(e){
    assert(false, "Text1 readable: " + e.message);
  }
  try {
    const disText = fillForm.getTextField("Text9").getText();
    assert(/נכות/.test(disText || ""), "spouse disability detail → Text9");
  } catch(e){
    assert(false, "Text9 readable: " + e.message);
  }

  console.log("\n" + (failed ? failed + " failed, " : "") + passed + " passed");
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
