/* מסך 360: סטטוס בדיקה בתיק, טקסט נתונים גדול, וסכום בפוליסה קיימת.
   הרצה: node _test-360-check-status.js
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
const css = fs.readFileSync(path.join(ROOT, "app.css"), "utf8");

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("לקוח בבדיקה ראשונית לקראת שיחת שיקוף"), "נוסח הסטטוס בתיק");
assert(html.includes('id="customerFullPreCheck"'), "הסטטוס ליד הטיימר");
assert(html.includes("<circle") && html.includes("M34.5 33.5"), "איור עין וזכוכית מגדלת");
assert(app.includes("paintPreCallCheck(rec)"), "ציור הסטטוס מחובר לטיימר");
assert(app.includes("CustomersUI?.paintPreCallCheck?.(checkRec)"), "הסטטוס מתעדכן עם מסך 360");
assert(/\.mc360Table td\{[^}]*font-size:17px/.test(css), "טקסט הנתונים בטבלאות הוגדל");
assert(/\.mc360Table th\{[^}]*font-size:15px/.test(css), "כותרות העמודות בטבלאות 360 הוגדלו");
const brief = extract(app, "_preFlightBriefHtml");
assert(brief.includes(">סכום<") && brief.includes("סכום פיצוי") && brief.includes("סכום ביטוח"), "עמודת סכום בפוליסות קיימות");
assert(brief.includes('if(!(n > 0)) return { label: "", text: "" }'), "בלי סכום בתיק לא מומצא מספר");

console.log("\n2) מתי הסטטוס דולק");
function escapeHtml(s){ return String(s == null ? "" : s); }
function safeTrim(v){ return String(v == null ? "" : v).trim(); }
const vis = extract(app, "_preCallCheckVisible");
const sandbox = { safeTrim, MirrorCallUI: null };
vm.runInNewContext("this.ui = { " + vis + " };", sandbox);
function cls(on){ return { contains(name){ return on && name === "is-open"; } }; }
function at(opts){
  sandbox.ui.els = {
    wrap: { classList: cls(opts.fileOpen !== false) },
    liveTimer: { hidden: opts.timerShown ? false : true }
  };
  sandbox.ui.currentId = opts.cid || "c1";
  sandbox.MirrorCallUI = {
    _callRunning: !!opts.running,
    selectedCustomer: { id: opts.sel || "c1" },
    els: { preFlightModal: { getAttribute(){ return opts.overlay ? "false" : "true"; } } }
  };
  return sandbox.ui._preCallCheckVisible({ id: opts.cid || "c1" });
}
assert(at({ overlay: true }) === true, "במסך 360 הסטטוס דולק");
assert(at({ overlay: true, running: true }) === false, "בתחילת שיחה הסטטוס כבה");
assert(at({ overlay: true, timerShown: true }) === false, "הסטטוס לא מופיע יחד עם הטיימר");
assert(at({ overlay: false }) === false, "בלי מסך 360 אין סטטוס");
assert(at({ overlay: true, sel: "other" }) === false, "רק בתיק של הלקוח שבמסך 360");
assert(at({ overlay: true, fileOpen: false }) === false, "תיק סגור בלי סטטוס");

console.log("\n3) סכום מהתיק");
const names = ["_preFlight360Icon", "_preFlight360Slide", "_preFlightPaySnapshot", "_preFlightBriefHtml"];
let code = "";
names.forEach((name) => {
  const src = extract(app, name);
  assert(!!src, "חולץ " + name);
  if(src) code += "this." + name + " = function" + src.slice(name.length) + ";\n";
});
const host = {
  escapeHtml(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])); },
  safeTrim,
  _preFlightInsureds(){
    return [{ id:"a", type:"primary", data:{ existingPolicies:[
      { policyNumber:"111", company:"כלל", type:"ריסק", sumInsured:"500000", monthlyPremium:"40" },
      { policyNumber:"222", company:"מנורה", type:"מחלות קשות", compensation:"150000", monthlyPremium:"30" },
      { policyNumber:"333", company:"הפניקס", type:"בריאות", monthlyPremium:"72" }
    ] } }];
  },
  _mirrorFullNameFromIns(){ return "מורן"; },
  _mirrorInsuredTitle(){ return "מבוטח"; },
  _preFlightInsuredLabel(){ return "מבוטח"; },
  _mirrorEditableFromInsured(){ return { fullName:"מורן" }; },
  _mirrorGetAddressText(){ return ""; },
  _mirrorDeliveryLabel(){ return ""; },
  _preFlightNewPolicies(){ return [{ company:"כלל", type:"ריסק", insuredIds:["a"], discountYears:"6" }]; },
  _mcExistingHealthCoverPremiumRows(){ return []; },
  _mcCoverageBits(){ return [{ label:"סכום ביטוח" }]; },
  _fmtMcMoney(v){
    const n = Number(String(v == null ? "" : v).replace(/[^\d.\-]/g, ""));
    return n > 0 ? (n + "₪") : "—";
  },
  _mcNewPolicyPremiumDiscountRows(){ return { schedule:"שנה 1: 60%" }; },
  _mcPremiumBefore(){ return "116.38"; },
  _mcPremiumAfter(){ return "46.55"; },
  _mcHealthCoverPremiumLines(){ return []; },
  getCompanyLogoSrcForCompany(){ return ""; },
  _mcHealthYesSummaryHtml(){ return ""; },
  _preFlightPayload(){ return {}; }
};
vm.runInNewContext(code, host);
const out = host._preFlightBriefHtml({});
const oldAt = out.indexOf("מספר פוליסה");
const saleAt = out.indexOf("mc360Table--sale");
const old = out.slice(oldAt, saleAt);
assert(old.includes("סכום ביטוח") && old.includes("500000₪"), "ריסק מציג סכום ביטוח מהתיק");
assert(old.includes("סכום פיצוי") && old.includes("150000₪"), "מחלות קשות מציגות סכום פיצוי");
const healthRow = old.slice(old.indexOf("333"));
assert(healthRow.includes(">—<") || healthRow.includes(">&#8212;<") || /<td class="mc360SumCell">—<\/td>/.test(healthRow), "בריאות בלי סכום נשארת עם קו");
assert(!healthRow.includes("72₪</b>"), "פרמיית הבריאות לא הופכת לסכום ביטוח");
assert(out.includes("116.38₪") && out.includes("שנה 1: 60%"), "נתוני המכירה נשארים");

console.log("\n" + (failed ? "FAILED " + failed : "OK " + passed + " checks"));
process.exit(failed ? 1 : 0);
