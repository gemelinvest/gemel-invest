/* GI-OPS 2026-09-14 — שלבי שיקוף לפי תסריט 2026: מספור רץ, עלות, ביטול בעתיד, מוטבים.
   הרצה: node _test-ops-mirror-live-steps.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260915-reminder-compact-v2";
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
const arrival = read("gi-arrival-docs.js");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-arrival-docs.js")]).status === 0, "node --check gi-arrival-docs.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-ops-mirror-live-steps.js")]).status === 0, "node --check this test");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + APP_TAG), "index.html app.css cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");
assert(app.includes('BUILD = "' + APP_TAG + '"'), "app.js BUILD");
assert(app.includes('GI_ARRIVAL_DOCS_HREF = "./gi-arrival-docs.js?v=20260914-mirror-script-order-v1"'), "arrival docs href לא שונה");

console.log("\n2) מספור רץ לכל מסך + טיימר חי בחזרה");
assert(app.includes("_mcCallStepCatalog(rec){"), "קטלוג מסכים לשיחה");
assert(app.includes("_mcResolveCallStepInfo(rec){"), "מספר רץ מחושב מהמסך הנוכחי");
assert(app.includes('_mcFormatCallStepKicker(index, label){'), "פורמט שלב N · שם");
assert(app.includes('if(hasExisting) steps.push({ key: "existing"'), "ביטוחים קיימים רק כשיש פוליסות");
assert(app.includes('steps.push({ key: "compareNotice", label: "אישור היעדר ביטוח"'), "בלי קיימים — אישור היעדר ביטוח");
assert(app.includes('this._persistMirrorCall("עודכן שלב שיחת שיקוף", { immediate: true })'), "שמירת שלב מיידית לטיימר");
assert(app.includes("safeTrim(call.flowStepKicker)"), "חתימת צפייה כוללת את כותרת השלב");
assert(app.includes("String(Number(call.flowStepIndex || 0) || 0)"), "חתימת צפייה כוללת מספר שלב");
assert(!app.includes('offer: "שלב 3 · פוליסות מוצעות"'), "אין יותר תת-שלבים תחת שלב 3 קבוע");

const catalog = sliceBetween(app, "_mcCallStepCatalog(rec){", "_mcCurrentCallStepKey(){");
const offerI = catalog.indexOf('key: "offer"');
const compareI = catalog.indexOf('key: "compareNotice"');
const premI = catalog.indexOf('key: "premiumCost"');
const futI = catalog.indexOf('key: "futureCancel"');
const discI = catalog.indexOf('key: "disclosure"');
const cancelI = catalog.indexOf('key: "cancelQuestionnaire"');
assert(offerI > 0 && compareI > offerI, "מוצעות לפני מסמך השוואה / אישור היעדר");
assert(premI < 0, "עלות הביטוח אינה שלב חי");
assert(futI > compareI, "שינוי/ביטול בעתיד אחרי השוואה");
assert(discI > futI, "גילוי נאות אחרי שינוי/ביטול בעתיד");
assert(cancelI > discI, "שאלון ביטול אחרי גילוי נאות");
assert(!catalog.includes('key: "reasons"'), "שיקולי המלצה אינם שלב חי בקטלוג");
assert(catalog.includes('label: "שינוי או ביטול בעתיד"'), "שם שלב ביטול בעתיד לפי התסריט");
assert(html.includes('id="mcStep4Wrap"') && html.includes('id="mcStep4Body"'), "פאנל עלות הביטוח ב-HTML נשאר");
assert(html.includes('id="mcStep4Kicker"'), "כותרת שלב לעלות הביטוח נשארה ב-DOM");

console.log("\n3) פוליסות מוצעות — המלצת מגדל בלבד, בלי מקס ובלי ביטול בעתיד");
const offer = sliceBetween(app, "_renderNeedsOffer(rec){", "_renderNeedsReasons(rec){");
assert(!offer.includes("במידה ובעתיד תרצה לעשות שינוי או ביטול"), "נוסח שינוי/ביטול לא דבוק להצעה");
assert(!offer.includes("בתנאי שנותר מוצר הבסיס"), "משפט ביטול נספחים לא בהצעה");
assert(!offer.includes("_mcMigdalPeakMap(rec)"), "מקס מגדל לא במסך ההצעה");
assert(offer.includes("<strong>(מגדל)</strong>"), "משפט המלצת מגדל אחרי הפוליסה המוצעת");
assert(offer.includes("ההמלצה מבוססת על גילך"), "נוסח המלצה לפי התסריט");
assert(offer.includes("reasons-to-compare"), "ממוצעות למסמך השוואה / אישור היעדר");
assert(offer.includes("needs-to-existing") && offer.includes("har-back"), "חזרה ממוצעות לקיימים או להסכמת הר");

console.log("\n4) עלות הביטוח נשארה בקוד, לא במסלול החי");
const premium = sliceBetween(app, "_renderStep4PremiumCostBody(rec){", "_renderStep4NewPoliciesBody(rec){");
assert(premium.includes("_mcMigdalPeakMap(rec)"), "מפת מקס מגדל במסך העלות שנשמר בקוד");
assert(premium.includes("migdalPeaks"), "שיא מגדל מועבר לכרטיסי עלות");
assert(premium.includes("premium-to-future"), "מעלויות לשינוי/ביטול בעתיד");
assert(premium.includes("premium-back"), "חזרה מעלויות למסמך השוואה");
assert(app.includes("הפרמיה המקסימלית הצפויה היא"), "שורת מקס על הכרטיס");
assert(app.includes("opts.migdalPeaks"), "שיא מגדל רק כשמועבר במפורש");
assert(arrival.includes("peakFromPolicyTables(tables, policy)"), "חישוב שיא מטבלאות התפתחות פרמיה");
assert(arrival.includes('if(proj.source !== "engine"'), "רק תחזית מנוע, בלי מספר מזויף");
assert(css.includes(".mcPolicyRow__maxPrem"), "עיצוב שורת מקס");
const restore = sliceBetween(app, "_restoreMirrorPhaseUi(rec, phase){", "_mcNavPrev(){");
assert(!restore.includes("_renderStep4PremiumCostBody(rec)"), "שחזור לא מציג את מסך העלות החי");
assert(restore.includes("_renderStep5FutureCancelBody()"), "שחזור מציג את מסך שינוי/ביטול");
assert(restore.includes('this._mirrorUiPhase = "futureCancel"'), "שחזור מדילוג עלות לביטול בעתיד");
const futureBody = sliceBetween(app, "_renderStep5FutureCancelBody(){", "_renderStep6DisclosureBody(rec){");
assert(futureBody.includes("future-to-disclosure"), "משינוי/ביטול תמיד לגילוי נאות");
assert(futureBody.includes("future-back"), "חזרה משינוי/ביטול");
assert(app.includes("_showStep4Panel(){"), "פתיחת פאנל עלות נשארה בקוד");
assert(app.includes('this.els.step4Wrap      = document.getElementById("mcStep4Wrap")'), "חיבור DOM לעלות");

console.log("\n5) מוטבים — מחלות קשות + סרטן");
assert(app.includes('_isBeneficiaryStepProduct(type){'), "מסנן מוצרי מוטבים");
assert(app.includes('return t === "ריסק" || t === "ריסק משכנתא" || t === "מחלות קשות" || t === "סרטן"'), "סרטן ומחלות קשות נכנסים");
assert(app.includes('if(type === "מחלות קשות" || type === "סרטן") return "risk_benef"'), "מצב מוטבים ל-CI/סרטן בלי משעבד");
assert(app.includes(".filter((p) => this._isBeneficiaryStepProduct(p?.type || p?.product))"), "איסוף כרטיסים לפי מוצר מוטבים");
assert(app.includes("if(this._isRiskOrMortgageRiskType(p?.type || p?.product)) this._ensurePledgeBank(p)"), "לא יוצרים משעבד למחלות קשות/סרטן");

console.log("\n6) ניווט לפי התסריט — בלי קיימים ובלי דילוג לגילוי מוקדם");
assert(app.includes("האם אתה מאשר שאין לך כיום ביטוחים קיימים"), "נוסח אישור היעדר ביטוחים");
const harYes = sliceBetween(app, 'if(action === "har-yes"){', 'if(action === "har-no"){');
assert(harYes.includes("_mirrorHasExistingPolicies(rec)"), "אחרי הר — קיימים רק אם יש פוליסות");
assert(harYes.includes('this._mirrorNeedsSubPhase = "offer"'), "בלי קיימים ממשיכים לפוליסות מוצעות");
assert(!harYes.includes('this._mirrorUiPhase = "disclosure"'), "בלי קיימים לא מדלגים לגילוי נאות");
const discBack = sliceBetween(app, 'if(action === "disclosure-back"){', 'if(action === "disclosure-done"){');
assert(discBack.includes('this._mirrorUiPhase = "futureCancel"'), "חזרה מגילוי נאות לשינוי/ביטול בעתיד");
const discDone = sliceBetween(app, 'if(action === "disclosure-done"){', 'if(action === "offer-to-cancelq"');
assert(discDone.includes('_enterCancelQuestionnaireOrSkip(rec, "forward")'), "גילוי נאות ממשיך לשאלון ביטול");
assert(app.includes('this._mirrorUiPhase = "disclosure"') && app.includes('if(action === "cancelq-back"){'), "חזרה משאלון ביטול לגילוי נאות");
const noneYes = sliceBetween(app, 'if(action === "compare-none-yes"){', 'if(action === "reasons-to-compare"){');
assert(noneYes.includes('this._mirrorUiPhase = "futureCancel"'), "אישור היעדר ביטוח ממשיך לשינוי/ביטול בעתיד");

console.log("\n7) שיא פרמיה מטבלאות מנוע");
const sandbox = { console, location: { href: "https://example.com/app", pathname: "/" } };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.runInNewContext(arrival, sandbox, { filename: "gi-arrival-docs.js" });
const api = sandbox.GiArrivalDocs;
const policy = { id: "np-migdal-1", company: "מגדל", type: "ריסק" };
const peak = api.peakFromPolicyTables([
  {
    policy,
    coverRows: [
      {
        projection: {
          ok: true,
          source: "engine",
          rows: [
            { age: 40, monthly: 80 },
            { age: 55, monthly: 210 },
            { age: 66, monthly: 210 },
            { age: 70, monthly: 180 }
          ]
        }
      }
    ]
  }
], policy);
assert(peak && peak.monthly === 210 && peak.age === 55, "שיא = סכום ראשון בגיל השיא");
const storedOnly = api.peakFromPolicyTables([
  {
    policy,
    coverRows: [{ projection: { ok: true, source: "stored", rows: [{ age: 40, monthly: 80 }, { age: 41, monthly: 90 }] } }]
  }
], policy);
assert(storedOnly == null, "fallback stored לא מייצר מקס מזויף");
const other = api.peakFromPolicyTables([
  { policy: { id: "other" }, coverRows: [{ projection: { ok: true, source: "engine", rows: [{ age: 50, monthly: 999 }] } }] }
], policy);
assert(other == null, "פוליסה אחרת לא נספרת");

const healthPeak = api.peakFromPolicyTables([
  {
    policy: { id: "h1" },
    coverRows: [
      { projection: { ok: true, source: "engine", rows: [{ age: 40, monthly: 50 }, { age: 60, monthly: 90 }] } },
      { projection: { ok: true, source: "engine", rows: [{ age: 40, monthly: 30 }, { age: 60, monthly: 40 }] } }
    ]
  }
], { id: "h1" });
assert(healthPeak && healthPeak.monthly === 130 && healthPeak.age === 60, "בריאות = סכום כיסויים לפי גיל ואז שיא");

console.log("\n8) רגרסיה — אזורים שלא נדרשו");
assert(app.includes("_mcSyncHealthDeclarationCopies(rec, source){"), "הצהרת בריאות לא הוחלפה");
assert(app.includes("_mcNewPolicyPremiumDiscountRows(p, opts = {}){"), "חישוב פרמיה/הנחה נשאר");
assert(app.includes("function findAgentForLogin(username, agents = []){"), "login לא נגע");
assert(app.includes("_renderNeedsReasons(rec){"), "מסך שיקולים נשאר בקוד ולא נמחק");
assert(app.includes("_mcNeedsNav(\"disclosure-done\""), "לחצן גילוי נאות עדיין קיים");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
