/* מונה השיחה בתיק עוקב אחרי המסך הפתוח, לא נופל לשלב 1.
   הרצה: node _test-file-call-stage.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
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

function extractMethod(src, name){
  const start = src.indexOf("    " + name + "(");
  if(start < 0) return "";
  let i = src.indexOf("{", start);
  let depth = 0;
  for(; i < src.length; i++){
    if(src[i] === "{") depth += 1;
    else if(src[i] === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, i + 1);
    }
  }
  return "";
}

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");

const names = ["_mcFormatCallStepKicker", "_mcCallStepCatalog", "_mcCurrentCallStepKey", "_mcResolveCallStepInfo", "_mcOpenScreenName", "_currentFlowStepInfo", "_phaseLabel"];
const body = names.map((name) => extractMethod(app, name)).join(",\n");
assert(names.every((name) => extractMethod(app, name)), "חולצו פונקציות השלב");

const stepFn = extractMethod(app, "_currentFlowStepInfo");
assert(!stepFn.includes('kicker: "שלב 1 · הצגה עצמית"') || stepFn.includes('phase === "idle"'), "נפילה לשלב 1 רק כשהמסך הוא באמת הצגה עצמית");
assert(stepFn.includes("_mcOpenScreenName"), "שלב לא מקוטלג נלקח משם המסך הפתוח");
assert(app.includes("(Number(info.index) || 0)"), "מסך בלי מספר שלב לא שומר את המספר הקודם");
assert(app.includes("const canonical = (State.data?.customers || []).find"), "שלב השיחה נכתב לרשומה בתיק ולא רק לעותק המסך");
assert((app.match(/_publishMirrorCallStep\(\)/g) || []).length >= 3, "טיימר השנייה מפרסם מחדש את השלב הפתוח");
const publishFn = extractMethod(app, "_publishMirrorCallStep");
assert(publishFn.includes("rec.updatedAt = nowISO()"), "מעבר מסך מחדש את חותמת התיק כדי שהשמירה לא תדלג");
const hashFn = extractMethod(app, "rowHash");
assert(hashFn.includes("needsSubPhase") && hashFn.includes("flowStepLabel") && hashFn.includes("stageTag"), "טביעת השמירה כוללת את שלב השיחה הפתוח");
const hashSandbox = {
  safeTrim: (v) => String(v ?? "").trim(),
  isCustomerPayloadTooHeavyForSyncMetrics: () => true,
  estimateRecordPayloadBytes: () => 10,
  api: {}
};
vm.createContext(hashSandbox);
vm.runInContext("this.api.rowHash = function" + hashFn.slice(hashFn.indexOf("(")) + ";", hashSandbox);
function stageRow(label, sub){
  return {
    id: "c1",
    updated_at: "2026-10-10T22:25:36.000Z",
    status: "חדש",
    full_name: "לקוח",
    payload: {
      mirrorFlow: {
        callSession: { uiPhase: "step2", needsSubPhase: sub, flowStepKey: sub, flowStepLabel: label, active: true }
      }
    }
  };
}
const existingHash = hashSandbox.api.rowHash(stageRow("ביטוחים קיימים", "existing"));
const offerHash = hashSandbox.api.rowHash(stageRow("פוליסות מוצעות", "offer"));
assert(existingHash !== offerHash, "מעבר מביטוחים קיימים לפוליסות מוצעות לא נבלע בטביעה");

const sandbox = {
  safeTrim: (v) => String(v ?? "").trim(),
  api: {
    _callRunning: true,
    _fileTimerArmedId: "c1",
    _mirrorUiPhase: "idle",
    _mirrorNeedsSubPhase: "consent",
    _payOn: true,
    _rec: { hasExisting: true, hasCancel: true, hasBenef: true },
    _mirrorHasExistingPolicies(rec){ return !!rec?.hasExisting; },
    _mcPayStepEnabled(){ return !!this._payOn; },
    _hasCancelQuestionnairePolicies(rec){ return !!rec?.hasCancel; },
    _mcHasBeneficiaryStepPolicies(rec){ return !!rec?.hasBenef; },
    _getFreshCustomerRecord(){ return this._rec; },
    selectedCustomer: null
  }
};
vm.createContext(sandbox);
vm.runInContext("Object.assign(this.api, {\n" + body + "\n});", sandbox);

function at(phase, sub, rec){
  sandbox.api._mirrorUiPhase = phase;
  sandbox.api._mirrorNeedsSubPhase = sub || "consent";
  if(rec) sandbox.api._rec = rec;
  return sandbox.api._currentFlowStepInfo();
}

console.log("\n2) המסך הפתוח הוא השלב בתיק");
const full = { hasExisting: true, hasCancel: true, hasBenef: true };
const bare = { hasExisting: false, hasCancel: false, hasBenef: false };

let info = at("idle", "consent", full);
assert(info.label === "הצגה עצמית" && info.kicker === "שלב 1 · הצגה עצמית", "פתיחת שיחה נשארת הצגה עצמית");

info = at("personalVerify", "consent", full);
assert(info.label === "פרטי מבוטח/ים" && info.index === 2, "פרטי מבוטח");

info = at("step2", "consent", full);
assert(info.label === "הסכמת הר הביטוח", "הסכמת הר");

info = at("step2", "existing", full);
assert(info.label === "ביטוחים קיימים", "ביטוחים קיימים לא נשארים על בירור צרכים");
assert(!info.kicker.includes("הצגה עצמית"), "ביטוחים קיימים לא נופלים לשלב 1");

info = at("step2", "offer", full);
assert(info.label === "פוליסות מוצעות", "פוליסות מוצעות");

info = at("step2", "compareNotice", bare);
assert(info.label === "אישור היעדר ביטוח", "אישור היעדר ביטוח כשאין קיימים");

info = at("futureCancel", "offer", full);
assert(info.label === "שינוי או ביטול בעתיד", "שינוי או ביטול בעתיד");

info = at("cancelQuestionnaire", "offer", full);
assert(info.label === "שאלון ביטול", "שאלון ביטול");

info = at("beneficiaries", "offer", full);
assert(info.label === "פרטי מוטבים" && info.index > 0, "פרטי מוטבים כשיש ריסק");

info = at("healthDeclaration", "offer", full);
assert(info.label === "הצהרת בריאות", "הצהרת בריאות");

sandbox.api._payOn = true;
info = at("paymentDetails", "offer", full);
assert(info.label === "פרטי אמצעי תשלום", "פרטי אמצעי תשלום");

info = at("insuranceStart", "offer", full);
assert(info.label === "סיכום והצהרות", "סיכום והצהרות");

info = at("mirrorSummaryReport", "offer", full);
assert(info.label === "שיחת שיקוף הסתיימה המסמכים נדבקים ונשלחים לחתימות", "דוח הסיכום");
assert(info.index === 0 && !info.kicker.includes("שלב 1"), "דוח הסיכום לא מוצג כשלב 1");

info = at("disclosure", "offer", full);
assert(info.label === "גילוי נאות" && info.index === 7, "גילוי נאות הוא שלב 7 ולא פוליסות מוצעות");
assert(info.kicker === "שלב 7 · גילוי נאות", "מונה התיק מציג את שלב גילוי הנאות");

info = at("premiumCost", "offer", full);
assert(info.label === "עלות הביטוח" && info.index === 0, "עלות הביטוח לא מוצגת כשינוי או ביטול");

info = at("step2", "existing", bare);
assert(info.label === "ביטוחים קיימים" && info.index === 0, "מסך קיימים לא מוחלף בשלב אחר כשהקטלוג בלי השלב");
assert(info.kicker !== "שלב 1 · הצגה עצמית", "מסך קיימים לא נופל להצגה עצמית");

console.log("\n3) המסך הגלוי גובר על שלב שמור");
const adoptSrc = extractMethod(app, "_mcAdoptVisibleCallScreen");
const subSrc = extractMethod(app, "_mcStep2SubFromBody");
assert(!!adoptSrc && !!subSrc, "חולצו קריאת המסך הגלוי");
assert(app.includes("this._mcAdoptVisibleCallScreen()"), "פרסום השלב קורא למסך שפתוח מול הנציג");
assert(app.includes('data-mc-needs-screen="consent"') && app.includes('data-mc-needs-screen="existing"') && app.includes('data-mc-needs-screen="offer"') && app.includes('data-mc-needs-screen="reasons"') && app.includes('data-mc-needs-screen="compareNotice"'), "כל מסך בירור מסומן בשם המסך");
assert(subSrc.includes("data-mc-needs-screen"), "קריאת המסך קוראת את הסימון לפני הכפתור");
assert(app.includes('return "שיחת שיקוף הסתיימה המסמכים נדבקים ונשלחים לחתימות"'), "שם דוח הסיכום במערכת נשאר");

function panel(on){
  return { hidden: !on, getAttribute: (name) => (name === "hidden" && !on) ? "" : null };
}
function primaryAct(act){
  return { getAttribute: (name) => name === "data-mc-needs-act" ? act : "" };
}
const host = {
  safeTrim: (v) => String(v ?? "").trim(),
  api: {
    _callRunning: true,
    _mirrorUiPhase: "idle",
    _mirrorNeedsSubPhase: "consent",
    els: {},
    _isMcPanelVisible(el){ return !!(el && !el.hidden && el.getAttribute("hidden") == null); }
  }
};
vm.createContext(host);
vm.runInContext("Object.assign(this.api, {\n" + subSrc + ",\n" + adoptSrc + "\n});", host);

host.api.els = { step6Wrap: panel(true), step2Wrap: panel(true), scriptWrap: panel(true) };
host.api._mirrorUiPhase = "step2";
host.api._mirrorNeedsSubPhase = "consent";
host.api._mcAdoptVisibleCallScreen();
assert(host.api._mirrorUiPhase === "disclosure", "גילוי נאות פתוח לא נשאר על בירור צרכים");

host.api.els = {
  step2Wrap: panel(true),
  step2Body: { querySelector: () => primaryAct("needs-to-reasons") }
};
host.api._mirrorUiPhase = "step2";
host.api._mirrorNeedsSubPhase = "consent";
host.api._mcAdoptVisibleCallScreen();
assert(host.api._mirrorUiPhase === "step2" && host.api._mirrorNeedsSubPhase === "offer", "פוליסות מוצעות לפי המסך שמוצג");

host.api.els = {
  step2Wrap: panel(true),
  step2Body: { querySelector: () => primaryAct("needs-to-offer") }
};
host.api._mirrorNeedsSubPhase = "consent";
host.api._mcAdoptVisibleCallScreen();
assert(host.api._mirrorNeedsSubPhase === "existing", "ביטוחים קיימים לפי המסך שמוצג");

host.api.els = { step5Wrap: panel(true), step2Wrap: panel(false) };
host.api._mirrorUiPhase = "step2";
host.api._mcAdoptVisibleCallScreen();
assert(host.api._mirrorUiPhase === "futureCancel", "שינוי או ביטול בעתיד לפי הפאנל הפתוח");

host.api.els = { scriptWrap: panel(true) };
host.api._mirrorUiPhase = "disclosure";
host.api._mcAdoptVisibleCallScreen();
assert(host.api._mirrorUiPhase === "idle", "הצגה עצמית כשזה המסך הפתוח");

host.api.els = { mirrorSummaryWrap: panel(true), stepInsStartWrap: panel(true) };
host.api._mirrorUiPhase = "insuranceStart";
host.api._mcAdoptVisibleCallScreen();
assert(host.api._mirrorUiPhase === "mirrorSummaryReport", "דוח התיקונים הוא המסך הפתוח");

host.api.els = {
  step2Wrap: panel(true),
  step2Body: {
    querySelector(sel){
      if(String(sel).indexOf("data-mc-needs-screen") >= 0){
        return { getAttribute: (name) => name === "data-mc-needs-screen" ? "offer" : "" };
      }
      return primaryAct("har-yes");
    }
  }
};
host.api._mirrorUiPhase = "step2";
host.api._mirrorNeedsSubPhase = "consent";
host.api._mcAdoptVisibleCallScreen();
assert(host.api._mirrorNeedsSubPhase === "offer", "פוליסות מוצעות נשארות גם אם נשאר כפתור הסכמה בגוף");

host.api._callRunning = false;
host.api.els = { step6Wrap: panel(true) };
host.api._mirrorUiPhase = "idle";
host.api._mcAdoptVisibleCallScreen();
assert(host.api._mirrorUiPhase === "idle", "בלי שיחה פעילה השלב השמור לא נדרס");

console.log("\n" + (failed ? "FAILED " + failed : "OK " + passed + " checks"));
process.exit(failed ? 1 : 0);
