/* GI-OPS 2026-09-14 — טפסים במסך אשר והעבר להקלדה + שעון ממתין/בהכנת טפסים.
   הרצה: node _test-ops-typing-forms-clock.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260914-mirror-chg-v2";
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
const theme = read("theme-mirror-typing.css");
const html = read("index.html");
const sw = read("service-worker.js");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-ops-typing-forms-clock.js")]).status === 0, "node --check this test");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + APP_TAG), "index.html app.css cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");
assert(app.includes("theme-mirror-typing.css?v=" + APP_TAG), "theme-mirror-typing cache");

console.log("\n2) טפסים במסך אשר והעבר להקלדה");
assert(app.includes('data-mc-summary-forms'), "פאנל טפסים במסך הסיכום");
assert(app.includes("טפסים ממולאים אחרי תיקון השיקוף"), "כותרת פאנל הטפסים");
assert(app.includes("_mcPrepareSummaryFilledForms"), "הכנת טפסים בפתיחת הדוח");
assert(app.includes("_mcEnsureJoinFormEdits"), "טפסי הצעה נאספים גם בלי formEdits קודם");
assert(app.includes("_mcOpenFilledFormDoc"), "פתיחת טופס מהסיכום");
assert(app.includes("_mcDownloadFilledFormDoc"), "הורדת טופס מהסיכום");
assert(app.includes('data-mc-summary-form="open"'), "לחצן פתח על טופס");
assert(app.includes('data-mc-summary-form="download"'), "לחצן הורדה על טופס");
assert(app.includes("void this._mcPrepareSummaryFilledForms(target)"), "openMirrorSummaryReport מכין טפסים");
assert(app.includes("try{ this._mcEnsureJoinFormEdits(rec); }catch(_e2){}"), "אישור עדיין מממש טפסים");
assert(theme.includes(".mtqFormRow"), "עיצוב שורות הטפסים");
assert(theme.includes(".mtqSummaryMain"), "עמודת הסיכום כוללת את הטפסים");

console.log("\n3) שעון ממתין להקלדה / בהכנת טפסים");
assert(app.includes('liveState: "waiting_typing"'), "אחרי אישור liveState הוא ממתין להקלדה");
assert(app.includes('status: "ממתין להקלדה"'), "השעון מציג ממתין להקלדה");
assert(app.includes('status: "לקוח בהכנת טפסים"'), "השעון מציג לקוח בהכנת טפסים");
assert(app.includes('stepKicker: agent ? ("נציג מבצע · " + agent) : ""'), "שם הנציג המבצע מופיע בשעון");
assert(app.includes("function beginCustomerTypingPrep(rec){"), "פתיחת תיק מקליד מסמנת הכנת טפסים");
assert(app.includes('App.persist("לקוח בהכנת טפסים")'), "שמירה בשרת כשמתחילים הקלדה");
assert(app.includes("if(typeof beginCustomerTypingPrep === \"function\" && beginCustomerTypingPrep(rec))"), "TypingPacketUI ופתיחת תיק קוראים ל-beginCustomerTypingPrep");
assert(css.includes(".cfFile__liveTimer.is-waiting"), "עיצוב שעון ממתין");
assert(css.includes(".cfFile__liveTimer.is-preparing"), "עיצוב שעון בהכנת טפסים");
assert(app.includes('el.classList.remove("is-live", "is-done", "is-stopped", "is-waiting", "is-preparing", "has-step")'), "השעון מנקה מצבי המתנה/הכנה");
assert(app.includes('const clockModes = view.mode === "live" || view.mode === "waiting" || view.mode === "preparing"'), "שעון ויזואלי גם בהמתנה ובהכנה");

console.log("\n4) לא נכנס כתוצאת תפעול לחיצה");
const resultButtons = sliceBetween(app, "const resultButtons = canSetOpsResult", "const updatedLine");
assert(!!resultButtons, "לחצני תוצאת תפעול נמצאו");
assert(!app.includes('pendingTyping: "'), "pendingTyping לא נוסף ל-OPS_RESULT_OPTIONS");
assert(app.includes("if(isPreparingFormsOps(ops))"), "הצגת הכנת טפסים לפני תוצאת תפעול רגילה");
assert(app.includes("if(liveKey === \"preparing_forms\" || liveKey === \"waiting_typing\")"), "תוצאת תפעול מאוחרת מנקה liveKey של הקלדה");

console.log("\n5) התנהגות העזרים");
const helperSrc = sliceBetween(app, "function isPendingTypingResult(key){", "/* GI-OPS-THREAD-LANE-START */");
const timerSrc = sliceBetween(app, "function getHeroCallTimerView(rec, opsState){", "function archiveMirrorCallIfDocumented(rec){");
assert(helperSrc.includes("function beginCustomerTypingPrep"), "beginCustomerTypingPrep בחתך");
assert(timerSrc.includes("function getCustomerFileOpsBadge"), "getCustomerFileOpsBadge בחתך");
const sandbox = {};
vm.runInNewContext(`
  function safeTrim(v){ return String(v == null ? "" : v).trim(); }
  function nowISO(){ return "2026-09-14T10:00:00.000Z"; }
  const Auth = {
    current: { name: "דנה מקלידה" },
    isOps(){ return true; },
    isOpsAgent(){ return false; }
  };
  function ensureOpsProcess(rec){
    if(!rec || typeof rec !== "object") return {};
    if(!rec.payload || typeof rec.payload !== "object") rec.payload = {};
    if(!rec.payload.opsProcess || typeof rec.payload.opsProcess !== "object") rec.payload.opsProcess = {};
    return rec.payload.opsProcess;
  }
  function setOpsTouch(rec, patch){
    const store = ensureOpsProcess(rec);
    Object.assign(store, patch || {});
    store.updatedAt = nowISO();
    return store;
  }
  ${helperSrc}
  ${timerSrc}
  this.isPendingTypingResult = isPendingTypingResult;
  this.isPreparingFormsOps = isPreparingFormsOps;
  this.isWaitingTypingOps = isWaitingTypingOps;
  this.beginCustomerTypingPrep = beginCustomerTypingPrep;
  this.getHeroCallTimerView = getHeroCallTimerView;
  this.getCustomerFileOpsBadge = getCustomerFileOpsBadge;
`, sandbox);

