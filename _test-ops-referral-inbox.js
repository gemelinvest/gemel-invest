/* הפניות תפעול: הגעה לנציג, שורה בכרטיסיית תפעול, החזרה, ותפריט רק לתפעול.
   הרצה: node _test-ops-referral-inbox.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = __dirname;
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
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

console.log("1) משלוח מהיר בלי להחזיר את סריקת 8 השניות");
assert(app.includes("const OpsReferralFastWatcher = {"), "צופה מהיר קיים");
assert(app.includes("intervalMs: 1000"), "הפנייה נמשכת כל שנייה");
assert(app.includes("intervalMs: 8000"), "סריקת הסטטוס נשארת על 8 שניות");
assert(app.includes('agentNotice:payload->opsProcess->agentNotice'), "השאילתה מושכת רק את הודעת הפנייה");
assert(app.includes("OpsReferralFastWatcher.start()"), "הצופה המהיר עולה עם ההתחברות");
assert(app.includes('statusKey !== "opsReferral"'), "הסריקה האיטית לא משכפלת טוסט פנייה");
assert(app.includes("referralToastTitle(count)"), "טוסט עם מספר פניות");

console.log("\n2) כרטיסיית תפעול והתפריט");
assert(app.includes("התקבלה פנייה מ "), "שורת הפנייה מציינת מי פתח");
assert(app.includes('data-ops-referral-show="'), "לחצן הצג");
assert(app.includes("is-unread") && app.includes("is-read"), "לא נקראה ונקראה");
assert(css.includes(".giOpsRef.is-unread{ background:#fee2e2"), "לא נקראה באדום");
assert(css.includes(".giOpsRef.is-read{ background:#dcfce7"), "נקראה בירוק");
assert(app.includes('actionLabel: "פתח תיק"'), "פתח תיק על ההודעה");
assert(app.includes('openSection: "ops"'), "הפתיחה נשארת בכרטיסיית תפעול");
assert(app.includes("החזר לשירות"), "החזרה לשירות");
assert(html.includes('id="navMyOpsReferrals"'), "לחצן הפניות שלי בתפריט");
assert(html.indexOf('id="navMirrorCall"') < html.indexOf('id="navMyOpsReferrals"'), "הלחצן ליד שיחת השיקוף");
assert(html.includes('id="view-myOpsReferrals"'), "מסך הפניות שלי");
assert(app.includes('myOpsReferralsNav.style.display = (isOps || isOpsAgent) ? "" : "none"'), "הלחצן רק לתפקיד תפעול ולנציג תפעול");
assert(app.includes('safe === "myOpsReferrals" && !OpsReferralsUI.canAccess()'), "שאר התפקידים לא נכנסים למסך");
assert(app.includes("פתח שיקוף"), "פתיחת מסך השיקוף מההפניה");

console.log("\n3) לוגיקת הפנייה");
const laneStart = app.indexOf("/* GI-OPS-THREAD-LANE-START */");
const laneEnd = app.indexOf("async function persistOpsProcessLightGuarded");
assert(laneStart > 0 && laneEnd > laneStart, "בלוק OpsThreadLane נמצא");
const extracted = app.slice(laneStart, laneEnd);
const sandbox = {};
vm.runInNewContext(`
  function safeTrim(v){ return String(v == null ? "" : v).trim(); }
  function nowISO(){ return "2026-09-30T09:41:00.000Z"; }
  const Auth = { current: { id: "ops-1", name: "סתיו כהן" } };
  function ensureOpsProcess(rec){
    if(!rec.payload) rec.payload = {};
    if(!rec.payload.opsProcess) rec.payload.opsProcess = {};
    return rec.payload.opsProcess;
  }
  function setOpsTouch(rec, patch){
    const store = ensureOpsProcess(rec);
    Object.assign(store, patch || {});
    store.updatedAt = "2026-09-30T09:41:00.000Z";
    return store;
  }
  ${extracted}
  this.OpsThreadLane = OpsThreadLane;
`, sandbox);

const rec = { id: "c1", fullName: "לקוח לדוגמה", agentId: "seller-1", agentName: "דנה", payload: { opsProcess: {} } };
const opened = sandbox.OpsThreadLane.openOpsReferral(rec, "השיחה נעצרה בשאלון", { id: "ops-1", name: "סתיו כהן" });
assert(opened && opened.ok === true, "יצירת פנייה");
assert(rec.payload.opsProcess.agentNotice.actionLabel === "פתח תיק", "ההודעה מבקשת פתיחת תיק");
assert(rec.payload.opsProcess.agentNotice.openSection === "ops", "ההודעה מצביעה על תפעול");
const item = sandbox.OpsThreadLane.referralItems(rec)[0];
assert(item && item.by === "סתיו כהן" && !item.readAt, "הפנייה נשמרת כלא נקראה");
assert(sandbox.OpsThreadLane.unreadReferralCount([rec]) === 1, "ספירת לא נקראו");
assert(sandbox.OpsThreadLane.referralToastTitle(2) === "קבלת 2 פניות מתפעול", "נוסח טוסט לכמה פניות");
assert(sandbox.OpsThreadLane.referralToastTitle(1) === "קבלת פנייה חדשה מתפעול", "נוסח טוסט לפנייה אחת");
const shown = sandbox.OpsThreadLane.markReferralShown(rec, item.id, { id: "seller-1", name: "דנה" });
assert(shown && shown.ok === true && !!item.readAt, "הצג מסמן כנקראה");
assert(sandbox.OpsThreadLane.unreadReferralCount([rec]) === 0, "אחרי הצג אין לא נקראו");
const returned = sandbox.OpsThreadLane.returnReferral(rec, item.id, "מצורף אישור", [{ name: "אישור.pdf", dataUrl: "data:application/pdf;base64,YQ==" }], { id: "seller-1", name: "דנה" });
assert(returned && returned.ok === true, "החזרה לשירות");
assert(item.returnText === "מצורף אישור" && item.attachments.length === 1, "נשמרו טקסט וקובץ");
assert(rec.payload.opsProcess.opsNotice.openedById === "ops-1", "ההחזרה חוזרת לנציג שפתח");
assert(sandbox.OpsThreadLane.belongsToOpsUser(item, { id: "ops-1", name: "אחר" }) === true, "הפנייה שייכת לתפעול שפתח אותה");
assert(sandbox.OpsThreadLane.belongsToOpsUser(item, { id: "seller-1", name: "דנה" }) === false, "נציג מכירות לא נכנס להפניות שלי");
const empty = sandbox.OpsThreadLane.returnReferral(rec, item.id, "   ", [], { id: "seller-1", name: "דנה" });
assert(empty && empty.ok === false, "החזרה בלי טקסט נדחית");

console.log("\n4) רגרסיה — מסלול הפנייה והסטטוס נשארו");
assert(app.includes("openOpsReferral(rec, note,"), "שליחה מחלון הפנייה נשארה");
assert(app.includes('label: "קבלת פנייה חדשה מתפעול"'), "נוסח פנייה בודדת נשאר");
assert(app.includes("store.statusLog.push({"), "תיעוד סטטוס נשאר");
assert(app.includes("async _documentReadyMirrorLane(laneKey)"), "לחצני סטטוס בשיקוף נשארו");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
