/* GI-OPS — קוביות דשבורד תפעול ורובריקות תצוגה.
   הרצה: node _test-ops-dashboard-rubrics.js
   לא משנים את שמירת החוצץ, את שער ההגשה, או את שיוך השיקוף.
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
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

const app = read("app.js");
const html = read("index.html");
const css = read("app.css");
const sw = read("service-worker.js");
const dashStart = app.indexOf("const OpsDashboardUI = {");
const dashEnd = app.indexOf("const TypingPacketUI = {");
const dashBlock = dashStart > 0 && dashEnd > dashStart ? app.slice(dashStart, dashEnd) : "";
const filterStart = dashBlock.indexOf("filterWaitingMirrorRowsByLane(rows){");
const filterEnd = dashBlock.indexOf("collectWaitingTypingRows(){");
const filterBlock = filterStart >= 0 && filterEnd > filterStart ? dashBlock.slice(filterStart, filterEnd) : "";
const stageStart = dashBlock.indexOf("renderIssuanceStages(){");
const stageEnd = dashBlock.indexOf("renderIssuancePanel(rows){");
const stageBlock = stageStart >= 0 && stageEnd > stageStart ? dashBlock.slice(stageStart, stageEnd) : "";
const rubricStart = app.indexOf("/* GI-OPS-DASH-RUBRIC-START */");
const rubricEnd = app.indexOf("/* GI-OPS-DASH-RUBRIC-END */");
const rubricSrc = rubricStart >= 0 && rubricEnd > rubricStart
  ? app.slice(rubricStart + "/* GI-OPS-DASH-RUBRIC-START */".length, rubricEnd)
  : "";

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-ops-dashboard-rubrics.js")]).status === 0, "node --check this test");
assert(html.includes("app.js?v=20261007-mirror-reasons-v1&giSign=29&giRecent=1&giPriorDecl=1&giDash=1"), "app.js נטען עם giDash בלי להחליף את התג הקיים");
assert(html.includes("app.css?v=20261007-mirror-reasons-v1&giDocs=1&giBack=1&giKpiCo=1&giPriorDecl=1&giDash=1"), "app.css נטען עם giDash בלי להחליף את התג הקיים");
assert(sw.includes("20261007-mirror-reasons-v1"), "גרסת ה-service worker לא הוחלפה");

console.log("\n2) קוביות, מסך נציגים ובחירת סטטוס");
assert(!!dashBlock, "OpsDashboardUI נמצא");
assert(dashBlock.includes('kpiCard("waiting_mirror", "שיקופים", "money")'), "קוביית שיקופים עם פרמיה");
assert(dashBlock.includes('kpiCard("pending_signatures", "חתימות", "count")'), "קוביית חתימות עם מספר ממתינים");
assert(dashBlock.includes('kpiCard("issuance", "הפקה", "money")'), "קוביית הפקה עם כסף");
assert(dashBlock.includes("opsDash__kpis opsDash__kpis--3"), "שלוש קוביות");
assert(!dashBlock.includes("פילוח סטטוס"), "פילוח הסטטוס הוסר מהדשבורד");
assert(!dashBlock.includes("const agentsHtml = isManager"), "מצבת הנציגים לא על הדשבורד");
assert(dashBlock.includes('data-ops-dash-go="opsAgentFloor"'), "לחצן פעילות נציגים למנהל");
assert(dashBlock.includes("renderAgentFloor(){"), "מסך נפרד לנציגים המחוברים");
assert(html.includes('id="view-opsAgentFloor"'), "מסך פעילות הנציגים קיים בנפרד");
assert(dashBlock.includes("this.renderAvailBar()"), "בחירת הסטטוס נשארת לנציג");
assert(dashBlock.includes("data-ops-avail-select"), "בחירת הסטטוס היא רשימה");
assert(dashBlock.includes('opt("break", "הפסקה")'), "אפשר לבחור הפסקה");
assert(!dashBlock.includes("סה״כ הפסקה היום"), "סיכום ההפסקה ירד מבחירת הסטטוס");
assert(!dashBlock.includes("!listBucket && Auth.isOpsAgent"), "בחירת הסטטוס לא נעלמת כשקובייה פתוחה");
assert(css.includes("#view-dashboard .opsDash__kpis--3{"), "עיצוב רשת שלוש הקוביות");
assert(css.includes("grid-template-columns:repeat(3,minmax(0,1fr));"), "שלוש עמודות לקוביות");

