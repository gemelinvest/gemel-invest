/* GI-HACHSHARA-HEALTH-ADVANCE 2026-08-26
   Fix: health declaration step blocked after answering all questions
   (Hachshara health + risk) because validation used a different insured
   set than the UI / "mark all no" path (couple → all insureds).
   Run: node _test-hachshara-health-decl-advance.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260906-team-mgr-self-sales-v1";
const APP_TAG = "20260906-team-mgr-self-sales-v1";
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

const wiz = fs.readFileSync(path.join(ROOT, "gi-wizard.js"), "utf8");
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "gi-wizard.js syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "app.js syntax");
assert(wiz.includes('GI_WIZARD_BUILD = "' + TAG + '"'), "wizard build mark");
assert(app.includes('GI_WIZARD_JS_VERSION = "' + TAG + '"'), "app wizard version");
assert(html.includes("app.js?v=" + APP_TAG), "index app.js cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");

console.log("\n2) shared insured resolver for UI + validation");
assert(wiz.includes("GI-FIX 2026-08-26: מקור אחד ל־UI + סימון-הכל + ולידציית המשך"), "shared insured fix marker");
assert(wiz.includes("getHealthStepRelevantInsureds(){"), "relevant insureds helper exists");
const blocking = wiz.slice(wiz.indexOf("getHealthBlockingIssue(){"), wiz.indexOf("getDraftPayload(){"));
assert(blocking.includes("getHealthStepRelevantInsureds()"), "blocking issue uses shared helper");
assert(!blocking.includes("insuredMode === 'couple') return true"), "blocking no longer treats couple as all insureds");
const step7 = wiz.slice(wiz.indexOf("// שלב 7 — הצהרת בריאות"), wiz.indexOf("if(/חסר גובה|חסר משקל/"));
assert(step7.includes("getHealthStepRelevantInsureds()"), "step7 advance uses shared helper");
assert(step7.includes("firstBlockReason = 'unsaved'"), "step7 distinguishes unsaved detail");
assert(step7.includes("חסר שמירת פירוט"), "toast for unsaved detail");

console.log("\n3) modal cancel clears incomplete yes");
assert(wiz.includes("ביטול/סגירה אחרי סימון \"כן\" בלי שמירה"), "cancel incomplete-yes marker");
assert(wiz.includes("hadSaved"), "tracks prior saved state for cancel");
assert(wiz.includes("hachsharaRiskAmountMode"), "amount mode still present");
assert(wiz.includes("מצב סכום הכשרה משנה short/full"), "amount mode in cache key");

console.log("\n4) behavioural harness — couple mismatch");
function safeTrim(v){ return String(v == null ? "" : v).trim(); }

function getHealthStepRelevantInsureds(ctx){
  const policies = ctx.newPolicies || [];
  const wizardInsureds = ctx.insureds || [];
  const primary = wizardInsureds.find((x) => x?.type === "primary") || wizardInsureds[0] || null;
  const spouse = wizardInsureds.find((x) => x?.type === "spouse") || null;
  const idSet = new Set();
  policies.forEach((policy) => {
    const mode = safeTrim(policy?.insuredMode);
    if(mode === "couple"){
      if(primary?.id != null && safeTrim(primary.id)) idSet.add(String(primary.id));
      if(spouse?.id != null && safeTrim(spouse.id)) idSet.add(String(spouse.id));
    }
    const ids = Array.isArray(policy?.insuredIds) && policy.insuredIds.length
      ? policy.insuredIds
      : (policy?.insuredId ? [policy.insuredId] : []);
    ids.forEach((id) => { if(id != null && safeTrim(id)) idSet.add(String(id)); });
  });
  const matched = wizardInsureds.filter((ins) => idSet.has(String(ins?.id)));
  return matched.length ? matched : wizardInsureds.slice();
}

function oldValidateInsureds(ctx){
  const allNewPolicies = ctx.newPolicies || [];
  const insuredsWithPolicies = ctx.insureds.filter((ins) =>
    allNewPolicies.some((p) => {
      if(p.insuredMode === "couple") return true;
      if(Array.isArray(p.insuredIds) && p.insuredIds.length) return p.insuredIds.includes(ins.id);
      return safeTrim(p.insuredId) === safeTrim(ins.id);
    })
  );
  return insuredsWithPolicies.length ? insuredsWithPolicies : ctx.insureds;
}

const coupleCtx = {
  insureds: [
    { id: "p1", type: "primary", label: "ראשי" },
    { id: "s1", type: "spouse", label: "בן/בת זוג" },
    { id: "c1", type: "child", label: "ילד" }
  ],
  newPolicies: [
    { id: "pol1", company: "הכשרה", type: "בריאות", insuredId: "p1", insuredIds: ["p1"], insuredMode: "couple" }
  ]
};

const oldIds = oldValidateInsureds(coupleCtx).map((i) => i.id);
const newIds = getHealthStepRelevantInsureds(coupleCtx).map((i) => i.id);
assert(oldIds.includes("c1"), "OLD bug required child on couple policy");
assert(!newIds.includes("c1"), "NEW helper excludes child on couple policy");
assert(newIds.includes("p1") && newIds.includes("s1"), "NEW helper keeps primary+spouse");

const riskCtx = {
  insureds: [
    { id: "p1", type: "primary", label: "ראשי" },
    { id: "s1", type: "spouse", label: "בן/בת זוג" }
  ],
  newPolicies: [
    { id: "pol2", company: "הכשרה", type: "ריסק", insuredId: "p1", insuredIds: ["p1"], insuredMode: "single" }
  ]
};
const riskIds = getHealthStepRelevantInsureds(riskCtx).map((i) => i.id);
assert(JSON.stringify(riskIds) === JSON.stringify(["p1"]), "single risk validates only assigned insured");

// After mark-all on UI-relevant insureds, validation with NEW helper passes
const qKeys = ["hachshara__hospitalization", "hachshara_risk_s__smoking"];
const responses = {};
const uiInsureds = getHealthStepRelevantInsureds(coupleCtx);
qKeys.forEach((q) => {
  responses[q] = {};
  uiInsureds.forEach((ins) => {
    responses[q][ins.id] = { answer: "no", fields: {}, saved: false };
  });
});
let blocked = false;
for(const q of qKeys){
  for(const ins of getHealthStepRelevantInsureds(coupleCtx)){
    const r = responses[q][ins.id] || {};
    if(r.answer !== "yes" && r.answer !== "no") blocked = true;
  }
}
assert(!blocked, "mark-all on shared insured set unblocks advance");

let blockedOld = false;
for(const q of qKeys){
  for(const ins of oldValidateInsureds(coupleCtx)){
    const r = responses[q][ins.id] || {};
    if(r.answer !== "yes" && r.answer !== "no") blockedOld = true;
  }
}
assert(blockedOld, "OLD path still blocked after UI mark-all (documents the bug)");

if(failed){
  console.error("\nFAILED  passed=" + passed + " failed=" + failed);
  process.exit(1);
}
console.log("\nOK  passed=" + passed);
