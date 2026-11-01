/* טופ בר, שדה חיפוש, לוגו צד וכרטיסיות דשבורד תפעול.
   הרצה: node _test-topbar-ops-cards.js
*/
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const lit = fs.readFileSync(path.join(ROOT, "gi-navy-lit.css"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "app.css"), "utf8");
const theme = fs.readFileSync(path.join(ROOT, "theme.css"), "utf8");
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

console.log("1) אייקוני הטופ בר");
assert(lit.includes(".topbar__actions .lcTopBtn:not(#\\9):not(#\\9):not(#\\9)"), "כל לחצני הטופ בר");
assert(lit.includes("color: #1E5AA3 !important;"), "נאבי בהיר במנוחה");
assert(lit.includes("color: #2A6BB8 !important;"), "גוון בהיר יותר במעבר");
assert(lit.includes(".topbar__actions .giReminderFab__badge") && lit.includes("color: #FFFFFF !important;"), "עיגול ההתראה נשאר לבן");

console.log("\n2) שדה החיפוש");
assert(lit.includes(".giTopSearch__input:not(#\\9):not(#\\9):not(#\\9)::placeholder"), "גם טקסט ההנחיה");
assert(lit.includes("color: #12345F !important;"), "הכיתוב בנאבי");
assert(lit.includes("border: 2px solid #8AA0B8 !important;"), "המסגרת מעט חזקה יותר");
assert(!lit.includes(".giTopSearch__icon"), "אייקון החיפוש לא נצבע מחדש");

console.log("\n3) לוגו תפריט הצד");
assert(lit.includes("body:not(.sidebar-collapsed) .sidebar .topbarBrand--sidebar > .topbarBrand__img") && lit.includes("width: min(100%, 96px);"), "הלוגו הפתוח 96 פיקסלים");
assert(theme.includes("width: 56px !important;"), "הלוגו במצב מכווץ נשאר");
assert(css.includes("width:min(100%, 96px);"), "גם כלל הסרגל הפתוח");

console.log("\n4) כרטיסיות תפעול");
assert(lit.includes("#view-dashboard .opsDash__kpis--3:not(#\\9):not(#\\9)"), "הרצועה המחוברת נפתחת לכרטיסים");
assert(lit.includes("border-radius: 20px !important;"), "פינות מעוגלות כמו אצל הנציג");
assert(lit.includes("background-clip: text !important;"), "המספר בנאבי המואר");
assert(lit.includes(".opsDashKpi--navy") && lit.includes(".opsDashKpi--amber") && lit.includes(".opsDashKpi--slate"), "ציור לכל אחת משלוש הכרטיסיות");
assert(css.includes("#view-dashboard .opsDash__kpis--3{"), "רשת שלוש הקוביות נשארה");
assert(css.includes(".opsDashKpi--navy::before{ background:#17324d; }"), "כלל הפס הישן נשאר בקובץ");

console.log(failed ? "\nFAILED " + failed : "\nOK " + passed);
process.exit(failed ? 1 : 0);
