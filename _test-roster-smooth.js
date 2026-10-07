/* GI-PERF 2026-10-04 — מאגר גדול לא מנרמל את הספר על שמירת תיק.
   Run: node _test-roster-smooth.js
*/
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const TAG = "20261007-forms-fill-v1";
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
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

console.log("1) cache tag stays, app.js bump only");
assert(html.includes("app.css?v=" + TAG), "css build tag unchanged");
assert(html.includes("app.js?v=" + TAG + "&giSign=29"), "app.js giSign 29");
assert(!html.includes("giSign=28"), "old giSign gone");

console.log("\n2) heavy roster saves do not normalize the book");
const persistAt = app.indexOf("async persist(label, options = {})");
const persistBody = app.slice(persistAt, persistAt + 900);
assert(persistBody.includes("isHeavyRosterSession?.()") && persistBody.includes("forceFullNormalize"), "persist detects heavy roster");
assert(persistBody.includes("skipNormalize: true") && persistBody.includes("lightShadows: true"), "persist forces light options");
const payloadPersist = app.indexOf("async function persistCustomerPayloadRecord");
const payloadBody = app.slice(payloadPersist, payloadPersist + 8000);
assert(payloadBody.includes("skipNormalize: true") && payloadBody.includes("lightShadows: true"), "single-customer save uses light shadows");
assert(payloadBody.includes("retainHeavyRosterPayloadLru"), "single-customer save trims fat payloads");

console.log("\n3) large session keeps a payload cap and does not drop the flag mid-load");
assert(app.includes("isLargeCustomersSession?.() || Storage?.isTeamManagerLightSession?.()"), "LRU covers large session and team managers");
assert(app.includes("ספירה שנכשלה אינה הוכחה שהארגון קטן"), "failed count stays on the working set");
assert(!app.includes("הסקופ קטן מהתקרה"), "short page no longer turns large session off");
assert(!app.includes("this.setLargeCustomersSession(false, 0);\n        let rosterProbe"), "flag is not cleared before the count returns");
const ensureAt = app.indexOf("async ensureRecordPayload(stateKey, id)");
const ensureBody = app.slice(ensureAt, ensureAt + 4500);
assert(ensureBody.includes("estimateRecordPayloadBytes({ payload })"), "open measures size without stringifying the file");
assert(!ensureBody.includes("JSON.stringify(payload)"), "open does not stringify the payload");
assert(ensureBody.includes("heavyRoster && key === \"customers\""), "working-set cap applies only to a heavy roster");

console.log("\n4) dashboard exact scans stay off while the roster is heavy");
const compareAt = app.indexOf("DashboardUI.compareServerKpis = function");
const compareBody = app.slice(compareAt, compareAt + 1800);
assert(compareBody.includes("!Storage.isHeavyRosterSession?.() && typeof Storage.loadDashboardMonthSalesExact"), "month exact scan skipped for heavy roster");
assert(app.includes("if(!Storage.isHeavyRosterSession?.() && typeof Storage.loadTodaySalesAfterDiscount"), "today exact scan skipped for heavy roster");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