console.log("\n3) רובריקות שיקוף בלי דריסת החוצץ השמור");
assert(dashBlock.includes('_mirrorRubric: "scheduled"'), "מתוזמנים פתוחים בכניסה");
assert(dashBlock.includes("data-ops-mirror-rubric="), "רובריקות שיקוף נבחרות");
assert(dashBlock.includes("לקוחות מתוזמנים"), "רובריקת מתוזמנים");
assert(dashBlock.includes("לקוחות שממתינים לתיאום"), "רובריקת ממתינים לתיאום");
assert(dashBlock.includes("לקוחות ללא מענה"), "רובריקת ללא מענה");
assert(!dashBlock.includes("הצעות שהוגשו לתפעול · לפי סדר כניסה לתור"), "הסבר התור הוסר");
assert(dashBlock.includes("data-ops-mirror-lane="), "תת־חלוקה ללא מענה נשארה");
assert(dashBlock.includes("data-ops-dash-assign"), "שיוך לנציג נשאר");
assert(dashBlock.includes("פתיחת מסך שיקוף"), "פתיחת מסך שיקוף נשארה");
assert(filterBlock.includes('safeTrim(row.laneKey) || "no_answer_1"'), "סינון החוצץ השמור לא השתנה");
assert(!filterBlock.includes("waitingMirrorLaneOf"), "הסינון לא דורס סטטוס מתועד");
assert(!rubricSrc.includes("laneOf"), "סיווג התצוגה לא קורא ל-laneOf");
assert(!dashBlock.includes("opsDashHomeHint"), "רמז לנציג הוסר");
assert(!dashBlock.includes("פתיחת ההודעה נספרת לפי פתיחת דף החתימה"), "הסבר החתימות הוסר");
assert(!dashBlock.includes("שלבי ההפקה המפורטים עדיין בפיתוח"), "הסבר ההפקה הוסר");

console.log("\n4) חתימות והפקה");
assert(dashBlock.includes('_signRubric: "not_opened"'), "לא פתח את ההודעה פתוח בכניסה");
assert(dashBlock.includes("data-ops-sign-rubric="), "רובריקות חתימה");
assert(dashBlock.includes("לא פתח את ההודעה"), "רובריקת לא פתח");
assert(dashBlock.includes("פתח חתימות ולא חתם"), "רובריקת פתח ולא חתם");
assert(dashBlock.includes("לקוחות מעוכבי חתימה"), "רובריקת עיכוב");
assert(dashBlock.includes("data-ops-open-typing"), "שליחה לחתימות נשארת ממסך החתימות");
assert(dashBlock.includes("לקוחות לשליחה לחתימות"), "רשימת השליחה לחתימות נשארה");
assert(stageBlock.includes("בפיתוח"), "שלבי הפקה ריקים מסומנים בפיתוח");
assert(!stageBlock.includes("row.bucket"), "שלבי ההפקה לא מקבלים לקוחות מומצאים");
assert(!stageBlock.includes("collectRows"), "שלבי ההפקה לא שואבים תור");
assert(dashBlock.includes("עבר להפקה"), "הרשימה האמיתית של מי שעבר להפקה נשארת");
assert(dashBlock.includes("נשלח לחברה וממתין להפקה"), "כותרת שלב הפקה");
assert(dashBlock.includes("נשלח ובחיתום"), "כותרת חיתום");
assert(dashBlock.includes("ממתין לחוסרים והערות"), "כותרת חוסרים");
assert(dashBlock.includes("ממתין לאישור תנאים"), "כותרת תנאים");
assert(dashBlock.includes("הפקה הושלמה"), "כותרת הפקה הושלמה");

console.log("\n5) סיווג תצוגה");
assert(!!rubricSrc, "בלוק הסיווג נמצא");
const sandbox = {};
vm.runInNewContext(`
function safeTrim(v){ return String(v == null ? "" : v).trim(); }
const api = {
${rubricSrc}
getCallStore(rec){
  const mf = rec && rec.payload && rec.payload.mirrorFlow;
  return (mf && (mf.callSession || mf.call)) || {};
}
};
this.api = api;
`, sandbox);
const api = sandbox.api;
api._mirrorRubric = "scheduled";

