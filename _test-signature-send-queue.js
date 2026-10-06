/* תור «שליחה לחתימות» במקום תיק הקלדה.
   מסמכים שנשמרו בשיקוף, טלפון לכל מבוטח, ושליחה שמעבירה לממתין לחתימות
   בלי ספק SMS.
   הרצה: node _test-signature-send-queue.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const QUEUE_STATUS = "בוצע שיקוף ללקוח. ניתן לשלוח לחתימות";
const SENT_STATUS = "נשלח SMS ללקוח לחתימות";
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

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-signature-send-queue.js")]).status === 0, "node --check this test");

console.log("\n2) תוויות תור וכרטיס");
assert(app.includes("data-ops-open-typing"), "שליחה לחתימות נשארת נגישה ממסך החתימות");
assert(app.includes(">שליחה לחתימות<"), "תווית שליחה לחתימות נשארת");
assert(app.includes('waiting_typing: "שליחה לחתימות"'), "תווית הדלי נשארת על אותו מפתח");
assert(app.includes('{ key: "waiting_typing", label: "שליחה לחתימות"'), "קוביית הנציג מציגה את אותו שם");
assert(app.includes('לקוחות לשליחה לחתימות'), "כותרת הרשימה");
assert(app.includes("פתח שליחה לחתימות"), "כפתור פתיחה מהרשימה");
assert(app.includes('status: "' + QUEUE_STATUS + '"'), "סטטוס ההמתנה במסך הלקוח");
assert(app.includes('liveLabel = "' + QUEUE_STATUS + '"'), "תווית תפעול בזמן ההמתנה");
assert(!app.includes("שיחה מנציג התפעול"), "אין שורת שיחה מנציג התפעול");
assert(app.includes('liveState: "waiting_typing"'), "מפתח ההמתנה הפנימי נשאר");
assert(app.includes('resultStatus: "pendingTyping"'), "תוצאת ההמתנה הפנימית נשארת");

console.log("\n3) מסך השליחה במקום תיק ההקלדה");
const packetStart = app.indexOf("const TypingPacketUI = {");
const packetEnd = app.indexOf("const DashboardUI = {", packetStart);
const packet = packetStart >= 0 && packetEnd > packetStart ? app.slice(packetStart, packetEnd) : "";
assert(!!packet, "TypingPacketUI נמצא");
assert(packet.includes('data-mtq-act="send-signature"'), "כפתור שלח לחתימה");
assert(packet.includes("שלח לחתימה"), "תווית כפתור השליחה");
assert(packet.includes("data-mtq-sig-doc"), "בחירת מסמכים");
assert(packet.includes("data-mtq-sig-phone"), "טלפון לפי מבוטח");
assert(packet.includes("מסמכים מוכנים משלב השיקוף"), "רשימת המסמכים שנשמרו");
assert(!packet.includes('data-mtq-act="mark-typed"'), "כפתור סימון ההקלדה הוסר מהמסך");
assert(!packet.includes("תיק הקלדה"), "מסך תיק ההקלדה לא נפתח יותר");
assert(packet.includes("beginCustomerTypingPrep"), "פתיחה עדיין מסמנת הכנת טפסים");
assert(!packet.includes("fetch("), "השליחה לא קוראת לרשת");

console.log("\n4) מעבר לממתין לחתימות");
assert(!app.includes('_frozenBuckets: Object.freeze(["pending_signatures"])'), "כרטיס החתימות נפתח");
assert(app.includes("לקוחות ממתינים לחתימות"), "רשימת ממתינים לחתימות");
assert(app.includes(SENT_STATUS), "סטטוס אחרי השליחה");
assert(app.includes('kpiCard("pending_signatures", "חתימות", "count")'), "קוביית חתימות");

const names = ["isReadySignatureDoc", "readySignatureDocs", "signatureInsuredRows", "applySignatureSend"];
let code = "";
names.forEach((name) => {
  const src = extractObjectMethod(app, name);
  assert(!!src, "חולץ " + name);
  if(src) code += "this." + name + " = function" + src.slice(name.length) + ";\n";
});

function safeTrim(v){ return String(v == null ? "" : v).trim(); }
const host = {
  safeTrim,
  nowISO(){ return "2026-10-01T08:00:00.000Z"; },
  Auth: { current: { name: "נציג תפעול" } },
  SIGNATURE_SENT_STATUS: SENT_STATUS,
  setOpsTouch(rec, patch){
    if(!rec.payload) rec.payload = {};
    if(!rec.payload.opsProcess) rec.payload.opsProcess = {};
    Object.assign(rec.payload.opsProcess, patch || {});
    return rec.payload.opsProcess;
  }
};
vm.runInNewContext(code, host);

console.log("\n5) מסמכים מוכנים בלבד");
const docsRec = {
  payload: {
    customerDocuments: [
      { id: "saved", name: "טופס הצטרפות כלל", fileName: "clal.pdf", dataUrl: "data:application/pdf;base64,QQ==", type: "clal_join", mirrorAgentSaved: true },
      { id: "materialized", name: "שאלון המשך", fileName: "follow.pdf", dataUrl: "data:application/pdf;base64,QQ==", type: "followup_questionnaire" },
      { id: "upload", name: "תעודה", fileName: "id.pdf", dataUrl: "data:application/pdf;base64,QQ==", type: "upload" },
      { id: "report", name: "דוח תפעולי", fileName: "report.pdf", dataUrl: "data:application/pdf;base64,QQ==", type: "healthOps" },
      { id: "empty", name: "טיוטה", type: "clal_join" }
    ]
  }
};
const ready = host.readySignatureDocs(docsRec);
const readyIds = ready.map((doc) => doc.id);
assert(readyIds.indexOf("saved") >= 0, "מסמך שנשמר בשיקוף נכלל");
assert(readyIds.indexOf("materialized") >= 0, "טופס שמולא עם קובץ נכלל");
assert(readyIds.indexOf("upload") < 0, "העלאה כללית לא נכנסת");
assert(readyIds.indexOf("report") < 0, "דוח תפעולי לא נכנס");
assert(readyIds.indexOf("empty") < 0, "מסמך בלי קובץ לא נכנס");

console.log("\n6) טלפון לפי שם מבוטח");
const peopleRec = {
  fullName: "ישראל ישראלי",
  phone: "0501111111",
  payload: {
    insureds: [
      { id: "a", label: "ראשי", data: { firstName: "ישראל", lastName: "ישראלי", phone: "0501111111" } },
      { id: "b", label: "בן זוג", data: { firstName: "שרה", lastName: "ישראלי", phone: "0522222222" } }
    ],
    opsProcess: { signaturePhoneDraft: { b: "0533333333" } }
  }
};
const people = host.signatureInsuredRows(peopleRec);
assert(people.length === 2, "שורה לכל מבוטח");
assert(people[0].name === "ישראל ישראלי" && people[0].phone === "0501111111", "שם המבוטח ואז הטלפון שלו");
assert(people[1].name === "שרה ישראלי" && people[1].phone === "0533333333", "טיוטת טלפון נשמרת למבוטח");
const fallback = host.signatureInsuredRows({ fullName: "לקוח בודד", phone: "0540000000", payload: {} });
assert(fallback.length === 1 && fallback[0].name === "לקוח בודד" && fallback[0].phone === "0540000000", "בלי מבוטחים נשארת שורת הלקוח");

console.log("\n7) שליחה מעבירה סטטוס בלי SMS");
const sendRec = {
  fullName: "ישראל ישראלי",
  payload: { opsProcess: { resultStatus: "pendingTyping", liveState: "waiting_typing" } }
};
const blockedDocs = host.applySignatureSend(sendRec, [], [{ insuredId: "a", name: "ישראל", phone: "0501111111" }]);
assert(blockedDocs.ok === false && blockedDocs.reason === "docs", "בלי מסמך לא שולחים");
assert(sendRec.payload.opsProcess.resultStatus === "pendingTyping", "בלי מסמך הלקוח נשאר בתור");
const blockedPhone = host.applySignatureSend(sendRec, ["saved"], [{ insuredId: "a", name: "ישראל", phone: "" }]);
assert(blockedPhone.ok === false && blockedPhone.reason === "phones", "בלי טלפון לא שולחים");
assert(sendRec.payload.opsProcess.liveState === "waiting_typing", "בלי טלפון לא מנקים את מצב ההמתנה");
const sent = host.applySignatureSend(sendRec, ["saved", ""], [
  { insuredId: "a", name: "ישראל ישראלי", phone: "0501111111" },
  { insuredId: "b", name: "שרה ישראלי", phone: "0522222222" }
]);
assert(sent.ok === true, "שליחה עם מסמך וטלפון מתקבלת");
const ops = sendRec.payload.opsProcess;
assert(ops.resultStatus === "pendingSignatures", "התוצאה עוברת לממתין לחתימות");
assert(ops.liveState === "", "מצב ההמתנה מתנקה כדי לא להישאר בתור השליחה");
assert(ops.signatureStatusLabel === SENT_STATUS, "נרשם שנשלח SMS לחתימות");
assert(ops.signatureSentAt === "2026-10-01T08:00:00.000Z", "נשמר מועד השליחה");
assert(ops.signatureDocIds.length === 1 && ops.signatureDocIds[0] === "saved", "נשמרים המסמכים שנבחרו");
assert(ops.signaturePhones.length === 2 && ops.signaturePhones[1].phone === "0522222222", "נשמר טלפון לכל מבוטח");
assert(JSON.stringify(ops).indexOf("fetch") < 0, "הרשומה לא כוללת קריאת רשת");

if(failed){
  console.error("\nFAILED " + failed + " / passed " + passed);
  process.exit(1);
}
console.log("\nOK  " + passed + " assertions");
