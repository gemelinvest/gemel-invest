/* GI-WIZARD-STALE-TOAST 2026-08-25
   build mismatch → soft recovery once + toast at most once per session.
   הרצה: node _test-wizard-stale-toast-dedupe.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260906-mirror-script-premiums-v3";
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
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");

console.log("1) syntax + aligned cache tags");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(app.includes('GI_WIZARD_JS_VERSION = "' + TAG + '"'), "app.js wizard version bumped");
assert(wiz.includes('GI_WIZARD_BUILD = "' + TAG + '"'), "gi-wizard.js build mark matches");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache tag matches");
assert(sw.includes("gi-v12-" + TAG), "service-worker CACHE_VERSION matches");

console.log("\n2) soft recovery + toast dedupe contracts");
assert(app.includes("softRecoverStaleWizardBuild"), "soft recovery helper exists");
assert(app.includes('GI_WIZARD_SOFT_RECOVERY_KEY = "gi_wizard_build_soft_recovery"'), "soft recovery session key");
assert(app.includes('GI_WIZARD_FAIL_TOAST_KEY = "gi_wizard_fail_toast_shown"'), "toast dedupe session key");
assert(app.includes("isWizardBuildMismatchError"), "build-mismatch detector exists");
assert(app.includes("stale gi-wizard.js (build mismatch)"), "stale wizard chunk is still rejected");
assert(app.includes("_giWizardFailToastShown"), "in-memory toast latch exists");
assert(app.includes("גרסת האשף לא תואמת למערכת"), "Hebrew mismatch message after failed recovery");
assert(app.includes("navigator.serviceWorker.getRegistrations"), "soft recovery unregisters SW");
assert(app.includes('?nocache=" + Date.now()'), "soft recovery reloads with nocache");
assert(app.includes("if(err && err.__giSoftRecovering) return"), "prefetch skips soft-recovery noise");
assert(app.includes("paintDashboardAfterFaceLogin"), "face-login KPI paint remains untouched");

console.log("\n" + (failed ? ("FAILED: " + failed) : ("OK — " + passed + " checks")));
process.exit(failed ? 1 : 0);