function row(extra){
  return Object.assign({
    id: "c1",
    laneKey: "",
    rec: { id: "c1", payload: { opsProcess: {}, mirrorFlow: {}, giSignByDoc: {} } }
  }, extra || {});
}

const none = new Set();
assert(api.mirrorRubricKey(row(), none) === "awaiting_schedule", "בלי תיאום ובלי סטטוס מתועד — ממתינים לתיאום");
assert(api.mirrorRubricKey(row(), new Set(["c1"])) === "scheduled", "תיאום ביומן נכנס למתוזמנים");
assert(api.mirrorRubricKey(row({ laneKey: "no_answer_2" }), none) === "no_answer", "ללא מענה מתועד נשאר ללא מענה");
assert(api.mirrorRubricKey(row({ laneKey: "no_answer_1" }), new Set(["c1"])) === "no_answer", "סימון ללא מענה מעביר גם מתוזמן לרשימת ללא מענה");
assert(api.mirrorRubricKey(row({
  rec: { id: "c1", payload: { opsProcess: {}, mirrorFlow: {}, mirrorCallBookings: { current: { date: "2026-10-07", time: "10:00" } } } }
}), none) === "scheduled", "תזמון בתיק נכנס למתוזמנים");
assert(api.mirrorRubricKey(row({
  rec: { id: "c1", payload: { opsProcess: {}, mirrorFlow: { callSession: { paused: true } } } }
}), new Set(["c1"])) === "on_hold", "שיחה מושהית נכנסת להשהייה");
assert(api.mirrorRubricKey(row({ laneKey: "on_hold" }), none) === "on_hold", "חוצץ השהייה שמור מוצג כהשהייה");
assert(api.mirrorRubricKey(row({ laneKey: "checklist_pending" }), none) === "checklist_pending", "צ׳ק־ליסט שמור לא נופל לללא מענה");
assert(api.mirrorRubricKey(row({
  rec: { id: "c1", payload: { opsProcess: { liveState: "handling" }, mirrorFlow: {} } }
}), none) === "checklist_pending", "טיפול בלי חוצץ מתועד נשאר בצ׳ק־ליסט");
assert(api.mirrorRubricKey(row({
  laneKey: "no_answer_3",
  rec: { id: "c1", payload: { opsProcess: { liveState: "handling" }, mirrorFlow: {} } }
}), none) === "no_answer", "ללא מענה מתועד לא נדרס לטיפול");

const grouped = api.groupWaitingMirrorRows([
  row({ id: "a", rec: { id: "a", payload: { opsProcess: {}, mirrorFlow: {} } } }),
  row({ id: "b", laneKey: "no_answer_1", rec: { id: "b", payload: { opsProcess: {}, mirrorFlow: {} } } })
], none);
assert(grouped.awaiting_schedule.length === 1, "לקוח בלי תיאום לא נספר כללא מענה");
assert(grouped.no_answer.length === 1, "ללא מענה מתועד נספר בנפרד");
api._mirrorRubric = "on_hold";
assert(api.resolveMirrorRubric({ on_hold: [], scheduled: [{}] }) === "scheduled", "רובריקת השהייה ריקה חוזרת למתוזמנים");
api._mirrorRubric = "scheduled";
assert(api.resolveMirrorRubric({ scheduled: [], on_hold: [] }) === "scheduled", "מתוזמנים נשארים הרובריקה הפתוחה");

