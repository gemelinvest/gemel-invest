/* GI-MENORA-HEALTH-DECL-FILL 2026-08-28
   Original Menora join PDFs: כן/לא widgets, 1:1 wizard mapping, Migdal health → Menora.
   Run: node _test-menora-health-decl-fill.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");
const { PDFDocument, PDFName } = require("pdf-lib");

const ROOT = __dirname;
const APP_TAG = "20260828-menora-health-decl-v1";
const FORM_TAG = "20260828-menora-health-decl-v1";
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
  const ctx = { window: { PDFLib: require("pdf-lib") }, console };
  vm.runInNewContext(app.slice(start, end) + "\nthis.GI_OFFICIAL_FORM_FILL = GI_OFFICIAL_FORM_FILL;", ctx);
  ctx.window.GI_OFFICIAL_FORM_FILL = ctx.GI_OFFICIAL_FORM_FILL;
  return ctx.GI_OFFICIAL_FORM_FILL;
}

function loadForm(file, globalName, helper){
  const src = fs.readFileSync(path.join(ROOT, file), "utf8");
  const sandbox = {
    window: { GI_OFFICIAL_FORM_FILL: helper, PDFLib: require("pdf-lib") },
    globalThis: null,
    console,
    PDFLib: require("pdf-lib")
  };
  sandbox.globalThis = sandbox.window;
  vm.runInNewContext(src, sandbox);
  return sandbox.window[globalName];
}

function widgetOn(field){
  const widgets = field.acroField.getWidgets();
  return widgets.map((w) => {
    const keys = [];
    const n = w.dict.lookup(PDFName.of("AP"))?.lookup(PDFName.of("N"));
    if(n && n.dict) n.dict.keys().forEach((k) => keys.push(String(k).replace(/^\//, "")));
    const as = String(w.dict.lookup(PDFName.of("AS")) || "").replace(/^\//, "");
    return { keys, as };
  });
}

function yesWidgetOn(field){
  return widgetOn(field).some((w) => w.keys.includes("1") && w.as === "1");
}
function noWidgetOn(field){
  return widgetOn(field).some((w) => w.keys.includes("2") && w.as === "2");
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
const riskSrc = fs.readFileSync(path.join(ROOT, "gi-menora-risk-form.js"), "utf8");
const mortSrc = fs.readFileSync(path.join(ROOT, "gi-menora-mortgage-form.js"), "utf8");
const ciSrc = fs.readFileSync(path.join(ROOT, "gi-menora-ci-form.js"), "utf8");

console.log("1) cache + wiring");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "app.js syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-menora-risk-form.js")]).status === 0, "risk form syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-menora-mortgage-form.js")]).status === 0, "mortgage form syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-menora-ci-form.js")]).status === 0, "CI form syntax");
assert(html.includes("app.js?v=" + APP_TAG), "index app.js cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");
assert(app.includes("./gi-menora-risk-form.js?v=" + FORM_TAG), "risk form href");
assert(app.includes("./gi-menora-mortgage-form.js?v=" + FORM_TAG), "mortgage form href");
assert(app.includes("./gi-menora-ci-form.js?v=" + FORM_TAG), "CI form href");
assert(riskSrc.includes('VERSION: "' + FORM_TAG + '"'), "risk VERSION");
assert(mortSrc.includes('VERSION: "' + FORM_TAG + '"'), "mortgage VERSION");
assert(ciSrc.includes('VERSION: "' + FORM_TAG + '"'), "CI VERSION");
assert(mortSrc.includes('map: "menora_mortgage"'), "mortgage uses named health map");
assert(ciSrc.includes('map: "menora_ci"'), "CI uses named health map");
assert(app.includes("HEALTH_TOPIC_ALIASES"), "cross-company topic aliases");
assert(app.includes("healthAnswerAliasKeys"), "alias key helper");

const H = loadHelper();
const Risk = loadForm("gi-menora-risk-form.js", "MenoraRiskForm", H);

console.log("\n2) wizard כן on Menora keys is never exported as לא");
{
  const responses = {
    menora_risk__alcohol: { p1: { answer: "yes" } },
    menora_risk__heart: { p1: { answer: "yes" } },
    menora_risk__neuro: { p1: { answer: "no" } }
  };
  assert(H.healthAnswer(responses, "menora_risk__alcohol", "p1") === "yes", "alcohol yes");
  assert(H.healthAnswer(responses, "menora_risk__heart", "p1") === "yes", "heart yes");
  assert(H.healthAnswer(responses, "menora_risk__neuro", "p1") === "no", "neuro no stays no");
}

console.log("\n3) Migdal health (longest) fills Menora keys");
{
  const responses = {
    magdal_full__heart: { p1: { answer: "yes" } },
    magdal_full__cancer: { p1: { answer: "yes" } },
    magdal_full__smoking_now: { p1: { answer: "yes" } },
    magdal_full__alcohol: { p1: { answer: "no" } },
    magdal_full__neuro: { p1: { answer: "no" } }
  };
  assert(H.healthAnswer(responses, "menora_risk__heart", "p1") === "yes", "Migdal heart → Menora risk heart כן");
  assert(H.healthAnswer(responses, "menora_mort__heart", "p1") === "yes", "Migdal heart → Menora mortgage heart כן");
  assert(H.healthAnswer(responses, "menora_crit__heart", "p1") === "yes", "Migdal heart → Menora CI heart כן");
  assert(H.healthAnswer(responses, "menora_risk__tumors", "p1") === "yes", "Migdal cancer → Menora tumors כן");
  assert(H.healthAnswer(responses, "menora_crit__tumors", "p1") === "yes", "Migdal cancer → Menora CI tumors כן");
  assert(H.healthAnswer(responses, "menora_risk__smoking", "p1") === "yes", "Migdal smoking_now → Menora smoking כן");
  assert(H.healthAnswer(responses, "menora_risk__alcohol", "p1") === "no", "Migdal alcohol no → Menora alcohol לא");
  assert(H.healthAnswer(responses, "menora_risk__neuro", "p1") === "no", "Migdal neuro no → Menora neuro לא");
  const exactWins = {
    menora_risk__heart: { p1: { answer: "no" } },
    magdal_full__heart: { p1: { answer: "yes" } }
  };
  assert(H.healthAnswer(exactWins, "menora_risk__heart", "p1") === "no", "exact Menora answer wins over Migdal alias");
}

console.log("\n4) mortgage named map: printed Q1 is hospital, not hobby");
{
  const cap = {};
  H.applyMappedHealthYesNo({ __giCapture: cap }, {
    map: "menora_mortgage",
    primaryId: "p1",
    responses: {
      menora_mort__hobby: { p1: { answer: "no" } },
      menora_mort__hospital: { p1: { answer: "yes" } },
      menora_mort__heart: { p1: { answer: "yes" } },
      menora_mort__meds: { p1: { answer: "no" } }
    }
  });
  assert(cap.HealthDecMainQ1 === "1", "mortgage Q1 hospital yes → 1");
  assert(cap.HealthDecMainQ2 === "2", "mortgage Q2 meds no → 2");
  assert(cap.HealthDecMainQ4 === "1", "mortgage Q4 heart yes → 1");
  assert(cap.HealthDecMainQ1 !== "2", "hospital yes is not painted as לא");
}

console.log("\n5) CI named map + Migdal / cancer aliases");
{
  const cap = {};
  H.applyMappedHealthYesNo({ __giCapture: cap }, {
    map: "menora_ci",
    primaryId: "p1",
    responses: {
      magdal_full__alcohol: { p1: { answer: "yes" } },
      magdal_full__heart: { p1: { answer: "yes" } },
      magdal_full__cancer: { p1: { answer: "no" } },
      menora_cancer__personal: { p1: { answer: "yes" } }
    }
  });
  assert(cap.HealthDecMainQ1 === "1", "CI Q1 alcohol from Migdal yes");
  assert(cap.HealthDecMainQ6 === "1", "CI Q6 heart from Migdal yes");
  assert(cap.HealthDecMainQ8 === "1", "CI Q8 tumors from Menora cancer personal yes");
}

console.log("\n6) risk MKQ capture: wizard כן → export 1");
{
  const cap = {};
  const form = { __giCapture: cap };
  Risk.applyMenoraMkqHealth(form, {
    primaryId: "p1",
    healthResponses: {
      magdal_full__alcohol: { p1: { answer: "yes" } },
      magdal_full__heart: { p1: { answer: "yes" } },
      menora_risk__neuro: { p1: { answer: "no" } }
    }
  });
  assert(cap.MKQ1 === "1", "MKQ1 alcohol from Migdal yes");
  assert(cap.MKQ3 === "2", "MKQ3 neuro no → 2");
  assert(cap.MKQ4 === "1", "MKQ4 heart from Migdal yes");
  assert(cap.MKQ5 === "1", "MKQ5 heart from Migdal yes");
  assert(cap.MKQ1 !== "2", "alcohol yes is not exported as לא");
}

console.log("\n7) live PDF widgets: כן paints /1, not /2");
(async () => {
  const bytes = fs.readFileSync(path.join(ROOT, "forms/menora-risk/menora-risk-join.pdf"));
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = pdf.getForm();
  H.setExport(form, "MKQ1", "1");
  H.setExport(form, "MKQ3", "2");
  const mkq1 = form.getField("MKQ1");
  const mkq3 = form.getField("MKQ3");
  assert(yesWidgetOn(mkq1), "risk MKQ1 yes widget AS=/1");
  assert(!noWidgetOn(mkq1), "risk MKQ1 no widget stays Off");
  assert(noWidgetOn(mkq3), "risk MKQ3 no widget AS=/2");
  assert(!yesWidgetOn(mkq3), "risk MKQ3 yes widget stays Off");

  const mortBytes = fs.readFileSync(path.join(ROOT, "forms/menora-mortgage/menora-mortgage-join.pdf"));
  const mortPdf = await PDFDocument.load(mortBytes, { ignoreEncryption: true });
  const mortForm = mortPdf.getForm();
  H.setExport(mortForm, "HealthDecMainQ1", "1");
  const q1 = mortForm.getField("HealthDecMainQ1");
  assert(yesWidgetOn(q1), "mortgage Q1 yes widget AS=/1");
  assert(!noWidgetOn(q1), "mortgage Q1 no widget stays Off");

  const ciBytes = fs.readFileSync(path.join(ROOT, "forms/menora-ci/menora-ci-join.pdf"));
  const ciPdf = await PDFDocument.load(ciBytes, { ignoreEncryption: true });
  const ciForm = ciPdf.getForm();
  H.setExport(ciForm, "HealthDecMainQ6", "1");
  const ciQ6 = ciForm.getField("HealthDecMainQ6");
  assert(yesWidgetOn(ciQ6), "CI Q6 heart yes widget AS=/1");
  assert(!noWidgetOn(ciQ6), "CI Q6 no widget stays Off");

  console.log("\n8) MKQ6 yes/no split fields");
  H.setExport(form, "MKQ6", "Off");
  H.setExport(form, "MQ6", "Off");
  Risk.applyMenoraMkqHealth({
    getField(name){ return form.getField(name); }
  }, {
    primaryId: "p1",
    healthResponses: { menora_risk__metabolic: { p1: { answer: "yes" } } }
  });
  const mkq6 = form.getField("MKQ6");
  const mq6 = form.getField("MQ6");
  assert(widgetOn(mkq6).some((w) => w.as === "1"), "MKQ6 yes uses /1 field");
  assert(!widgetOn(mq6).some((w) => w.as === "2"), "MQ6 no stays off when metabolic is yes");

  console.log("\n=== " + passed + " passed, " + failed + " failed ===");
  if(failed) process.exit(1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
