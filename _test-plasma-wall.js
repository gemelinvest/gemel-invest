/* GI-OPS 2026-10-10 — מסך פלזמה חי למוקד שירות ותפעול
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

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "plasma.js")]).status === 0, "node --check plasma.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-plasma-wall.js")]).status === 0, "node --check this test");

console.log("\n2) כותרות לפי האישור");
assert(html.includes("מוקד שירות ותפעול"), "כותרת מוקד שירות ותפעול");
assert(html.includes("כעת בשיחה"), "כעת בשיחה");
assert(html.includes("זמן המתנה ממוצע"), "זמן המתנה ממוצע");
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
assert(css.includes("--navy:#0d4c86"), "פס כחול כהה כמו לוח המוקד");
assert(js.includes("1920") && js.includes("1080"), "קנבס טלוויזיה");
assert(css.includes("@keyframes page"), "דפי התיקייה מדפדפים");
assert(css.includes("@keyframes soon"), "הבהוב למתקרב למועד");
assert(html.includes("logo-login-clean.png"), "לוגו המערכת");

if (failed) {
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed);
