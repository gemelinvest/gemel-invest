/* GI-PERF 2026-09-12 — פתיחת תיק לקוח לא טוענת את האשף דרך openByIdWithLoader.
   Run: node _test-customer-open-freeze.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260913-sim-prem-edit-v4";
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

function sliceFunction(src, startToken){
  const start = src.indexOf(startToken);
  if(start < 0) return "";
  let i = startToken.endsWith("{")
    ? start + startToken.length - 1
    : src.indexOf("{", start);
  if(i < 0) return "";
  let depth = 0;
  for(; i < src.length; i++){
    const ch = src[i];
    if(ch === "{") depth += 1;
    else if(ch === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, i + 1);
    }
  }
  return "";
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
const wiz = fs.readFileSync(path.join(ROOT, "gi-wizard.js"), "utf8");

console.log("1) syntax + cache tags aligned");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache");
assert(sw.includes(TAG) || sw.includes("gi-v12-" + TAG), "service worker cache");
assert(app.includes('BUILD = "' + TAG + '"'), "app.js BUILD tag");
assert(app.includes('GI_WIZARD_JS_VERSION = "' + TAG + '"'), "GI_WIZARD_JS_VERSION aligned");
assert(wiz.includes('GI_WIZARD_BUILD = "' + TAG + '"'), "gi-wizard BUILD aligned");

console.log("\n2) guarded closer still skips wizard chunk when not installed");
const closeChrome = sliceFunction(app, "_closeWizardChromeForFileOpen(){");
assert(!!closeChrome, "closer function exists");
assert(closeChrome.includes("giWizardIsInstalled"), "checks whether wizard chunk is already installed");
assert(closeChrome.includes("Wizard.isOpen"), "still closes a really-open wizard");
assert(closeChrome.includes("if(!chunkReady) return"), "skips wrappers when chunk is not ready");

console.log("\n3) ROOT CAUSE FIX — openByIdWithLoader no longer kicks wizard wrappers");
const openWithLoader = sliceFunction(app, "openByIdWithLoader(id, delay=120){");
assert(!!openWithLoader, "openByIdWithLoader exists");
assert(openWithLoader.includes("this._closeWizardChromeForFileOpen()"), "loader uses guarded closer");
assert(!openWithLoader.includes("Wizard?.hideFinishFlow?.()"), "loader does not call hideFinishFlow wrapper");
assert(!openWithLoader.includes("Wizard?.closeHealthFindingsModal?.()"), "loader does not call closeHealthFindingsModal wrapper");
assert(!openWithLoader.includes("Wizard?.closePolicyDiscountModal?.()"), "loader does not call closePolicyDiscountModal wrapper");
assert(!openWithLoader.includes("Wizard?.closeCoversDrawer?.()"), "loader does not call closeCoversDrawer wrapper");
assert(openWithLoader.includes("GI-PERF 2026-09-12"), "loader documents the regression fix");

const openResolved = sliceFunction(app, "_openByIdResolved(rec, opts={}){");
assert(openResolved.includes("this._closeWizardChromeForFileOpen()"), "resolved open path still uses guarded closer");
assert(!openResolved.includes("Wizard?.hideFinishFlow?.()"), "resolved open path no longer calls hideFinishFlow directly");

console.log("\n4) followup sync does not load wizard when nothing to sync");
const ensureFollowup = sliceFunction(app, "async ensureFollowupDocuments(rec, options = {}){");
assert(!!ensureFollowup, "ensureFollowupDocuments exists");
const earlyReturnIdx = ensureFollowup.indexOf("if(!pack.triggered.length && !hasMap) return false;");
const wizardLoadIdx = ensureFollowup.indexOf("ensureGiWizardJsLoaded");
assert(earlyReturnIdx >= 0, "early-returns when no followup docs");
assert(wizardLoadIdx > earlyReturnIdx, "wizard load happens only after followup need is confirmed");

if(failed){
  console.error("\nFAILED " + failed + " / passed " + passed);
  process.exit(1);
}
console.log("\n-----");
console.log("passed=" + passed + " failed=" + failed);
process.exit(0);
