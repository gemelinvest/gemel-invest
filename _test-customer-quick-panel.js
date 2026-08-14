/* GI-FIX 2026-08-13 — רגרסיה: כרטיס פרטים אישיים (עיצוב בלבד, בלי שינוי לוגיקה).
   הרצה: node _test-customer-quick-panel.js
*/
"use strict";

const fs = require("fs");
const path = require("path");

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
const css = read("gi-customers-import.css");
const flat = read("theme-unify-flat.css");

const start = app.indexOf("const CustomerQuickPanel = {");
const end = app.indexOf("function ciCopyToClipboard");
assert(start > 0 && end > start, "בלוק CustomerQuickPanel נמצא ב-app.js");
const block = start > 0 && end > start ? app.slice(start, end) : "";

console.log("\nלוגיקה שלא אמורה להשתנות");
assert(block.includes("Storage.loadSingleRow(SUPABASE_TABLES.customers, id, \"*\")"), "open טוען שורה מלאה מהשרת");
assert(block.includes("Storage.mapCustomerRow(res.data, 0)"), "open ממפה את שורת הלקוח");
assert(block.includes("CustomersUI.openByIdWithLoader(id)"), "פתח תיק מלא קורא ל-openByIdWithLoader");
assert(block.includes("Storage.upsertSingleRow(SUPABASE_TABLES.customers, row)"), "שמירה עדיין upsert לשרת");
assert(block.includes("payload.importedProfile"), "שמירה מעדכנת importedProfile");
assert(block.includes("payload.primary"), "שמירה מעדכנת primary");
assert(block.includes("ciBuildPrimaryInsured(payload, rec.id)"), "שמירה מסנכרנת מבוטח ראשי");
assert(block.includes("CustomersUI.render({ forceServer: true })"), "אחרי שמירה מרעננים את טבלת הלקוחות");
assert(block.includes("this.enterEditMode()"), "עריכה נשארת enterEditMode");
assert(block.includes("[\"fullName\", \"שם מלא\""), "שדה עריכה: שם מלא");
assert(block.includes("[\"idNumber\", \"תעודת זהות\""), "שדה עריכה: ת״ז");
assert(block.includes("[\"mobile\", \"סלולרי\""), "שדה עריכה: סלולרי");
assert(block.includes("[\"landline\", \"טלפון נוסף\""), "שדה עריכה: טלפון נוסף");
assert(block.includes("[\"email\", \"דוא\\\"ל\""), "שדה עריכה: דוא״ל");
assert(block.includes("[\"gender\", \"מגדר\""), "שדה עריכה: מגדר");
assert(block.includes("[\"birthDate\", \"תאריך לידה\""), "שדה עריכה: תאריך לידה");
assert(block.includes("[\"maritalStatus\", \"מצב משפחתי\""), "שדה עריכה: מצב משפחתי");
assert(block.includes("[\"childrenCount\", \"מספר ילדים\""), "שדה עריכה: מספר ילדים");
assert(block.includes("[\"occupation\", \"מקצוע\""), "שדה עריכה: מקצוע");
assert(block.includes("[\"street\", \"רחוב\""), "שדה עריכה: רחוב");
assert(block.includes("[\"houseNumber\", \"מספר בית\""), "שדה עריכה: מספר בית");
assert(block.includes("[\"apartment\", \"דירה\""), "שדה עריכה: דירה");
assert(block.includes("[\"city\", \"יישוב\""), "שדה עריכה: יישוב");
assert(block.includes("pick(prof.mobile, record.phone, primary.phone)"), "טלפון נמשך מאותם מקורות");
assert(block.includes("ciAgeFromBirthDate(birthDate)"), "גיל מחושב כמו קודם");
assert(app.includes("CustomerQuickPanel.open(customerId)"), "לחיצה על שם בטבלה עדיין פותחת את הפאנל");
assert(app.includes("CustomerQuickPanel.open(openId)"), "לחיצה על שם בתיק המלא עדיין פותחת את הפאנל");

console.log("\nעיצוב שאושר");
assert(!block.includes("if(safeTrim(record.status)) chips.push"), "תג סטטוס הוסר מהכותרת");
assert(block.includes("cqPanel__agent"), "שורה של נציג בכותרת");
assert(block.includes("cqChip--id"), "צ'יפ ת״ז נשאר בכותרת");
assert(block.includes("cqFacts"), "פרטים אישיים ברשת");
assert(!/personalRows = rowsHtml\(\[[\s\S]*\[\"שם מלא\"/.test(block), "שם מלא לא חוזר בגוף הכרטיס");
assert(css.includes("background:#3870ED") && css.includes(".cqPanel__head"), "כותרת בכחול תפריט הצד");
assert(css.includes(".cqPanel .btn--primary{ background:#3870ED"), "כפתור עריכה בכחול תפריט הצד");
assert(flat.includes(".cqPanel__head:not(#\\9):not(#\\9)") && flat.includes("background: #3870ED"), "unify-flat לא דורס את כחול התפריט");
assert(flat.includes(".cqPanel .btn--primary:not(#\\9):not(#\\9)") && flat.includes("background: #3870ED"), "unify-flat: כפתור ראשי בכחול התפריט");
assert(!/^\.cqPanel \.btn:not\(#\\9\):not\(#\\9\),$/m.test(flat.split("כפתורים")[1]?.slice(0, 800) || ""), "cqPanel הוצא מרשימת הכפתורים השטוחים הכללית");

console.log("\n-----");
console.log("passed=" + passed + " failed=" + failed);
process.exit(failed ? 1 : 0);
