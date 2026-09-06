/* GI-OPS 2026-09-06 — שיחת שיקוף: צ׳קליסט מסך מלא, בלי שער פרמיות,
   ברכה לכל המבוטחים הבגירים, ובר חי עם שם + תזמון.
   הרצה: node _test-ops-mirror-ops-ux.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260906-existing-locked-status-v1";
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

function read(name){
  return fs.readFileSync(path.join(ROOT, name), "utf8");
}

function sliceBetween(src, startMark, endMark){
  const start = src.indexOf(startMark);
  const end = src.indexOf(endMark, start);
  if(start < 0 || end < 0 || end <= start) return "";
  return src.slice(start, end);
}

const app = read("app.js");
const html = read("index.html");
const css = read("app.css");
const sw = read("service-worker.js");
const wizard = read("gi-wizard.js");
const cancelForms = read("gi-cancel-forms.js");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-ops-mirror-ops-ux.js")]).status === 0, "node --check this test");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + APP_TAG), "index.html app.css cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");
assert(wizard.includes('GI_WIZARD_BUILD = "' + APP_TAG + '"'), "gi-wizard build tag");
assert(cancelForms.includes('VERSION: "' + APP_TAG + '"'), "gi-cancel-forms version");
assert(app.includes('GI_WIZARD_JS_VERSION = "' + APP_TAG + '"'), "app.js wizard version");

console.log("\n2) העלאת פרמיות הוסרה — אין שער להתחלת שיחה");
assert(!html.includes('id="mcReadyPremiumUploads"'), "אין אזור העלאת פרמיות");
assert(!html.includes('id="mcReadyPremiumFileInput"'), "אין קלט קובץ פרמיות");
assert(!html.includes("סמן וי על הפרמיות"), "אין לחצן מעקף פרמיות");
assert(!app.includes("_collectMirrorPremiumUploadSlots"), "אין לוגיקת סלוטי פרמיות");
assert(!app.includes("_renderReadyPremiumUploads"), "אין רינדור העלאות פרמיות");
assert(!app.includes("_getMirrorPremiumCoversForPolicy"), "אין כיסויים מקובץ אקסל שהועלה");
assert(app.includes("_canStartMirrorCall(){\n      return this._allPreCheckComplete();\n    }")
  || /_canStartMirrorCall\(\)\{\s*return this\._allPreCheckComplete\(\);\s*\}/.test(app),
  "התחלת שיחה תלויה רק בצ׳קליסט");
assert(app.includes("if(!this._allPreCheckComplete()){"), "startCall עדיין דורש צ׳קליסט");
assert(!app.includes("readyPremiumAlert"), "אין באנר שער פרמיות ב-JS");

console.log("\n3) צ׳קליסט — פוליסות ישנות + חדשות");
const needsSum = sliceBetween(app, 'if(key === "needs"){', 'if(key === "disclosure")');
assert(needsSum.includes('ins?.data?.existingPolicies'), "סיכום needs קורא פוליסות קיימות");
assert(needsSum.includes('קיימות:'), "סיכום needs מציג קיימות");
assert(needsSum.includes('חדשות:'), "סיכום needs מציג חדשות");
const needsDetails = sliceBetween(app, 'if(key === "needs"){\n          const existingCards', 'if(key === "disclosure")');
assert(needsDetails.includes("_collectExistingPolicyCards"), "פירוט needs מציג פוליסות קיימות");
assert(needsDetails.includes("_collectNewPolicyCards"), "פירוט needs מציג פוליסות חדשות");
assert(needsDetails.includes("ביטוחים קיימים"), "כותרת ביטוחים קיימים");
assert(needsDetails.includes("פוליסות מוצעות"), "כותרת פוליסות מוצעות");

console.log("\n4) עיצוב צ׳קליסט מסך מלא");
assert(css.includes("body.view-mirrorCall-active.mc-mirror-immersive .topbar"), "טופבר מוסתר במצב immersive");
assert(!/body\.view-mirrorCall-active\.mc-mirror-immersive \.sidebar/.test(css), "תפריט הצד לא מוסתר בשיקוף");
assert(!css.includes("body.view-mirrorCall-active.mc-mirror-immersive .app{"), "גריד האפליקציה לא מתכווץ לעמודה אחת");
const immersiveFixed = sliceBetween(css, "body.view-mirrorCall-active.mc-mirror-immersive #view-mirrorCall.is-visible{", "}");
assert(!immersiveFixed.includes("position:fixed"), "מסך השיקוף לא מכסה את תפריט הצד ב-fixed");
assert(/\n\.mcPreFlightModal\{\s*position:absolute;/.test(css), "צ׳קליסט יושב בתוך אזור השיקוף");
assert(css.includes(".mcPreFlightModal__sheet"), "גיליון צ׳קליסט קיים");
assert(css.includes("height:100%"), "גיליון צ׳קליסט בגובה מלא");
assert(css.includes("font-size:clamp(28px, 3.2vw, 32px)"), "כותרת צ׳קליסט גדולה");
assert(css.includes("font-size:clamp(18px, 1.7vw, 20px)"), "כותרות שלבים גדולות");
assert(css.includes("font-size:clamp(15px, 1.35vw, 16px)"), "סיכומי שלבים קריאים");
assert(app.includes("_syncMirrorImmersiveChrome(){"), "סנכרון chrome immersive קיים");
assert(app.includes('document.body.classList.toggle("mc-mirror-immersive", immersive)'), "מחלקת body נדלקת בשיחה");
assert(app.includes("try { MirrorCallUI._syncMirrorImmersiveChrome(); } catch(_e) {}"), "יציאה ממסך השיקוף מנקה immersive");

console.log("\n5) בר חי — שם לקוח + תזמון בתוך הכרטיס הלבן");
const callCard = sliceBetween(html, 'id="mcCallCard"', 'id="mcWorkstationMainRow"');
assert(callCard.includes('id="mcCallCustomerPill"'), "שם הלקוח בתוך כרטיס השיחה");
assert(callCard.includes('class="mcCall__liveActions"'), "עטיפת פעולות חיות");
assert(callCard.includes('id="mcRescheduleMirrorDockBtn"'), "תזמון חדש בתוך כרטיס השיחה");
assert(callCard.includes('id="mcCallStartBtn"'), "סיים/התחל שיחה באותה שורה");
assert(callCard.indexOf("mcCallCustomerPill") < callCard.indexOf("mcCallStartBtn"), "שם הלקוח בכרטיס לפני לחצן הסיום");
assert(callCard.indexOf("mcRescheduleMirrorDockBtn") < callCard.indexOf("mcCallStartBtn"), "תזמון ליד סיים שיחה");
assert(!html.includes('class="mcRescheduleBar"'), "הוסר פס התזמון הצף");
assert(css.includes(".mcRescheduleBtn--live"), "עיצוב תזמון בבר החי");
assert(css.includes(".mcWorkstation--callLive .mcRescheduleBtn--live"), "תזמון מוצג רק בשיחה חיה");

console.log("\n6) ברכת פתיחה — כל המבוטחים הבגירים, בלי ילדים");
const greetStart = app.indexOf("_mirrorJoinHebrewNames(names){");
const greetEnd = app.indexOf("_mirrorOpeningCompanyName(rec, pr){");
assert(greetStart > 0 && greetEnd > greetStart, "פונקציות ברכה נמצאו");
const greetBlock = app.slice(greetStart, greetEnd);
const sandbox = {};
vm.runInNewContext(`
  function safeTrim(v){ return String(v == null ? "" : v).trim(); }
  const ui = {
    _mirrorGetInsureds(rec){ return rec._insureds || []; },
    _mirrorFullNameFromIns(_rec, ins){ return safeTrim(ins._name); },
    ${greetBlock}
  };
  this.ui = ui;
`, sandbox);

const greet = (insureds, fallbackName) => sandbox.ui._mirrorAdultInsuredGreetingNames({
  fullName: fallbackName || "",
  _insureds: insureds
});
assert(sandbox.ui._mirrorJoinHebrewNames(["תהילה יוסף", "שלמה יוסף"]) === "תהילה יוסף ושלמה יוסף", "צירוף שני שמות");
assert(sandbox.ui._mirrorJoinHebrewNames(["א", "ב", "ג"]) === "א, ב וג", "צירוף שלושה שמות");
assert(
  greet([
    { type: "primary", _name: "תהילה יוסף" },
    { type: "spouse", _name: "שלמה יוסף" },
    { type: "child", _name: "נועם יוסף" }
  ]) === "תהילה יוסף ושלמה יוסף",
  "ראשי + בן/בת זוג, בלי ילד"
);
assert(
  greet([
    { type: "primary", _name: "דנה לוי" },
    { type: "adult", _name: "יוסי לוי" }
  ]) === "דנה לוי ויוסי לוי",
  "ראשי + בגיר"
);
assert(
  greet([
    { type: "primary", _name: "תהילה יוסף" },
    { type: "spouse", _name: "שלמה יוסף" },
    { type: "adult", _name: "רותי יוסף" },
    { type: "child", _name: "ילד יוסף" }
  ]) === "תהילה יוסף, שלמה יוסף ורותי יוסף",
  "שלושה בגירים בלי ילד"
);
assert(greet([], "ישראל ישראלי") === "ישראל ישראלי", "נפילה לשם הלקוח כשאין מבוטחים");
assert(app.includes("this._mirrorAdultInsuredGreetingNames(c)"), "נוסח הפתיחה החי משתמש בברכת בגירים");
assert(app.includes("const greetName = this._mirrorAdultInsuredGreetingNames(c)"), "צ׳קליסט פתיחה משתמש באותה ברכה");

console.log("\n7) רגרסיה — כניסה / תפקידים / שיקוף קיים");
assert(app.includes("function findAgentForLogin(username, agents = []){"), "findAgentForLogin לא נגע");
assert(app.includes("Auth._submit = async function(){"), "Auth._submit לא נגע");
assert(app.includes("pinOnlyLogin: input.pinOnlyLogin === true"), "pinOnlyLogin לא נגע");
assert(html.includes('id="mcCallStartBtn"'), "לחצן התחלת שיחה נשאר");
assert(html.includes('id="mcFlowStep1"') && html.includes("הצגה עצמית"), "סרגל שלבי שיחה נשאר");
assert(app.includes('{ n: 1, keys: ["idle"], label: "הצגה עצמית" }'), "מעקב שלבי שיחה חיה לא נגע");
assert(app.includes("_collectExistingPolicyCards(rec)"), "כרטיסי פוליסות קיימות בשיחה חיה נשארו");
assert(app.includes("_collectNewPolicyCards(rec"), "כרטיסי פוליסות חדשות בשיחה חיה נשארו");
assert(app.includes("if(!hasSubmittedHealthRisksToOps(rec)) return false;"), "שער ממתינים לשיקוף נשאר");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
