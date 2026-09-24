/* GI-OPS 2026-09-24 — גילוי נאות על שורת הפוליסה המוצעת, בלי מסך שלב נפרד.
   הרצה: node _test-ops-offer-row-disclosure.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260924-manager-toast-yield-v1";let failed = 0;
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
  const end = src.indexOf(endMark, start + startMark.length);
  if(start < 0 || end < 0 || end <= start) return "";
  return src.slice(start, end);
}

function sliceMethod(src, signature){
  const start = src.indexOf(signature);
  if(start < 0) return "";
  let i = src.indexOf("{", start);
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

const app = read("app.js");
const css = read("app.css");
const html = read("index.html");
const sw = read("service-worker.js");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-ops-offer-row-disclosure.js")]).status === 0, "node --check this test");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + APP_TAG), "index.html app.css cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");
assert(app.includes('BUILD = "' + APP_TAG + '"'), "app.js BUILD");

console.log("\n2) השלב החי הוסר, הגילוי יושב על השורה");
const catalog = sliceBetween(app, "_mcCallStepCatalog(rec){", "_mcCurrentCallStepKey(){");
assert(catalog.indexOf('key: "disclosure"') < 0, "אין שלב גילוי נאות בקטלוג השיחה");
assert(catalog.includes('key: "offer"'), "פוליסות מוצעות נשארו שלב");
const offer = sliceBetween(app, "_renderNeedsOffer(rec){", "_renderNeedsReasons(rec){");
assert(offer.includes("withDisclosure: true"), "מסך הפוליסות המוצעות מבקש גילוי על השורה");
assert(offer.includes("להקראת גילוי הנאות לחצו «הצג גילוי נאות»"), "נוסח הקראה מפנה ללחצן");
assert(offer.includes("mcOfferList"), "רשימת כרטיסים ולא שורה דחוסה");
const collect = sliceBetween(app, "_collectNewPolicyCards(rec, opts = {}){", "_mcMigdalPeakMap(rec){");
assert(collect.includes("this._mcOfferDisclosureExtraHtml(buttonPolicy)"), "רק כרטיס ההצעה מקבל את לחצן הגילוי");
assert(collect.includes("this._mcOfferCardHtml({"), "כרטיס מסודר לפוליסה מוצעת");
assert(!collect.includes("<details"), "הגילוי לא נפתח כלפי מטה בכרטיס");
assert(css.includes(".mcOfferCard__facts{"), "ששת השדות בכרטיס");
assert(css.includes(".mcOfferCard__fact strong{"), "ערכים בכתב גדול");
assert(css.includes(".mcDiscModal{"), "מודאל גילוי במרכז המסך");
assert(css.includes("align-items:center"), "המודאל ממורכז");

console.log("\n3) הניווט מדלג על המסך הנפרד");
const futureGo = sliceBetween(app, 'if(action === "future-to-disclosure" || action === "future-done"){', 'if(action === "pay-back"){');
assert(futureGo.includes('_enterCancelQuestionnaireOrSkip(rec, "forward")'), "אחרי שינוי/ביטול ממשיכים בלי מסך גילוי");
assert(!futureGo.includes("_showStep6Panel"), "לא נפתח פאנל גילוי נאות");
const cancelBack = sliceBetween(app, 'if(action === "cancelq-back"){', 'if(action === "cancelq-to-benef"');
assert(cancelBack.includes('this._mirrorUiPhase = "futureCancel"'), "חזרה משאלון ביטול לשינוי/ביטול");
assert(!cancelBack.includes("_renderStep6DisclosureBody"), "חזרה לא מציירת מסך גילוי");
const restore = sliceBetween(app, 'else if(p === "disclosure"){', 'else if(p === "paymentDetails"');
assert(restore.includes('this._mirrorNeedsSubPhase = "offer"'), "שחזור שלב ישן חוזר לפוליסות מוצעות");
assert(restore.includes("_showStep2Panel()"), "שחזור מציג את מסך הפוליסות");
assert(!restore.includes("_showStep6Panel"), "שחזור לא פותח את המסך הישן");
const flow = sliceBetween(app, "_mcFlowPlan(){", "_isMcPanelVisible(el){");
assert(!flow.includes('label: "גילוי נאות"'), "סרגל השלבים בלי גילוי נאות נפרד");
assert(app.includes('if(phase === "disclosure") return "offer"'), "מספר רץ של שלב ישן הוא פוליסות מוצעות");

console.log("\n4) נוסח לפי פוליסה וחברה");
const itemsFn = sliceMethod(app, "_mcDisclosureItemsForPolicy(policy){");
const htmlFn = sliceMethod(app, "_mcOfferDisclosureExtraHtml(policy){");
const modalFn = sliceMethod(app, "_mcDisclosureModalPanelHtml(policy, items){");
assert(itemsFn.includes("getDisclosureKeysForPolicy"), "שליפת מפתחות גילוי לפוליסה");
assert(htmlFn.includes("הצג גילוי נאות"), "לחצן פתיחה על הכרטיס");
assert(htmlFn.includes("data-mc-disc-open"), "הלחצן פותח לפי מזהה פוליסה");
assert(!htmlFn.includes("<details"), "הלחצן לא מרחיב את השורה");
assert(modalFn.includes("mcDiscModal__text"), "נוסח הגילוי חי במודאל");

function safeTrim(v){ return String(v == null ? "" : v).trim(); }
function escapeHtml(s){
  return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
const MIRROR_DISCLOSURE_LIBRARY = {
  "מגדל": {
    risk: { label: "ריסק מגדל", text: "סכום הביטוח ____ ₪ לחברת מגדל." },
    cancer: { label: "סרטן מגדל", text: "כיסוי סרטן במגדל." }
  },
  "כלל": {
    risk: { label: "ריסק כלל", text: "נוסח כלל לריסק." }
  }
};
const MirrorsUI = {
  resolveDisclosureCompany(company){ return company; },
  resolveDisclosureLibraryCompany(company){ return company; },
  getDisclosureKeysForPolicy(policy){
    const type = safeTrim(policy?.type);
    if(type === "ריסק") return ["risk"];
    if(type === "סרטן") return ["cancer"];
    return [];
  },
  getPolicyDisclosureAmount(){ return "250000"; },
  fillDisclosureAmountBlanks(text, amount){
    return String(text).replace("____", amount);
  },
  getHealthCoverList(){ return []; },
  findDisclosureKeysByCoverLabel(){ return []; }
};
const sandbox = { safeTrim, escapeHtml, MIRROR_DISCLOSURE_LIBRARY, MirrorsUI, console };
sandbox.ui = {};
vm.createContext(sandbox);
vm.runInContext(
  "ui._mcDisclosureItemsForPolicy = function " + itemsFn.replace("_mcDisclosureItemsForPolicy", "") + ";\n" +
  "ui._mcOfferDisclosureExtraHtml = function " + htmlFn.replace("_mcOfferDisclosureExtraHtml", "") + ";\n" +
  "ui._mcDisclosureModalPanelHtml = function " + modalFn.replace("_mcDisclosureModalPanelHtml", "") + ";",
  sandbox
);
const migdal = { id: "p-migdal", company: "מגדל", type: "ריסק" };
const items = sandbox.ui._mcDisclosureItemsForPolicy(migdal);
assert(items.length === 1 && items[0].title === "ריסק מגדל", "ריסק מגדל מביא רק את נוסח מגדל");
assert(items[0].text.includes("250000") && items[0].text.includes("מגדל"), "הסכום והחברה נכנסים לנוסח");
const button = sandbox.ui._mcOfferDisclosureExtraHtml(migdal);
assert(button.includes("הצג גילוי נאות") && button.includes("p-migdal"), "הכרטיס מציג לחצן סגור");
assert(!button.includes("250000") && !button.includes("ריסק מגדל"), "נוסח הגילוי לא פתוח על הכרטיס");
const modal = sandbox.ui._mcDisclosureModalPanelHtml(migdal, items);
assert(modal.includes("mcDiscModal__title") && modal.includes("מגדל") && modal.includes("250000"), "המודאל מציג את גילוי מגדל");
assert(!modal.includes("נוסח כלל"), "נוסח כלל לא נכנס למודאל של מגדל");
const clalItems = sandbox.ui._mcDisclosureItemsForPolicy({ company: "כלל", type: "ריסק" });
const clalModal = sandbox.ui._mcDisclosureModalPanelHtml({ company: "כלל", type: "ריסק" }, clalItems);
assert(clalModal.includes("ריסק כלל") && !clalModal.includes("ריסק מגדל"), "פוליסת כלל מציגה רק את גילוי כלל");
const cancerItems = sandbox.ui._mcDisclosureItemsForPolicy({ company: "מגדל", type: "סרטן" });
const cancerModal = sandbox.ui._mcDisclosureModalPanelHtml({ company: "מגדל", type: "סרטן" }, cancerItems);
assert(cancerModal.includes("סרטן מגדל") && !cancerModal.includes("ריסק מגדל"), "סרטן מגדל לא מושך נוסח ריסק");
const missing = sandbox.ui._mcDisclosureModalPanelHtml({ company: "איילון", type: "ריסק" }, []);
assert(missing.includes("לא נמצא נוסח גילוי נאות"), "בלי ספרייה המודאל מסביר שאין נוסח");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
