/* GI-OPS 2026-09-08 — שיקוף תפעול: נוסח הסכמה, שורות דחוסות,
   סדר גילוי נאות / מסמך השוואה, ומסילת טפסים בהצהרת בריאות.
   הרצה: node _test-ops-mirror-screens-flow.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260908-daily-sales-v5";
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
const css = read("app.css");
const html = read("index.html");
const sw = read("service-worker.js");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-ops-mirror-screens-flow.js")]).status === 0, "node --check this test");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + APP_TAG), "index.html app.css cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");

console.log("\n2) נוסח הסכמת הר הביטוח");
const consent = sliceBetween(app, "_renderNeedsConsent(_rec){", "_mcCancelMetaForPolicy(ins, policy){");
assert(consent.includes("אז לאחר שקיבלנו את פנייתך, האם אתה מאשר כי אתה מאשר לנו להיכנס עבורך לממשק הר הביטוח"), "נוסח הסכמה מעודכן");
assert(!consent.includes("האם אתה מאשר לנו להיכנס עבורך"), "הנוסח הישן הוסר");

console.log("\n3) שורות פוליסה דחוסות");
assert(app.includes("_mcPolicyRowHtml(opts){"), "עזר שורת פוליסה");
assert(css.includes(".mcPolicyRow__main{"), "עיצוב שורה דחוסה");
assert(css.includes(".mcPolicyRow__status--danger"), "תג סטטוס דחוס");
const existing = sliceBetween(app, "_collectExistingPolicyCards(rec){", "_renderNeedsExisting(rec){");
assert(existing.includes("_mcPolicyRowHtml({"), "ביטוחים קיימים בשורות");
assert(!existing.includes("_mcPolicyCardHtml({"), "כרטיס גבוה לא בשימוש בקיימים");
const offer = sliceBetween(app, "_collectNewPolicyCards(rec, opts = {}){", "_renderNeedsOffer(rec){");
assert(offer.includes("_mcPolicyRowHtml({"), "פוליסות מוצעות בשורות");
assert(offer.includes('k: "לפני הנחה"'), "עמודת פרמיה לפני הנחה");
assert(app.includes("_mcPolicyCardHtml(opts){"), "כרטיס ישן נשאר לגילוי נאות");

console.log("\n4) סדר שלבים: קיימים → גילוי נאות → מוצעות → מסמך השוואה");
const existingRender = sliceBetween(app, "_renderNeedsExisting(rec){", "_mcNewPolicyFileParityRows(rec, p){");
assert(existingRender.includes('needs-to-disclosure"'), "מקיימים ממשיכים לגילוי נאות");
assert(!existingRender.includes("needs-to-offer"), "מקיימים לא מדלגים למוצעות");
const offerRender = sliceBetween(app, "_renderNeedsOffer(rec){", "_renderNeedsReasons(rec){");
assert(offerRender.includes("reasons-to-compare"), "ממוצעות למסמך השוואה");
assert(offerRender.includes("needs-to-disclosure"), "חזרה ממוצעות לגילוי נאות");
const disc = sliceBetween(app, "const nextLabel = \"המשך · פוליסות מוצעות\";", "_hideMcPanelsExcept(keep){");
assert(!!disc, "גילוי נאות ממשיך לפוליסות מוצעות");
assert(app.includes('this._mirrorNeedsSubPhase = "offer";') && app.includes('action === "disclosure-done"'), "disclosure-done → מוצעות");
assert(app.includes('this._mirrorNeedsSubPhase = "existing";'), "disclosure-back → קיימים");
const reasons = sliceBetween(app, "_renderNeedsReasons(rec){", "_renderNeedsCompareNotice(rec){");
assert(reasons.includes("compare-to-cancelq"), "משיקולים לשאלון ביטול");
const compare = sliceBetween(app, "_renderNeedsCompareNotice(rec){", "_mirrorGetNewPoliciesRaw(rec){");
assert(compare.includes("needs-to-reasons"), "ממסמך השוואה לשיקולים");
assert(compare.includes("<strong>(מגדל)</strong>"), "תג מגדל בנוסח");
assert(compare.includes("מסמך השוואה כתוב המשווה"), "נוסח מסמך השוואה המעודכן");
assert(!compare.includes("שבו כתוב ההשוואה"), "הנוסח הישן של מסמך ההשוואה הוסר");

console.log("\n5) מסילת טפסים בהצהרת בריאות + שמירה בסוף");
assert(app.includes("_mcHealthFormsRailHtml(rec){"), "בונה רשימת טפסים");
assert(app.includes("mcHealthDeclSplit"), "פריסה מפוצלת");
assert(css.includes(".mcHealthFormsRail{"), "עיצוב מסילה ימנית");
assert(app.includes("טפסי הצעה") && app.includes("שאלוני המשך"), "שתי קבוצות ברשימה");
assert(app.includes("_mcBindFormEditPersistence(rec, key){"), "עריכה נשמרת תוך כדי");
assert(app.includes("payload.mirrorFlow.formEdits"), "overlay ב-mirrorFlow");
assert(app.includes("_mcMaterializeEditedForms(rec){"), "הפקת טפסים מוכנים בסוף");
assert(app.includes("_mcCanonicalJoinDocId(type){"), "מזהה טופס קנוני בתיק");
assert(!app.includes("doc_mirror_filled_"), "אין מסמך כפול משיחת שיקוף");
assert(app.includes("mcFormModalFull"), "טופס נפתח במלואו");
assert(css.includes(".giValModal.mcFormModalFull .giValModal__card"), "חלון טופס גדול");
assert(app.includes("data-mc-open-form"), "לחיצה מהמסילה");
assert(app.includes("_mcJoinFormTypeForPolicy(p, rec){"), "צימוד טופס לכל פוליסה מוצעת");
assert(app.includes("הקראתי ללקוח והמשך"), "לחצן הקראה לפני טפסים");
assert(app.includes("על מה הלקוח הצהיר כן"), "אזור תיעוד כן");
assert(app.includes("Auth.isOps() || Auth.isOpsAgent()"), "תפעול יכול לפתוח טפסי הצעה");
assert(app.includes("_mcFilterCurrentOfferPolicies(rec, list){"), "סינון פוליסות מוצעות להצעה הנוכחית");
const healthRender = sliceBetween(app, "_renderHealthDeclarationBody(rec){", "_mcIsExistingHealthProduct(p){");
assert(healthRender.includes("_mcHealthFormsRailHtml(rec)"), "המסילה מצוירת אחרי ההקראה");
assert(healthRender.includes("כעת נעבור להצהרת הבריאות"), "נוסח הקראה לא הוסר");
assert(healthRender.includes("health-script-ack"), "שער הקראה");
assert(!healthRender.includes("data-mc-health-answer"), "אין כרטיסי אשף בשלב השיקוף");

console.log("\n6) רגרסיה — לוגיקת ליבה לא הוחלפה");
assert(app.includes("_mcSyncHealthDeclarationCopies(rec, source){"), "סנכרון הצהרה נשאר");
assert(app.includes("function findAgentForLogin(username, agents = []){"), "findAgentForLogin לא נגע");
assert(app.includes("_mcNewPolicyPremiumDiscountRows(p, opts = {}){"), "חישוב פרמיה/הנחה נשאר");
assert(app.includes("fillOriginalTemplate"), "מנוע מילוי טפסים רשמיים נשאר");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
