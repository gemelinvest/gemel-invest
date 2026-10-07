/* רשימת מסמכי תיק לקוח: מרווח, גלילה כשיש הרבה, שם עבה ותאריך דק.
   הרצה: node _test-customer-docs-list-space.js
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

function sliceRule(src, selector){
  const start = src.indexOf(selector + "{");
  if(start < 0){
    const spaced = src.indexOf(selector + "{\n");
    if(spaced < 0) return "";
  }
  const brace = src.indexOf("{", src.indexOf(selector));
  if(brace < 0) return "";
  let depth = 0;
  for(let i = brace; i < src.length; i++){
    if(src[i] === "{") depth += 1;
    else if(src[i] === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(src.indexOf(selector), i + 1);
    }
  }
  return "";
}

const appCss = fs.readFileSync(path.join(ROOT, "app.css"), "utf8");
const signCss = fs.readFileSync(path.join(ROOT, "gi-sign.css"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");

console.log("1) cache + syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.css?v=20261007-forms-fill-v1&giDocs=1"), "app.css נטען מחדש לרשימת המסמכים");
assert(html.includes("gi-sign.css?v=20261005-sign-survey-v1"), "gi-sign.css נטען מחדש לרשימת המסמכים");

console.log("\n2) name is bold and larger, meta is thin");
const nameRule = sliceRule(appCss, ".cfFile__documentRowName");
const metaRule = sliceRule(appCss, ".cfFile__documentRowMeta");
assert(nameRule.includes("font-size: 16px") && nameRule.includes("font-weight: 800"), "שם המסמך גדול ועבה");
assert(metaRule.includes("font-weight: 500") && metaRule.includes("font-size: 13px"), "שורת התאריך דקה יותר");
assert(nameRule.includes("Heebo") && metaRule.includes("Heebo"), "הטקסט בפונט Heebo");

console.log("\n3) list is spaced and scrolls when long");
const listRule = sliceRule(appCss, ".cfFile__documentsList");
assert(listRule.includes("overflow: auto") && listRule.includes("min-height: 0") && listRule.includes("gap: 12px"), "הרשימה גוללת ויש מרווח בין השורות");
assert(signCss.includes("overflow-y:auto") && signCss.includes("min-height:0"), "גלילה אנכית נשמרת גם אחרי עיצוב החתימה");
assert(signCss.includes("padding:14px 16px") && !signCss.includes("padding:8px 10px;"), "השורה לא דחוסה");
assert(signCss.includes("overflow-x:hidden") && signCss.includes("text-overflow:ellipsis"), "אין גלילה אופקית, שם ארוך נחתך");
const rowRule = sliceRule(signCss.slice(signCss.indexOf(".cfFile__documentRow{")), ".cfFile__documentRow");
assert(signCss.includes("align-content:start") && signCss.includes("grid-auto-rows:max-content"), "הרבה מסמכים לא מכווצים את השורות");
assert(rowRule.includes("min-height:min-content") && rowRule.includes("align-self:start") && !rowRule.includes("overflow:hidden"), "השורה נשארת בגובה התוכן ולא נחתכת");

console.log("\n4) customer file list markup unchanged");
assert(app.includes('class="cfFile__documentsList"') && app.includes("cfFile__documentRowName") && app.includes("cfFile__documentRowMeta"), "מבנה רשימת המסמכים בתיק נשאר");

console.log("\n" + (failed ? "FAILED " + failed : "OK") + "  passed=" + passed + " failed=" + failed);
process.exit(failed ? 1 : 0);
