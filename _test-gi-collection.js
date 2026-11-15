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
const letterRow = [
  { x: 551, y: 285, text: "0" }, { x: 545, y: 285, text: "5" }, { x: 539, y: 285, text: "3" }, { x: 533, y: 285, text: "7" },
  { x: 528, y: 285, text: "*" }, { x: 524, y: 285, text: "*" }, { x: 520, y: 285, text: "*" }, { x: 515, y: 285, text: "*" }, { x: 511, y: 285, text: "*" }, { x: 507, y: 285, text: "*" },
  { x: 489, y: 285, text: "4" }, { x: 483, y: 285, text: "5" }, { x: 476, y: 285, text: "0" }, { x: 470, y: 285, text: "1" },
  { x: 466, y: 285, text: "*" }, { x: 462, y: 285, text: "*" }, { x: 458, y: 285, text: "*" }, { x: 453, y: 285, text: "*" }, { x: 449, y: 285, text: "*" }, { x: 445, y: 285, text: "*" },
  { x: 426, y: 285, text: "א" }, { x: 420, y: 285, text: "ס" }, { x: 417, y: 285, text: "י" }, { x: 411, y: 285, text: "ה" },
  { x: 365, y: 285, text: "א" }, { x: 359, y: 285, text: "ל" }, { x: 350, y: 285, text: "נ" }, { x: 343, y: 285, text: "ע" }, { x: 340, y: 285, text: "מ" }, { x: 336, y: 285, text: "י" },
  { x: 303, y: 285, text: "1" }, { x: 297, y: 285, text: "2" }, { x: 290, y: 285, text: "9" }, { x: 284, y: 285, text: "0" },
  { x: 278, y: 285, text: "6" }, { x: 272, y: 285, text: "3" }, { x: 266, y: 285, text: "4" }, { x: 260, y: 285, text: "2" },
  { x: 240, y: 285, text: "ב" }, { x: 232, y: 285, text: "י" }, { x: 223, y: 285, text: "ו" }, { x: 216, y: 285, text: "ת" }
];
const parsedLetter = GI.parseMigdalItems(letterRow);
assert(parsedLetter.length === 1 && parsedLetter[0].idLast4 === "1054", "נלקחות 4 הספרות של המבוטח, לא של המשפחה");
assert(parsedLetter[0].familyLast4 === "7350" && parsedLetter[0].familyLast4 !== parsedLetter[0].idLast4, "תעודת המשפחה נשמרת בנפרד ולא משמשת לזיהוי");
assert(parsedLetter[0].policyNumber === "24360921", "מספר הפוליסה נקרא משמאל לימין");
const byLast4 = GI.matchCustomers({ company: "מגדל", idLast4: "1054", policyNumber: "24360921", name: "מישהו אחר" }, [
  { id: "m1", fullName: "אסיה אלנעמי", idNumber: "000001054" }
]);
assert(byLast4.status === "unique" && byLast4.customer.id === "m1", "4 ספרות ייחודיות פותחות את התיק");
const byPolicy = GI.matchCustomers({ company: "מגדל", idLast4: "", policyNumber: "24360921", name: "" }, [
  { id: "m1", fullName: "אסיה אלנעמי", idNumber: "000009999", policyNumbers: ["24360921"] },
  { id: "m2", fullName: "אחר", idNumber: "000001111", policyNumbers: ["11111111"] }
]);
assert(byPolicy.status === "unique" && byPolicy.customer.id === "m1", "בלי 4 ספרות התיק נפתח לפי מספר פוליסה");
const noKey = GI.matchCustomers({ company: "מגדל", name: "אסיה אלנעמי" }, [
  { id: "m1", fullName: "אסיה אלנעמי", idNumber: "000001054" }
]);
assert(noKey.status === "NO_IDENTITY", "בלי 4 ספרות ובלי פוליסה לא נפתח תיק מגדל");
const narrowed = GI.matchCustomers({ company: "מגדל", idLast4: "2788", policyNumber: "24308533" }, [
  { id: "a", fullName: "אחת", idNumber: "111112788", policyNumbers: ["111"] },
  { id: "b", fullName: "שתיים", idNumber: "222222788", policyNumbers: ["24308533"] }
]);
assert(narrowed.status === "unique" && narrowed.customer.id === "b", "כמה תיקים עם אותן 4 ספרות מוכרעים לפי הפוליסה");
const familyFile = GI.matchCustomers({ company: "מגדל", idLast4: "1054", policyNumber: "24360921" }, [
  { id: "main", fullName: "נוח אלנעמי", idNumber: "000005180", payload: { insureds: [
    { data: { idNumber: "111111054", existingPolicies: [{ policyNumber: "24360921" }] } }
  ] } }
]);
assert(familyFile.status === "unique" && familyFile.customer.id === "main", "4 ספרות של מבוטח בתיק, לא רק של בעל התיק");
const policyOnFile = GI.matchCustomers({ company: "מגדל", policyNumber: "24360921" }, [
  { id: "main", fullName: "נוח אלנעמי", idNumber: "000009999", payload: { insureds: [
    { data: { existingPolicies: [{ policyNumber: "24360921" }] } }
  ] } }
]);
assert(policyOnFile.status === "unique" && policyOnFile.customer.id === "main", "פוליסה מתוך התיק פותחת אותו");
const mergedRoster = GI.mergeMatchCustomers([
  [{ id: "main", idNumber: "000005180" }],
  [{ id: "main", idNumber: "000005180", payload: { insureds: [{ data: { idNumber: "111111054" } }] } }]
]);
assert(mergedRoster.length === 1 && mergedRoster[0].payload.insureds.length === 1, "אותו תיק לא נספר פעמיים");

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
assert(app.includes("pageNo * 2000"), "עמודי הדוח לא מתערבבים");
assert(app.includes("lookupCollectionCustomers") && app.includes("הדוח עדיין נקרא"), "הטעינה מחפשת בכל ספר הלקוחות ומראה שהיא עובדת");
assert(app.includes("canUploadCollectionReport") && app.includes("isOpsAgent"), "מנהל, תפעול ושירות יכולים לטעון");
assert(app.includes("ללא תיק"), "לקוח בלי תיק מופיע בלי כניסה לתיק");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed);
