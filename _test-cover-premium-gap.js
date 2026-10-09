/* GI-COVER-GAP — בפירוט כיסויים הפרמיה יושבת ליד שם הכיסוי.
   הרצה: node _test-cover-premium-gap.js
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

function sliceBetween(src, startMark, endMark){
  const start = src.indexOf(startMark);
  const end = src.indexOf(endMark, start + startMark.length);
  if(start < 0 || end < 0) return "";
  return src.slice(start, end);
}

const theme = fs.readFileSync(path.join(ROOT, "theme.css"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");

console.log("1) premiums sit next to the cover name");
const rule = sliceBetween(theme, ".cfNewPolicyCard__cover:not(#\\9):not(#\\9){", ".cfNewPolicyCard__coverName");
assert(!!rule, "cover row rule exists");
assert(rule.includes("justify-content: flex-start"), "amounts stay next to the name");
assert(!rule.includes("justify-content: space-between"), "amounts are not pushed to the far edge");
assert(rule.includes("gap: 14px"), "small gap between the name and the premiums");

console.log("\n2) health cover markup is unchanged");
assert(app.includes('bit("לפני הנחה", row.amountBefore)'), "before-discount caption stays");
assert(app.includes('bit("אחרי הנחה", row.amountAfter)'), "after-discount caption stays");
assert(app.includes("cfNewPolicyCard__coverAmts"), "premium group stays");

console.log("\n3) cache");
assert(html.includes("giCoverGap=1"), "theme.css cache bumped");
assert(sw.includes("cover-gap-v1"), "service worker cache bumped");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
