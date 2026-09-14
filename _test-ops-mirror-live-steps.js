/* GI-OPS 2026-09-14 — שלבי שיקוף רצים, מקס מגדל, מוטבים סרטן/CI, טיימר חי.
   הרצה: node _test-ops-mirror-live-steps.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260914-mirror-live-steps-v1";
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
assert(app.includes('GI_ARRIVAL_DOCS_HREF = "./gi-arrival-docs.js?v=' + APP_TAG + '"'), "arrival docs href");

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

console.log("\n3) פוליסות מוצעות — מקס מגדל + שינוי/ביטול בעתיד");
const offer = sliceBetween(app, "_renderNeedsOffer(rec){", "_renderNeedsReasons(rec){");
assert(offer.includes("במידה ובעתיד תרצה לעשות שינוי או ביטול, תוכל לבצע זאת בכל אחד מהאמצעים"), "נוסח שינוי/ביטול אחרי הפוליסות");
assert(offer.includes("בתנאי שנותר מוצר הבסיס"), "משפט ביטול נספחים");
assert(offer.includes("_mcMigdalPeakMap(rec)"), "מפת מקס מגדל במסך ההצעה");
assert(app.includes("הפרמיה המקסימלית הצפויה היא"), "שורת מקס על הכרטיס");
assert(app.includes("opts.migdalPeaks"), "שיא מגדל רק במסך ההצעה");
assert(arrival.includes("peakFromPolicyTables(tables, policy)"), "חישוב שיא מטבלאות התפתחות פרמיה");
assert(arrival.includes('if(proj.source !== "engine"'), "רק תחזית מנוע, בלי מספר מזויף");
assert(css.includes(".mcPolicyRow__maxPrem"), "עיצוב שורת מקס");

console.log("\n4) מוטבים — מחלות קשות + סרטן");
assert(app.includes('_isBeneficiaryStepProduct(type){'), "מסנן מוצרי מוטבים");
assert(app.includes('return t === "ריסק" || t === "ריסק משכנתא" || t === "מחלות קשות" || t === "סרטן"'), "סרטן ומחלות קשות נכנסים");
assert(app.includes('if(type === "מחלות קשות" || type === "סרטן") return "risk_benef"'), "מצב מוטבים ל-CI/סרטן בלי משעבד");
assert(app.includes(".filter((p) => this._isBeneficiaryStepProduct(p?.type || p?.product))"), "איסוף כרטיסים לפי מוצר מוטבים");
assert(app.includes("if(this._isRiskOrMortgageRiskType(p?.type || p?.product)) this._ensurePledgeBank(p)"), "לא יוצרים משעבד למחלות קשות/סרטן");

console.log("\n5) בלי ביטוחים קיימים — דילוג + אישור");
assert(app.includes("האם אתה מאשר שאין לך כיום ביטוחים קיימים"), "נוסח אישור היעדר ביטוחים");
const harYes = sliceBetween(app, 'if(action === "har-yes"){', 'if(action === "har-no"){');
assert(harYes.includes("_mirrorHasExistingPolicies(rec)"), "אחרי הר — קיימים רק אם יש פוליסות");
assert(harYes.includes('this._mirrorUiPhase = "disclosure"'), "בלי קיימים מדלגים לגילוי נאות");
const discBack = sliceBetween(app, 'if(action === "disclosure-back"){', 'if(action === "disclosure-done"){');
assert(discBack.includes('this._mirrorNeedsSubPhase = "consent"'), "חזרה מגילוי בלי קיימים להסכמת הר");
assert(app.includes('this._mirrorNeedsSubPhase = this._mirrorHasExistingPolicies(rec) ? "reasons" : "compareNotice"'), "חזרה משאלון ביטול לא מדלגת למסך שיקולים ריק");

console.log("\n6) שיא פרמיה מטבלאות מנוע");
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

console.log("\n7) רגרסיה — אזורים שלא נדרשו");
assert(app.includes("_mcSyncHealthDeclarationCopies(rec, source){"), "הצהרת בריאות לא הוחלפה");
assert(app.includes("_mcNewPolicyPremiumDiscountRows(p, opts = {}){"), "חישוב פרמיה/הנחה נשאר");
assert(app.includes("function findAgentForLogin(username, agents = []){"), "login לא נגע");
assert(app.includes("_renderStep5FutureCancelBody(){"), "מסך שינוי/ביטול הנפרד לא נמחק");
assert(app.includes("_mcNeedsNav(\"disclosure-done\""), "גילוי נאות עדיין ממשיך למוצעות");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
