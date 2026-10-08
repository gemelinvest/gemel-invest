/* מסך 360 לפני שיחה — פרמיות חדש ללקוח מהסימולטור, לא מקפים.
   הרצה: node _test-preflight-sale-premiums.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const BUILD = "20261007-lead-dup-v1";
let failed = 0;
let passed = 0;
function assert(cond, msg){
  if(cond){ passed += 1; console.log("  PASS  " + msg); }
  else { failed += 1; console.error("  FAIL  " + msg); }
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
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");

console.log("1) syntax + cache; BUILD stays");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(app.includes('const BUILD = "' + BUILD + '"'), "BUILD stays");
assert(html.includes("&giPrePrem=1"), "index.html busts giPrePrem");
assert(html.includes("&giFloorPop=3&giPrePrem=1"), "keeps floor-pop and adds preflight premiums");
assert(sw.includes("pre-prem-v1"), "service-worker busts pre-prem");
assert(sw.includes(BUILD), "SW still has BUILD");

const brief = extract(app, "_preFlightBriefHtml");
assert(brief.includes("_mcHealthCoverPremiumLines"), "בריאות לוקחת שורות כיסוי");
assert(brief.includes("_mcPremiumBefore") && brief.includes("_mcPremiumAfter"), "עמודות לפני/אחרי מהעזרים");
assert(brief.includes("afterN > 0 ? afterN"), "אם לפני חסר משתמשים באחרי");
assert(app.includes("getPolicyInsuredCoverPremiumRows"), "כיסויים מאותו מקור כמו שורת ההצעה");
assert(app.includes("riskSimQuotes"), "ציטוט סימולטור נשאר מקור גיבוי");

console.log("\n2) ציור עם פוליסות כמו במסך המקדים — בלי מקפים");
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
const discStart = app.indexOf("_mcDiscountScheduleText(p){");
const discEnd = app.indexOf("_mcNeedsNav(primaryAct, primaryLabel, secondaryAct, secondaryLabel, opts){", discStart);
assert(discStart > 0 && discEnd > discStart, "בלוק פרמיה/הנחה נמצא");

const health = {
  company: "מנורה",
  type: "בריאות",
  insuredIds: ["a"],
  insuredId: "a",
  healthCovers: [
    "תרופות מחוץ לסל שירותי הבריאות",
    "ניתוחים בישראל מהשקל הראשון",
    "ייעוץ ובדיקות"
  ],
  riskSimQuotes: {
    a: {
      monthlyPremium: 214.8,
      covers: [
        { wizardKey: "תרופות מחוץ לסל שירותי הבריאות", monthlyPremium: 88.4 },
        { wizardKey: "ניתוחים בישראל מהשקל הראשון", monthlyPremium: 96.2 },
        { wizardKey: "ייעוץ ובדיקות", monthlyPremium: 30.2 }
      ]
    }
  },
  simDiscountPerInsured: { a: { year1Pct: 15, years: 10, monthlyAfterDiscount: 182.58 } }
};
const risk = {
  company: "מנורה",
  type: "ריסק",
  insuredIds: ["a"],
  insuredId: "a",
  sumInsured: "9713396",
  riskSimQuotes: { a: { monthlyPremium: 176.5 } },
  simDiscountPerInsured: { a: { year1Pct: 25, years: 20, monthlyAfterDiscount: 132.38 } }
};

const host = {
  escapeHtml, safeTrim,
  _preFlightInsureds(){
    return [{ id:"a", type:"primary", data:{ existingPolicies:[] } }];
  },
  _mirrorFullNameFromIns(){ return "סמדר ניראלי"; },
  _mirrorInsuredTitle(){ return "מבוטח"; },
  _preFlightInsuredLabel(){ return "מבוטח"; },
  _mirrorEditableFromInsured(){ return { fullName:"סמדר ניראלי" }; },
  _mirrorGetAddressText(){ return ""; },
  _mirrorDeliveryLabel(){ return ""; },
  _preFlightNewPolicies(){ return [health, risk]; },
  _mcExistingHealthCoverPremiumRows(){ return []; },
  _mcCoverageBits(p){
    return safeTrim(p?.type) === "ריסק" ? [{ label:"סכום ביטוח" }] : [];
  },
  _fmtMcMoney(v){
    const n = Number(String(v == null ? "" : v).replace(/[^\d.\-]/g, ""));
    return n > 0 ? n + "₪" : "—";
  },
  _mcHealthYesSummaryHtml(){ return ""; },
  _preFlightPayload(){ return {}; }
};
vm.runInNewContext(`
  function safeTrim(v){ return String(v == null ? "" : v).trim(); }
  function escapeHtml(s){ return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;"}[c])); }
  var Wizard = undefined;
  var CustomersUI = undefined;
  ${code}
  const prem = {
    ${app.slice(discStart, discEnd)}
  };
  Object.keys(prem).forEach((k) => { this[k] = prem[k]; });
`, host);

const out = host._preFlightBriefHtml({});
const saleAt = out.indexOf("mc360Table--sale");
const saleEnd = out.indexOf("</table></div>", saleAt);
const sale = out.slice(saleAt, saleEnd);
assert(sale.includes("תרופות מחוץ לסל שירותי הבריאות"), "שם כיסוי תרופות");
assert(sale.includes("88.4₪") && sale.includes("96.2₪") && sale.includes("30.2₪"), "פרמיות כיסוי מציטוט הסימולטור");
assert(!/mc360CoverLine__pay[^<]*—/.test(sale.slice(sale.indexOf("תרופות"), sale.indexOf("ריסק"))), "כיסויי בריאות בלי מקף במקום סכום");
assert(sale.includes("214.8₪") && sale.includes("182.58₪"), "עמודות לפני/אחרי של הבריאות");
assert(sale.includes("15% ל־10 שנים"), "הנחת בריאות מ-simDiscount");
assert(sale.includes("9713396₪") || sale.includes("9,713,396"), "סכום ביטוח ריסק נשאר");
assert(sale.includes("176.5₪") && sale.includes("132.38₪"), "עמודות לפני/אחרי של הריסק מציטוט");
assert(sale.includes("25% ל־20 שנים"), "הנחת ריסק מ-simDiscount");
const moneyCells = sale.match(/mc360Money">[^<]+/g) || [];
assert(moneyCells.every((c) => !c.includes("—")), "אין מקף בעמודות לפני/אחרי");

console.log("\n" + (failed ? "FAILED " + failed : "OK " + passed) + " checks");
process.exit(failed ? 1 : 0);
