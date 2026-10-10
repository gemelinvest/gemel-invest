/* GI-OPS 2026-10-10 — מסך פלזמה למוקד: קיר חי + חדר שיקוף
   הרצה: node _test-plasma-wall.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
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
const manifest = read("plasma.webmanifest");

console.log("1) syntax + files");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "plasma.js")]).status === 0, "node --check plasma.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-plasma-wall.js")]).status === 0, "node --check this test");
assert(html.includes("logo-login-clean.png"), "לוגו המערכת במסך");
assert(html.includes('dir="rtl"'), "עמוד RTL");
assert(manifest.includes("fullscreen"), "מניפסט למסך מלא בטלוויזיה");

console.log("\n2) מוקד — לא דשבורד");
assert(html.includes("נציגים במשמרת"), "רשת נציגים");
assert(html.includes("ממתינים שיקוף"), "תור ממתינים שיקוף");
assert(html.includes("ממתינים שירות"), "תור ממתינים שירות");
assert(html.includes("מבזק"), "פס מבזק");
assert(html.includes("שיחת שיקוף חיה"), "ספוטלייט שיחה חיה");
assert(!html.includes("kpiCard") && !css.includes("opsDash"), "אין כרטיסי דשבורד של המערכת");

console.log("\n3) חדר שיקוף");
assert(html.includes("view--or"), "תצוגת חדר שיקוף");
assert(js.includes('view === "or"') || js.includes('raw === "or"'), "פתיחה עם ?view=or");
assert(html.includes("בשיחת שיקוף עם"), "שם נציג מול לקוח");
assert(css.includes(".or__agent"), "טיפוגרפיה גדולה לחדר");

console.log("\n4) שידור וקנבס טלוויזיה");
assert(js.includes("1920") && js.includes("1080"), "קנבס 1920×1080");
assert(js.includes("transform") && js.includes("scale"), "התאמה לרזולוציה בסקאלה");
assert(css.includes("@keyframes ticker"), "אנימציית מבזק");
assert(css.includes("@keyframes led"), "פעימת LIVE");
assert(js.includes("מבזק זמני"), "משפט מבזק זמני");

if (failed) {
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed);