assert(sandbox.isPendingTypingResult("pendingTyping") === true, "pendingTyping מזוהה");
assert(sandbox.isPendingTypingResult("waitingTyping") === true, "waitingTyping מזוהה");
assert(sandbox.isPendingTypingResult("pendingSignatures") === false, "חתימות אינן הקלדה");

const waitingOps = { resultStatus: "pendingTyping", liveState: "waiting_typing" };
assert(sandbox.isWaitingTypingOps(waitingOps) === true, "ממתין להקלדה מזוהה");
assert(sandbox.isPreparingFormsOps(waitingOps) === false, "ממתין אינו הכנת טפסים");

const oldFinished = { resultStatus: "pendingTyping", liveState: "call_finished" };
assert(sandbox.isWaitingTypingOps(oldFinished) === true, "תיקים ישנים עם call_finished+pendingTyping נחשבים ממתינים");

const prepOps = { resultStatus: "pendingTyping", liveState: "preparing_forms", typingStartedAt: "2026-09-14T10:01:00.000Z", typingStartedBy: "דנה מקלידה" };
assert(sandbox.isPreparingFormsOps(prepOps) === true, "הכנת טפסים מזוהה");
assert(sandbox.isWaitingTypingOps(prepOps) === false, "הכנה אינה מצב המתנה");

const signed = { resultStatus: "pendingSignatures", liveState: "preparing_forms", typingStartedAt: "2026-09-14T10:01:00.000Z" };
assert(sandbox.isPreparingFormsOps(signed) === false, "אחרי סימון הוקלד לא נשארים בהכנת טפסים");

const rec = { payload: { opsProcess: { resultStatus: "pendingTyping", liveState: "waiting_typing" } } };
assert(sandbox.beginCustomerTypingPrep(rec) === true, "פתיחה ראשונה מסמנת הכנה");
assert(rec.payload.opsProcess.liveState === "preparing_forms", "liveState עובר להכנת טפסים");
assert(rec.payload.opsProcess.typingStartedBy === "דנה מקלידה", "נשמר שם הנציג המבצע");
assert(sandbox.beginCustomerTypingPrep(rec) === false, "פתיחה חוזרת של אותו נציג לא דורסת");

const waitView = sandbox.getHeroCallTimerView(null, { liveKey: "waiting_typing" });
assert(waitView.mode === "waiting" && waitView.status === "ממתין להקלדה", "שעון ממתין להקלדה");
const prepView = sandbox.getHeroCallTimerView(null, { liveKey: "preparing_forms", ownerText: "דנה מקלידה" });
assert(prepView.mode === "preparing" && prepView.status === "לקוח בהכנת טפסים", "שעון בהכנת טפסים");
assert(String(prepView.stepKicker).indexOf("דנה מקלידה") >= 0, "השעון מציג את שם הנציג");
assert(sandbox.getCustomerFileOpsBadge({ liveKey: "waiting_typing" }) === "ממתין להקלדה", "תג תפעול ממתין להקלדה");
assert(sandbox.getCustomerFileOpsBadge({ liveKey: "preparing_forms", liveLabel: "לקוח בהכנת טפסים · דנה מקלידה" }).indexOf("בהכנת טפסים") >= 0, "תג תפעול בהכנת טפסים");
assert(sandbox.getHeroCallTimerView(null, { liveKey: "preparing_forms", finalLabel: "בוצע שיקוף · ממתין לחתימות", resultKey: "pendingSignatures" }).mode === "hidden", "אחרי הקלדה השעון לא נשאר על הכנת טפסים");
assert(sandbox.getCustomerFileOpsBadge({ liveKey: "preparing_forms", finalLabel: "בוצע שיקוף · ממתין לחתימות" }) === "בוצע שיקוף · ממתין לחתימות", "אחרי הקלדה התג חוזר לתוצאת תפעול");

const salesAuth = {};
vm.runInNewContext(`
  function safeTrim(v){ return String(v == null ? "" : v).trim(); }
  function nowISO(){ return "2026-09-14T10:00:00.000Z"; }
  const Auth = { current: { name: "נציג מכירות" }, isOps(){ return false; }, isOpsAgent(){ return false; } };
  function ensureOpsProcess(rec){
    if(!rec.payload.opsProcess) rec.payload.opsProcess = {};
    return rec.payload.opsProcess;
  }
  function setOpsTouch(rec, patch){
    const store = ensureOpsProcess(rec);
    Object.assign(store, patch || {});
    return store;
  }
  ${helperSrc}
  this.beginCustomerTypingPrep = beginCustomerTypingPrep;
`, salesAuth);
const salesRec = { payload: { opsProcess: { resultStatus: "pendingTyping", liveState: "waiting_typing" } } };
assert(salesAuth.beginCustomerTypingPrep(salesRec) === false, "נציג מכירות לא משנה לסטטוס הכנת טפסים");
assert(salesRec.payload.opsProcess.liveState === "waiting_typing", "המתנה נשמרת אם לא נציג תפעול");

if(failed){
  console.error("\nFAILED " + failed + " / passed " + passed);
  process.exit(1);
}
console.log("\nOK  " + passed + " assertions");
