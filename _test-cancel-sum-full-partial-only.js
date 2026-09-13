/* GI-WIZARD 2026-09-12 — סכום ביטוח נדרש רק בביטול מלא/חלקי.
   Run: node _test-cancel-sum-full-partial-only.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const vm = require("vm");

const ROOT = __dirname;
const TAG = "20260913-sim-prem-edit-v8";
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

function sliceFn(src, token){
  const start = src.indexOf(token);
  if(start < 0) return "";
  let i = src.indexOf("{", start);
  if(i < 0) return "";
  let depth = 0;
  for(; i < src.length; i++){
    if(src[i] === "{") depth += 1;
    else if(src[i] === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, i + 1);
    }
  }
  return "";
}

const wiz = fs.readFileSync(path.join(ROOT, "gi-wizard.js"), "utf8");
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");

console.log("1) markers + tags");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(wiz.includes("isExistingPolicyCancelSumRequired"), "helper exists");
assert(wiz.includes("סכום ביטוח/פיצוי נדרש רק בביטול מלא או חלקי"), "marker comment");
assert(wiz.includes('GI_WIZARD_BUILD = "' + TAG + '"'), "wizard build tag");
assert(app.includes('GI_WIZARD_JS_VERSION = "' + TAG + '"'), "app wizard version");
assert(app.includes('BUILD = "' + TAG + '"'), "app BUILD tag");

console.log("\n2) validation gated by cancel status");
const validate = sliceFn(wiz, "validateStep3Detailed(){");
assert(!!validate, "validateStep3Detailed body found");
assert(validate.includes("isExistingPolicyCancelSumRequired"), "validateStep3Detailed uses helper");
assert(validate.includes("d.cancellations"), "validate reads cancellations status");
const complete = sliceFn(wiz, "isStepCompleteForInsured(stepId, ins){");
assert(!!complete, "isStepCompleteForInsured body found");
assert(complete.includes("isExistingPolicyCancelSumRequired"), "isStepCompleteForInsured uses helper");
assert(wiz.includes("isExistingPolicyCancelSumRequired(p, cancelSt)"), "UI missing-state uses helper");

console.log("\n3) runtime helper behavior");
const helperSrc = sliceFn(wiz, "isExistingPolicyCancelSumRequired(policy, cancellation){");
const execSrc = sliceFn(wiz, "isCancellationExecutionMethodRequired(status){");
assert(!!helperSrc && !!execSrc, "helper sources extracted");
const ctx = {};
vm.createContext(ctx);
vm.runInContext(
  "function safeTrim(v){ return String(v == null ? \"\" : v).trim(); }\n" +
  "const api = {\n" + execSrc + ",\n" + helperSrc + "\n};\n" +
  "this.api = api;",
  ctx
);
const api = ctx.api;
assert(api.isExistingPolicyCancelSumRequired({ type: "ריסק" }, { status: "full" }) === true, "full + risk requires sum");
assert(api.isExistingPolicyCancelSumRequired({ type: "ריסק" }, { status: "partial_health" }) === true, "partial + risk requires sum");
assert(api.isExistingPolicyCancelSumRequired({ type: "ריסק משכנתא" }, { status: "full" }) === true, "full + mortgage requires sum");
assert(api.isExistingPolicyCancelSumRequired({ type: "סרטן" }, { status: "partial_health" }) === true, "partial + cancer requires sum");
assert(api.isExistingPolicyCancelSumRequired({ type: "מחלות קשות" }, { status: "full" }) === true, "full + CI requires sum");
assert(api.isExistingPolicyCancelSumRequired({ type: "ריסק" }, { status: "nochange_client" }) === false, "nochange_client does not require sum");
assert(api.isExistingPolicyCancelSumRequired({ type: "ריסק" }, { status: "nochange_collective" }) === false, "collective does not require sum");
assert(api.isExistingPolicyCancelSumRequired({ type: "ריסק" }, { status: "agent_appoint" }) === false, "agent_appoint does not require sum");
assert(api.isExistingPolicyCancelSumRequired({ type: "ריסק" }, { status: "" }) === false, "empty status does not require sum");
assert(api.isExistingPolicyCancelSumRequired({ type: "בריאות" }, { status: "full" }) === false, "health type still not sum-gated here");

if(failed){
  console.error("\nFAILED " + failed);
  process.exit(1);
}
console.log("\nOK " + passed + "/" + passed);
process.exit(0);
