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
assert(info.label === "בירור והתאמת צרכים", "הסכמת הר");

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
assert(info.label === "סיכום תיקוני שיחת השיקוף", "דוח הסיכום");
assert(info.index === 0 && !info.kicker.includes("שלב 1"), "דוח הסיכום לא מוצג כשלב 1");

info = at("disclosure", "offer", full);
assert(info.label === "גילוי נאות" && info.index === 7, "גילוי נאות הוא שלב 7 ולא פוליסות מוצעות");
assert(info.kicker === "שלב 7 · גילוי נאות", "מונה התיק מציג את שלב גילוי הנאות");

info = at("premiumCost", "offer", full);
assert(info.label === "עלות הביטוח" && info.index === 0, "עלות הביטוח לא מוצגת כשינוי או ביטול");

info = at("step2", "existing", bare);
assert(info.label === "ביטוחים קיימים" && info.index === 0, "מסך קיימים לא מוחלף בשלב אחר כשהקטלוג בלי השלב");
assert(info.kicker !== "שלב 1 · הצגה עצמית", "מסך קיימים לא נופל להצגה עצמית");

console.log("\n" + (failed ? "FAILED " + failed : "OK " + passed + " checks"));
process.exit(failed ? 1 : 0);
