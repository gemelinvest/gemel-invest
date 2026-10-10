/* GI-OPS 2026-10-10 — מסך פלזמה חי למוקד שירות ותפעול
   הרצה: node _test-plasma-wall.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
let failed = 0;
let passed = 0;

function assert(cond, msg) {
  if (cond) {
    passed += 1;
    console.log("  PASS  " + msg);
  } else {
    failed += 1;
    console.error("  FAIL  " + msg);
  }
}

function read(name) {
  return fs.readFileSync(path.join(ROOT, name), "utf8");
}

const html = read("plasma.html");
const css = read("plasma.css");
const js = read("plasma.js");

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "plasma.js")]).status === 0, "node --check plasma.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-plasma-wall.js")]).status === 0, "node --check this test");

console.log("\n2) כותרות לפי האישור");
assert(html.includes("מוקד שירות ותפעול"), "כותרת מוקד שירות ותפעול");
assert(html.includes("כעת בשיחה"), "כעת בשיחה");
assert(html.includes("שיקופים שבוצעו"), "שיקופים שבוצעו");
assert(html.includes('id="kpiDone"'), "מונה שיקופים שהושלמו");
assert(!html.includes("זמן המתנה ממוצע"), "אין כרטיס זמן המתנה ממוצע");
assert(html.includes("נציגים במשמרת"), "נציגים במשמרת");
assert(html.includes("מצטיין יומי"), "מצטיין יומי");
assert(html.includes("לקוחות ממתינים בתור"), "טבלת ממתינים");
assert(html.includes("לקוחות בשיחה כעת"), "לקוחות בשיחה כעת");
assert(html.includes("שלב בשיחה"), "שלב בשיחה");
assert(html.includes("הלקוח הבא בתור"), "הלקוח הבא בתור");
assert(html.includes("נכנס תיק חדש לשיקוף"), "קפיצת תיק חדש");
assert(html.includes('id="greet"'), "ברכת יום");

console.log("\n3) נתונים חיים, לא הדגמה");
assert(js.includes("vhvlkerectggovfihjgm.supabase.co"), "חיבור למערכת");
assert(js.includes("gi_daily_sales_by_agent"), "מצטיין יומי מהמכירות");
assert(js.includes("gi_agent_live"), "נציגים מחוברים");
assert(js.includes("submittedToOpsAt"), "תור שיקוף אמיתי");
assert(js.includes("waitingMirrorAt"), "זמן המתנה מחותמת הכניסה לתור");
assert(js.includes("POP_MS = 5000"), "התיקייה נשארת 5 שניות");
assert(js.includes("popQueue"), "תיקים נכנסים אחד אחרי השני");
assert(!js.includes("דוד כהן") && !js.includes("נועה לוי"), "אין שמות הדגמה");
assert(js.includes("postgres_changes"), "עדכון אוטומטי בלי רענון");

console.log("\n4) עיצוב מסך");
assert(css.includes("--navy:#3870ED"), "כחול תפריט הצד");
assert(!css.includes("#0d4c86") && !html.includes("#0c447c"), "אין כחול כהה ישן");
assert(js.includes("1920") && js.includes("1080"), "קנבס טלוויזיה");
assert(js.includes("translate(") && css.includes("transform-origin:0 0"), "המסך ממורכז בחלון ולא נחתך");
assert(css.includes("@keyframes page"), "דפי התיקייה מדפדפים");
assert(css.includes("@keyframes soon"), "הבהוב למתקרב למועד");
assert(html.includes("logo-login-clean.png"), "לוגו המערכת");
assert(html.includes('id="clockHour"') && html.includes('id="clockMin"') && html.includes('id="clockSec"'), "שעון: שעות, דקות ושניות");
assert(html.includes('class="colon"'), "נקודתיים כחולות");
assert(html.includes("clock__date"), "תאריך עם אייקון יומן");
assert(js.includes("premiumAfterDiscountValue"), "פרמיית פוליסות מוצעות");
assert(js.includes("payload->newPolicies"), "שליפת פוליסות מוצעות");
assert(js.includes('origin || "") === "existing"'), "פוליסות קיימות לא נספרות");
var body = html.slice(html.indexOf('class="body"'));
assert(body.indexOf("לקוחות בשיחה כעת") >= 0 && body.indexOf("לקוחות בשיחה כעת") < body.indexOf("לקוחות ממתינים בתור"), "שיחות בטבלה הגדולה והתור ברצועה");
assert(html.includes("פרמיה") && html.includes("מועד שיחה"), "עמודות תור: פרמיה ומועד");
assert(html.includes('id="radioAudio"') && html.includes('id="radioMenu"'), "בורר רדיו על המסך");
assert(js.includes("glzwizzlv.bynetcdn.com/glglz_mp3"), "שידור גלגל״צ");
assert(js.includes("1075.livecdn.biz/radiohaifa"), "שידור רדיו חיפה");
assert(js.includes("glglz_hits_mp3") && js.includes("glglz_med_mp3") && js.includes("glglz_rock_mp3"), "ערוצי מוזיקה בלי שדרן");
assert(js.includes('group: "music"') && js.includes("מוזיקה בלבד"), "קבוצת מוזיקה בלבד");
assert(!js.includes("spotify") && !js.includes("spotify.com"), "בלי ספוטיפיי");
var brand = html.slice(html.indexOf('class="top__brand"'), html.indexOf('class="top__greet"'));
assert(brand.indexOf("logo-login-clean.png") < brand.indexOf("מוקד שירות ותפעול"), "לוגו משמאל לכותרת");
assert(html.includes('id="fsBtn"') && js.includes("requestFullscreen") && js.includes("exitFullscreen"), "לחצן מסך מלא");
assert(css.includes("--call-cols:") && css.includes("font-size:30px") && css.includes("font-size:28px") && css.includes("font-size:22px"), "טבלת השיחות גדולה והעמודות משותפות");
assert(js.includes("mirrorSummaryAt") && js.includes("דוח תיקוני הצעה") && js.includes("ביטוחים קיימים"), "שלב השיחה נלקח מהמסך הפתוח");
assert(!js.includes("kpiWait"), "מונה ההמתנה הממוצע ירד");

const app = read("app.js");
const summaryOpen = app.slice(app.indexOf("openMirrorSummaryReport(rec){"), app.indexOf("closeMirrorSummaryReport(){"));
assert(summaryOpen.includes("_stampMirrorSummaryReached"), "סיים שיקוף חותם שהלקוח הגיע לדוח התיקונים");
assert(app.includes("store.mirrorSummaryAt = now"), "חותמת השיקוף שנפתח נשמרת בתיק");
const stopAt = app.indexOf("stopCall(){");
const stopBody = app.slice(stopAt, stopAt + 1600);
assert(!stopBody.includes("mirrorSummaryAt"), "סיים שיחה לא נספר כשיקוף שהושלם");
assert(app.includes("store.needsSubPhase = nextSub") && app.includes("store.flowStepKey = nextKey"), "מסך המשנה נשמר עם שלב השיחה");

const stageSrc = js.slice(js.indexOf("function trim(value)"), js.indexOf("function signStage"));
const stageBox = { trim: null, stageText: null, SCREEN: null };
vm.createContext(stageBox);
vm.runInContext(stageSrc + "\nthis.trim = trim; this.stageText = stageText;", stageBox);
assert(stageBox.stageText({ uiPhase: "idle", stepLabel: "הצגה עצמית" }) === "הצגה עצמית", "פתיחה נשארת הצגה עצמית");
assert(stageBox.stageText({ uiPhase: "personalVerify", stepLabel: "הצגה עצמית" }) === "פרטי מבוטח/ים", "שלב תקוע לא גובר על המסך הפתוח");
assert(stageBox.stageText({ uiPhase: "step2", needsSub: "existing", stepLabel: "בירור והתאמת צרכים" }) === "ביטוחים קיימים", "מסך משנה מדויק");
assert(stageBox.stageText({ uiPhase: "step2", stepKey: "offer", stepLabel: "הצגה עצמית" }) === "פוליסות מוצעות", "מפתח המסך מדויק");
assert(stageBox.stageText({ uiPhase: "mirrorSummaryReport", stepLabel: "סיכום והצהרות" }) === "דוח תיקוני הצעה", "דוח התיקונים הוא סיום השיקוף");

if (failed) {
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed);
