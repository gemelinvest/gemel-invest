/* אזור שירות לפי התמונה שאושרה, ולוגו ONYX בחלון טעינת התיק.
   בלי שינוי לוגיקה: אותם נושאים, אותה ספירה, אותה לחיצה.
   הרצה: node _test-service-cube-loader-logo.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

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

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const theme = fs.readFileSync(path.join(ROOT, "theme.css"), "utf8");

function sliceBetween(src, start, end){
  const i = src.indexOf(start);
  const j = src.indexOf(end, i + start.length);
  return i >= 0 && j > i ? src.slice(i, j) : "";
}

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");

console.log("\n2) service topics and clicks stay");
const cube = sliceBetween(app, "renderAgentServiceCubeHtml(){", "agentOpsBucketLabel(key){");
assert(cube.includes('key: "collection", label: "גבייה"'), "גבייה");
assert(cube.includes('key: "claims", label: "תביעות"'), "תביעות");
assert(cube.includes('key: "policy_changes", label: "שינויים בפוליסה"'), "שינויים בפוליסה");
assert(cube.includes('key: "service_requests", label: "פניות לשירות"'), "פניות לשירות");
assert(cube.includes("this.collectionOpenCustomers().length"), "ספירת גבייה מאותו מקור");
assert(cube.includes("data-agent-service-topic="), "לחיצה נשארת על אותו מאפיין");
assert(cube.includes("bankServiceCube__count"), "המספר עדיין מצויר");
assert(app.includes('this.openAgentServiceTopic(svcBtn.getAttribute("data-agent-service-topic"))'), "פתיחת הנושא נשארת");
assert(cube.includes('aria-label="שירות"'), "כותרת האזור נשארת שירות");

console.log("\n3) approved service icons stay");
assert(cube.includes("<ellipse") && cube.includes("M14 3v5h5") && cube.includes("M16.5 3.5") && cube.includes("M4 13a8 8 0"), "ארבעת האייקונים");
assert(cube.includes("M9 6l6 6-6 6") && !cube.includes("&gt;"), "החץ פונה ימינה ולא מתהפך בעברית");
assert(theme.includes("GI-SERVICE-CUBE 2026-11-15"), "סימון העיצוב");
assert(theme.includes("background: #f6f8fc !important;"), "שורות אפורות מעוגלות");
assert(theme.includes("background: #d8f3ee !important; color: #0d9488 !important;"), "עיגול גבייה");
assert(theme.includes("background: #ffedd5 !important; color: #ea580c !important;"), "עיגול תביעות");
assert(theme.includes("background: #e0e7ff !important; color: #4f46e5 !important;"), "עיגול שינויים");
assert(theme.includes("background: #ffe4e6 !important; color: #e11d48 !important;"), "עיגול פניות");
assert(theme.includes("GI-SERVICE-CUBE 2026-11-15") && theme.includes("background: #d8f3ee !important; color: #0d9488 !important;"), "שירות נשאר בעיצוב שאושר");

console.log("\n4) loader logo only");
const loader = sliceBetween(html, 'id="customerLoader"', 'id="customerPolicyModal"');
assert(loader.includes("טוען תיק לקוח"), "הכותרת נשארת");
assert(loader.includes("אנו מכינים עבורך את נתוני הלקוח"), "שורת המשנה נשארת");
assert(loader.includes('class="customerLoader__brandLogo"') && loader.includes("onyx-sidebar-logo.png"), "לוגו המערכת במקום המילים");
assert(!loader.includes("GEMEL INVEST"), "המילים הוסרו מחלון הטעינה");
assert(html.includes('<div class="modal__kicker">GEMEL INVEST</div>'), "שאר המסכים לא נוקו");

console.log("\n" + (failed ? "FAILED " + failed : "OK " + passed));
process.exit(failed ? 1 : 0);
