/* GI-STEP1-VAL — חלון חסרים באשף בריאות וסיכונים: קומפקטי, בלי אימוג׳י.
   הרצה: node _test-step1-validation-modal.js
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

const wizard = fs.readFileSync(path.join(ROOT, "gi-wizard.js"), "utf8");
const theme = fs.readFileSync(path.join(ROOT, "theme.css"), "utf8");
const appCss = fs.readFileSync(path.join(ROOT, "app.css"), "utf8");
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");

const start = wizard.indexOf("showStep1ValidationModal(){");
const end = wizard.indexOf("completeElementaryProposalAndContinueToMirror()", start);
const fn = start > 0 && end > start ? wizard.slice(start, end) : "";

console.log("\n2) this dialog only");
assert(fn.length > 200, "missing-fields dialog extracted");
assert(fn.includes("לא ניתן להמשיך לשלב הבא"), "title stays");
assert(fn.includes("יש להשלים"), "count line stays");
assert(fn.includes("הבנתי, אחזור למילוי"), "button stays");
assert(fn.includes('id = \'giStep1ValidationModal\''), "same dialog id");
assert(!fn.includes("⚠️") && !fn.includes("👤"), "emoji icons are gone from this dialog");
assert(fn.includes('stroke="currentColor"') && fn.includes('stroke-width="1.9"'), "icons are system line icons");
assert((fn.match(/<svg /g) || []).length === 2, "warning icon and person icon");
assert(wizard.includes("if(this.step === 1 && !this.isElementaryFlow())"), "still only health/risk step 1");

console.log("\n3) other dialogs stay");
assert(appCss.includes("max-width:480px"), "shared validation card width stays for other dialogs");
assert(app.includes('giValModal__headIcon" aria-hidden="true">⚠️</span>'), "other warning dialogs still use their own icon");
assert(theme.includes("GI-STEP1-VAL"), "compact rules are marked");
assert(theme.includes("#giStep1ValidationModal .giValModal__card"), "compact width is scoped to this dialog");
assert(theme.includes("width: min(340px, calc(100vw - 32px))"), "dialog is narrower");
assert(!theme.includes("#giStep1ValidationModal") || theme.indexOf("#giStep1ValidationModal") > theme.indexOf("GI-STEP1-VAL"), "scope sits with the design layer");

if(failed){
  console.error("\nFAILED " + failed + " / passed " + passed);
  process.exit(1);
}
console.log("\nOK " + passed + " assertions");
process.exit(0);
