/* GI-OPS 2026-08-27 — ממתינים לשיקוף רק מהגש לתפעול; וידג'טי מנהל מוסתרים מנציג.
   הרצה: node _test-ops-submit-waiting-mirror.js
   לא משנים לוגיקת אשף / שיוך / מסך שיקוף — רק שער התור והצגת דשבורד.
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260827-clal-prod-v1";
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
const wizard = read("gi-wizard.js");
const sw = read("service-worker.js");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-ops-submit-waiting-mirror.js")]).status === 0, "node --check this test");
assert(html.includes("app.js?v=" + APP_TAG), "index.html bumps app.js cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache bumped");

const queueBlock = sliceBetween(app, "/* GI-OPS-SUBMIT-MIRROR-START */", "/* GI-OPS-SUBMIT-MIRROR-END */");
assert(!!queueBlock, "GI-OPS-SUBMIT-MIRROR block found");

console.log("\n2) שער תור ממתינים לשיקוף — רק הגש לתפעול");
assert(queueBlock.includes("function hasSubmittedHealthRisksToOps"), "hasSubmittedHealthRisksToOps נשאר");
assert(queueBlock.includes("submittedToOpsAt"), "סימון הגשה לתפעול נשאר");
assert(queueBlock.includes("if(!hasSubmittedHealthRisksToOps(rec)) return false;"), "התור דורש הגשה לתפעול");
assert(!queueBlock.includes("isAmongLastCreatedCustomers"), "הוסר שער 5 הלקוחות האחרונים");
assert(!queueBlock.includes("OPS_WAITING_MIRROR_LAST_CREATED_LIMIT"), "הוסר לימיט 5 לקוחות אחרונים");
assert(!queueBlock.includes("listCustomersByCreatedAtDesc"), "הוסרה מיון לפי createdAt לתור");
assert(app.includes('if(isWaitingMirrorQueueCustomer(rec)) return "waiting_mirror";'), "classifyBucket עדיין נשען על אותו שער");

console.log("\n3) נציג תפעול — בלי מעקב נציגים ובלי פילוח סטטוס");
const dashStart = app.indexOf("const OpsDashboardUI = {");
const dashEnd = app.indexOf("const TypingPacketUI = {");
const dashBlock = dashStart > 0 && dashEnd > dashStart ? app.slice(dashStart, dashEnd) : app;
assert(dashBlock.includes('const agentsHtml = (!listBucket && isManager)'), "וידג'טי אמצע רק למנהל תפעול");
assert(dashBlock.includes("מעקב נציגים בשיחה"), "מעקב נציגים נשאר למנהל");
assert(dashBlock.includes("פילוח סטטוס"), "פילוח סטטוס נשאר למנהל");
assert(dashBlock.includes('kpiCard("waiting_mirror", "ממתינים לשיקוף")'), "כרטיס ממתינים לשיקוף נשאר לשני התפקידים");
assert(dashBlock.includes('kpiCard("waiting_typing", "ממתין להקלדה")'), "כרטיס ממתינים להקלדה לא נגע");
assert(dashBlock.includes('kpiCard("pending_signatures", "ממתין לחתימות")'), "כרטיס חתימות לא נגע");
assert(dashBlock.includes('kpiCard("issuance", "עבר להפקה")'), "כרטיס הפקה לא נגע");

