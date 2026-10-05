/* GI-KPI-CO 2026-10-05 — «הצג פירוט» מציג כל חברה וכמה נמכר.
   בלי שינוי חישוב פרמיה / סכומי הכרטיסים.
   הרצה: node _test-kpi-company-breakdown.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20261005-ops-forms-warm-v1";
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

function read(name){
  return fs.readFileSync(path.join(ROOT, name), "utf8");
}

function extractObjectMethod(src, methodName){
  const needle = "\n    " + methodName + "(";
  const start = src.indexOf(needle);
  if(start < 0) return "";
  let i = start + needle.length;
  let depthParen = 1;
  while(i < src.length && depthParen > 0){
    const ch = src[i];
    if(ch === "(") depthParen += 1;
    else if(ch === ")") depthParen -= 1;
    i += 1;
  }
  const brace = src.indexOf("{", i);
  if(brace < 0) return "";
  let depth = 0;
  for(let j = brace; j < src.length; j += 1){
    const ch = src[j];
    if(ch === "{") depth += 1;
    else if(ch === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, j + 1).trim();
    }
  }
  return "";
}

const app = read("app.js");
const html = read("index.html");
const sw = read("service-worker.js");
const css = read("app.css");

console.log("1) syntax + cache substring");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=" + TAG), "app.js tag unchanged");
assert(html.includes("app.css?v=" + TAG), "app.css tag substring stays");
assert(sw.includes("gi-v12-" + TAG), "service-worker still carries the sums tag");
assert(html.includes("gi-sign.js?v=20261005-sign-survey-v1"), "gi-sign cache tag unchanged");
assert(!extractObjectMethod(app, "policyNetPremium").includes("getPolicyPremiumAfterDiscount"), "policyNetPremium לא השתנה");
assert(app.includes("const skipServerOnly = localHealthPremium > 0"), "skipServerOnly נשאר");
assert(app.includes("if(!Storage.isHeavyRosterSession?.() && typeof Storage.loadTodaySalesAfterDiscount === \"function\")"), "דשבורד כבד עדיין מדלג בפעם הראשונה");
assert(app.includes("isHeavyRosterSession?.()") && app.includes("skipExtras = true"), "heavy roster עדיין מדלג extras של מוצר");

console.log("\n2) פירוט לפי חברה נמשך גם בסשן כבד");
assert(app.includes("סשן כבד מדלג על sales_by_product"), "בסשן כבד לא נשלף פירוט מוצר");
assert(app.includes('client.rpc("gi_dashboard_sales_by_company", args)'), "פירוט חברות נשלף");
assert(app.includes("m.netCompanyBreakdown"), "מטמון נטו נושא פירוט חברות");
assert(app.includes("formatNetProductBreakdownHtml(m.netProductTotals, m.agentAppointmentPremium, m.netCompanyBreakdown)"), "paintServerKpiDom צובע פירוט חברות בנטו");
assert(app.includes("formatNetProductBreakdownHtml(metrics.netProductTotals, metrics.agentAppointmentPremium, metrics.netCompanyBreakdown)"), "רינדור נטו לפי חברה");
assert(app.includes("_formatKpiCompanyBreakdownHtml"), "שורות חברה משותפות לכרטיס היום");
assert(css.includes("bankKpi--netPremium:has(.bankKpiToday__breakdown--open)"), "כרטיס נטו לא חותך שורות בפתיחה");

console.log("\n3) התנהגות — שורות חברה מול סכום הכרטיס");
const matchFn = extractObjectMethod(app, "_kpiCompanyRowsMatchMoney");
const fmtFn = extractObjectMethod(app, "formatNetProductBreakdownHtml");
const rowsFn = extractObjectMethod(app, "_formatKpiCompanyBreakdownHtml");
const box = {
  safeTrim(v){ return String(v == null ? "" : v).trim(); },
  escapeHtml(v){ return String(v == null ? "" : v); },
  formatMoney(v){ return "₪" + (Math.round((Number(v) || 0) * 100) / 100); },
  _formatKpiCompanyBreakdownHtml(){ return ""; }
};
vm.runInNewContext(
  "this._kpiCompanyRowsMatchMoney = function" + matchFn.slice("_kpiCompanyRowsMatchMoney".length) + ";\n" +
  "this._formatKpiCompanyBreakdownHtml = function" + rowsFn.slice("_formatKpiCompanyBreakdownHtml".length) + ";\n" +
  "this.formatNetProductBreakdownHtml = function" + fmtFn.slice("formatNetProductBreakdownHtml".length) + ";",
  box
);
assert(box._kpiCompanyRowsMatchMoney([{ premium: 142.33 }], 7052.43) === false, "פניקס 142 לא נחשב פירוט מלא ל-7052");
assert(box._kpiCompanyRowsMatchMoney([
  { premium: 4000 }, { premium: 2910.1 }, { premium: 142.33 }
], 7052.43) === true, "סכום חברות תואם לכרטיס היום");
assert(box._kpiCompanyRowsMatchMoney([], 18774) === false, "פירוט ריק לא תואם ל-18774");
const htmlNet = box.formatNetProductBreakdownHtml({}, 0, [
  { label: "הפניקס", premium: 9000 },
  { label: "כלל", premium: 9774 }
]);
assert(htmlNet.indexOf("הפניקס") >= 0 && htmlNet.indexOf("כלל") >= 0, "נטו מציג כל חברה");
assert(htmlNet.indexOf("אין מכירות החודש") < 0, "עם חברות אין הודעת ריק");
assert(htmlNet.indexOf("פרמיה ממינוי סוכן") >= 0, "שורת מינוי סוכן נשארת אחרי החברות");
const htmlEmpty = box.formatNetProductBreakdownHtml({}, 12.5, []);
assert(htmlEmpty.indexOf("אין מכירות החודש") >= 0, "בלי חברות ובלי מוצרים נשארת הודעת הריק");
assert(htmlEmpty.indexOf("פרמיה ממינוי סוכן") >= 0, "מינוי סוכן מופיע גם כשהפירוט ריק");

const paintFn = extractObjectMethod(app, "paintServerKpiDom");
assert(paintFn.includes("_formatKpiCompanyBreakdownHtml"), "paintServerKpiDom ממלא פירוט כרטיס היום");
assert(paintFn.includes("netCompanyBreakdown"), "paintServerKpiDom ממלא פירוט נטו מחברות");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
