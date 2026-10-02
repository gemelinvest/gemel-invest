/* מסך 360 לבדיקת תיק לפני השיחה.
   הרצה: node _test-preflight-360.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20261002-mirror-360-precall-v1";
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
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "app.css"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");

console.log("1) syntax and cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(app.includes('const BUILD = "' + TAG + '"'), "BUILD tag");
assert(html.includes("app.js?v=" + TAG), "index cache");
assert(sw.includes("gi-v12-" + TAG), "service worker cache");
assert(!html.includes('id="mcCallPreFlightTitle"'), "כותרת המסך הוסרה");
assert(!html.includes("מבט 360 על העסקה שעומדת להיסגר"), "כותרת המשנה הוסרה");
assert(html.includes('aria-label="בדיקת תיק לפני השיחה"'), "שם נגיש נשאר על החלון");
assert(css.includes("padding:12px 16px 12px;"), "המסך נפתח על כל השטח");
assert(css.includes("font-size:clamp(22px, 2vw, 28px);"), "שעון השיחה הוגדל");
assert(/\.mcWorkstation--callLive > \.mcSessionPanel \.mcCall__btn,[\s\S]{0,280}min-height:36px;/.test(css), "כפתורי הסרגל הוגדלו");

console.log("\n2) המבנה");
const brief = extract(app, "_preFlightBriefHtml");
assert(brief.includes('class="mc360"'), "מעטפת 360");
assert(!brief.includes("mcBriefCols"), "רשימת קיים/חדש הכפולה הוסרה");
assert(brief.includes("מספר פוליסה"), "עמודת מספר פוליסה בקיימות");
assert(brief.includes("<details class=\"mc360Person\">"), "כרטיס מבוטח סגור");
assert(brief.includes("_mcHealthYesSummaryHtml(rec)"), "הצהרות כן מאותו מקור");
assert(brief.includes("חדש ללקוח") && brief.includes("קיים היום") && brief.includes("תשלום"), "חמשת נושאי העסקה");
assert(css.includes(".mc360Sum{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));"), "שורת סיכום");
assert(css.includes(".mc360Person[open] .mc360Chev::before{content:\"סגור ▴\";}"), "כרטיס פתוח מסמן סגור");

const names = ["_preFlight360Icon", "_preFlight360Slide", "_preFlightPaySnapshot", "_preFlightBriefHtml"];
let code = "";
names.forEach((name) => {
  const src = extract(app, name);
  assert(!!src, "חולץ " + name);
  if(src) code += "this." + name + " = function" + src.slice(name.length) + ";\n";
});

function escapeHtml(s){
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
function safeTrim(v){ return String(v == null ? "" : v).trim(); }
const host = {
  escapeHtml, safeTrim,
  _preFlightInsureds(){
    return [
      { id:"a", type:"primary", data:{ idNumber:"028879823", birthDate:"22/02/1972", maritalStatus:"נשוי", occupation:"חקלאי", clinic:"כללית", shaban:"כללית פלטינום", smokingStatus:"no", existingPolicies:[{ policyNumber:"45822109", company:"כלל", type:"בריאות", monthlyPremium:"186" }] } },
      { id:"b", type:"spouse", data:{ idNumber:"034221908", smokingStatus:"no", existingPolicies:[] } }
    ];
  },
  _mirrorFullNameFromIns(_rec, ins){ return ins.id === "a" ? "ארז מאיר" : "מיכל מאיר"; },
  _mirrorInsuredTitle(ins){ return ins.type === "spouse" ? "בת זוג" : "מבוטח ראשי"; },
  _preFlightInsuredLabel(){ return "מבוטח"; },
  _mirrorEditableFromInsured(_rec, ins){
    const d = ins.data || {};
    return { fullName: ins.id === "a" ? "ארז מאיר" : "מיכל מאיר", idNumber:d.idNumber, birthDate:d.birthDate, maritalStatus:d.maritalStatus, childrenText:"לא", occupation:d.occupation, clinic:d.clinic, shaban:d.shaban };
  },
  _mirrorGetAddressText(){ return "מושב כפר יובל"; },
  _mirrorDeliveryLabel(){ return "למייל"; },
  _preFlightNewPolicies(){ return [{ company:"הפניקס", type:"מחלות קשות", insuredIds:["a"] }]; },
  _mcExistingHealthCoverPremiumRows(){ return [{ label:"ניתוחים" }]; },
  _mcCoverageBits(){ return []; },
  _fmtMcMoney(v){ const t = safeTrim(v); return t ? t + " ₪" : "—"; },
  _mcNewPolicyPremiumDiscountRows(){ return { schedule:"15% לשנתיים" }; },
  _mcPremiumBefore(){ return "210"; },
  _mcPremiumAfter(){ return "178"; },
  _mcHealthYesSummaryHtml(){ return `<section class="mcHealthYesBox"><article class="mcHealthYesBox__item">כן</article></section>`; },
  _preFlightPayload(){ return { primary:{ paymentMethod:"ho", ho:{ bankName:"בנק לאומי", bankNo:"10", branch:"801" } } }; }
};
vm.runInNewContext(code, host);
const out = host._preFlightBriefHtml({ idNumber:"028879823" });
assert(out.includes(">2<") && out.includes("ארז מאיר · מיכל מאיר"), "סיכום מבוטחים");
assert(out.includes("45822109"), "מספר הפוליסה הקיימת בטבלה");
assert(out.includes("הפניקס") && out.includes("178 ₪") && out.includes("15% לשנתיים"), "טבלת הרכישה החדשה");
assert(out.includes("הוראת קבע") && out.includes("801"), "תשלום מהתיק");
assert(out.includes(">הצהיר<"), "יש הצהרת בריאות");
assert((out.match(/<details class="mc360Person">/g) || []).length === 2, "כרטיס לכל מבוטח");
assert(!out.includes("mcBriefCols"), "אין עמודות הרשימה הישנה");

host._mcHealthYesSummaryHtml = () => `<section class="mcHealthYesBox mcHealthYesBox--empty"><p class="mcHealthYesBox__empty">אין</p></section>`;
host._preFlightNewPolicies = () => [];
const quiet = host._preFlightBriefHtml({});
assert(quiet.includes(">לא הצהיר<"), "בלי תשובת כן מוצג שלא הצהיר");
assert(quiet.includes("אין רכישה חדשה בתיק."), "בלי פוליסה חדשה יש מצב ריק");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
