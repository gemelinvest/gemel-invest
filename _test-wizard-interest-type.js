/* GI-WIZ-INTEREST-TYPE 2026-10-07
   ריסק משכנתא וריסק משועבד: חובה לסמן ריבית קבועה או משתנה, לא את שתיהן.
   הרצה: node _test-wizard-interest-type.js
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

function sliceFn(src, startNeedle, endNeedle){
  const start = src.indexOf(startNeedle);
  if(start < 0) return "";
  const end = src.indexOf(endNeedle, start + startNeedle.length);
  if(end < 0) return src.slice(start);
  return src.slice(start, end);
}

const wiz = fs.readFileSync(path.join(ROOT, "gi-wizard.js"), "utf8");
const sims = fs.readFileSync(path.join(ROOT, "gi-simulators.js"), "utf8");
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "app.css"), "utf8");

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "gi-wizard.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-simulators.js")]).status === 0, "gi-simulators.js");

assert(wiz.includes('return { bankName:"", bankNo:"", branch:"", amount:"", years:"", address:"", interestType:"" };'), "בנק ריק כולל interestType");
assert(wiz.includes('if(s === "fixed" || s === "קבועה" || s === "קבוע") return "fixed"'), "קבועה מנורמלת");
assert(wiz.includes('if(s === "variable" || s === "משתנה") return "variable"'), "משתנה מנורמלת");

const issuesFn = sliceFn(wiz, "if(!isMedicare && (d.type === \"ריסק\" || d.type === \"ריסק משכנתא\") && d.pledge){", "return issues;");
assert(issuesFn.includes("interestType"), "ולידציית טיוטה דורשת סוג ריבית");
assert(issuesFn.includes("data-pdraft-interest"), "סימון השדה מצביע על תיבות הריבית");

const step5 = sliceFn(wiz, "if(isRisk && p.pledge){", "return true;");
assert(step5.includes("normalizeInterestType(b.interestType)"), "שלב 5 לא שלם בלי ריבית");

assert(wiz.includes('data-pdraft-interest="fixed"') && wiz.includes('data-pdraft-interest="variable"'), "שתי תיבות XOR באשף");
assert(wiz.includes("el.checked ? want : \"\""), "ביטול סימון מנקה את הריבית");
assert(sims.includes("data-gishell-legal-interest") && sims.includes("ריבית קבועה"), "סימולטור זהה לאשף");
assert(app.includes("data-mc-pledge-interest") && app.includes("_onPledgeInterestToggle"), "שיקוף מסמן ריבית על הבנק המשעבד");
assert(css.includes(".lcPledgeInterest") && css.includes(".mcPledgeInterest"), "עיצוב תיבות הריבית");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