const hour = 60 * 60 * 1000;
const now = Date.parse("2026-10-06T12:00:00.000Z");
function signRow(ops, links){
  return {
    rec: {
      id: "s1",
      payload: {
        opsProcess: ops,
        giSignByDoc: { d1: { links: links } }
      }
    },
    ops: { store: ops }
  };
}
assert(api.signRubricOf(signRow({ signatureSentAt: new Date(now - hour).toISOString() }, [{ status: "pending" }]), now) === "not_opened", "בלי פתיחה — לא פתח את ההודעה");
assert(api.signRubricOf(signRow({ signatureSentAt: new Date(now - hour).toISOString() }, [{ status: "pending", openedAt: "2026-10-06T11:00:00.000Z" }]), now) === "opened_unsigned", "פתיחת דף החתימה — פתח ולא חתם");
assert(api.signRubricOf(signRow({ signatureSentAt: new Date(now - 25 * hour).toISOString() }, [{ status: "pending" }]), now) === "delayed", "מעל יממה בלי חתימה — מעוכב");
assert(api.signRubricOf(signRow({ signatureSentAt: new Date(now - 25 * hour).toISOString() }, [{ status: "pending", opened_at: "2026-10-05T10:00:00.000Z", step_n: 2, step_total: 4 }]), now) === "opened_unsigned", "מי שפתח נשאר בפתח ולא חתם גם אחרי יממה");
assert(api.signRubricOf(signRow({ signatureSentAt: new Date(now - 23 * hour).toISOString() }, [{ status: "pending", openedAt: "2026-10-06T10:00:00.000Z" }]), now) === "opened_unsigned", "פחות מיממה שנפתח לא נכנס לעיכוב");
assert(api.signRubricOf(signRow({ signatureSentAt: new Date(now - 48 * hour).toISOString() }, [{ status: "signed", openedAt: "2026-10-04T10:00:00.000Z" }]), now) === "opened_unsigned", "חתימה שהושלמה לא נספרת כעיכוב");
const lateOpened = signRow(
  { signatureSentAt: new Date(now - 25 * hour).toISOString() },
  [{ status: "pending", openedAt: "2026-10-05T10:00:00.000Z", step: 2, total: 4 }]
);
const detail = api.signDetailOf(lateOpened, now);
assert(detail.indexOf("פתח ולא חתם") >= 0, "פירוט עיכוב מציין פתח ולא חתם");
assert(detail.indexOf("חתימה 2 מתוך 4") >= 0, "פירוט עיכוב מציין את שלב החתימה");
assert(api.signDetailOf(signRow({ signatureSentAt: new Date(now - hour).toISOString() }, [{ status: "pending" }]), now) === "לא פתח את ההודעה", "בלי פתיחה הפירוט הוא לא פתח את ההודעה");

