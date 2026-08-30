/* GI-PERF 2026-08-30 — פתיחת תיק: משיכת call-session דקה, בלי payload מלא.
   Run: node _test-customer-open-call-pull.js
   לא נוגע בשמירות / ensureRecordPayload / לוגיקת שיקוף — רק בנתיב ה-watch.
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260830-policy-actions-align-v1";
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

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=" + TAG), "index.html bumps app.js cache");
assert(html.includes("app.css?v=" + TAG), "index.html bumps app.css cache");
assert(sw.includes("gi-v12-" + TAG), "service worker cache bumped");

console.log("\n2) thin call-session pull (no full payload on watch)");
assert(app.includes("_openFileCallSessionThinSelect"), "thin select constant exists");
assert(
  app.includes("callSession:payload->mirrorFlow->callSession")
    && app.includes("opsProcess:payload->opsProcess"),
  "thin select pulls only callSession + opsProcess"
);
assert(app.includes("_payloadFromOpenFileCallRow"), "row→payload adapter exists");
const pullStart = app.indexOf("async _pullOpenFileCallSession(cid){");
const pullEnd = app.indexOf("startOpenFileCallWatch(){", pullStart);
assert(pullStart > 0 && pullEnd > pullStart, "_pullOpenFileCallSession block found");
const pullBlock = pullStart > 0 && pullEnd > pullStart ? app.slice(pullStart, pullEnd) : "";
assert(pullBlock.includes("this._openFileCallSessionThinSelect"), "pull uses thin select first");
assert(pullBlock.includes('"id,payload,updated_at"'), "legacy full-payload fallback kept");
assert(pullBlock.includes("_payloadFromOpenFileCallRow"), "pull uses adapter");
assert(pullBlock.includes("_applyOpenFileRemotePayload"), "same apply function — no logic fork");

console.log("\n3) skip redundant immediate pull after ensureRecordPayload");
assert(app.includes("skipImmediatePull"), "skipImmediatePull option exists");
assert(
  app.includes('afterOpen({ skipImmediatePull: true })'),
  "cold open (empty payload) skips immediate re-pull"
);
const refreshStart = app.indexOf("async _refreshOpenFileCallSession(id, opts={}){");
const refreshEnd = app.indexOf("/* GI-FIX 2026-08-01 (תוכניות 1+3)", refreshStart);
assert(refreshStart > 0 && refreshEnd > refreshStart, "_refreshOpenFileCallSession block found");
const refreshBlock = app.slice(refreshStart, refreshEnd);
assert(refreshBlock.includes("opts.skipImmediatePull === true"), "refresh honors skip flag");
assert(refreshBlock.includes("this.startOpenFileCallWatch()"), "watch still starts when skip");
assert(refreshBlock.includes("_callSessionWatchSig"), "seeds local call sig when skip");

console.log("\n4) warm open still refreshes (thin) + apply path untouched");
const openStart = app.indexOf("openById(id, opts={}){");
const openEnd = app.indexOf("_showFileLoading(rec){", openStart);
const openBlock = openStart > 0 && openEnd > openStart ? app.slice(openStart, openEnd) : "";
assert(openBlock.includes("afterOpen();"), "warm open still calls afterOpen (immediate thin pull)");
assert(app.includes("_applyOpenFileRemotePayload(cid, payload){"), "apply function signature unchanged");
assert(app.includes("shouldKeepLocalMirrorCallSession"), "local call session guard still used");

console.log("\n5) followup deferred off paint — same sync logic");
const fuStart = app.indexOf("queueFollowupDocumentsSync(rec, opts){");
const fuEnd = app.indexOf("async buildFollowupZipBlob(rec){", fuStart);
const fuBlock = fuStart > 0 && fuEnd > fuStart ? app.slice(fuStart, fuEnd) : "";
assert(fuBlock.includes("perfIdle"), "followup queued via perfIdle");
assert(fuBlock.includes("ensureFollowupDocuments(rec)"), "same ensureFollowupDocuments call");
assert(fuBlock.includes("syncFollowupQuestionnaireDocs") === false
  || app.includes("CustomerDocuments.syncFollowupQuestionnaireDocs"),
  "sync helper still in app");
assert(fuBlock.includes("_skipFollowupSync"), "skip flag preserved");
assert(app.includes("async ensureFollowupDocuments(rec, options = {}){"), "ensureFollowupDocuments unchanged entry");

console.log("\n6) saves / ensureRecordPayload / omit-empty untouched");
assert(app.includes("_omitEmptyPayloadForWrite(row){"), "write guard intact");
assert(app.includes("async ensureRecordPayload(stateKey, id){"), "ensureRecordPayload intact");
assert(
  !app.includes('ensureRecordPayload') === false,
  "ensureRecordPayload still referenced"
);
const ensureStart = app.indexOf("async ensureRecordPayload(stateKey, id){");
const ensureEnd = app.indexOf("payloadHasPolicyOrInsuredContent(payload){", ensureStart);
const ensureBlock = app.slice(ensureStart, ensureEnd);
assert(ensureBlock.includes('selectExpr = rec ? "id,payload"'), "ensure still fetches payload when needed");
assert(!ensureBlock.includes("skipImmediatePull"), "ensureRecordPayload not coupled to open watch opts");

console.log("\n-----");
console.log("passed=" + passed + " failed=" + failed);
process.exit(failed ? 1 : 0);
