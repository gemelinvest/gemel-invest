/* נוסח הקראה בשיקוף:
   סיכום והצהרות (בלוקים 13–16) אחד לאחד,
   ומשפט הפרמיה בראש שלב שינוי או ביטול בעתיד.
   הרצה: node _test-mirror-script-wording.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20261001-file-call-stage-v1";
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

function sliceBetween(src, start, end){
  const a = src.indexOf(start);
  const b = src.indexOf(end, a + start.length);
  if(a < 0 || b < 0) return "";
  return src.slice(a, b).replace(/`\s*\+\s*`/g, "");
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");

console.log("1) syntax and cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(app.includes('const BUILD = "' + TAG + '"'), "BUILD tag");
assert(html.includes("app.js?v=" + TAG), "index app.js cache");
assert(sw.includes("gi-v12-" + TAG), "service-worker cache");

console.log("\n2) בלוק 13 — תחילת ביטוח");
const ins = sliceBetween(app, "_mcInsStartSectionHtml(pols){", "_mcSumToggle(key, on, label){");
const startSentence = "הפוליסה תיכנס לתוקף החל מתאריך ${dateHtml} , או מועד הפקת הפוליסה על-ידי החברה, " +
  "לפי המאוחר מביניהם ובכפוף לאמצעי תשלום תקין, בעת הפקת הפוליסה וכניסתה לתוקף, " +
  "תישלח אליך הודעת SMS מחב' הביטוח, יש לעקוב אחר קבלת הודעה זו.";
assert(ins.includes(startSentence), "משפט התוקף וה-SMS אחד לאחד");
assert(!ins.includes("מחברת הביטוח"), "בלוק 13 בלי «מחברת»");
assert(!ins.includes("קבלת ההודעה"), "בלוק 13 בלי «ההודעה» הישן");
assert(!ins.includes("על ידי החברה"), "בלוק 13 עם מקף ב«על-ידי»");

const sandbox = {};
vm.runInNewContext(`
  function safeTrim(v){ return String(v == null ? "" : v).trim(); }
  function escapeHtml(s){ return String(s == null ? "" : s); }
  const ui = { ${app.slice(app.indexOf("_mcInsStartSectionHtml(pols){"), app.indexOf("_mcSumToggle(key, on, label){"))} };
  this.ui = ui;
`, sandbox);
const filled = sandbox.ui._mcInsStartSectionHtml([{ company: "הפניקס", type: "מחלות קשות", startDate: "01/10/2026" }]);
assert(filled.includes("01/10/2026") && filled.includes("על-ידי החברה"), "התאריך מהתיק נכנס לקו הריק");
assert((filled.match(/הפוליסה תיכנס לתוקף/g) || []).length === 1, "משפט התוקף פעם אחת");
assert(filled.includes("הפניקס · מחלות קשות"), "שם הפוליסה נשאר מעל המשפט");
const empty = sandbox.ui._mcInsStartSectionHtml([{ company: "מנורה", type: "בריאות", startDate: "" }]);
assert(empty.includes("לא הוזן תאריך תחילה"), "בלי תאריך מוצג חסר");

console.log("\n3) בלוקים 14–16");
const body = sliceBetween(app, "_renderInsStartBody(rec){", "_validateSummaryStep(rec){");
assert(body.includes("חשוב לציין כי המידע שמסרת בשיחה, יעובד בהתאם למדיניות הפרטיות של החברה ויועבר לגורמים הרלוונטיים לצורך הנפקת הפוליסה ומתן שירות, <strong>האם אתה מאשר?</strong>"), "פסקת הפרטיות");
assert(body.includes("כל הנאמר בשיחה הינו בכפוף לפוליסה אשר תישלח אליך לאחר קבלתך לביטוח. מסמכי הפוליסה והדיוורים ישלחו אליך לנייד/למייל. תוכל לעדכן בכל שלב את החברה אם תרצה לקבל את הדיווחים לדוא\"ל או בדואר."), "פסקת הדיוור הקבועה");
assert(!body.includes("_mirrorDeliveryLabel"), "הדיוור במסך ההקראה אינו מוחלף מהתיק");
assert(body.includes("רשות שוק ההון הקימה אתר אינטרנט מאובטח שיאפשר לך לראות במרכז את מוצרי הביטוח שלך בכל חברות הביטוח בישראל וזאת על בסיס נתונים שאנחנו נעביר אליהם."), "פתיח הר הביטוח");
assert(body.includes("עליך ליצור קשר עם חברתנו או להודיע עכשיו שאתה מבקש שלא להעביר את הפרטים."), "בחירת אי-העברה");
assert(body.includes("לידיעתך, אי העברת הנתונים תמנע ממך לראות במרכז באתר האינטרנט המאובטח את מוצרי הביטוח שלך בכל חברות הביטוח בישראל."), "סיום הר הביטוח");
assert(body.includes("כמו כן, אני שולח/ת אליך את טופס ההצעה לביטוח שכולל מידע והצהרות שאתה נדרש לאשר בחתימתך."), "פתיח טופס ההצעה");
assert(body.includes("בבקשה תוודא שכל הפרטים נכונים וחשוב מאוד שתקרא את פרק הצהרות המועמד לביטוח."), "בקשת הבדיקה");
assert(body.includes("רק מב\"א/ה לידיעתך שחתימתך בטופס מהווה אישור לנכונותו ולבקשתך להצטרף לביטוח."), "משפט החתימה");
assert(body.includes("<strong>האם אתה מאשר את רכישת הפוליסה ?</strong>"), "שאלת הרכישה עם רווח לפני הסימן");
assert(body.includes("האם יש שאלות נוספות שתרצה לשאול? לכל עניין דבר אתה מוזמן לפנות אלינו לסוכנות בטלפון <span class=\"mcStartDate\">04-6043579</span> תודה רבה והמון בריאות."), "שאלות נוספות והטלפון");
assert(body.includes("סמן שהלקוח אישר") && body.includes("הלקוח מאשר העברת נתונים") && body.includes("כן — הלקוח מאשר"), "סימוני האישור נשארו");
assert(body.includes("13 · תחילת ביטוח") && body.includes("16 · שאלות נוספות"), "התגים נשארו");

console.log("\n4) שלב שינוי או ביטול — המשפט הראשון");
const future = sliceBetween(app, "_renderStep5FutureCancelBody(){", "_renderStep6DisclosureBody(rec){");
const premiumLine = "הפרמיה צמודה למדד ובמידה ולא תהיה תוספת חיתומית או מקצועית ייתכן והגבייה הראשונה תהיה גבייה יחסית או כפולה, בהתאם למועד החיוב הגבייה תתבצע במועד התשלום הקבוע של אמצעי התשלום שלך.";
const cancelLine = "במידה ובעתיד תרצה לעשות שינוי או ביטול";
assert(future.includes(premiumLine), "משפט הפרמיה בראש השלב");
assert(future.indexOf(premiumLine) < future.indexOf(cancelLine), "הפרמיה לפני משפט השינוי");
assert(future.includes("חשוב לי שתדע שתוכל לבטל את כל אחד מהנספחים הכלולים בחבילה בכל עת, בתנאי שנותר מוצר הבסיס."), "משפט הנספחים נשאר");
assert(future.includes("בהמשך אשלח לך מסמך השוואה כתוב"), "מסמך ההשוואה נשאר כשיש קיימים");

console.log("\n5) מסכים אחרים לא הוחלפו");
const issuance = sliceBetween(app, "renderIssuanceStep(rec){", "saveIssuanceStep(){");
assert(issuance.includes("תישלח אליך הודעת SMS מחברת הביטוח"), "כרטיס הכניסה לתוקף הישן נשאר");
assert(app.includes('<div class="emMirror__askText">האם אתה מאשר את רכישת הפוליסה?</div>'), "שאלת הרכישה בשיקוף האלמנטרי בלי רווח");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
