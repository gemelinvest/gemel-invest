/* חלון הקמת הצעה: נאבי מואר בלי קווים, בלי GEMEL INVEST ובלי תוויות זמין עכשיו.
   הרצה: node _test-proposal-modal-navy.js
*/
"use strict";

const fs = require("fs");
const path = require("path");

const root = __dirname;
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const lit = fs.readFileSync(path.join(root, "gi-navy-lit.css"), "utf8");

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
  const i = src.indexOf(start);
  const j = src.indexOf(end, i + start.length);
  return i >= 0 && j > i ? src.slice(i, j) : "";
}

const modal = sliceBetween(html, 'id="lcNewCustomerTypeModal"', 'id="lcWizard"');
console.log("1) טקסטים בחלון");
assert(modal.includes("במה נוכל לעזור היום?"), "השאלה נשארת");
assert(!modal.includes("GEMEL INVEST"), "GEMEL INVEST הוסר מהחלון");
assert(!modal.includes("בחר את תחום ההצעה"), "שורת בחירת התחום הוסרה");
assert(!modal.includes(">זמין עכשיו<"), "תוויות זמין עכשיו הוסרו");
assert(modal.includes("בפיתוח"), "תווית בפיתוח נשארת");
assert(modal.includes("בריאות וסיכונים") && modal.includes("אלמנטרי") && modal.includes("פנסיה"), "שלוש הכרטיסיות נשארות");
assert(html.includes('class="lcHrChoiceCard__pill">זמין עכשיו</span>'), "התווית במסך הבחירה שאחרי נשארת");

console.log("\n2) רקע");
const block = lit.slice(lit.indexOf("חלון הקמת הצעה"));
assert(block.includes("background-image: var(--gi-lit-fill) !important;"), "תאורה בלי שכבת קווים");
assert(!block.includes("--gi-lit-lines"), "אין קווים על החלון");
assert(block.includes("text-align: right !important;"), "השאלה בצד ימין");
assert(block.includes("color: #fff !important;"), "השאלה בהירה");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
