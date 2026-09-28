/* פוליסות קיימות, מייל לא חוסם, טופס מקורי עריך, וכיסוי שאלוני המשך.
   הרצה: node _test-ops-mirror-forms-rows.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "app.css"), "utf8");
let failed = 0;
let passed = 0;

function assert(cond, msg){
  if(cond){ passed += 1; console.log("  PASS  " + msg); }
  else { failed += 1; console.error("  FAIL  " + msg); }
}

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");

console.log("\n2) שורות פוליסות קיימות");
assert(css.includes(".mcPolicyRowList{\n  gap:14px;"), "רווח בין שורות");
assert(css.includes(".mcPolicyRowList .mcPolicyRow__cell--money"), "פרמיה לא על רקע כחול");
assert(css.includes(".mcPolicyRowList .mcStartDate{\n  color:#0f2744;\n  background:transparent;"), "מספר הפרמיה כהה על רקע שקוף");
assert(/\.mcPolicyRow__cell\{[\s\S]*font-weight:500;[\s\S]*font-size:16px;/.test(css), "כתב גדול ופחות עבה");

console.log("\n3) שדה ריק ומייל לא חוסמים");
const cont = app.slice(app.indexOf("async onVerifyPersonalContinue(){"), app.indexOf("_renderNeedsExisting", app.indexOf("async onVerifyPersonalContinue(){")));
assert(!cont.includes('חסר מייל'), "אין מייל לא עוצר");
assert(!cont.includes("יש להשלים שדות חסרים לפני המשך"), "שדה ריק לא עוצר");
assert(cont.includes("מייל לא תקין"), "מייל שגוי עדיין נעצר");
assert(app.includes("d.healthFund") && app.includes('textField("קופת חולים"'), "קופת חולים נשאבת מהאשף");
assert(app.includes('textField("טלפון"') && app.includes('textField("מין"'), "טלפון ומין נשאבים");

console.log("\n4) טופס מקורי עריך");
assert(app.includes("useOriginalForm: pdfBytes.length > 0"), "נפתח קובץ הטופס עצמו");
assert(app.includes('data-mc-original-form="1"'), "מעטפת הטופס המקורי");
assert(app.includes('t.type !== "radio" && t.type !== "checkbox"'), "לחיצה שנייה מסירה גם צ׳קבוקס");
assert(app.includes('t.getAttribute("data-mc-health-yes") === "1"'), "כן פותח שאלון המשך");

console.log("\n5) כיסוי טפסים ושאלוני המשך");
const followPdfs = [
  "forms/followup-questionnaires/menora-followup-all.pdf",
  "forms/followup-questionnaires/phoenix-followup-all.pdf",
  "forms/followup-questionnaires/clal-followup-all.pdf",
  "forms/followup-questionnaires/hachshara-followup-all.pdf",
  "forms/followup-questionnaires/ayalon-followup-all.pdf",
  "forms/followup-questionnaires/migdal-followup-all.pdf"
];
followPdfs.forEach((rel) => {
  assert(fs.existsSync(path.join(ROOT, rel)), "קובץ מקור קיים: " + rel);
});
assert(app.includes("qualifiesForAyalonLifeForm"), "טופס הצעה לחיים של איילון מחובר");
assert(app.includes("qualifiesForAyalonCiForm"), "טופס הצעה למחלות קשות של איילון מחובר");
assert(app.includes("kind: \"missing\""), "פוליסה בלי טופס מסומנת כחסרה במסילה");

console.log(failed ? "\nFAILED " + failed : "\nOK " + passed);
process.exit(failed ? 1 : 0);
