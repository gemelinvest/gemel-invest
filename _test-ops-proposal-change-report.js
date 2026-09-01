/* GI-OPS 2026-08-27 — דוח תיקוני הצעה:
   כל שינוי בכל מסך בשיחת השיקוף מופיע בדוח.
   בלי נגיעה בלוגיקת persist/flow של המסכים.
   הרצה: node _test-ops-proposal-change-report.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260901-restore-11am-v1";
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
const sw = read("service-worker.js");
const mock = read("_verify-mirror-typing.html");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-ops-proposal-change-report.js")]).status === 0, "node --check this test");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + APP_TAG), "index.html app.css cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");

console.log("\n2) שם הדוח בכל המשטחים");
assert((app.match(/דוח תיקוני הצעה/g) || []).length >= 4, "app.js מציג דוח תיקוני הצעה");
assert(app.includes("mtqPageHead__title\">דוח תיקוני הצעה"), "כותרת מסך הסיכום");
assert(app.includes("כל שינוי שבוצע בכל מסך בשיחת השיקוף"), "תת־כותרת מכסה כל מסך");
assert(app.includes("<h2 class=\"mtqPanel__title\">דוח תיקוני הצעה</h2>"), "תיק הקלדה מציג את אותו שם");
assert(mock.includes("דוח תיקוני הצעה"), "מוקאפ האימות עודכן");
assert(!app.includes("סיכום תיקונים בשיחת השיקוף"), "הוסרה הכותרת הישנה ממסך הסיכום");
assert(!app.includes("סיכום שינויי שיקוף"), "הוסרה הכותרת הישנה מתיק ההקלדה");

console.log("\n3) אין נגיעה בלוגיקת persist/flow של המסכים");
const reportStart = app.indexOf("const MirrorChangeReport = {");
const reportEnd = app.indexOf("function releaseGlobalUiLocks()", reportStart);
const reportSrc = reportStart >= 0 && reportEnd > reportStart ? app.slice(reportStart, reportEnd) : "";
assert(!!reportSrc, "MirrorChangeReport נמצא");
assert(!reportSrc.includes("App.persist"), "הדוח לא קורא ל-persist");
assert(!reportSrc.includes("_mirrorPersistPersonalVerification"), "הדוח לא כותב פרטים אישיים");
assert(!reportSrc.includes("_persistCancelQuestionnaire"), "הדוח לא כותב שאלון ביטול");
assert(!reportSrc.includes("_persistBeneficiariesStep"), "הדוח לא כותב מוטבים");
assert(!reportSrc.includes("_onMcPayAction"), "הדוח לא מחליף אמצעי תשלום");
assert(app.includes("_mirrorPersistPersonalVerification(rec, collectedById, store){"), "persist אימות אישי נשאר");
assert(app.includes("async _persistCancelQuestionnaire(rec, label){"), "persist שאלון ביטול נשאר");
assert(app.includes("async _persistBeneficiariesStep(rec){"), "persist מוטבים נשאר");
assert(app.includes("_onMcPayAction(el){"), "החלפת אמצעי תשלום נשארה");
assert(app.includes("try{ MirrorChangeReport.captureBaseline(rec, { force: true }); }catch(_e){}"), "לכידת בסיס בתחילת השיחה נשארה");

console.log("\n4) כיסוי כל מסכי השיקוף בצילום וב־collect");
assert(reportSrc.includes("_deliverySnapshot"), "צילום אופן קבלת דיוורים");
assert(reportSrc.includes("_beneficiariesSnapshot"), "צילום מוטבים/שעבוד");
assert(reportSrc.includes("_cancelSnapshot"), "צילום שאלון ביטול");
assert(reportSrc.includes('["method", "אמצעי תשלום"]'), "אמצעי תשלום CC/HO נכנס לדוח");
assert(reportSrc.includes('key: "delivery"'), "אזור דיוורים בדוח");
assert(reportSrc.includes('key: "cancel"'), "אזור ביטול בדוח");
assert(reportSrc.includes('key: "beneficiaries"'), "אזור מוטבים בדוח");
assert(reportSrc.includes('key: "health"'), "אזור הצהרת בריאות נשאר");
assert(reportSrc.includes('key: "personal"'), "אזור פרטים אישיים נשאר");
assert(reportSrc.includes('key: "payment"'), "אזור תשלום נשאר");
assert(reportSrc.includes("Object.keys(before.personal") && reportSrc.includes("Object.keys(after.personal"), "השוואת מבוטחים לפי איחוד מפתחות");
assert(app.includes("mtqPktBenef"), "תיק הקלדה מציג מוטבים");
assert(app.includes("mtqPktCancel"), "תיק הקלדה מציג שאלון ביטול");

console.log("\n5) התנהגות — צילום, השוואה, בלי מוטציה");
function safeTrim(v){
  return v == null ? "" : String(v).trim();
}

const sandbox = {
  console,
  safeTrim,
  nowISO(){ return "2026-08-27T12:00:00.000Z"; },
  Auth: { current: { name: "נציג בדיקה" } },
  CustomersUI: undefined,
  MirrorFlowReadModel: undefined,
  Wizard: undefined
};
vm.createContext(sandbox);
vm.runInContext(reportSrc + "\nthis.MirrorChangeReport = MirrorChangeReport;", sandbox);
const R = sandbox.MirrorChangeReport;
assert(!!R && typeof R.buildSnapshot === "function", "MirrorChangeReport נטען ל-vm");

function baseRec(){
  return {
    phone: "0501112233",
    email: "old@mail.co.il",
    city: "תל אביב",
    payload: {
      primary: {
        firstName: "ישראל",
        lastName: "ישראלי",
        phone: "0501112233",
        email: "old@mail.co.il",
        street: "הרצל",
        houseNumber: "12",
        city: "תל אביב",
        zip: "61000",
        paymentMethod: "cc",
        payerChoice: "insured",
        cc: { holderName: "ישראל ישראלי", holderId: "012345678", cardNumber: "4580123412344412", exp: "08/27" },
        ho: { bankName: "לאומי", bankNo: "10", branch: "123", account: "456789" },
        externalPayer: { firstName: "", lastName: "", idNumber: "", birthDate: "", phone: "", relation: "" }
      },
      insureds: [{
        id: "ins-1",
        type: "primary",
        data: {
          firstName: "ישראל",
          lastName: "ישראלי",
          idNumber: "012345678",
          birthDate: "1988-03-15",
          maritalStatus: "נשוי",
          childrenCount: "2",
          occupation: "מהנדס",
          clinic: "כללית",
          shaban: "זהב",
          street: "הרצל",
          houseNumber: "12",
          city: "תל אביב",
          zip: "61000",
          smokingStatus: "no",
          existingPolicies: [{ id: "ex-1", company: "הפניקס", type: "בריאות" }],
          cancellations: { "ex-1": { status: "full", executionMethod: "agent" } }
        }
      }],
      newPolicies: [{
        id: "np-risk",
        type: "ריסק",
        company: "מגדל",
        beneficiariesMode: "named",
        beneficiaries: [{ firstName: "רות", lastName: "ישראלי", idNumber: "111222333", relationship: "בת זוג", sharePct: "100" }],
        pledgeBanks: []
      }],
      mirrorFlow: {
        verify: { deliveryMethod: "home", deliveryEmail: "old@mail.co.il", perInsuredSmoking: {} },
        paymentStep: { method: "cc" },
        beneficiariesStep: { policies: { "np-risk": { legalHeirs: false } } },
        cancelQuestionnaire: {
          policies: { "ex-1": { confirmed: "yes", executionMethod: "agent" } },
          keepExistingDespiteDuplicate: false,
          approveAddition: ""
        }
      }
    }
  };
}

const rec = baseRec();
const frozenBenef = JSON.stringify(rec.payload.newPolicies);
const frozenCancel = JSON.stringify(rec.payload.mirrorFlow.cancelQuestionnaire);
const frozenPay = JSON.stringify(rec.payload.mirrorFlow.paymentStep);
const frozenVerify = JSON.stringify(rec.payload.mirrorFlow.verify);
const snap0 = R.buildSnapshot(rec);
assert(JSON.stringify(rec.payload.newPolicies) === frozenBenef, "צילום לא משנה מוטבים בתיק");
assert(JSON.stringify(rec.payload.mirrorFlow.cancelQuestionnaire) === frozenCancel, "צילום לא משנה שאלון ביטול");
assert(JSON.stringify(rec.payload.mirrorFlow.paymentStep) === frozenPay, "צילום לא משנה paymentStep");
assert(JSON.stringify(rec.payload.mirrorFlow.verify) === frozenVerify, "צילום לא משנה verify");

assert(snap0.payment.method === "כרטיס אשראי", "אמצעי תשלום בעברית — כרטיס");
assert(snap0.payment.payerChoice === "מבוטח קיים", "זהות משלם בעברית");
assert(snap0.delivery.method === "לבית", "דיוורים — לבית");
assert(snap0.beneficiaries["np-risk"].beneficiaries.includes("רות ישראלי"), "מוטבת בצילום");
assert(snap0.beneficiaries["np-risk"].legalHeirs === "לא", "יורשים חוקיים כבוי בצילום");
assert(snap0.cancel.policies["ex-1"].confirmed === "כן", "אישור ביטול בצילום");
assert(snap0.cancel.policies["ex-1"].executionMethod === "באמצעות הנציג המטפל", "אופן ביצוע ביטול בעברית");
assert(snap0.personal["ins-1"].fullName === "ישראל ישראלי", "שם מלא בצילום אישי");
assert(snap0.personal["ins-1"].smoking === "לא", "עישון לא");

R.captureBaseline(rec, { force: true });
assert(!!rec.payload.mirrorFlow.baseline?.data, "בסיס נלכד");
const firstBaseline = JSON.stringify(rec.payload.mirrorFlow.baseline.data);
R.captureBaseline(rec);
assert(JSON.stringify(rec.payload.mirrorFlow.baseline.data) === firstBaseline, "לכידה חוזרת לא דורסת בלי force");

rec.payload.insureds[0].data.street = "ויצמן";
rec.payload.insureds[0].data.houseNumber = "45";
rec.payload.insureds[0].data.city = "רמת גן";
rec.payload.primary.street = "ויצמן";
rec.payload.primary.houseNumber = "45";
rec.payload.primary.city = "רמת גן";
rec.payload.mirrorFlow.verify.deliveryMethod = "email";
rec.payload.mirrorFlow.verify.deliveryEmail = "new@mail.co.il";
rec.email = "new@mail.co.il";
rec.payload.primary.email = "new@mail.co.il";
rec.payload.mirrorFlow.paymentStep.method = "ho";
rec.payload.primary.paymentMethod = "ho";
rec.payload.newPolicies[0].beneficiaries = [
  { firstName: "דן", lastName: "ישראלי", idNumber: "999888777", relationship: "בן", sharePct: "100" }
];
rec.payload.mirrorFlow.cancelQuestionnaire.policies["ex-1"].executionMethod = "client";
rec.payload.mirrorFlow.cancelQuestionnaire.keepExistingDespiteDuplicate = true;
rec.payload.mirrorFlow.cancelQuestionnaire.approveAddition = "yes";
rec.payload.insureds[0].data.smokingStatus = "yes";
rec.payload.insureds[0].data.smokingType = "סיגריות";
rec.payload.insureds[0].data.smokingAmount = "10";
rec.payload.mirrorFlow.verify.perInsuredSmoking = {
  "ins-1": { answer: "yes", products: ["סיגריות", "נרגילה"], quantity: "10" }
};

const report = R.collect(rec);
const byArea = {};
report.areas.forEach((a) => { byArea[a.key] = a; });
const labelsOf = (key) => (byArea[key]?.rows || []).map((r) => r.label + "|" + r.before + "→" + r.after);

assert(report.changedFields >= 8, "נמצאו שינויים במספר אזורים (got " + report.changedFields + ")");
assert((byArea.personal?.rows || []).some((r) => r.label.includes("כתובת") && r.after.includes("ויצמן")), "שינוי כתובת בפרטים אישיים");
assert((byArea.personal?.rows || []).some((r) => r.label.includes("עישון") && r.after.includes("נרגילה")), "שינוי עישון כולל כל המוצרים");
assert((byArea.personal?.rows || []).some((r) => r.label === "דוא״ל" && r.after === "new@mail.co.il"), "שינוי אימייל יצירת קשר");
assert((byArea.delivery?.rows || []).some((r) => r.label === "אופן קבלת דיוורים" && r.before === "לבית" && r.after === "למייל"), "שינוי אופן דיוורים");
assert((byArea.delivery?.rows || []).some((r) => r.label.includes("אימייל למשלוח")), "שינוי אימייל דיוורים");
assert((byArea.payment?.rows || []).some((r) => r.label === "אמצעי תשלום" && r.before === "כרטיס אשראי" && r.after === "הוראת קבע"), "החלפת CC→HO בדוח");
assert((byArea.beneficiaries?.rows || []).some((r) => r.label.includes("מוטבים") && r.after.includes("דן ישראלי")), "שינוי מוטב בדוח");
assert((byArea.cancel?.rows || []).some((r) => r.label.includes("אופן ביצוע ביטול") && r.after.includes("הלקוח עצמו")), "שינוי אופן ביטול בדוח");
assert((byArea.cancel?.rows || []).some((r) => r.label === "השארת כיסוי קיים" && r.after === "כן"), "השארת כיסוי קיים בדוח");
assert((byArea.cancel?.rows || []).some((r) => r.label === "אישור תוספת לכיסוי קיים" && r.after === "כן"), "אישור תוספת בדוח");

const noChangeRec = baseRec();
R.captureBaseline(noChangeRec, { force: true });
const emptyReport = R.collect(noChangeRec);
assert(emptyReport.changedFields === 0, "בלי שינוי — דוח ריק (got " + emptyReport.changedFields + ")");
assert(emptyReport.areas.length === 6, "שישה אזורי דוח קבועים");

const removed = baseRec();
R.captureBaseline(removed, { force: true });
removed.payload.insureds.push({
  id: "ins-2",
  type: "spouse",
  data: { firstName: "רות", lastName: "ישראלי", idNumber: "111222333", maritalStatus: "נשוי" }
});
const addedIns = R.collect(removed);
assert((addedIns.areas.find((a) => a.key === "personal")?.rows || []).some((r) => r.label.includes("בן/בת זוג") && r.label.includes("שם מלא")), "מבוטח שנוסף נכנס לדוח");

console.log("\n6) שמירת דוח מאושר לתיק הקלדה");
const saved = R.saveApproved(rec, { approvedAt: "2026-08-27T13:00:00.000Z", approvedBy: "נציג בדיקה" });
assert(saved.changedFields === report.changedFields, "saveApproved שומר את מספר השדות");
assert(saved.areas.some((a) => a.key === "beneficiaries" && a.rows.length), "דוח מאושר כולל מוטבים");
assert(saved.areas.some((a) => a.key === "cancel" && a.rows.length), "דוח מאושר כולל ביטול");
const frozen = R.getReport(rec);
assert(frozen.approved === true, "getReport מחזיר דוח קפוא אחרי אישור");
assert(frozen.changedFields === saved.changedFields, "תיק הקלדה רואה את אותו דוח");

if(failed){
  console.error("\nFAILED " + failed + " / passed " + passed);
  process.exit(1);
}
console.log("\nOK  " + passed + " assertions");
