/* GI-OPS 2026-10-07 — שלב שיקולי המלצה חי בשיקוף אחרי פוליסות מוצעות.
   הרצה: node _test-ops-mirror-reasons-step.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20261007-forms-fill-v1";
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

function sliceBetween(src, startMark, endMark){
  const start = src.indexOf(startMark);
  const end = src.indexOf(endMark, start);
  if(start < 0 || end < 0 || end <= start) return "";
  return src.slice(start, end);
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "app.css"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-ops-mirror-reasons-step.js")]).status === 0, "node --check this test");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + TAG), "index.html app.css cache");
assert(sw.includes("gi-v12-" + TAG), "service-worker cache");
assert(app.includes('BUILD = "' + TAG + '"'), "app.js BUILD");

console.log("\n2) catalog + navigation");
const catalog = sliceBetween(app, "_mcCallStepCatalog(rec){", "_mcCurrentCallStepKey(){");
const offerI = catalog.indexOf('key: "offer"');
const reasonsI = catalog.indexOf('key: "reasons"');
const futI = catalog.indexOf('key: "futureCancel"');
assert(offerI >= 0 && reasonsI > offerI, "שיקולי המלצה אחרי פוליסות מוצעות");
assert(futI > reasonsI, "שינוי/ביטול בעתיד אחרי שיקולי המלצה");
const offer = sliceBetween(app, "_renderNeedsOffer(rec){", "_renderNeedsReasons(rec){");
assert(offer.includes("needs-to-reasons"), "ממוצעות לשיקולי המלצה");
assert(offer.includes("המשך · שיקולי המלצה"), "תווית המשך");
const reasons = sliceBetween(app, "_renderNeedsReasons(rec){", "_renderNeedsCompareNotice(rec){");
assert(reasons.includes("השיקולים העיקריים במתן ההמלצה הינם הם:"), "נוסח הקראה לנציג תפעול");
assert(reasons.includes("needs-to-premium"), "משיקולים לשינוי/ביטול בעתיד");
assert(reasons.includes("reasons-to-offer"), "חזרה לפוליסות מוצעות");
assert(reasons.includes("getMainConsideration"), "סטטוס נמשך מהאשף");
assert(reasons.includes("mcReasonStatus"), "תצוגת סטטוס על המסך");
const futureBack = sliceBetween(app, 'if(action === "future-back"){', 'if(action === "future-to-disclosure"');
assert(futureBack.includes('this._mirrorNeedsSubPhase = "reasons"'), "חזרה מביטול בעתיד לשיקולים");

console.log("\n3) runtime getMainConsideration");
const fnStart = app.indexOf("getMainConsideration(rec){");
const retMark = 'return key ? { key, label } : { key: "", label: "" };';
const retAt = app.indexOf(retMark, fnStart);
const fnEnd = app.indexOf("\n    }", retAt);
assert(fnStart > 0 && fnEnd > fnStart, "getMainConsideration נמצא");
const sandbox = {
  console,
  safeTrim(v){ return String(v == null ? "" : v).trim(); }
};
sandbox.api = {
  getInsureds(rec){ return rec?.payload?.insureds || []; }
};
vm.runInNewContext(
  "this.api.getMainConsideration = function " + app.slice(fnStart, fnEnd + "\n    }".length),
  sandbox
);

const disc = sandbox.api.getMainConsideration({ payload: { needsMainConsideration: { key: "hozala" } } });
assert(disc.key === "hozala" && disc.label === "הוזלה", "הוזלה נמשכת לשיקוף");
const exp = sandbox.api.getMainConsideration({ payload: { needsMainConsideration: { key: "expansion", label: "הרחבה" } } });
assert(exp.label === "הרחבה", "הרחבה נמשכת לשיקוף");
const noPol = sandbox.api.getMainConsideration({
  payload: { needsMainConsideration: { key: "new_cover" }, insureds: [{ data: { existingPolicies: [] } }] }
});
assert(noPol.label === "רכישת ביטוח חדש", "בלי פוליסות מוצג רכישת ביטוח חדש");
const withPol = sandbox.api.getMainConsideration({
  payload: {
    needsMainConsideration: { key: "new_cover" },
    insureds: [{ data: { existingPolicies: [{ id: "p1" }] } }]
  }
});
assert(withPol.label === "כיסוי חדש", "עם פוליסות מוצג כיסוי חדש");
const empty = sandbox.api.getMainConsideration({ payload: {} });
assert(!empty.key, "בלי סימון — ריק");

console.log("\n4) css + regression");
assert(css.includes(".mcReasonStatus{"), "עיצוב סטטוס בשיקוף");
assert(css.includes(".lcNaMain{"), "עיצוב סימון באשף");
assert(app.includes("getCancellationRecommendationItems(rec){"), "נימוקי ביטול קיימים נשארו");
assert(app.includes("_renderNeedsExisting(rec){"), "מסך ביטוחים קיימים לא הוסר");
assert(app.includes("_renderStep5FutureCancelBody(){"), "מסך שינוי/ביטול לא הוסר");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
