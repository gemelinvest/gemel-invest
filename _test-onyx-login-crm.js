/* Login ONYX logo: white CRM, no side rules, and one more in-app update prompt.
   node _test-onyx-login-crm.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function sliceBetween(src, startToken, endToken){
  const start = src.indexOf(startToken);
  if(start < 0) return "";
  const end = src.indexOf(endToken, start + startToken.length);
  if(end < 0) return src.slice(start);
  return src.slice(start, end);
}

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
assert(html.includes('class="lcLogin__visualLogo" src="./assets/onyx-login-logo.png?v=onyx-login-align-1"'), "login panel cache token");
assert(html.includes('class="lcLogin__rimLight"') && html.includes("M 701 168 Q 681 184"), "curved light follows the inner rim of the O");
assert(fs.readFileSync(path.join(ROOT, "login-split.css"), "utf8").includes("giOnyxRim"), "curved light shares the logo lighting cycle");
assert(html.includes('app.js?v=20261007-lead-dup-v1&giSign=29'), "app.js build prefix stays");
assert(html.includes("&giLoginCrm=1"), "app.js cache token for the update prompt");
assert(html.includes("&giVerPop=2"), "app.js cache token for the forced refresh");
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
assert(applyAt > 0 && app.indexOf("if(pendingVersion) setAcknowledgedVersion(pendingVersion, pendingPublishedAt);") > applyAt, "עדכן records the epoch before the acknowledgement");
assert(app.includes("caches.delete(k)") && app.includes("r.unregister()"), "עדכן still clears caches and the service worker");
assert(app.includes("async publishVersion()") && app.includes("key: 'app_version'"), "version publish path unchanged");
const publishFn = sliceBetween(app, "async publishVersion(){", "async saveUsersManagementPin(){");
assert(publishFn.includes("window.__GI_NOTIFY_VERSION_PUBLISHED"), "a successful publish notifies this browser immediately");
assert(app.includes("window.__GI_NOTIFY_VERSION_PUBLISHED = function(payload){"), "watcher exposes the publish notify hook");
const pollFn = sliceBetween(app, "async function authBearer(", "function startVersionWatchAfterLogin(){");
assert(pollFn.includes("gemelInvestSupabaseClient"), "version poll reads the signed-in client");
assert(pollFn.includes("access_token"), "version poll reads the session access token");
assert(pollFn.includes("await authBearer(cfg.key)"), "poll sends the session bearer");
assert(!pollFn.includes("Bearer ' + cfg.key") && !pollFn.includes('Bearer " + cfg.key'), "poll does not authorize as the public key alone");
const handler = sliceBetween(app, "function handleVersionChange(rawInfo){", "function promptBrandingEpochIfNeeded");
assert(handler.includes("versionPublishUnseen(info)"), "handler asks whether this publish was seen");
assert(!handler.includes("newVersion === local"), "same BUILD does not suppress a new publish");
assert(handler.indexOf("isSensitiveWorkflowOpen()") < handler.indexOf("applyPublishedUpdate(info)"), "an open file or wizard waits before the refresh");
assert(handler.includes("void applyPublishedUpdate(info)"), "an unseen publish refreshes without waiting for a click");
const forceFn = sliceBetween(app, "async function applyPublishedUpdate(", "function handleVersionChange");
assert(forceFn.indexOf("setAcknowledgedVersion(version, publishedAt)") < forceFn.indexOf("__GI_PREPARE_VERSION_UPDATE_RESUME"), "acknowledgement is stored before the resume marker");
assert(forceFn.indexOf("__GI_PREPARE_VERSION_UPDATE_RESUME") < forceFn.indexOf("reloadForPublishedUpdate()"), "the signed-in session is kept before the refresh");
assert(forceFn.includes("caches.delete(k)") && forceFn.includes("r.unregister()"), "the refresh clears caches and the service worker");
const swHandler = sliceBetween(app, "navigator.serviceWorker.addEventListener(\"controllerchange\"", "function bindInstallUi()");
assert(swHandler.includes("window.__GI_HAS_AUTH_CURRENT"), "a service worker claim still does not reload a signed-in screen by itself");
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

console.log("\n5) same BUILD with a newer publishedAt prompts once");
const decision = sliceBetween(app, "function getAcknowledgedRecord(){", "function clearAcknowledgedVersion(){");
function runUnseen(ack, info){
  const ackStore = new Map();
  if(ack) ackStore.set(GI_VC_ACKNOWLEDGED_KEY, JSON.stringify(ack));
  const ackStorage = {
    getItem(k){ return ackStore.has(k) ? ackStore.get(k) : null; },
    setItem(k, v){ ackStore.set(k, String(v)); },
    removeItem(k){ ackStore.delete(k); }
  };
  const fn = new Function(
    "localStorage", "GI_VC_ACKNOWLEDGED_KEY", "GI_VC_ACKNOWLEDGED_LEGACY_KEY", "info",
    decision + "\nreturn versionPublishUnseen(info);"
  );
  return fn(ackStorage, GI_VC_ACKNOWLEDGED_KEY, "GI_VERSION_ACKNOWLEDGED_V1", info);
}
const build = "20261007-lead-dup-v1";
const fresh = { version: build, publishedAt: "2026-11-08T00:00:00.000Z" };
assert(runUnseen({ ver: build, ts: Date.parse("2026-10-08T00:00:00.000Z") }, fresh) === true, "same BUILD with a newer publishedAt still prompts");
assert(runUnseen({ ver: build, ts: Date.parse("2026-11-08T01:00:00.000Z"), publishedAt: fresh.publishedAt }, fresh) === false, "the same publish does not prompt again");
assert(runUnseen({ ver: build, ts: Date.parse("2026-11-09T00:00:00.000Z") }, fresh) === false, "an acknowledgement after the publish stays quiet");
assert(runUnseen({ ver: build, ts: Date.parse("2026-10-08T00:00:00.000Z") }, { version: build, publishedAt: "2026-10-07T00:00:00.000Z" }) === false, "an older publish of the same BUILD stays quiet");
assert(runUnseen({ ver: "older-build", ts: Date.parse("2026-11-09T00:00:00.000Z") }, fresh) === true, "a different version string still prompts");
assert(runUnseen(null, fresh) === true, "a browser with no acknowledgement prompts");

if(failed){
  console.error("\nFAILED " + failed + " / passed " + passed);
  process.exit(1);
}
console.log("\nOK " + passed + " assertions");
process.exit(0);
