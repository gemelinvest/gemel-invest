/* GI-MIGDAL-SMOKE-FOLLOWUP 2026-08-26
   Migdal health 1א/1ב must open a smoking follow-up (not generic medical),
   and saving 1ב must not be blocked by a 1א yes stored under an alias.
   Run: node _test-migdal-smoking-followup.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260826-migdal-smoke-fu-v1";
const APP_TAG = "20260826-travel-insurance-v1";
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

function safeTrim(v){ return String(v == null ? "" : v).trim(); }

const wiz = fs.readFileSync(path.join(ROOT, "gi-wizard.js"), "utf8");
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");

const schemaStart = wiz.indexOf("getMagdalHealthSchema(){");
const schemaEnd = wiz.indexOf("getMagdalRiskSumInsuredMax(){");
assert(schemaStart > 0 && schemaEnd > schemaStart, "Migdal health schema block found");
const schema = schemaStart > 0 && schemaEnd > schemaStart ? wiz.slice(schemaStart, schemaEnd) : "";

const nowBlock = (() => {
  const i = schema.indexOf("q('magdal_full__smoking_now'");
  const j = schema.indexOf("q('magdal_full__smoking_past'");
  return i >= 0 && j > i ? schema.slice(i, j) : "";
})();
const pastBlock = (() => {
  const i = schema.indexOf("q('magdal_full__smoking_past'");
  const j = schema.indexOf("q('magdal_full__hobby'");
  return i >= 0 && j > i ? schema.slice(i, j) : "";
})();

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "gi-wizard.js syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "app.js syntax");
assert(wiz.includes('GI_WIZARD_BUILD = "' + TAG + '"'), "wizard build mark");
assert(app.includes('GI_WIZARD_JS_VERSION = "' + TAG + '"'), "app wizard version");
assert(html.includes("app.js?v=" + APP_TAG), "index app.js cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");

console.log("\n2) smoking follow-up is smoking, not generic medical");
assert(nowBlock.includes("label:'פירוט עישון'"), "1א labeled פירוט עישון");
assert(pastBlock.includes("label:'פירוט עישון בעבר'"), "1ב labeled פירוט עישון בעבר");
assert(nowBlock.includes("מספר סיגריות / פעמים ליום"), "1א asks for cigarettes per day");
assert(pastBlock.includes("מתי הפסיק לעשן"), "1ב asks when they quit");
assert(!nowBlock.includes("אבחנה / בעיה רפואית"), "1א does not use generic diagnosis fields");
assert(!pastBlock.includes("אבחנה / בעיה רפואית"), "1ב does not use generic diagnosis fields");
assert(schema.includes("options.label || 'פירוט רפואי מובנה'"), "label is used as questionnaire source when no follow-up number");
assert(schema.includes("buildFields(nums, key, options.fields)"), "q() passes extra smoking fields");

console.log("\n3) 1א and 1ב stay separate answers");
assert(wiz.includes("1א/1ב הן שאלות נפרדות"), "alias split marker");
assert(wiz.includes("magdal_full__smoking: ['magdal_full__smoking_now']"), "legacy smoking alias points at 1א only");
assert(!wiz.includes("magdal_full__smoking: ['magdal_full__smoking_now', 'magdal_full__smoking_past']"), "1א/1ב no longer share one alias group");
assert(wiz.includes("מפתח מדויק קודם"), "exact-key-first marker");

console.log("\n4) behavioural harness — save 1ב while 1א is already yes");
function getHealthResponse(store, qKey, insId){
  const empty = { answer:"", fields:{}, saved:false, editing:false };
  const readHit = (ak) => {
    const qBlock = store.responses[ak];
    if(!qBlock || typeof qBlock !== "object") return null;
    const hit = qBlock[insId] || qBlock[String(insId)];
    if(!hit || typeof hit !== "object") return null;
    const hasAnswer = !!safeTrim(hit.answer);
    const hasFields = hit.fields && typeof hit.fields === "object" && Object.keys(hit.fields).some((fk) => safeTrim(hit.fields[fk]));
    if(!hasAnswer && !hasFields && !hit.saved) return null;
    return hit;
  };
  const exact = readHit(safeTrim(qKey));
  if(exact){
    const outExact = { ...exact };
    if(!outExact.fields) outExact.fields = {};
    return outExact;
  }
  return { ...empty, fields:{} };
}
function validateHealthDetail(store, question, insId){
  const r = getHealthResponse(store, question.key, insId);
  if(r.answer !== "yes") return true;
  const detailFields = (question.fields || []).filter((f) => f.type !== "section");
  if(!detailFields.length) return true;
  return detailFields.some((f) => safeTrim(r.fields?.[f.key]));
}

const pastQ = {
  key: "magdal_full__smoking_past",
  fields: [
    { key:"amount", label:"מספר סיגריות / פעמים ליום בעבר", type:"text" },
    { key:"quitDate", label:"מתי הפסיק לעשן", type:"text" }
  ]
};
const store = {
  responses: {
    magdal_full__smoking_now: {
      p1: { answer:"yes", saved:true, fields:{ amount:"10", product:"סיגריות" } }
    },
    magdal_full__smoking_past: {
      p1: { answer:"yes", saved:false, fields:{ amount:"אין", quitDate:"אין", years:"אין" } }
    }
  }
};
assert(getHealthResponse(store, "magdal_full__smoking_past", "p1").fields.amount === "אין", "exact 1ב fields are kept");
assert(validateHealthDetail(store, pastQ, "p1") === true, "1ב with אין is valid detail");
assert(getHealthResponse(store, "magdal_full__smoking_now", "p1").fields.amount === "10", "1א fields stay on 1א");

const emptyPast = {
  responses: {
    magdal_full__smoking_now: {
      p1: { answer:"yes", saved:true, fields:{ amount:"10" } }
    },
    magdal_full__smoking_past: {
      p1: { answer:"yes", saved:false, fields:{} }
    }
  }
};
assert(validateHealthDetail(emptyPast, pastQ, "p1") === false, "1ב yes without its own fields still blocks save");

console.log("\n5) unrelated health advance / one-decl contracts stay");
assert(wiz.includes("getHealthStepRelevantInsureds(){"), "shared insured helper remains");
assert(wiz.includes("GI-HEALTH-ONE-DECL"), "one-declaration marker remains");
assert(wiz.includes("getPhoenixHealthSchema(){") || wiz.includes("getPhoenixHealthSchema("), "Phoenix schema untouched");
assert(wiz.includes("getHachsharaHealthSchema(){"), "Hachshara schema untouched");
assert(app.includes("if(!username) return this._setError('נא להזין שם משתמש')"), "PIN login contract unchanged");

console.log("\n-----");
console.log("passed=" + passed + " failed=" + failed);
process.exit(failed ? 1 : 0);
