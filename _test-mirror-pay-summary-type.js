/* שיחת שיקוף:
   הוראת קבע עם כתובת סניף ותווית «הבנק»,
   כרטיס אשראי עם שדות מספר ותוקף,
   פסקת תחילת ביטוח פעם אחת,
   חזרה מימין במעבר להצהרת בריאות,
   כיתוב שורת ביטוח קיים גדול יותר בלי שינוי מבנה.
   הרצה: node _test-mirror-pay-summary-type.js
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

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "app.css"), "utf8");

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");

const names = ["_mcPayRow", "_mcPayDetailHtml", "_mcPayOwner", "_onMcPayFieldEdit", "_mcInsStartSectionHtml", "_mcNeedsNav"];
let code = "";
names.forEach((name) => {
  const src = extractObjectMethod(app, name);
  assert(!!src, "חולץ " + name);
  if(src) code += "this." + name + " = function" + src.slice(name.length) + ";\n";
});

function escapeHtml(s){
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
function safeTrim(v){ return String(v == null ? "" : v).trim(); }
const host = { escapeHtml, safeTrim, nowISO(){ return "2026-09-30T00:00:00.000Z"; } };
vm.runInNewContext(code, host);

console.log("\n2) הוראת קבע");
const ho = host._mcPayDetailHtml({
  method: "ho",
  ho: { bankName: "בנק לאומי", bankNo: "10", branch: "801", branchAddress: "הרצל 1 תל אביב", account: "123456" }
});
assert(ho.includes(">הבנק<") && ho.includes("בנק לאומי"), "התווית היא הבנק והשם מופיע אחריה");
assert(!ho.includes("שם הבנק"), "אין תווית שם הבנק הכפולה");
assert(ho.includes("כתובת הסניף") && ho.includes("הרצל 1 תל אביב"), "כתובת הסניף מוצגת");
assert(ho.indexOf("הבנק") < ho.indexOf("מספר בנק") && ho.indexOf("מספר בנק") < ho.indexOf("כתובת הסניף"), "אחרי הבנק ממשיכים מספר, סניף וכתובת");
assert(ho.includes("123456"), "מספר החשבון נשאר");

console.log("\n3) כרטיס אשראי");
const cc = host._mcPayDetailHtml({
  method: "cc",
  cc: { holderName: "יוסף", holderId: "123", cardNumber: "4580", exp: "12/28" }
});
assert(cc.includes('data-mc-pay-field="cardNumber"') && cc.includes('data-mc-pay-field="exp"'), "נפתחים שדות מספר כרטיס ותוקף");
assert(cc.includes('value="4580"') && cc.includes('value="12/28"'), "השדות מציגים ערך שכבר נשמר");
assert(!cc.includes("לא הוזן באשף</span></div><label"), "מספר הכרטיס אינו שורת תצוגה בלבד");
const rec = { payload: { primary: { paymentMethod: "ho", cc: {} }, mirrorFlow: { payment: { method: "ho" } } } };
let persisted = 0;
host._getFreshCustomerRecord = () => rec;
host._mirrorGetPaymentStore = (row) => row.payload.mirrorFlow.payment;
host._persistMirrorCall = () => { persisted += 1; };
host._onMcPayFieldEdit({ getAttribute(n){ return n === "data-mc-pay-field" ? "cardNumber" : ""; }, value: "4111111111111111" });
assert(rec.payload.primary.cc.cardNumber === "4111111111111111", "מספר הכרטיס נשמר על בעל הפוליסה");
assert(rec.payload.primary.paymentMethod === "cc" && rec.payload.mirrorFlow.payment.method === "cc", "אמצעי התשלום נשאר כרטיס אשראי");
assert(persisted === 1, "השמירה הקיימת של השיחה נקראת");
host._onMcPayFieldEdit({ getAttribute(n){ return n === "data-mc-pay-field" ? "exp" : ""; }, value: "09/27" });
assert(rec.payload.primary.cc.exp === "09/27" && rec.payload.primary.cc.cardNumber === "4111111111111111", "התוקף נשמר בלי למחוק את המספר");

console.log("\n4) תחילת ביטוח פעם אחת");
const start = host._mcInsStartSectionHtml([
  { company: "מנורה", type: "בריאות", startDate: "01/10/2026" },
  { company: "מנורה", type: "מחלות קשות", startDate: "01/10/2026" }
]);
assert((start.match(/הפוליסה תיכנס לתוקף/g) || []).length === 1, "משפט התוקף פעם אחת");
assert((start.match(/הודעת SMS/g) || []).length === 1, "משפט ה-SMS פעם אחת");
assert(start.includes("מנורה · בריאות") && start.includes("מנורה · מחלות קשות"), "שתי הפוליסות עדיין מופיעות");

console.log("\n5) לחצן חזרה מימין רק במעבר להצהרה");
const nav = host._mcNeedsNav("benef-to-health", "המשך · הצהרת בריאות", "benef-back", "חזרה", { backOnStart: true });
assert(nav.includes("mcNeedsNav--backStart"), "לזוג הזה יש סימון סדר הפוך");
assert(nav.includes("benef-back") && nav.includes("benef-to-health"), "הפעולות נשארו");
const other = host._mcNeedsNav("needs-to-offer", "המשך · פוליסות מוצעות");
assert(!other.includes("mcNeedsNav--backStart"), "שאר המעברים לא התהפכו");
assert(css.includes(".mcNeedsNav--backStart .mcNeedsNav__secondary{order:1;}"), "חזרה מתחילה מימין");
assert(css.includes(".mcNeedsNav--backStart .mcNeedsNav__primary{order:2;}"), "המשך עובר לשמאל");

console.log("\n6) כיתוב שורת ביטוח קיים");
assert(css.includes(".mcPolicyRowList .mcPolicyRow__cell{font-size:18px;}"), "תאי השורה 18px");
assert(css.includes(".mcPolicyRowList .mcPolicyRow__sub{font-size:14px;}"), "שורות הכיסוי מתחת גדולות יותר");
assert(css.includes("grid-template-columns:minmax(128px,1.05fr)"), "עמודות השורה לא הוחלפו");
assert(css.includes(".mcPolicyRow__cell{\n  min-width:0;\n  color:#0f2744;"), "צבע ומשקל בסיס של התא נשארו");

console.log("\n7) זרימה שלא נדרשה");
assert(app.includes("_validatePaymentStep(rec){"), "ולידציית תשלום נשארה");
assert(app.includes('if(action === "pay-to-insstart")'), "המשך מתשלום לתחילת ביטוח נשאר");
assert(app.includes('if(action === "benef-to-health")'), "המשך מהמוטבים להצהרה נשאר");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
