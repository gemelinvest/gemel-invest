/* לוגו תפריט הצד הוחלף לקובץ הכחול וקטן ל-80 פיקסלים.
   לוגו הטעינה וההתחברות נשארים.
   הרצה: node _test-sidebar-logo-blue.js
*/
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
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

function sliceBetween(src, start, end){
  const i = src.indexOf(start);
  const j = src.indexOf(end, i + start.length);
  return i >= 0 && j > i ? src.slice(i, j) : "";
}

console.log("1) sidebar image only");
const side = sliceBetween(html, 'class="topbarBrand topbarBrand--sidebar"', "</div>");
assert(side.includes("onyx-sidebar-logo-blue.png"), "תפריט הצד משתמש בלוגו החדש");
assert(!side.includes("onyx-sidebar-logo.png"), "תפריט הצד לא נשאר על הלוגו הקודם");
assert(fs.existsSync(path.join(ROOT, "assets/onyx-sidebar-logo-blue.png")), "קובץ הלוגו קיים");

console.log("\n2) other logos stay");
const loader = sliceBetween(html, 'id="customerLoader"', 'id="customerPolicyModal"');
assert(loader.includes("onyx-sidebar-logo.png") && !loader.includes("onyx-sidebar-logo-blue.png"), "חלון הטעינה נשאר על הלוגו הקודם");
assert(html.includes("onyx-login-logo.png"), "לוגו ההתחברות נשאר");

console.log("\n3) open logo is a bit smaller; collapsed stays");
assert(theme.includes("width: min(100%, 80px);"), "הלוגו הפתוח 80 פיקסלים");
assert(theme.includes("width: 56px !important;"), "הלוגו המכווץ נשאר 56");

console.log("\n" + (failed ? "FAILED " + failed : "OK " + passed));
process.exit(failed ? 1 : 0);
