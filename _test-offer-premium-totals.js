/* פוליסות מוצעות: שורות צפופות יותר, וסיכום פרמיה לפני ואחרי הנחה לכל הפוליסות.
   הסכום נשען על אותן פונקציות פרמיה שכבר מציירות כל כרטיס.
   הרצה: node _test-offer-premium-totals.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
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

function extractObjectMethod(src, methodName){
  const needle = "\n    " + methodName + "(";
  const start = src.indexOf(needle);
  if(start < 0) return "";
  const paren = src.indexOf("(", start);
  let parenDepth = 0;
  let i = paren;
  for(; i < src.length; i += 1){
    if(src[i] === "(") parenDepth += 1;
    else if(src[i] === ")"){
      parenDepth -= 1;
      if(parenDepth === 0){ i += 1; break; }
    }
  }
  const brace = src.indexOf("{", i);
  if(brace < 0) return "";
  let depth = 0;
  for(let j = brace; j < src.length; j += 1){
    if(src[j] === "{") depth += 1;
    else if(src[j] === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, j + 1).trim();
    }
  }
  return "";
}

function sliceBetween(src, startMark, endMark){
  const start = src.indexOf(startMark);
  const end = src.indexOf(endMark, start + startMark.length);
  if(start < 0 || end < 0 || end <= start) return "";
  return src.slice(start, end);
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "app.css"), "utf8");

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");

console.log("\n2) סיכום רק במסך הפוליסות המוצעות");
const offer = sliceBetween(app, "_renderNeedsOffer(rec){", "_renderNeedsReasons(rec){");
const premium = sliceBetween(app, "_renderStep4PremiumCostBody(rec){", "_renderStep4NewPoliciesBody(rec){");
assert(!!offer, "מסך הפוליסות המוצעות נמצא");
assert(offer.includes("_mcOfferPremiumTotalsHtml(rec)"), "הסיכום מצויר מתחת לפוליסות המוצעות");
assert(offer.includes("פרמיה לפני הנחה") || app.includes("פרמיה לפני הנחה"), "תווית לפני הנחה");
assert(app.includes("פרמיה אחרי הנחה"), "תווית אחרי הנחה בסיכום");
assert(app.includes("סה״כ לכל הפוליסות"), "כותרת הסיכום");
assert(!premium.includes("_mcOfferPremiumTotalsHtml"), "מסך עלות הביטוח לא מקבל סיכום נוסף");
assert(offer.includes("withDisclosure: true"), "גילוי הנאות על הכרטיס נשאר");

console.log("\n3) הכרטיס צפוף יותר בלי לשנות את שדותיו");
assert(css.includes(".mcOfferTotals{"), "עיצוב שורת הסיכום");
const totalsRule = css.slice(css.indexOf(".mcOfferTotals{"), css.indexOf(".mcOfferTotals{") + 280);
assert(/display:\s*flex/.test(totalsRule) && /justify-content:\s*flex-start/.test(totalsRule), "כותרת הסה״כ צמודה לסכומים מימין");
assert(!/minmax\(0,\s*1fr\)/.test(totalsRule), "שורת הסיכום לא מותחת רווח בין הכותרת לסכומים");
const facts = css.slice(css.indexOf(".mcOfferCard__fact{"), css.indexOf(".mcOfferCard__fact{") + 220);
assert(/padding:\s*6px\s+8px/.test(facts), "ריפוד שדה בכרטיס המוצע צומצם");
assert(css.includes(".mcOfferList{"), "רשימת ההצעות נשארת");
assert(!css.includes(".mcPolicyRowList .mcOfferTotals"), "הסיכום לא נוגע בשורות הביטוח הקיים");

const src = extractObjectMethod(app, "_mcSumOfferPremiums");
assert(!!src, "חולץ _mcSumOfferPremiums");

function safeTrim(v){ return String(v == null ? "" : v).trim(); }
const host = { safeTrim };
vm.runInNewContext(
  "this._mcSumOfferPremiums = function" + src.slice("_mcSumOfferPremiums".length) + ";",
  host
);
host._mcAsMoneyNumber = (v) => {
  const n = Number(String(v == null ? "" : v).replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
host._mcPremiumBefore = (p) => p.before;
host._mcPremiumAfter = (p) => p.after;

console.log("\n4) סכימה של אותם סכומים שמוצגים בכרטיס");
const totals = host._mcSumOfferPremiums([
  { before: "100.5", after: "80" },
  { before: "40", after: "40" },
  { before: "", after: "" }
]);
assert(totals.count === 3, "כל הפוליסות נספרות");
assert(totals.before === 140.5, "סכום לפני הנחה");
assert(totals.after === 120, "סכום אחרי הנחה");
const empty = host._mcSumOfferPremiums([]);
assert(empty.before === 0 && empty.after === 0 && empty.count === 0, "בלי פוליסות הסכום אפס");

if(failed){
  console.error("\nFAILED " + failed + " / passed " + passed);
  process.exit(1);
}
console.log("\nOK  " + passed + " assertions");
