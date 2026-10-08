/* GI-CF-ROW 2026-10-08
   תצוגה בלבד בתיק הלקוח:
   שם מבוטח בלי תפקיד, פרמיית כיסוי בריאות לפני ואחרי הנחה,
   עדכון נתונים למנהל ולמנהל מערכת, כותרות שורה גדולות יותר,
   וסימון שיעבוד על ריסק משכנתא או ריסק משועבד.
   הרצה: node _test-cf-policy-row-display.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
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

function read(name){
  return fs.readFileSync(path.join(ROOT, name), "utf8");
}

function sliceMethod(src, name){
  const re = new RegExp("(?:^|\\n)\\s*" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\(");
  const m = re.exec(src);
  if(!m) return "";
  const start = m.index + (m[0][0] === "\n" ? 1 : 0);
  let i = m.index + m[0].length;
  let paren = 1;
  let quote = "";
  for(; i < src.length && paren > 0; i++){
    const ch = src[i];
    if(quote){
      if(ch === "\\"){ i += 1; continue; }
      if(ch === quote) quote = "";
      continue;
    }
    if(ch === "'" || ch === "\"" || ch === "`"){ quote = ch; continue; }
    if(ch === "(") paren += 1;
    else if(ch === ")") paren -= 1;
  }
  while(i < src.length && /\s/.test(src[i])) i += 1;
  if(src[i] !== "{") return "";
  let depth = 0;
  for(; i < src.length; i++){
    const ch = src[i];
    if(ch === "{") depth += 1;
    else if(ch === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, i + 1).trim();
    }
  }
  return "";
}

function safeTrim(v){
  return String(v == null ? "" : v).trim();
}

const app = read("app.js");
const html = read("index.html");
const theme = read("theme.css");
const sw = read("service-worker.js");

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-cf-policy-row-display.js")]).status === 0, "node --check this test");

const names = [
  "_policyInsuredRoleOnly",
  "_stripPolicyInsuredRole",
  "policyInsuredPersonName",
  "policyRowInsuredNames",
  "getPolicyInsuredIdsForDisplay",
  "logicalHealthCoverLabel",
  "healthCoverPremiumPair",
  "policyPledgeMarkText",
  "canEditCustomerFile",
  "refreshEditBtnVisibility"
];
const src = {};
names.forEach((name) => { src[name] = sliceMethod(app, name); });
names.forEach((name) => assert(!!src[name], "sliced " + name));

function makeUi(auth){
  const ui = {
    asMoneyNumber(v){
      const n = Number(String(v == null ? "" : v).replace(/[^\d.\-]/g, ""));
      return Number.isFinite(n) ? n : 0;
    }
  };
  names.forEach((name) => {
    if(name === "canEditCustomerFile" || name === "refreshEditBtnVisibility"){
      ui[name] = new Function("Auth", "safeTrim", "return function " + src[name])(auth, safeTrim).bind(ui);
    } else {
      ui[name] = new Function("safeTrim", "return function " + src[name])(safeTrim).bind(ui);
    }
  });
  return ui;
}

const ui = makeUi({
  isAdmin(){ return false; },
  isManager(){ return false; }
});

console.log("\n2) insured column is the person name only");
assert(ui._stripPolicyInsuredRole("מבוטח משני בן / בת זוג - אורלי כהן") === "אורלי כהן", "role before the dash is dropped");
assert(ui._stripPolicyInsuredRole("מבוטח ראשי - עופר כהן") === "עופר כהן", "primary role prefix is dropped");
assert(ui._stripPolicyInsuredRole("אורלי כהן (בת/בן זוג)") === "אורלי כהן", "parenthetical role is dropped");
assert(ui._stripPolicyInsuredRole("מבוטח ראשי") === "", "role without a name is empty");
assert(ui.policyInsuredPersonName({
  label: "מבוטח משני בן / בת זוג - תווית",
  data: { firstName: "אורלי", lastName: "כהן" }
}) === "אורלי כהן", "stored first and last name win");

const couple = ui.policyRowInsuredNames({
  payload: {
    insureds: [
      { id: "a", type: "primary", label: "מבוטח ראשי - עופר כהן", data: { firstName: "עופר", lastName: "כהן" } },
      { id: "b", type: "spouse", label: "מבוטח משני בן / בת זוג - אורלי כהן", data: { firstName: "אורלי", lastName: "כהן" } }
    ],
    newPolicies: [{ id: "p1", insuredIds: ["a", "b"], type: "בריאות" }]
  }
}, { id: "p1", type: "בריאות" });
assert(couple === "עופר כהן · אורלי כהן", "several insureds are names side by side");
assert(!couple.includes("מבוטח"), "the row does not keep a role word");

const labelOnly = ui.policyRowInsuredNames({
  payload: {
    insureds: [{ id: "b", type: "spouse", label: "מבוטח משני בן / בת זוג - אורלי כהן", data: {} }],
    newPolicies: [{ id: "p2", insuredIds: ["b"] }]
  }
}, { id: "p2" });
assert(labelOnly === "אורלי כהן", "a role dash label keeps the name");

const noName = ui.policyRowInsuredNames({
  payload: {
    insureds: [{ id: "a", type: "primary", label: "מבוטח ראשי", data: {} }],
    newPolicies: [{ id: "p3", insuredIds: ["a"] }]
  }
}, { id: "p3", insuredLabel: "מבוטח ראשי" });
assert(noName === "", "missing name does not fall back to מבוטח ראשי");
assert(app.includes("this.policyRowInsuredNames(rec, policy) || \"—\""), "the card uses the name list");
assert(!sliceMethod(app, "renderNewPolicyCard").includes("מבוטח ראשי"), "the policy card no longer prints מבוטח ראשי");

console.log("\n3) health cover premiums before and after discount");
const health = {
  type: "בריאות",
  premiumMonthly: "225.98",
  healthCovers: ["ניתוחים וטיפולים מחליפי ניתוח מחוץ לישראל", "ייעוץ ובדיקות"],
  coverDiscounts: [
    { name: "ניתוחים וטיפולים מחליפי ניתוח מחוץ לישראל", pct: "10" }
  ]
};
const beforeJson = JSON.stringify(health);
const priced = ui.healthCoverPremiumPair(health, "ניתוחים וטיפולים מחליפי ניתוח מחוץ לישראל", "100");
assert(priced.before === 100 && priced.after === 90, "saved cover discount turns 100 into 90");
assert(JSON.stringify(health) === beforeJson, "display does not write discounts back onto the policy");
const emptyCover = ui.healthCoverPremiumPair(health, "ייעוץ ובדיקות", "");
assert(emptyCover.before === "" && emptyCover.after === "", "a cover without a stored premium stays blank");
global.Wizard = {
  getHealthCoverGrossPremiumsByName(){
    return { "ניתוחים וטיפולים מחליפי ניתוח מחוץ לישראל": 250 };
  },
  parseCoverDiscountPct(raw){
    return Math.min(100, Math.max(0, Number(String(raw).replace(/[^\d.]/g, "")) || 0));
  }
};
const grossPolicy = {
  type: "בריאות",
  coverDiscounts: [{ name: "ניתוחים וטיפולים מחליפי ניתוח מחוץ לישראל", pct: "20" }]
};
const grossBefore = JSON.stringify(grossPolicy);
const gross = ui.healthCoverPremiumPair(grossPolicy, "ניתוחים וטיפולים מחליפי ניתוח מחוץ לישראל", "80");
assert(gross.before === 250 && gross.after === 200, "gross from the existing cover table is the before amount");
assert(JSON.stringify(grossPolicy) === grossBefore, "reading gross premiums does not change the policy");
delete global.Wizard;
const riskPair = ui.healthCoverPremiumPair({
  type: "ריסק",
  coverDiscounts: [{ name: "מוות", pct: "10" }]
}, "מוות", "500");
assert(riskPair.before === "" && riskPair.after === "", "risk covers do not get before and after");
const ciPair = ui.healthCoverPremiumPair({ type: "מחלות קשות", coverDiscounts: [{ name: "סרטן", pct: "10" }] }, "סרטן", "80");
assert(ciPair.before === "" && ciPair.after === "", "critical illness keeps a single amount path");
const card = sliceMethod(app, "renderNewPolicyCard");
assert(card.includes('safeTrim(policy.type) === "בריאות"') && card.includes("לפני הנחה") && card.includes("אחרי הנחה"), "only a health card prints both premiums");
assert(card.includes("cfPolicyPay"), "payment pill stays on the policy row");

console.log("\n4) edit customer data is manager and admin only");
const agent = makeUi({ isAdmin(){ return false; }, isManager(){ return false; } });
const manager = makeUi({ isAdmin(){ return false; }, isManager(){ return true; } });
const admin = makeUi({ isAdmin(){ return true; }, isManager(){ return false; } });
assert(agent.canEditCustomerFile() === false, "an agent cannot edit the file");
assert(manager.canEditCustomerFile() === true, "a manager can edit the file");
assert(admin.canEditCustomerFile() === true, "a system admin can edit the file");
const editBtn = { style: { display: "" } };
agent.els = { editBtn, wrap: { classList: { contains(){ return true; } } } };
agent.currentId = "cust_1";
agent.refreshEditBtnVisibility();
assert(editBtn.style.display === "none", "the button stays hidden for an agent");
manager.els = agent.els;
manager.currentId = "cust_1";
manager.refreshEditBtnVisibility();
assert(editBtn.style.display === "", "the button is shown for a manager");
assert(/id="customerFullEditBtn"[^>]*style="display:none"/.test(html), "the button is hidden until the role check");
const editAt = app.indexOf('this.els.editBtn = $("#customerFullEditBtn")');
const editHandler = app.slice(editAt, editAt + 4200);
assert(editHandler.includes("if(!this.canEditCustomerFile()) return;"), "a direct click does not open the editor");
assert(editHandler.indexOf("canEditCustomerFile") < editHandler.indexOf("CustomerEditUI.open(rec.id)"), "the role check is before the editor opens");
assert(html.includes("רכישת ביטוח חדש") && html.includes("תזמון חדש לשיקוף") && html.includes("גניזת לקוח") && html.includes("שיוך לקוח"), "the other file actions stay");

console.log("\n5) column headers and pledge mark");
const head = theme.slice(theme.indexOf(".cfNewPolicyGrid__head:not(#\\9):not(#\\9){"), theme.indexOf(".cfNewPolicyCard:not(#\\9):not(#\\9){"));
assert(/font-size:\s*15px\s*!important/.test(head), "policy column headers are 15px");
assert(/font-weight:\s*800\s*!important/.test(head), "policy column headers are heavier");
assert(ui.policyPledgeMarkText({ type: "ריסק משכנתא" }) === "פוליסה משועבדת לבנק", "mortgage risk is marked even before a bank name");
assert(ui.policyPledgeMarkText({ type: "ריסק משכנתא", pledgeBankName: "לאומי" }) === "פוליסה משועבדת לבנק לאומי", "mortgage risk shows the bank");
assert(ui.policyPledgeMarkText({
  type: "ריסק",
  pledge: true,
  pledgeBanks: [{ bankName: "לאומי" }, { bankName: "הפועלים" }]
}) === "פוליסה משועבדת לבנק לאומי · הפועלים", "two pledged banks are both shown");
assert(ui.policyPledgeMarkText({ type: "ריסק", hasPledge: true, pledgeBank: { bankName: "דיסקונט" } }) === "פוליסה משועבדת לבנק דיסקונט", "a pledged risk uses pledgeBank");
assert(ui.policyPledgeMarkText({ type: "ריסק" }) === "", "a risk policy without a pledge is not marked");
assert(ui.policyPledgeMarkText({ type: "בריאות", pledge: true, pledgeBankName: "לאומי" }) === "", "health is not marked as pledged");
assert(card.includes("cfPolicyPledge"), "the policy card renders the pledge mark");
assert(theme.includes(".cfPolicyPledge:not(#\\9):not(#\\9)"), "the pledge mark has a style");
assert(html.includes("giCfRow=1"), "app and theme cache token is bumped");
assert(sw.includes("cf-row-v1"), "service worker cache includes the row display");

console.log("\n" + passed + " passed, " + failed + " failed");
if(failed) process.exit(1);
