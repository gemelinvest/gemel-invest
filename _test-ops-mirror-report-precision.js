/* דיוק דוח התיקונים, דיוורים, משפט מגדל, תורים וכיתוב סיום השיקוף.
   הרצה: node _test-ops-mirror-report-precision.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "app.css"), "utf8");
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

function extractMethod(src, name){
  const token = name + "(";
  const at = src.indexOf("\n    " + token);
  const asyncAt = src.indexOf("\n    async " + token);
  const start = at >= 0 ? at + 1 : (asyncAt >= 0 ? asyncAt + 1 : -1);
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

const MIGDAL = "ההמלצה מבוססת על גיל, מצבך המשפחתי, הכיסויים הקיימים שלך וצרכים שציינת. בהמשך אשלח לך מסמך השוואה כתוב המשווה בין הפוליסות שקיימות לך כיום לעומת הפוליסות החדשות שאנו מציעים לך לרכוש אותם תידרש לאשר לי בחתימתך.";
const PILL = "שיחת שיקוף הסתיימה המסמכים נדבקים ונשלחים לחתימות";
const reasons = sliceBetween(app, "_renderNeedsReasons(rec){", "_renderNeedsCompareNotice(rec){");
const offer = sliceBetween(app, "_renderNeedsOffer(rec){", "_renderNeedsReasons(rec){");
const verify = sliceBetween(app, "_renderPersonalVerifyBody(rec){", "async onVerifyPersonalContinue(){");
const cont = sliceBetween(app, "async onVerifyPersonalContinue(){", "onConsentYes(){");
const finish = extractMethod(app, "_completeMirrorSummaryTransfer");
const screen = extractMethod(app, "_mcOpenScreenName");

console.log("\n2) משפט מגדל בשיקולי המלצה");
assert(reasons.includes(MIGDAL), "המשפט המאושר נמצא בשיקולי המלצה");
assert(!reasons.includes("(מגדל)"), "בלי המילה (מגדל)");
assert(reasons.includes("_mcHasMigdalProduct(rec)"), "המשפט מותנה במוצר מגדל");
assert(offer.includes("(מגדל)"), "משפט ההצעה הקיים נשאר במקומו");
assert(extractMethod(app, "_mcHasMigdalProduct").includes("existingPolicies"), "גם פוליסה קיימת של מגדל נספרת");

console.log("\n3) שאלת דיוורים");
assert(verify.includes("איך תהיה מעונין/נת לקבל את הדיוורים ?"), "השאלה המוקראת");
assert(verify.includes('store.deliveryAsked === true ? safeTrim(store.deliveryMethod) : ""'), "הכפתורים נפתחים בלי סימון");
assert(verify.includes('data-mc-personal-delivery="home"') && verify.includes('data-mc-personal-delivery="email"'), "לבית ולמייל נשארו");
assert(cont.indexOf("_mcShowDeliveryAskGate") < cont.indexOf('_mirrorUiPhase = "step2"'), "בלי בחירה אין מעבר שלב");
assert(app.includes("יש לשאול את הלקוח איך ירצה לקבל דיוורים"), "הודעה ממורכזת");
assert(app.includes('data-mc-delivery-ask-ok>אישור'), "כפתור אישור בהודעה");
assert(css.includes(".mcAskGate{") && css.includes("align-items:center") && css.includes("justify-content:center"), "ההודעה ממורכזת במסך");
assert(app.includes("verifyStore.deliveryAsked = false"), "כניסה לשלב מאפסת סימון קודם");
assert(app.includes("store.deliveryAsked = true"), "סימון נרשם רק בלחיצה");

console.log("\n4) דוח תיקונים — כפתורים ותורים");
assert(app.includes("אישור העברה להפקה"), "כפתור הפקה");
assert(app.includes("העברה לממתין לחתימות"), "כפתור ממתין לחתימות");
assert(app.includes("התיק מוכן להעברה להפקה"), "סימון מוכנות להפקה");
assert(!app.includes("לאחר האישור הלקוח יועבר לסטטוס"), "הערת הסטטוס הוסרה");
assert(!app.includes("אשר והעבר לשליחה לחתימות"), "הכפתור הישן הוסר");
assert(app.includes('data-mc-summary-act="production"${issueDisabled}'), "הפקה חסומה עד שהחתימות ירוקות");
assert(finish.indexOf("this.stopCall()") < finish.indexOf('resultStatus: "pendingSignatures"'), "עצירת השיחה לפני כניסה לתור החתימות");
assert(finish.includes("mirrorFlow.issuance") && finish.includes("savedAt: approvedAt"), "הפקה נכנסת לתור הקיים");
assert(finish.includes('_listBucket = production ? "issuance" : "pending_signatures"'), "הדשבורד נפתח על התור המתאים");
assert(screen.includes(PILL), "פס הטיימר בתיק מציג את סיום השיקוף");

console.log("\n5) runtime");
const sandbox = {
  safeTrim(v){ return String(v == null ? "" : v).trim(); },
  escapeHtml(v){ return String(v == null ? "" : v); },
  MirrorFlowReadModel: {
    getMainConsideration(){ return { key: "new_cover", label: "כיסוי חדש" }; },
    getCancellationRecommendationItems(){ return []; }
  },
  api: {
    els: { step2Body: { innerHTML: "" } },
    _mcNeedsNav(){ return "<nav></nav>"; }
  }
};
vm.createContext(sandbox);
const helpers = ["_mcCompanyIsMigdal", "_mcPolicyIsMigdal", "_mcHasMigdalProduct", "_mcSignaturesFullyGreen"].map((name) => extractMethod(app, name)).join(",\n");
vm.runInContext("Object.assign(this.api, {\n" + helpers + ",\n_renderNeedsReasons: function " + reasons + "\n});", sandbox);

function migdalRec(existingCompany, newCompany){
  return {
    existingCompany,
    newCompany,
    payload: { insureds: [{ data: { existingPolicies: existingCompany ? [{ company: existingCompany }] : [] } }] }
  };
}
sandbox.api._mirrorGetNewPoliciesRaw = function(rec){
  return rec.newCompany ? [{ company: rec.newCompany }] : [];
};
sandbox.api._collectMirrorPolicies = function(){ return []; };
sandbox.api._mirrorGetInsureds = function(rec){
  return rec.payload.insureds;
};

assert(sandbox.api._mcHasMigdalProduct(migdalRec("מגדל", "")) === true, "מגדל קיים מספיק");
assert(sandbox.api._mcHasMigdalProduct(migdalRec("", "migdal")) === true, "מגדל חדש מספיק");
assert(sandbox.api._mcHasMigdalProduct(migdalRec("הפניקס", "מנורה")) === false, "בלי מגדל אין משפט");
sandbox.api._renderNeedsReasons({ migdal: false, newCompany: "", existingCompany: "הפניקס", payload: { insureds: [{ data: { existingPolicies: [{ company: "הפניקס" }] } }] } });
assert(!sandbox.api.els.step2Body.innerHTML.includes(MIGDAL), "בלי מגדל המשפט לא מצויר");
assert(sandbox.api.els.step2Body.innerHTML.includes("השיקולים העיקריים במתן ההמלצה הינם הם:"), "נוסח השיקולים נשאר");
sandbox.api._renderNeedsReasons(migdalRec("מגדל", ""));
assert(sandbox.api.els.step2Body.innerHTML.includes(MIGDAL), "עם מגדל קיים המשפט מצויר");
assert(!sandbox.api.els.step2Body.innerHTML.includes("(מגדל)"), "הציור בלי (מגדל)");

assert(sandbox.api._mcSignaturesFullyGreen({ payload: {} }) === false, "בלי חתימות לא ירוק");
assert(sandbox.api._mcSignaturesFullyGreen({ payload: { giSignByDoc: { a: { links: [{ status: "signed" }] }, b: { links: [{ status: "sent" }] } } } }) === false, "מסמך אחד לא חתום חוסם הפקה");
assert(sandbox.api._mcSignaturesFullyGreen({ payload: { giSignByDoc: { a: { links: [{ status: "signed" }, { status: "signed" }] } } } }) === true, "כל החותמים על כל המסמכים פותחים הפקה");

const bucketSrc = extractMethod(app, "classifyBucket");
const bucketBox = {
  safeTrim(v){ return String(v == null ? "" : v).trim(); },
  getOpsStatePresentation(rec){
    const ops = rec?.payload?.opsProcess || {};
    return { resultKey: ops.resultStatus || "", liveKey: ops.liveState || "" };
  },
  isWaitingMirrorQueueCustomer(){ return false; },
  api: { getCallStore(){ return {}; } }
};
vm.createContext(bucketBox);
vm.runInContext("api.classifyBucket = function " + bucketSrc, bucketBox);
function bucketOf(ops, flow){
  return bucketBox.api.classifyBucket({ payload: { opsProcess: ops, mirrorFlow: flow || {} } });
}
assert(bucketOf({ resultStatus: "pendingSignatures", liveState: "" }) === "pending_signatures", "העברה לממתין לחתימות נכנסת ללקוחות ממתינים לחתימות");
assert(bucketOf({ resultStatus: "", liveState: "issuance" }, { issuance: { savedAt: "2026-10-08T10:00:00.000Z" } }) === "issuance", "אישור הפקה נכנס לתור ההפקה");
assert(bucketOf({ resultStatus: "pendingSignatures", liveState: "" }, { issuance: { savedAt: "2026-10-08T10:00:00.000Z" } }) === "pending_signatures", "לפני סיום החתימות הלקוח נשאר בממתינים לחתימות");

if(failed){
  console.error("\nFAILED " + failed + " / passed " + passed);
  process.exit(1);
}
console.log("\nOK  " + passed + " assertions");
