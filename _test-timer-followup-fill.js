const fs = require("fs");
const assert = require("assert");
const app = fs.readFileSync("app.js", "utf8");

function sliceBetween(src, start, end){
  const a = src.indexOf(start);
  assert(a >= 0, "missing " + start);
  const b = src.indexOf(end, a + start.length);
  assert(b > a, "missing " + end);
  return src.slice(a, b);
}

const openFollow = sliceBetween(app, "async _mcOpenFollowupFromRail(rec, type", "_mcShowFullPdfModal(title, url){");
const hold = sliceBetween(app, "_holdMirrorCallSeconds(){", "stopCall(){");
const submit = sliceBetween(app, "async _submitReferAgent(){", "_holdMirrorCallSeconds(){");
const bookSave = sliceBetween(app, 'save = await this._commit(rec, nextBox, "תזמון שיחת שיקוף")', "async clear(){");
const persisted = sliceBetween(app, "function getPersistedLiveCall(rec){", "function releaseCustomerFileCallTimer(rec){");
const live = sliceBetween(app, "function isLiveMirrorCallForCustomer(rec){", "function getOpsStatePresentation(rec){");

assert(app.includes("function releaseCustomerFileCallTimer(rec){"), "עצירת טיימר התיק");
assert(app.includes("function undoReleaseCustomerFileCallTimer(token){"), "שחזור טיימר אם השמירה נכשלה");
assert(persisted.includes("if(call.fileTimerHidden) return null;"), "טיימר מוסתר לא נשאר חי אחרי רענון");
assert(persisted.indexOf("if(call.fileTimerHidden) return null;") < persisted.indexOf("if(call.timerHeld)"), "הסתרה גוברת על שעון עצור");
assert(live.includes("if(store?.fileTimerHidden) return { live:false, seconds:0, startedAt:\"\", source:\"\" };"), "תיק פתוח לא מציג טיימר מוסתר");
assert(live.indexOf("fileTimerHidden") < live.indexOf("_callRunning"), "הסתרה גוברת על מונה מקומי");
const bookReleaseAt = app.lastIndexOf("releaseCustomerFileCallTimer(rec)", app.indexOf('save = await this._commit(rec, nextBox, "תזמון שיחת שיקוף")'));
assert(bookReleaseAt >= 0, "קביעת מועד עוצרת את הטיימר");
assert(app.indexOf("releaseCustomerFileCallTimer(rec)", bookReleaseAt) < app.indexOf('this._commit(rec, nextBox, "תזמון שיחת שיקוף")'), "הטיימר נעצר לפני שמירת המועד");
assert(bookSave.includes("undoReleaseCustomerFileCallTimer(timerRelease)"), "מועד שנכשל לא משאיר את התיק בלי טיימר");
assert(submit.includes("releaseCustomerFileCallTimer(rec)"), "פתיחת פנייה עוצרת את הטיימר");
assert(submit.indexOf("releaseCustomerFileCallTimer(rec)") < submit.indexOf("persistOpsProcessLightGuarded"), "הטיימר נעצר לפני שמירת הפנייה");
assert(submit.includes("undoReleaseCustomerFileCallTimer(timerRelease)"), "פנייה שנכשלה לא מסתירה את הטיימר");
assert(submit.includes('actionLabel: "פתח תיק"') || app.includes('actionLabel: "פתח תיק"'), "פתיחת תיק נשארת");
assert(!hold.includes("fileTimerHidden"), "סיום שיקוף לא מסתיר את הטיימר");
assert(hold.includes("store.timerHeld = true"), "סיום שיקוף עדיין עוצר את השניות");
assert(app.includes("store.fileTimerHidden = false"), "שיחה חדשה מחזירה את הטיימר");
assert(app.includes("store.fileTimerHidden = true"), "ההסתרה נשמרת על השיחה");
assert(app.includes('this._releaseRosterCall("rescheduled")'), "לחיצה על תזמון עוצרת את המונה");
assert(app.includes('this._releaseRosterCall("referred")'), "לחיצה על פנייה לנציג עוצרת את המונה");
const releaseFn = sliceBetween(app, "_releaseRosterCall(reason){", "_holdMirrorCallSeconds(){");
assert(releaseFn.indexOf("store.endReason = why") > 0, "הלחיצה מסמנת את סיבת הסיום");
assert(releaseFn.includes("window.clearInterval(this._timerHandle)"), "הלחיצה עוצרת את האינטרוול");
assert(!releaseFn.includes("stopCall()"), "הלחיצה לא סוגרת את שלבי התפעול");
const rescheduleClick = sliceBetween(app, 'this.els.rescheduleBtn, "click"', "this.els.referAgentBtn");
assert(rescheduleClick.indexOf("_releaseRosterCall") < rescheduleClick.indexOf("MirrorCallBooking.open"), "המונה נעצר לפני פתיחת חלון התזמון");
const undoFn = sliceBetween(app, "function undoReleaseCustomerFileCallTimer(token){", "function shouldKeepLocalMirrorCallSession");
assert(undoFn.includes('reason === "rescheduled"') && undoFn.includes('reason === "referred"'), "שמירה שנכשלה לא מחייה שיחה שכבר נעצרה בלחיצה");

assert(openFollow.includes("ensureFollowupZipLoaded"), "שאלון המשך נטען לפני המילוי");
assert(openFollow.includes("getFollowupZipMeta"), "השאלון נלקח מההצהרה שסומנה כן");
assert(openFollow.includes("_mcFollowupHealthResponseValues"), "הנתונים שכבר מולאו נכנסים לשאלון");
assert(openFollow.indexOf("ensureFollowupZipLoaded") < openFollow.indexOf("getFollowupZipMeta"), "הטופס נטען לפני איתור התשובות");
assert(openFollow.indexOf("_mcFollowupHealthResponseValues") < openFollow.indexOf("_mcCachedFormBytes"), "הזיכרון לא מציג שאלון ריק לפני המיזוג");
assert(openFollow.indexOf("overlay.html") < openFollow.indexOf("savedFollowBytes"), "עריכה על השאלון לא נזרקת לפני המילוי");
assert(openFollow.includes("fillFollowupPdf"), "השאלון נפתח ממולא");
assert(openFollow.includes("loadFollowupPageBytes"), "בלי מילוי נשאר עמוד המקור");
assert(openFollow.includes("saved: false"), "פתיחה מחדש לא מסמנת שמירה");
assert(openFollow.includes("useOriginalForm: true"), "מוצג טופס החברה");
assert(!openFollow.includes("listEditablePdfFields"), "שאלון המשך לא שופך שדות גולמיים");

console.log("timer + followup fill ok");
