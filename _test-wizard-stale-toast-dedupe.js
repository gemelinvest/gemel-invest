/* GI-WIZARD-STALE-TOAST 2026-08-25
   אשף תקין עם תג מטמון אחר נטען. קובץ לא-אשף עדיין נדחה.
   הרצה: node _test-wizard-stale-toast-dedupe.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260910-cf-policy-sum-v1";
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

function sliceBetween(src, startToken, endToken){
  const start = src.indexOf(startToken);
  if(start < 0) return "";
  const end = src.indexOf(endToken, start + startToken.length);
  if(end < 0) return src.slice(start);
  return src.slice(start, end);
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const wiz = fs.readFileSync(path.join(ROOT, "gi-wizard.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");

console.log("1) syntax + aligned cache tags");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(app.includes('const BUILD = "' + TAG + '"'), "app.js BUILD matches wizard tag");
assert(app.includes('GI_WIZARD_JS_VERSION = "' + TAG + '"'), "app.js wizard version matches BUILD");
assert(wiz.includes('GI_WIZARD_BUILD = "' + TAG + '"'), "gi-wizard.js build mark matches");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache tag matches");
assert(sw.includes("gi-v12-" + TAG), "service-worker CACHE_VERSION matches");

console.log("\n2) tag drift is accepted; junk chunks still rejected");
assert(app.includes("function giWizardChunkLooksInstallable"), "installable-chunk helper exists");
assert(app.includes("cache-tag drift accepted"), "installable drift is accepted instead of throw");
assert(app.includes("stale gi-wizard.js (build mismatch)"), "non-installable mismatch still throws");
assert(app.includes("גרסת האשף לא תואמת למערכת"), "Hebrew mismatch toast kept for real failures");
assert(app.includes("_giWizardFailToastShown"), "in-memory toast latch exists");
assert(app.includes('GI_WIZARD_FAIL_TOAST_KEY = "gi_wizard_fail_toast_shown"'), "toast dedupe session key");
assert(app.includes("paintDashboardAfterFaceLogin"), "face-login KPI paint remains untouched");

console.log("\n3) mismatch no longer full-page-reloads after MFA");
const loadCatch = sliceBetween(app, "GI_WIZARD_CHUNK_LOAD_FAILED", "GI_WIZARD_CHUNK_RETRY_FAILED");
assert(loadCatch.includes("resolveGiWizardHref({ nocache: true })"), "failed fetch retries with nocache");
assert(!loadCatch.includes("softRecoverStaleWizardBuild"), "first mismatch does not location.replace the whole app");
assert(!loadCatch.includes("await new Promise(() => {})"), "load path does not hang while recovering");
assert(app.includes("softRecoverStaleWizardBuild"), "soft recovery helper still exists for last-resort");
assert(app.includes("window.__GI_PREPARE_VERSION_UPDATE_RESUME"), "recover would keep the session if it runs");
assert(app.includes('sessionStorage.getItem(GI_WIZARD_SOFT_RECOVERY_KEY) === "1") return'), "pagehide does not wipe session during wizard recover");

console.log("\n" + (failed ? ("FAILED: " + failed) : ("OK — " + passed + " checks")));
process.exit(failed ? 1 : 0);
