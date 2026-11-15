/* GI-COLLECTION 2026-11-15
   קריאת מייל גבייה: פרטני מול דוח, ת.ז מלאה מול 4 ספרות, בלי לשייך דוח מלא לתיק.
   הרצה: node _test-gi-collection.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const GI = require("./gi-collection.js");

let failed = 0;
let passed = 0;
function assert(cond, msg){
  if(cond){ passed += 1; console.log("  PASS  " + msg); }
  else { failed += 1; console.error("  FAIL  " + msg); }
}

const customers = [
  { id: "c1", fullName: "רחל אזרד", idNumber: "323913061" },
  { id: "c2", fullName: "חיה קוש", idNumber: "215737420" },
  { id: "c3", fullName: "פינטיה אסקייאס", idNumber: "309733061" },
  { id: "c4", fullName: "עותמאן אחמד", idNumber: "111111111" },
  { id: "c5", fullName: "מאמא אדלה", idNumber: "0123452788" },
  { id: "c6", fullName: "מאמא אדלה", idNumber: "9999992788" }
];

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(__dirname, "gi-collection.js")]).status === 0, "gi-collection.js");
assert(spawnSync(process.execPath, ["--check", path.join(__dirname, "app.js")]).status === 0, "app.js");

console.log("\n2) כלל פרטני");
const clal = GI.applyIncoming({
  from: "Clal.Briut@Clal-Ins.co.il",
  subject: 'מכתב ללקוח: "הודעה בגין אי תשלום פרמיות - אמצעי תשלום שלא כובד" העתק לסוכן ע"ש אזרד רחל ת.ז. 323913061',
  body: "פוליסת מדיכלל מס' 122346536 בסכום של 77.13 ₪ לא כובדה מהסיבה: נתקבלה הוראת ביטול חוזרת. בנק הפועלים סניף 721.",
  receivedAt: "2026-11-04T18:43:00+02:00"
}, customers);
assert(clal.assignments.length === 1 && clal.assignments[0].customerId === "c1", "כלל משויך לרחל אזרד");
assert(clal.assignments[0].entry.idNumber === "323913061", "ת.ז מלאה נשמרת בתיק");
assert(clal.assignments[0].entry.policyNumber === "122346536", "מספר פוליסה מהמכתב");
assert(clal.assignments[0].entry.amount === "77.13", "סכום מהמכתב");
assert(clal.assignments[0].entry.reason.indexOf("הוראת ביטול") >= 0, "סיבת ההחזרה");
const clalForward = GI.applyIncoming({
  from: "gviyaas@i-s-f.co.il",
  subject: 'מכתב ללקוח: "הודעה בגין אי תשלום פרמיות - אמצעי תשלום שלא כובד" העתק לסוכן ע"ש אזרד רחל ת.ז. 323913061'
}, customers);
assert(clalForward.assignments.length === 1 && clalForward.assignments[0].customerId === "c1", "העברה מתיבת המשרד עדיין מזהה כלל");
assert(!clal.assignments[0].entry.document, "בלי מסמך לא ממציאים קובץ");

console.log("\n3) הפניקס, איילון, מנורה");
const phoenix = GI.applyIncoming({
  subject: "הודעה על אי תשלום הפניקס",
  body: "עותמאן אחמד שלום, מסמך הודעה על אי תשלום ממתין עבורך באזור האישי באתר הפניקס."
}, customers);
assert(phoenix.assignments.length === 1 && phoenix.assignments[0].customerId === "c4", "הפניקס לפי שם בלבד");
assert(!phoenix.assignments[0].entry.idNumber, "הפניקס בלי ת.ז לא ממציא מספר");
const phoenixAmbiguous = GI.applyIncoming({
  subject: "הודעה על אי תשלום הפניקס",
  body: "עותמאן אחמד שלום"
}, customers.concat([{ id: "c7", fullName: "עותמאן אחמד", idNumber: "222222222" }]));
assert(phoenixAmbiguous.assignments.length === 0 && phoenixAmbiguous.holds[0].reason === "AMBIGUOUS", "שם כפול לא משויך");

const ayalon = GI.applyIncoming({
  from: "גביה א.ס <gviyaas@i-s-f.co.il>",
  subject: "מסמכים משמעותיים הנוגעים ללקוחותיך בקוש חיה 215737420 איילון"
}, customers);
assert(ayalon.assignments.length === 1 && ayalon.assignments[0].customerId === "c2", "איילון לפי נושא");
assert(ayalon.assignments[0].entry.idNumber === "215737420", "ת.ז מלאה של איילון");

const menora = GI.applyIncoming({
  from: "gviyaas@i-s-f.co.il",
  subject: "אסקייאס - פינטיה מנורה 309733061"
}, customers);
assert(menora.assignments.length === 1 && menora.assignments[0].customerId === "c3", "מנורה לפי נושא");

console.log("\n4) מגדל — 4 ספרות, ובלי קובץ הדוח על התיק");
const migdal = GI.applyIncoming({
  from: "gviyaas@i-s-f.co.il",
  subject: "פוליסות לפני ביטול - בריאות וריסק מגדל",
  attachment: { fileName: "migdal.pdf" },
  items: [
    { x: 40, y: 373, text: "170.12" },
    { x: 140, y: 367, text: "ביטול אשראי - חסום" },
    { x: 145, y: 380, text: "החרם כרטיס" },
    { x: 216, y: 373, text: "בריאות" },
    { x: 270, y: 373, text: "24308533" },
    { x: 347, y: 373, text: "אדלה" },
    { x: 407, y: 373, text: "מאמא" },
    { x: 470, y: 373, text: "******2788" },
    { x: 533, y: 373, text: "******2788" }
  ]
}, customers);
assert(migdal.reportFileOmitted === true, "קובץ הדוח לא מועתק לתיק");
assert(migdal.assignments.length === 0 && migdal.holds.some((row) => row.reason === "AMBIGUOUS"), "שם וארבע ספרות כפולים לא משויכים");
const migdalOne = GI.applyIncoming({
  subject: "פוליסות לפני ביטול - בריאות וריסק מגדל",
  items: [
    { x: 40, y: 373, text: "170.12" },
    { x: 216, y: 373, text: "בריאות" },
    { x: 270, y: 373, text: "24308533" },
    { x: 347, y: 373, text: "אדלה" },
    { x: 407, y: 373, text: "מאמא" },
    { x: 470, y: 373, text: "******2788" }
  ]
}, customers.filter((row) => row.id !== "c6"));
assert(migdalOne.assignments.length === 1 && migdalOne.assignments[0].customerId === "c5", "מגדל משויך לפי שם וארבע ספרות");
assert(migdalOne.assignments[0].entry.idLast4 === "2788", "נשמרות רק ארבע ספרות");
assert(!migdalOne.assignments[0].entry.idNumber, "אין ת.ז מלאה בדוח מגדל");
assert(migdalOne.assignments[0].entry.policyNumber === "24308533", "מספר פוליסה מהשורה");
assert(!migdalOne.assignments[0].entry.document, "השורה בלי קובץ הדוח המלא");
const migdalSubjectOnly = GI.applyIncoming({ subject: "פוליסות לפני ביטול - בריאות וריסק מגדל" }, customers);
assert(migdalSubjectOnly.assignments.length === 0 && migdalSubjectOnly.holds[0].reason === "MIGDAL_NEEDS_ROWS", "נושא מגדל בלי שורות לא פותח פנייה");

console.log("\n5) מייל לא מזוהה לא נתלה על תיק");
const unknown = GI.applyIncoming({ from: "gviyaas@i-s-f.co.il", subject: "שלום" }, customers);
assert(unknown.assignments.length === 0 && unknown.holds[0].reason === "NO_COMPANY", "בלי חברה אין שיוך");
assert(!JSON.stringify(unknown.holds).includes("77.13"), "המתנה לא סוחבת סכום של מכתב אחר");

console.log("\n6) החיבור במערכת בלי סיסמה");
const app = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
assert(html.includes('src="./gi-collection.js?'), "הסקריפט נטען");
assert(app.includes("tab('collection', 'גבייה'"), "לשונית גבייה");
assert(app.includes('data-cf-service-toggle='), "פעולות שירות על שורת פרודוקציה");
assert(app.includes('data-cf-service-action="collection"'), "גבייה בתפריט השירות");
assert(app.includes('data-cf-service-action="policy_changes"') && app.includes('data-cf-service-action="claim"'), "שינויים ותביעה מוצגים");
assert(app.includes("openCollectionCustomerList"), "רשימת גבייה בדשבורד");
assert(app.includes("collection_file_download"), "הורדה נרשמת");
assert(app.includes("safeTrim(doc.scope) === \"report\"") || app.includes("safeTrim(row.document.scope) === \"report\""), "דוח מרובה לא יורד מתיק לקוח");
assert(!app.includes("gviyaas") || app.includes("GICollection.MAILBOX") || app.includes("gviyaas@i-s-f.co.il"), "הכתובת בלי סיסמה");
assert(!/password\s*[:=]\s*["'][^"']+["']/i.test(fs.readFileSync(path.join(__dirname, "gi-collection.js"), "utf8")), "אין סיסמה בקורא המייל");
assert(GI.MAILBOX === "gviyaas@i-s-f.co.il", "התיבה המוסכמת");
const weekNow = Date.parse("2026-11-15T12:00:00Z");
assert(Date.parse(GI.weekStart(weekNow)) === weekNow - 7 * 24 * 60 * 60 * 1000, "חלון של שבעה ימים");
assert(GI.withinWeek("2026-11-10T00:00:00Z", weekNow) === true, "מייל מתוך השבוע נכנס");
assert(GI.withinWeek("2026-11-01T00:00:00Z", weekNow) === false, "מייל מלפני השבוע לא נכנס");
assert(GI.withinWeek("", weekNow) === false, "מייל בלי תאריך לא נכנס");
assert(app.includes("data-gi-col-mail-pull"), "כפתור משיכה של שבעה ימים");
assert(app.includes("canConnectCollectionMailbox"), "חיבור התיבה רק למנהל או תפעול");

console.log("\n7) טעינת דוח לפי חברה");
const sheet = GI.applyReport("כלל", GI.parseReportSheet("כלל", [
  ["שם", "ת.ז.", "פוליסה", "סכום", "סיבה"],
  ["רחל אזרד", "323913061", "122346536", "77.13", "הוראת ביטול"],
  ["דנה כהן", "111222333", "99887766", "40", "אין כיסוי"]
]), customers);
assert(sheet.assignments.length === 1 && sheet.assignments[0].customerId === "c1", "דוח כלל פותח פנייה לרחל");
assert(sheet.assignments[0].entry.source === "report" && sheet.assignments[0].entry.idNumber === "323913061", "הפנייה מסומנת כדוח עם ת.ז");
assert(!sheet.assignments[0].entry.document && sheet.reportFileOmitted === true, "קובץ הדוח לא נשמר על התיק");
assert(sheet.holds.some((row) => row.reason === "NO_CUSTOMER" && row.noFile === true && row.name.indexOf("דנה") >= 0), "לקוח חסר נשאר שורה בלי תיק");
const again = GI.applyReport("כלל", GI.parseReportSheet("כלל", [
  ["שם", "ת.ז.", "פוליסה", "סכום"],
  ["אזרד רחל", "323913061", "122346536", "77.13"]
]), customers);
assert(again.assignments[0].entry.id === sheet.assignments[0].entry.id, "אותה שורה בדוח לא מקבלת מזהה חדש");
const twoPolicies = GI.parseReportSheet("איילון", [
  ["שם", "תעודת זהות", "מספר פוליסה"],
  ["חיה קוש", "215737420", "100"],
  ["חיה קוש", "215737420", "200"]
]);
const ayalonReport = GI.applyReport("איילון", twoPolicies, customers);
assert(ayalonReport.assignments.length === 2, "שתי פוליסות נפתחות כשתי פניות");
const textRow = GI.parseReportText("מנורה", "אסקייאס פינטיה ת.ז. 309733061");
assert(textRow.length === 1 && textRow[0].idNumber === "309733061", "שורה טקסטואלית מזהה ת.ז ושם");
const migdalReport = GI.applyReport("מגדל", GI.parseReportItems("מגדל", [
  { x: 40, y: 373, text: "170.12" },
  { x: 216, y: 373, text: "בריאות" },
  { x: 270, y: 373, text: "24308533" },
  { x: 347, y: 373, text: "אדלה" },
  { x: 407, y: 373, text: "מאמא" },
  { x: 470, y: 373, text: "******2788" }
]), customers.filter((row) => row.id !== "c6"));
assert(migdalReport.assignments.length === 1 && migdalReport.assignments[0].customerId === "c5", "דוח מגדל משויך לפי שם וארבע ספרות");
assert(!migdalReport.assignments[0].entry.document, "גם בטעינה ידנית דוח מגדל לא נשמר על התיק");
assert(GI.applyReport("", [], customers).holds[0].reason === "NO_COMPANY", "בלי חברה אין טעינה");
assert(GI.parseReportSheet("כלל", [["שם", "ת.ז."], ["שם", "ת.ז."]]).length === 0, "שורת כותרת לא נפתחת כלקוח");
assert(app.includes("data-gi-col-report-company") && app.includes("data-gi-col-report-load"), "במסך בוחרים חברה ואז טוענים");
assert(app.includes("canUploadCollectionReport") && app.includes("isOpsAgent"), "מנהל, תפעול ושירות יכולים לטעון");
assert(app.includes("ללא תיק"), "לקוח בלי תיק מופיע בלי כניסה לתיק");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed);
