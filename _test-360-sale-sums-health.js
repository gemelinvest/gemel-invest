/* מסך 360 · סכום ביטוח וסכום פיצוי בטבלת חדש ללקוח.
   הרצה: node _test-360-sale-sums-health.js
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

function extract(src, name){
  const needle = "\n    " + name + "(";
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

const brief = extract(app, "_preFlightBriefHtml");
assert(brief.includes('product === "ריסק"') && brief.includes('product === "ריסק משכנתא"'), "ריסק ומשכנתא נכללים");
assert(brief.includes('product === "מחלות קשות"') && brief.includes('product === "סרטן"'), "מחלות קשות וסרטן נכללים");
assert(brief.includes("mc360EnteredSum"), "הסכום נכנס לתא הכיסויים");
assert(brief.includes('product === "בריאות"') && brief.includes("_mcHealthCoverPremiumLines"), "שורות הבריאות נשארות");
assert(brief.includes("<th>חברה</th><th>מוצר</th><th>מבוטח</th><th>כיסויים</th><th>הנחה</th><th>לפני</th><th>אחרי</th>"), "סדר העמודות נשאר");
assert(css.includes(".mc360EnteredSum{display:inline-flex"), "הסכום יושב ליד הכיתוב");

console.log("\n2) ציור");
function escapeHtml(s){
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
function safeTrim(v){ return String(v == null ? "" : v).trim(); }
const names = ["_preFlight360Icon", "_preFlight360Slide", "_preFlightPaySnapshot", "_preFlightBriefHtml"];
let code = "";
names.forEach((name) => {
  const src = extract(app, name);
  assert(!!src, "חולץ " + name);
  if(src) code += "this." + name + " = function" + src.slice(name.length) + ";\n";
});
const host = {
  escapeHtml, safeTrim,
  _preFlightInsureds(){
    return [
      { id:"a", type:"primary", data:{ existingPolicies:[{ policyNumber:"111", company:"כלל", type:"ריסק", sumInsured:"900000", monthlyPremium:"40" }] } },
      { id:"b", type:"spouse", data:{ existingPolicies:[] } }
    ];
  },
  _mirrorFullNameFromIns(_rec, ins){ return ins.id === "a" ? "גילית סצדקי" : "יפים סצדקי"; },
  _mirrorInsuredTitle(){ return "מבוטח"; },
  _preFlightInsuredLabel(){ return "מבוטח"; },
  _mirrorEditableFromInsured(){ return { fullName:"גילית סצדקי" }; },
  _mirrorGetAddressText(){ return ""; },
  _mirrorDeliveryLabel(){ return ""; },
  _preFlightNewPolicies(){
    return [
      { company:"הפניקס", type:"ריסק", insuredIds:["a"], sumInsured:"500000" },
      { company:"הפניקס", type:"ריסק משכנתא", insuredIds:["a","b"], sumInsuredPerInsured:{ a:"200000", b:"300000" } },
      { company:"הפניקס", type:"מחלות קשות", insuredIds:["a"], compensation:"150000" },
      { company:"הפניקס", type:"סרטן", insuredIds:["a","b"], compensationPerInsured:{ a:"80000", b:"70000" } },
      { company:"הפניקס", type:"בריאות", insuredIds:["a"] },
      { company:"הפניקס", type:"ריסק", insuredIds:["b"] }
    ];
  },
  _mcExistingHealthCoverPremiumRows(){ return []; },
  _mcCoverageBits(p){
    const type = safeTrim(p?.type || p?.product);
    if(type === "ריסק" || type === "ריסק משכנתא") return [{ label:"סכום ביטוח" }];
    if(type === "מחלות קשות" || type === "סרטן") return [{ label:"סכום פיצוי" }];
    return [];
  },
  _fmtMcMoney(v){
    const n = Number(String(v == null ? "" : v).replace(/[^\d.\-]/g, ""));
    return n > 0 ? n + "₪" : "";
  },
  _mcNewPolicyPremiumDiscountRows(){ return { schedule:"10% ל־15 שנים" }; },
  _mcPremiumBefore(){ return "338.79"; },
  _mcPremiumAfter(){ return "292.68"; },
  _mcHealthCoverPremiumLines(_rec, p){
    if(safeTrim(p?.type || p?.product) !== "בריאות") return [];
    return [{ name:"תרופות מחוץ לסל", before:120.5, after:108.45 }];
  },
  _mcHealthYesSummaryHtml(){ return ""; },
  _preFlightPayload(){ return {}; }
};
vm.runInNewContext(code, host);
const out = host._preFlightBriefHtml({});
const saleAt = out.indexOf("mc360Table--sale");
const saleEnd = out.indexOf("</table></div>", saleAt);
const sale = out.slice(saleAt, saleEnd);
const rows = sale.split("mc360SaleRow").slice(1);
assert(rows.length === 6, "שש שורות בטבלת המכירה");
function cell(row){ return row; }
assert(cell(rows[0]).includes("סכום ביטוח") && cell(rows[0]).includes("500000₪") && cell(rows[0]).includes("mc360EnteredSum"), "ריסק מציג את סכום הביטוח שהוזן");
assert((cell(rows[0]).match(/סכום ביטוח/g) || []).length === 1, "כיתוב סכום הביטוח לא מוכפל");
assert(cell(rows[1]).includes("סכום ביטוח") && cell(rows[1]).includes("500000₪"), "משכנתא מסכמת סכום לפי מבוטח");
assert(cell(rows[2]).includes("סכום פיצוי") && cell(rows[2]).includes("150000₪"), "מחלות קשות מציגות סכום פיצוי");
assert(cell(rows[3]).includes("סכום פיצוי") && cell(rows[3]).includes("150000₪"), "סרטן מסכם סכום פיצוי לפי מבוטח");
assert(cell(rows[4]).includes("תרופות מחוץ לסל") && cell(rows[4]).includes("108.45₪") && !cell(rows[4]).includes("mc360EnteredSum"), "בריאות נשארת עם לפני ואחרי");
assert(cell(rows[5]).includes("סכום ביטוח") && !cell(rows[5]).includes("mc360EnteredSum"), "בלי סכום בתיק לא מומצא מספר");
assert(sale.includes("338.79₪") && sale.includes("292.68₪"), "עמודות לפני ואחרי נשארות");
const oldAt = out.indexOf("מספר פוליסה");
const old = out.slice(oldAt, saleAt);
assert(old.includes("900000₪") && old.includes("סכום ביטוח"), "עמודת הסכום בפוליסות הקיימות נשארת");

console.log("\n3) הצהרת בריאות ב-360");
assert(brief.includes("stackAnswers: true"), "פריסת התשובות רק במסך 360");
assert(brief.includes("לקוח לא הצהיר על בעיות רפואיות"), "המשפט הריק ב-360 נשאר");
const decl = extract(app, "_renderHealthDeclarationBody");
assert(decl.includes("_mcHealthYesSummaryHtml(rec)") && !decl.includes("stackAnswers"), "שלב ההצהרה בשיחה לא מקבל את פריסת 360");
const summary = extract(app, "_mcHealthYesSummaryHtml");
assert(summary.includes("לא סומן כן באשף בריאות וסיכונים — אין ממצאים חיוביים לתיעוד."), "המשפט הריק בשיחה נשאר");
assert(summary.includes("bareKey") && summary.includes("mcHealthYesBox__field--answer"), "מפתח פנימי לא מוצג ב-360");
const boxRule = css.slice(css.indexOf(".mc360 .mcHealthYesBox{"), css.indexOf(".mc360 .mcHealthYesBox--empty"));
assert(boxRule.includes("background:#fff") && !boxRule.includes("#fff6e5") && !boxRule.includes("#f3e0b5"), "הרקע הכתום ירד מהצהרת 360");
assert(css.includes(".mc360 .mcHealthYesBox__field{display:flex;flex-direction:column"), "התשובה יורדת מתחת לשם");
assert(css.includes(".mc360 .mcHealthYesBox__q{font-size:17px;}"), "טקסט ההצהרה הוגדל");
assert(css.includes(".mcHealthYesBox__field{display:flex;justify-content:space-between;gap:10px;font-size:12px;}"), "פריסת שלב השיחה נשארת");

const sumSrc = extract(app, "_mcHealthYesSummaryHtml");
const healthHost = {
  escapeHtml, safeTrim,
  _mirrorBuildHealthGroups(){
    return [{
      question: { text: "מחלת לב, כלי דם או דם" },
      items: [
        {
          insLabel: "מבוטח ראשי: גילית סצדקי",
          response: { answer: "yes", fields: { q2_defect: "לחץ דם - וקטור שנת 2023 מאזן", diagnosis: "מאוזן" } },
          meta: { text: "מחלת לב, כלי דם או דם" }
        }
      ]
    }];
  },
  _mcHealthFollowupFields(){
    return [
      { key: "q2_defect", label: "q2_defect" },
      { key: "diagnosis", label: "אבחנה" }
    ];
  }
};
vm.runInNewContext("this._mcHealthYesSummaryHtml = function" + sumSrc.slice("_mcHealthYesSummaryHtml".length) + ";", healthHost);
const stacked = healthHost._mcHealthYesSummaryHtml({}, { emptyText: "לקוח לא הצהיר על בעיות רפואיות", stackAnswers: true });
assert(stacked.includes("מחלת לב, כלי דם או דם"), "שם ההצהרה נשאר");
assert(stacked.includes("מבוטח ראשי: גילית סצדקי"), "שם המבוטח נשאר");
assert(!stacked.includes("q2_defect"), "המפתח באנגלית לא מוצג");
assert(stacked.includes("לחץ דם - וקטור שנת 2023 מאזן"), "התשובה מוצגת");
const answerAt = stacked.indexOf("לחץ דם - וקטור שנת 2023 מאזן");
const whoAt = stacked.indexOf("מבוטח ראשי: גילית סצדקי");
assert(whoAt >= 0 && answerAt > whoAt, "התשובה באה אחרי שם המבוטח");
assert(stacked.includes("mcHealthYesBox__field--stack") && stacked.includes("אבחנה") && stacked.includes("מאוזן"), "כיתוב בעברית נשאר מעל התשובה");
const inline = healthHost._mcHealthYesSummaryHtml({}, {});
assert(inline.includes("q2_defect") && inline.includes(">לחץ דם - וקטור שנת 2023 מאזן<"), "בשיחה המפתח נשאר כמו שהיה");
assert(!inline.includes("mcHealthYesBox__field--answer"), "בשיחה אין את מחלקת הפריסה של 360");
const empty360 = healthHost._mcHealthYesSummaryHtml({}, { emptyText: "לקוח לא הצהיר על בעיות רפואיות", stackAnswers: true });
healthHost._mirrorBuildHealthGroups = () => [];
const quiet = healthHost._mcHealthYesSummaryHtml({}, { emptyText: "לקוח לא הצהיר על בעיות רפואיות", stackAnswers: true });
assert(quiet.includes("לקוח לא הצהיר על בעיות רפואיות"), "בלי תשובת כן נשאר המשפט של 360");
const quietCall = healthHost._mcHealthYesSummaryHtml({}, {});
assert(quietCall.includes("לא סומן כן באשף בריאות וסיכונים — אין ממצאים חיוביים לתיעוד."), "בלי תשובת כן בשיחה נשאר המשפט של השיחה");
assert(empty360.includes("לחץ דם"), "ציור עם תשובות לא נדרס");

console.log("\n" + (failed ? "FAILED " + failed : "OK " + passed + " checks"));
process.exit(failed ? 1 : 0);