console.log("\n6) רנדור — רובריקה אחת פתוחה, שלבי הפקה ריקים");
function extractObjectMethod(src, methodName){
  const needle = "\n    " + methodName + "(";
  const start = src.indexOf(needle);
  if(start < 0) return "";
  const paren = src.indexOf("(", start);
  let parenDepth = 0;
  let i = paren;
  for(; i < src.length; i += 1){
    if(src[i] === "(") parenDepth += 1;
    else if(src[i] === ")"){
      parenDepth -= 1;
      if(parenDepth === 0){ i += 1; break; }
    }
  }
  const brace = src.indexOf("{", i);
  if(brace < 0) return "";
  let depth = 0;
  for(let j = brace; j < src.length; j += 1){
    if(src[j] === "{") depth += 1;
    else if(src[j] === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, j + 1).trim();
    }
  }
  return "";
}
const renderNames = ["ageYears", "insuredCallList", "mirrorWhen", "mirrorWhenMs", "formatMirrorWhen", "scheduleHeat", "mirrorNoAnswerRows", "renderWaitingMirrorList", "renderMirrorPanel", "renderSignaturePanel", "renderIssuanceStages", "renderIssuancePanel"];
let renderSrc = "";
renderNames.forEach((name) => {
  const src = extractObjectMethod(dashBlock, name);
  assert(!!src, "חולץ " + name);
  if(src) renderSrc += src + ",\n";
});
const view = {};
vm.runInNewContext(`
function safeTrim(v){ return String(v == null ? "" : v).trim(); }
function escapeHtml(v){
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
const MirrorCallBooking = { queueMeta(){ return ""; } };
const api = {
${rubricSrc}
${renderSrc}
WAITING_MIRROR_LANES: [
  { key: "no_answer_1", label: "ללא מענה 1" },
  { key: "no_answer_2", label: "ללא מענה 2" },
  { key: "no_answer_3", label: "ללא מענה 3" },
  { key: "no_answer_long", label: "ללא מענה ממושך" },
  { key: "scheduled", label: "מתוזמנים" },
  { key: "on_hold", label: "בהשהייה" },
  { key: "checklist_pending", label: "לא אושר צ׳ק־ליסט לשיקוף" }
],
ISSUANCE_STAGES: [
  { key: "sent_company", label: "נשלח לחברה וממתין להפקה" },
  { key: "underwriting", label: "נשלח ובחיתום" },
  { key: "missing", label: "ממתין לחוסרים והערות" },
  { key: "terms", label: "ממתין לאישור תנאים" },
  { key: "completed", label: "הפקה הושלמה" }
],
_mirrorRubric: "scheduled",
_signRubric: "not_opened",
_waitingMirrorLane: "no_answer_1",
formatMoney(value){ return String(Math.round(Number(value) || 0)) + " ₪"; },
getCallStore(rec){
  const mf = rec && rec.payload && rec.payload.mirrorFlow;
  return (mf && (mf.callSession || mf.call)) || {};
},
scheduledMirrorCustomerIds(){ return new Set(["sched-1"]); }
};
this.api = api;
`, view);
const ui = view.api;
function mirrorRow(id, name, lane){
  return {
    id: id,
    laneKey: lane || "",
    premium: 1200,
    waitLabel: "לפני שעה",
    salesAgentName: "נציג מכירות",
    agentName: "לא משויך",
    assign: null,
    rec: {
      id: id,
      fullName: name,
      idNumber: "123",
      phone: "050",
      payload: { opsProcess: {}, mirrorFlow: {} }
    }
  };
}
const mirrorModel = {
  waitingMirrorRows: [
    mirrorRow("sched-1", "לקוח מתוזמן", ""),
    mirrorRow("wait-1", "לקוח ממתין", ""),
    mirrorRow("na-1", "לקוח ללא מענה ראשון", "no_answer_1"),
    mirrorRow("na-2", "לקוח ללא מענה שני", "no_answer_2")
  ]
};
ui._mirrorRubric = "scheduled";
const scheduledHtml = ui.renderMirrorPanel(mirrorModel, true);
assert(scheduledHtml.includes("לקוח מתוזמן"), "רשימת המתוזמנים מציגה את הלקוח המתוזמן");
assert(!scheduledHtml.includes("לקוח ממתין"), "רשימת המתוזמנים לא פותחת את ממתינים לתיאום");
assert(!scheduledHtml.includes("לקוח ללא מענה ראשון"), "רשימת המתוזמנים לא פותחת את ללא מענה");
assert(scheduledHtml.includes('data-ops-mirror-rubric="scheduled"') && scheduledHtml.includes("is-active"), "רובריקת המתוזמנים מסומנת פתוחה");
assert(!scheduledHtml.includes('data-ops-mirror-rubric="on_hold"'), "בהשהייה לא מופיעה כשאין לקוחות");
assert(scheduledHtml.includes("שיוך לנציג"), "מנהל רואה שיוך ברשימה הפתוחה");
ui._mirrorRubric = "awaiting_schedule";
const waitHtml = ui.renderMirrorPanel(mirrorModel, false);
assert(waitHtml.includes("לקוח ממתין"), "מעבר לרובריקה פותח את ממתינים לתיאום");
assert(!waitHtml.includes("לקוח מתוזמן"), "מעבר רובריקה סוגר את רשימת המתוזמנים");
assert(waitHtml.includes("פתיחת מסך שיקוף"), "נציג רואה פתיחת מסך שיקוף");
assert(!waitHtml.includes("opsDashHomeHint"), "רמז הנציג לא מופיע במסך השיקופים");
assert(!waitHtml.includes("הצעות שהוגשו לתפעול"), "הסבר התור לא מופיע");
ui._mirrorRubric = "no_answer";
ui._waitingMirrorLane = "no_answer_1";
const naHtml = ui.renderMirrorPanel(mirrorModel, true);
assert(naHtml.includes("לקוח ללא מענה ראשון"), "ללא מענה 1 פתוח כברירת מחדל");
assert(!naHtml.includes("לקוח ללא מענה שני"), "ללא מענה 2 לא נפתח יחד איתו");
assert(naHtml.includes('data-ops-mirror-lane="no_answer_2"'), "אפשר לעבור לללא מענה 2");

