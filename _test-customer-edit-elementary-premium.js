/* GI-FEAT 2026-08-25 — רגרסיה: עריכת פרמיות אלמנטרי/רכב בעדכון נתונים.
   הרצה: node _test-customer-edit-elementary-premium.js
   בודק תוספת בלבד — בלי שינוי לוגיקת בריאות/סיכונים הקיימת.
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
const indexHtml = read("index.html");
const sw = read("service-worker.js");

const ceStart = app.indexOf("const CustomerEditUI = {");
const ceEnd = app.indexOf("CustomerEditUI.init();");
assert(ceStart > 0 && ceEnd > ceStart, "בלוק CustomerEditUI נמצא ב-app.js");
const block = ceStart > 0 && ceEnd > ceStart ? app.slice(ceStart, ceEnd) : "";

console.log("\nתוספת עריכת אלמנטרי בעדכון נתונים");
assert(block.includes("elementaryPolicies"), "טיוטה כוללת elementaryPolicies");
assert(block.includes("renderElementaryPoliciesSection"), "קיימת פונקציית רינדור לאלמנטרי");
assert(block.includes("applyElementaryPremiumFields"), "קיימת החלת פרמיית אלמנטרי");
assert(block.includes("applyElementaryPoliciesFromDraft"), "קיימת שמירת אלמנטרי מהטיוטה");
assert(block.includes("syncElementaryPricingFromPolicies"), "סנכרון ל-elementaryProductPricing");
assert(block.includes("${this.renderElementaryPoliciesSection()}"), "render כולל את סעיף האלמנטרי");
assert(block.includes("data-ce-elementary-section"), "סמן DOM לסעיף אלמנטרי");
assert(block.includes("פרמיה שנתית"), "תווית פרמיה שנתית (לא חודשית)");
assert(block.includes("ביטוח אלמנטרי / רכב"), "כותרת סעיף אלמנטרי/רכב");

console.log("\nלוגיקת בריאות/סיכונים לא נפגעה");
assert(block.includes("renderNewPoliciesSection()"), "סעיף פוליסות חדשות נשאר");
assert(block.includes("renderHealthEditSection()"), "סעיף הצהרת בריאות נשאר");
assert(block.includes("renderPaymentSection()"), "סעיף תשלום נשאר");
assert(block.includes("syncPolicyPremiumOnSave"), "סנכרון פרמיית בריאות/סיכונים נשאר");
assert(block.includes("finalizeHealthPolicyPremiumFromParts"), "פרמיית תוספות בריאות נשארת");
assert(block.includes("normalizeHealthResponsesBeforeSave"), "שמירת הצהרת בריאות נשארת");
assert(block.includes("payload.newPolicies = this.deepClone(newPolicies)"), "שמירת newPolicies לא הוסרה");
assert(block.includes("this.applyElementaryPoliciesFromDraft(payload)"), "שמירת אלמנטרי נקראת בסוף normalizeDraftForSave");

console.log("\nעיצוב + cache");
assert(css.includes("customerEditSection--elementary"), "CSS לסעיף אלמנטרי");
assert(indexHtml.includes("app.js?v=20260826-travel-insurance-v2"), "cache bust ל-app.js");
assert(indexHtml.includes("app.css?v=20260826-travel-insurance-v2"), "cache bust ל-app.css");
assert(sw.includes("20260826-travel-insurance-v2"), "service-worker cache version");

console.log("\nלוגיקה טהורה — החלת פרמיה");
function asEditMoneyNumber(v){
  const n = Number(String(v ?? "").replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) ? Math.max(0, Math.round(n * 100) / 100) : 0;
}
function applyElementaryPremiumFields(policy, draftPolicy){
  const src = draftPolicy || policy;
  const prem = asEditMoneyNumber(src?.premiumValue ?? src?.premiumAfterDiscountValue ?? "");
  if(prem <= 0) return false;
  const rounded = Math.round(prem * 100) / 100;
  const premStr = String(rounded);
  const instN = parseInt(String(src?.installments || "").replace(/\D/g, ""), 10);
  const inst = Number.isFinite(instN) && instN >= 1 ? String(Math.min(120, instN)) : "";
  const premText = `${premStr} ₪`;
  let perStr = "";
  if(inst){
    const per = Math.round((rounded / Number(inst)) * 100) / 100;
    perStr = `${per} ₪`;
  }
  policy.premiumValue = premStr;
  policy.premiumAfterDiscountValue = rounded;
  policy.premiumAfterDiscount = premText;
  policy.premiumText = premText;
  policy.installments = inst;
  policy.perPayment = perStr;
  return true;
}

const pol = {
  id: "elementary_compulsory",
  type: "חובה",
  company: "הכשרה",
  premiumValue: "1200",
  premiumAfterDiscountValue: 1200,
  installments: "12"
};
assert(applyElementaryPremiumFields(pol, { premiumValue: "1500.5", installments: "10" }), "החלת פרמיה מצליחה");
assert(pol.premiumValue === "1500.5", "premiumValue עודכן");
assert(pol.premiumAfterDiscountValue === 1500.5, "premiumAfterDiscountValue עודכן");
assert(pol.installments === "10", "תשלומים עודכנו");
assert(String(pol.perPayment).includes("150.05"), "תשלום לתשלום חושב");

const untouched = { id: "elementary_comprehensive", premiumValue: "2000", premiumAfterDiscountValue: 2000 };
assert(!applyElementaryPremiumFields(untouched, { premiumValue: "", installments: "6" }), "פרמיה ריקה לא דורסת");
assert(untouched.premiumValue === "2000", "ערך מקורי נשמר כשאין קלט");

console.log("\n-----");
console.log("passed=" + passed + " failed=" + failed);
process.exit(failed ? 1 : 0);
