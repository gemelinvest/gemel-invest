/* מסך 360 · לוגו חברה על שורת המכירה, ופירוט כיסויי בריאות.
   הרצה: node _test-360-sale-logo-covers.js
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
assert(brief.includes("mc360SaleLogo") && brief.includes("mc360SaleRow"), "לוגו על שורת המכירה");
assert(brief.includes("_mcHealthCoverPremiumLines"), "בריאות לוקחת את שורות הכיסוי");
assert(brief.includes("mc360CoverLine__pay--after"), "לפני ואחרי ליד כל כיסוי");
assert(!brief.includes("lcCompanyLogo"), "הלוגו לא נכנס לקופסת הלוגו");
assert(brief.includes('product === "בריאות"'), "הפירוט רק למוצר בריאות");

const saleCss = css.slice(css.indexOf(".mc360Table.mc360Table--sale tbody tr.mc360SaleRow{"), css.indexOf(".mc360CoverList{"));
assert(saleCss.includes("background:#fff"), "רקע השורה לבן");
assert(saleCss.includes("height:96px"), "הלוגו גדול יחסית");
assert(saleCss.includes("border:0") && saleCss.includes("box-shadow:none") && saleCss.includes("border-radius:0"), "בלי מסגרת סביב הלוגו");

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
  getCompanyLogoSrcForCompany(name){
    return safeTrim(name) === "מגדל" ? "./assets/logos/megdl.jfif" : "";
  },
  _preFlightInsureds(){
    return [
      { id:"a", type:"primary", data:{ existingPolicies:[{ policyNumber:"45822109", company:"כלל", type:"בריאות", monthlyPremium:"186" }] } },
      { id:"b", type:"spouse", data:{ existingPolicies:[] } }
    ];
  },
  _mirrorFullNameFromIns(_rec, ins){ return ins.id === "a" ? "מיכל שן" : "דני שן"; },
  _mirrorInsuredTitle(){ return "מבוטח"; },
  _preFlightInsuredLabel(){ return "מבוטח"; },
  _mirrorEditableFromInsured(){ return { fullName:"מיכל שן" }; },
  _mirrorGetAddressText(){ return ""; },
  _mirrorDeliveryLabel(){ return ""; },
  _preFlightNewPolicies(){
    return [
      { company:"מגדל", type:"בריאות", insuredIds:["a"] },
      { company:"הפניקס", type:"מחלות קשות", insuredIds:["b"] }
    ];
  },
  _mcExistingHealthCoverPremiumRows(){ return [{ label:"ניתוחים" }]; },
  _mcCoverageBits(){ return []; },
  _fmtMcMoney(v){
    const n = Number(String(v == null ? "" : v).replace(/[^\d.\-]/g, ""));
    return n > 0 ? n + "₪" : "—";
  },
  _mcNewPolicyPremiumDiscountRows(){ return { schedule:"10% ל־15 שנים" }; },
  _mcPremiumBefore(){ return "338.79"; },
  _mcPremiumAfter(){ return "292.68"; },
  _mcHealthCoverPremiumLines(_rec, p){
    if(safeTrim(p?.type || p?.product) !== "בריאות") return [];
    return [
      { name:"תרופות מחוץ לסל", before:120.5, after:108.45 },
      { name:"משלים שב״ן", before:80, after:72 }
    ];
  },
  _mcHealthYesSummaryHtml(){ return ""; },
  _preFlightPayload(){ return {}; }
};
vm.runInNewContext(code, host);
const out = host._preFlightBriefHtml({});
const saleAt = out.indexOf("mc360Table--sale");
const saleEnd = out.indexOf("</table></div>", saleAt);
const sale = out.slice(saleAt, saleEnd);
const existingAt = out.indexOf("מספר פוליסה");
const existing = out.slice(existingAt, saleAt);
assert(sale.includes('class="mc360SaleLogo" src="./assets/logos/megdl.jfif"'), "לוגו מגדל על רקע שורת הבריאות");
assert(!sale.includes("lcCompanyLogo"), "אין קופסת לוגו בטבלת המכירה");
assert(sale.includes("תרופות מחוץ לסל") && sale.includes("לפני") && sale.includes("120.5₪") && sale.includes("108.45₪"), "כיסוי בריאות עם לפני ואחרי");
assert(sale.includes("משלים שב״ן") && sale.includes("72₪"), "כיסוי שני עם פרמיה אחרי");
assert((sale.match(/mc360SaleRow/g) || []).length === 2, "שתי שורות מכירה");
assert((sale.match(/mc360SaleLogo/g) || []).length === 1, "לוגו רק לחברה שיש לה קובץ");
assert(!sale.slice(sale.indexOf("מחלות קשות")).includes("mc360CoverLine"), "מוצר שאינו בריאות נשאר בלי פירוט כיסויים");
assert(sale.includes("338.79₪") && sale.includes("292.68₪"), "סכום הפוליסה נשאר בעמודות לפני ואחרי");
assert(!existing.includes("mc360SaleRow") && existing.includes("45822109"), "פוליסות קיימות בלי לוגו המכירה");

console.log("\n" + (failed ? "FAILED " + failed : "OK " + passed + " checks"));
process.exit(failed ? 1 : 0);