console.log("\n4) רגרסיה — שיוך, פרמיה, נציג מכירות, לחצן שיקוף");
assert(dashBlock.includes("data-ops-dash-assign"), "מנהל עדיין משייך מהתור");
assert(dashBlock.includes("data-ops-dash-mirror"), "נציג עדיין פותח שיקוף מהתור");
assert(dashBlock.includes("פתיחת מסך שיקוף"), "תווית לחצן שיקוף לנציג לא שונתה");
assert(dashBlock.includes("שיוך לנציג"), "תווית שיוך למנהל לא שונתה");
assert(dashBlock.includes("row.salesAgentName"), "שם נציג המכירות עדיין בשורת התור");
assert(dashBlock.includes("this.formatMoney(row.premium)"), "פרמיה עדיין בשורת התור");
assert(dashBlock.includes('UI.goView("mirrorCall")'), "לחצן שיקוף עדיין פותח את מסך השיקוף");
assert(dashBlock.includes("MirrorCallUI.pickCustomer(cid)"), "בחירת לקוח במסך השיקוף לא נגעה");
assert(dashBlock.includes("currentUserMatchesMirrorAssign(getMirrorAssign(rec))"), "נציג רואה רק מה ששויך אליו");
assert(app.includes("const MirrorAssignmentsUI"), "מסך שיוכי שיקוף לא הוסר");
assert(html.includes('id="view-mirrorAssignments"'), "HTML של שיוכי שיקוף לא נגע");
assert(html.includes('id="view-mirrorCall"'), "HTML של מסך השיקוף לא נגע");
assert(html.includes('id="lcSendToOps"'), "לחצן הגש לתפעול במסך הסיום לא נגע");
assert(wizard.includes("async submitHealthRisksToOpsFromFinish()"), "נתיב הגש לתפעול באשף לא נגע");
assert(wizard.includes("submitHealthRisksProposalToOps(rec)"), "האשף עדיין קורא לאותה פונקציית הגשה");

console.log("\n5) תקינות התנהגותית — שער התור");
const healthFnStart = app.indexOf("function isHealthRisksWizardCompleted(rec){");
const mirrorEnd = app.indexOf("/* GI-OPS-SUBMIT-MIRROR-END */");
assert(healthFnStart > 0 && mirrorEnd > healthFnStart, "ניתן לחלץ את פונקציות התור");
const extracted = app.slice(healthFnStart, mirrorEnd);
const sandbox = {};
const code = `
  function safeTrim(v){ return String(v == null ? "" : v).trim(); }
  function nowISO(){ return "2026-08-27T10:00:00.000Z"; }
  const Auth = { current: { name: "בודק" } };
  function ensureOpsProcess(rec){
    if(!rec || typeof rec !== "object") return {};
    if(!rec.payload || typeof rec.payload !== "object") rec.payload = {};
    if(!rec.payload.opsProcess || typeof rec.payload.opsProcess !== "object") rec.payload.opsProcess = {};
    return rec.payload.opsProcess;
  }
  function setOpsTouch(rec, patch){
    const store = ensureOpsProcess(rec);
    Object.assign(store, patch || {});
    return store;
  }
  function getOpsStatePresentation(rec){
    const ops = rec && rec.payload && rec.payload.opsProcess ? rec.payload.opsProcess : {};
    return { resultKey: safeTrim(ops.resultStatus), liveKey: safeTrim(ops.liveState) };
  }
  ${extracted}
  this.hasSubmittedHealthRisksToOps = hasSubmittedHealthRisksToOps;
  this.isWaitingMirrorQueueCustomer = isWaitingMirrorQueueCustomer;
  this.submitHealthRisksProposalToOps = submitHealthRisksProposalToOps;
  this.isHealthRisksWizardCompleted = isHealthRisksWizardCompleted;
`;
vm.runInNewContext(code, sandbox);

function makeRec(extra){
  return Object.assign({
    id: "c1",
    fullName: "ישראל ישראלי",
    agentName: "נציג מכירות",
    createdAt: "2026-08-27T09:00:00.000Z",
    newPoliciesCount: 1,
    payload: {
      newPolicies: [{ company: "כלל", premium: 120 }],
      opsProcess: {},
      mirrorFlow: {}
    }
  }, extra || {});
}

const createdOnly = makeRec();
assert(sandbox.isHealthRisksWizardCompleted(createdOnly) === true, "לקוח שהוקם באשף נחשב הושלם");
assert(sandbox.hasSubmittedHealthRisksToOps(createdOnly) === false, "בלי לחיצה אין סימון הגשה");
assert(sandbox.isWaitingMirrorQueueCustomer(createdOnly) === false, "לקוח שהוקם בלי הגשה לא נכנס לתור");

