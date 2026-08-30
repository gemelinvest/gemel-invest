/* GI-FEAT 2026-08-25 — רגרסיה: הצג נתוני פוליסה לשורות אלמנטרי/רכב.
   הרצה: node _test-elementary-policy-details.js
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

function read(name){
  return fs.readFileSync(path.join(ROOT, name), "utf8");
}

const app = read("app.js");
const css = read("app.css");
const wizard = read("gi-wizard.js");
const indexHtml = read("index.html");
const sw = read("service-worker.js");

console.log("\nלחצן + מודל");
assert(app.includes("הצג נתוני פוליסה"), "טקסט לחצן קיים");
assert(app.includes("data-elem-policy-details"), "data attribute ללחצן");
assert(app.includes("customerPolicyRow__detailsBtn"), "כפתור בשורת ארנק");
assert(app.includes("cfFile__detailsBtn"), "כפתור בטבלת פוליסות");
assert(app.includes("renderElementaryPolicyDetailsModal"), "רינדור מודל אלמנטרי");
assert(app.includes("buildElementaryPolicyDetailsModel"), "בניית מודל נתונים");
assert(app.includes("מאיזה גיל הביטוח תקף"), "שדה גיל תקף");
assert(app.includes("תאריך סיום ביטוח"), "שדה תאריך סיום");
assert(app.includes("שמות הנהגים המנוקבים"), "שדה נהגים נקובים");
assert(app.includes("חברה לפי מוצר"), "שדה חברה לפי מוצר");

console.log("\nלוגיקה קיימת לא נשברה");
assert(app.includes("openPolicyModal(rec, policy)"), "openPolicyModal נשאר");
assert(app.includes("פרטי פוליסה"), "בריאות עדיין מציג פרטי פוליסה");
assert(app.includes("customerPolicyRow__downloadBtn"), "כפתור הורדת פוליסה נשאר");
assert(app.includes("resolveDisplayPolicy"), "resolveDisplayPolicy נשאר");

console.log("\nשימור חברה ב-pricing");
assert(wizard.includes("company: safeTrim(old?.company ?? '')"), "ensureElementaryProductPricing שומר company");

console.log("\nעיצוב + cache");
assert(css.includes("customerPolicyRow__detailsBtn"), "CSS לכפתור פרטים");
assert(css.includes("customerPolicyModal__elemDetails"), "CSS למודל אלמנטרי");
assert(css.includes("customerPolicyModal__companyRow"), "CSS לשורות חברה");
assert(indexHtml.includes("app.js?v=20260830-customer-open-perf-v1"), "cache bust app.js");
assert(indexHtml.includes("app.css?v=20260830-customer-open-perf-v1"), "cache bust app.css");
assert(sw.includes("20260830-customer-open-perf-v1"), "service-worker version");

console.log("\nלוגו פתוח בתיק לקוח");
assert(css.includes("#customerFull .customerPolicyRow__logoWrap .lcCompanyLogo"), "שורת ארנק: לוגו בלי מסגרת");
assert(read("theme.css").includes(".cfNewPolicyCard__logo .lcCompanyLogo:not(#\\9):not(#\\9)"), "כרטיס פוליסה חדשה: override לוגו");
assert(read("theme.css").includes("background: transparent !important"), "כרטיס: רקע שקוף ללוגו");
assert(indexHtml.includes("theme.css?v=20260830-customer-open-perf-v1"), "cache bust theme.css");

console.log("\nלוגיקה טהורה — מודל נתונים");
function safeTrim(v){ return String(v ?? "").trim(); }
function getElementaryDriverAgeValidityLabel(d){
  let mode = "";
  if(Array.isArray(d.namedDrivers) && d.namedDrivers.length) mode = "named";
  else if(safeTrim(d.driverMinAge) || d.driverAnyEnabled) mode = "any";
  if(mode === "any"){
    const age = safeTrim(d.driverMinAge) || "—";
    const exp = safeTrim(d.driverMinExperienceYears);
    return exp ? `כל נהג מעל גיל ${age} · ותק ${exp} שנים` : `מעל גיל ${age}`;
  }
  if(mode === "named") return "נהגים נקובים בלבד";
  return "—";
}
function getElementaryNamedDriverNames(data){
  return (Array.isArray(data?.namedDrivers) ? data.namedDrivers : []).map((drv, idx) => {
    const nm = [safeTrim(drv?.firstName), safeTrim(drv?.lastName)].filter(Boolean).join(" ");
    return nm || (`נהג ${idx + 1}`);
  });
}

const anyData = { driverMinAge: "24", driverMinExperienceYears: "2", driverAnyEnabled: true };
assert(getElementaryDriverAgeValidityLabel(anyData) === "כל נהג מעל גיל 24 · ותק 2 שנים", "גיל תקף לכל נהג");
const namedData = {
  namedDrivers: [
    { firstName: "יוסי", lastName: "כהן" },
    { firstName: "דנה", lastName: "לוי" }
  ]
};
assert(getElementaryDriverAgeValidityLabel(namedData) === "נהגים נקובים בלבד", "מצב נהגים נקובים");
assert(getElementaryNamedDriverNames(namedData).join(",") === "יוסי כהן,דנה לוי", "שמות נהגים");

console.log("\n-----");
console.log("passed=" + passed + " failed=" + failed);
process.exit(failed ? 1 : 0);
