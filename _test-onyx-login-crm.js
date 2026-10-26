/* Login ONYX logo: white CRM, no side rules, and one more in-app update prompt.
   node _test-onyx-login-crm.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
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
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");

console.log("\n2) login logo address");
assert(html.includes('class="lcLogin__visualLogo" src="./assets/onyx-login-logo.png?v=onyx-login-crm-1"'), "login panel cache token");
assert(html.includes('app.js?v=20261007-lead-dup-v1&giSign=29'), "app.js build prefix stays");
assert(html.includes("&giLoginCrm=1"), "app.js cache token for the update prompt");
assert(sw.includes("20261007-lead-dup-v1"), "service worker keeps the build tag");
assert(sw.includes("onyx-login-crm-v1"), "service worker cache generation moved");
assert(app.includes('const BUILD = "20261007-lead-dup-v1"'), "BUILD tag stays");

console.log("\n3) installed copies see the existing update popup once");
const epochAt = app.indexOf("const GI_VC_ASSET_EPOCH = 'onyx-login-crm-1'");
const releaseAt = app.indexOf("function releaseAckForAssetEpoch()");
const pollAt = app.indexOf("async function pollVersionFromSupabase()");
const applyAt = app.indexOf("markAssetEpochApplied();");
assert(epochAt > 0 && releaseAt > epochAt && pollAt > releaseAt, "epoch helpers sit on the version watcher");
assert(app.includes("releaseAckForAssetEpoch();"), "a previous acknowledgement does not hide this release");
assert(applyAt > 0 && app.indexOf("if(pendingVersion) setAcknowledgedVersion(pendingVersion);") > applyAt, "עדכן records the epoch before the acknowledgement");
assert(app.includes("caches.delete(k)") && app.includes("r.unregister()"), "עדכן still clears caches and the service worker");
assert(app.includes("async publishVersion()") && app.includes("key: 'app_version'"), "version publish path unchanged");
const buildHits = app.split('const BUILD = "20261007-lead-dup-v1"').length - 1;
assert(buildHits === 1, "one BUILD constant");

console.log("\n4) acknowledgement is cleared once, then left alone");
const store = new Map();
const localStorage = {
  getItem(k){ return store.has(k) ? store.get(k) : null; },
  setItem(k, v){ store.set(k, String(v)); },
  removeItem(k){ store.delete(k); }
};
const GI_VC_ACKNOWLEDGED_KEY = "GI_VERSION_ACKNOWLEDGED_V2";
const GI_VC_ASSET_EPOCH = "onyx-login-crm-1";
const GI_VC_ASSET_EPOCH_KEY = "GI_VERSION_ASSET_EPOCH_V1";
function assetEpochApplied(){
  try { return localStorage.getItem(GI_VC_ASSET_EPOCH_KEY) === GI_VC_ASSET_EPOCH; } catch(_e){ return false; }
}
function markAssetEpochApplied(){
  try { localStorage.setItem(GI_VC_ASSET_EPOCH_KEY, GI_VC_ASSET_EPOCH); } catch(_e){}
}
function releaseAckForAssetEpoch(){
  if(assetEpochApplied()) return;
  try { localStorage.removeItem(GI_VC_ACKNOWLEDGED_KEY); } catch(_e){}
}
localStorage.setItem(GI_VC_ACKNOWLEDGED_KEY, JSON.stringify({ ver: "202681007-lead-dup-v1", ts: 1 }));
releaseAckForAssetEpoch();
assert(localStorage.getItem(GI_VC_ACKNOWLEDGED_KEY) == null, "old acknowledgement is dropped before the prompt");
localStorage.setItem(GI_VC_ACKNOWLEDGED_KEY, JSON.stringify({ ver: "202681007-lead-dup-v1", ts: 2 }));
markAssetEpochApplied();
releaseAckForAssetEpoch();
assert(localStorage.getItem(GI_VC_ACKNOWLEDGED_KEY).includes("202681007-lead-dup-v1"), "after עדכן the acknowledgement stays");

if(failed){
  console.error("\nFAILED " + failed + " / passed " + passed);
  process.exit(1);
}
console.log("\nOK " + passed + " assertions");
process.exit(0);