const fresh = signRow({ signatureSentAt: new Date(now - hour).toISOString(), signaturePhones: [{ phone: "050111" }] }, [{ status: "pending" }]);
fresh.rec.fullName = "לקוח לא פתח";
fresh.rec.idNumber = "111";
fresh.id = "sig-1";
fresh.waitLabel = "לפני שעה";
const opened = signRow({ signatureSentAt: new Date(now - hour).toISOString() }, [{ status: "pending", openedAt: "2026-10-06T11:00:00.000Z" }]);
opened.rec.fullName = "לקוח פתח";
opened.id = "sig-2";
opened.waitLabel = "לפני שעה";
ui._signRubric = "not_opened";
const signHtml = ui.renderSignaturePanel([fresh, opened]);
assert(signHtml.includes("לקוח לא פתח"), "רובריקת החתימה הראשונה מציגה מי שלא פתח");
assert(!signHtml.includes("לקוח פתח"), "רובריקת לא פתח לא מציגה מי שפתח");
assert(signHtml.includes("data-ops-open-typing"), "מסך החתימות משאיר כניסה לשליחה לחתימות");
ui._signRubric = "opened_unsigned";
const openedHtml = ui.renderSignaturePanel([fresh, opened]);
assert(openedHtml.includes("לקוח פתח"), "מעבר רובריקה פותח את מי שפתח ולא חתם");
assert(!openedHtml.includes("לקוח לא פתח"), "מעבר רובריקה סוגר את מי שלא פתח");

const issued = {
  id: "iss-1",
  premium: 3400,
  waitLabel: "אתמול",
  rec: { fullName: "לקוח בהפקה", idNumber: "999", phone: "052" }
};
const issueHtml = ui.renderIssuancePanel([issued]);
const issueSplit = issueHtml.split("עבר להפקה");
assert(issueSplit.length === 2, "רשימת עבר להפקה מופיעה אחרי שלבי הפיתוח");
assert(!issueSplit[0].includes("לקוח בהפקה"), "הלקוח לא הוכנס לשלב הפקה מומצא");
assert(issueSplit[0].includes("בפיתוח"), "שלבי ההפקה מסומנים בפיתוח");
assert(issueSplit[1].includes("לקוח בהפקה"), "הלקוח שסומן להפקה מופיע ברשימה האמיתית");
assert(issueSplit[1].includes("3400 ₪"), "סכום ההפקה האמיתי מוצג ברשימה");
assert(scheduledHtml.includes("פתח שיקוף שיחה"), "לחצן פתיחת השיקוף מופיע במתוזמנים");
assert(waitHtml.includes("תזמון"), "ממתינים לתיאום מקבלים תזמון");
assert(waitHtml.includes("נציג שהגיש"), "ממתינים לתיאום מציגים את הנציג שהגיש");
assert(naHtml.includes("ללא מענה 1") && naHtml.includes("ללא מענה ממושך"), "ברשימת ללא מענה אפשר לסמן את כמות השיחות");
assert(ui.ageYears("01/01/2012", new Date("2026-10-06T00:00:00")) === 14, "קטין מתחת ל-16 לא נספר");
assert(ui.ageYears("01/01/2010", new Date("2026-10-06T00:00:00")) === 16, "מי שמלאו לו 16 נספר");
const people = ui.insuredCallList({
  payload: {
    operational: {
      insureds: [
        { label: "מבוטח ראשי", data: { firstName: "דנה", lastName: "כהן", birthDate: "01/01/1990" } },
        { type: "child", label: "קטין", data: { firstName: "נועם", lastName: "כהן", birthDate: "01/01/2015" } },
        { type: "spouse", label: "בן/בת זוג", data: { firstName: "יוסי", lastName: "כהן", birthDate: "02/02/1988" } }
      ]
    }
  }
});
assert(people.length === 2 && people[0].name === "דנה כהן" && people[1].name === "יוסי כהן", "בשיחה רק מבוטחים בני 16 ומעלה");
const openers = api.signOpenedNames(signRow({}, [
  { name: "דנה כהן", status: "pending", openedAt: "2026-10-06T10:00:00.000Z" },
  { name: "יוסי כהן", status: "signed", openedAt: "2026-10-06T10:00:00.000Z" }
]));
assert(openers.join(",") === "דנה כהן", "מי שפתח וחתם לא מוצג בין מי שפתח");
assert(read("gi-wizard.js").includes("לא נבחר עדיין מועד מול המבוטח"), "באפשרות התזמון באשף יש סימון שאין מועד");
assert(css.includes("#opsAgentFloat{") && css.includes("position:fixed"), "פעילות הנציגים נפתחת בחלון צף");
assert(dashBlock.includes("openAgentFloat(){") && dashBlock.includes("data-ops-float-drag"), "אפשר לגרור את חלון הנציגים בלי לעזוב את הדשבורד");
assert(app.includes('if(safe === "opsAgentFloor")') && app.includes("OpsDashboardUI.openAgentFloat()"), "לחיצה לא מחליפה את מסך הדשבורד");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