const submitted = makeRec();
const submitRes = sandbox.submitHealthRisksProposalToOps(submitted);
assert(submitRes && submitRes.ok === true, "הגש לתפעול מצליח על הצעת בריאות וסיכונים");
assert(sandbox.hasSubmittedHealthRisksToOps(submitted) === true, "אחרי הגשה יש submittedToOpsAt");
assert(sandbox.isWaitingMirrorQueueCustomer(submitted) === true, "אחרי הגש לתפעול ההצעה נכנסת לממתינים לשיקוף");

const already = sandbox.submitHealthRisksProposalToOps(submitted);
assert(already && already.ok === true && already.alreadySubmitted === true, "הגשה חוזרת מסומנת alreadySubmitted ולא נשברת");
assert(sandbox.isWaitingMirrorQueueCustomer(submitted) === true, "הגשה חוזרת משאירה את ההצעה בתור");

const inCall = makeRec({
  payload: {
    newPolicies: [{ company: "כלל", premium: 120 }],
    opsProcess: { submittedToOpsAt: "2026-08-27T10:00:00.000Z", queueSource: "health_risks_wizard" },
    mirrorFlow: { callSession: { active: true, startedAt: "2026-08-27T10:05:00.000Z" } }
  }
});
assert(sandbox.isWaitingMirrorQueueCustomer(inCall) === false, "הצעה בשיחה חיה לא נשארת בממתינים");

const finished = makeRec({
  payload: {
    newPolicies: [{ company: "כלל", premium: 120 }],
    opsProcess: {
      submittedToOpsAt: "2026-08-27T10:00:00.000Z",
      resultStatus: "pendingTyping",
      liveState: "call_finished"
    },
    mirrorFlow: {}
  }
});
assert(sandbox.isWaitingMirrorQueueCustomer(finished) === false, "אחרי תוצאת שיקוף ההצעה יוצאת מהתור");

const elementary = makeRec({
  payload: {
    flowType: "elementary",
    newPolicies: [{ company: "הראל", premium: 90 }],
    opsProcess: { submittedToOpsAt: "2026-08-27T10:00:00.000Z" }
  }
});
assert(sandbox.isHealthRisksWizardCompleted(elementary) === false, "אלמנטרי לא נחשב בריאות וסיכונים");
assert(sandbox.isWaitingMirrorQueueCustomer(elementary) === false, "אלמנטרי לא נכנס לתור השיקוף הזה");
assert(sandbox.submitHealthRisksProposalToOps(elementary).ok === false, "הגש לתפעול נחסם לאלמנטרי");

console.log("\n6) רגרסיה — פיצ'רים ומסכים שלא נגעו");
assert(html.includes('id="lcSubmitToUnderwriting"'), "לחצן הגש לחיתום אלמנטרי לא הוסר");
assert(html.includes('id="lcWizardSubmitUnderwriting"'), "לחצן חיתום באשף אלמנטרי לא הוסר");
assert(wizard.includes("async submitElementaryUnderwritingReferral()"), "נתיב חיתום אלמנטרי לא נגע");
assert(dashBlock.includes("collectWaitingTypingRows"), "תור הקלדה לא הוסר");
assert(dashBlock.includes("renderTypingQueuePanel"), "מסך ממתינים להקלדה לא נגע");
assert(app.includes("function getMirrorAssign(rec)"), "שיוך שיקוף לא נגע");
assert(app.includes("function setMirrorAssign(rec, agent, byName)"), "שמירת שיוך לא נגעה");
assert(app.includes("function currentUserMatchesMirrorAssign(assign)"), "התאמת שיוך לנציג לא נגעה");
assert(html.includes('id="mcFlowBar"'), "צ׳ק־ליסט שיקוף לא הוסר");
assert(!app.includes("OPS_WAITING_MIRROR_LAST_CREATED_LIMIT"), "לימיט הישן לא נשאר במערכת");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
