/* Phoenix risk form is chosen by the oldest insured's age only.
   Mortgage keeps the age-or-2M rule and its previous question text.
   Run: node _test-phoenix-risk-age-form.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = __dirname;
let passed = 0;
let failed = 0;

function assert(cond, msg){
  if(cond){
    passed += 1;
    console.log("  PASS  " + msg);
  } else {
    failed += 1;
    console.error("  FAIL  " + msg);
  }
}

function extractMethod(src, signature){
  const start = src.indexOf(signature);
  if(start < 0) throw new Error("missing " + signature);
  let i = src.indexOf("{", start);
  let depth = 0;
  for(; i < src.length; i++){
    const ch = src[i];
    if(ch === "{") depth += 1;
    else if(ch === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error("unclosed " + signature);
}

function yearsAgo(age){
  const d = new Date();
  d.setMonth(0, 15);
  d.setFullYear(d.getFullYear() - age);
  return d.toISOString().slice(0, 10);
}

const wizSrc = fs.readFileSync(path.join(ROOT, "gi-wizard.js"), "utf8");
const appSrc = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const script = `
function safeTrim(v){ return String(v == null ? "" : v).trim(); }
const api = {
${extractMethod(wizSrc, "getPhoenixFollowupSchemas()")},
${extractMethod(wizSrc, "buildPhoenixFollowupFields(questionnaireNos=[], baseFields=[])")},
${extractMethod(wizSrc, "buildPhoenixQuestionnaireCatalog()")},
${extractMethod(wizSrc, "getPhoenixRiskMortgageDecision()")},
${extractMethod(wizSrc, "getPhoenixRiskMortgageHealthSchema()")},
${extractMethod(wizSrc, "phoenixRiskOpenedQuestionnaireText(question)")}
};
this.api = api;
`;
const sandbox = {};
vm.runInNewContext(script, sandbox);
const api = sandbox.api;
api.calcAge = function(bd){
  const y = Number(String(bd || "").slice(0, 4));
  if(!y) return "";
  return new Date().getFullYear() - y;
};
api.parseMoneyNumber = function(value){
  const n = Number(String(value == null ? "" : value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : NaN;
};
api.formatMoneyValue = function(n){ return String(n); };
api.getHealthPoliciesForInsured = function(){ return this.newPolicies || []; };

function loadCase(policies, ages){
  api.newPolicies = policies;
  api.insureds = ages.map((age, index) => ({
    id: "p" + (index + 1),
    label: "מבוטח " + (index + 1),
    data: { birthDate: yearsAgo(age) }
  }));
  return api.getPhoenixRiskMortgageDecision();
}

function riskPolicy(sum){
  return { id: "pol-risk", type: "ריסק", company: "הפניקס", sumInsured: String(sum) };
}
function mortgagePolicy(sum){
  return { id: "pol-mort", type: "ריסק משכנתא", company: "הפניקס", sumInsured: String(sum) };
}

console.log("1) risk form follows the oldest age only");
let d = loadCase([riskPolicy(3500000)], [40]);
assert(d && d.isExtended === false, "age 40 and 3.5M stays on the until-55 form");
assert(d.catalogKey === "short_risk_age", "until-55 uses the risk age catalog");
assert(d.engineKey === "phoenix_risk_u55_under2m", "until-55 keeps the short fill key");

d = loadCase([riskPolicy(3500000)], [55]);
assert(d.isExtended === false && d.catalogKey === "short_risk_age", "age 55 stays on the until-55 form");

d = loadCase([riskPolicy(100000)], [56]);
assert(d.isExtended === true, "age 56 uses the over-55 form even under 2M");
assert(d.catalogKey === "extended_risk_age", "over-55 uses the risk age catalog");
assert(d.engineKey === "phoenix_risk_o55_or_over2m", "over-55 keeps the full fill key");

d = loadCase([riskPolicy(100000)], [30, 60]);
assert(d.isExtended === true && d.maxAge === 60, "the oldest insured in the file chooses the form");

console.log("\n2) mortgage keeps the previous rule and catalog");
d = loadCase([mortgagePolicy(3500000)], [40]);
assert(d.isExtended === true && d.catalogKey === "extended_risk", "mortgage over 2M still uses the extended catalog");
assert(d.engineKey === "phoenix_mortgage_o55_or_over2m", "mortgage fill key unchanged");
d = loadCase([mortgagePolicy(500000)], [40]);
assert(d.isExtended === false && d.catalogKey === "short_risk", "mortgage under 2M and under 55 stays short");
d = loadCase([mortgagePolicy(100000)], [60]);
assert(d.isExtended === true && d.catalogKey === "extended_risk", "mortgage over 55 stays extended");

const catalog = api.buildPhoenixQuestionnaireCatalog();
assert(catalog.short_risk.steps[0].text.indexOf("יותר מ־3 שבועות") >= 0, "mortgage short wording stays");
assert(catalog.extended_risk.sourceLabel.indexOf("מעל 2 מיליון") >= 0, "mortgage extended label stays");
assert(catalog.critical_illness.steps[0].text.indexOf("סיגריה אלקטרונית") >= 0, "critical illness catalog untouched");

console.log("\n3) risk questions match the form and open the same follow-ups");
loadCase([riskPolicy(100000)], [40]);
const shortSchema = api.getPhoenixRiskMortgageHealthSchema();
const shortQs = shortSchema[0].questions;
assert(shortSchema[0].summary.indexOf("עד גיל 55") >= 0, "short route says age 55");
assert(shortSchema[0].summary.indexOf("2 מיליון") < 0, "short risk route does not use the sum rule");
assert(shortQs[0].text === "2. האם בשנה האחרונה טופלת (או הומלץ על טיפול) תרופתי יותר מ- 3 שבועות?", "treatment wording");
assert(shortQs[1].text.indexOf("US ו – MRI") >= 0, "tests wording");
assert(shortQs[1].questionnaireNos.join(",") === "18,20", "tests open questionnaires 18 and 20");
assert(shortQs[1].fields.some((field) => field.type === "section" && field.label.indexOf("שאלון 18") === 0), "tests yes opens questionnaire 18");
assert(shortQs[1].fields.some((field) => field.type === "section" && field.label.indexOf("שאלון 20") === 0), "tests yes opens questionnaire 20");
assert(shortQs[3].text.indexOf("5.1 מחלות לב, כלי דם ודם") >= 0, "heart line wording");
assert(shortQs[3].questionnaireNos.join(",") === "2,3,4", "heart opens questionnaires 2, 3 and 4");
assert(shortQs[shortQs.length - 1].text.indexOf("הליך תביעת נכות (מכל סיבה שהיא)") >= 0, "disability wording");
assert(shortQs.every((q) => q.key.indexOf("phoenix_risk_u55_under2m__") === 0), "short answers stay on the short fill prefix");

loadCase([riskPolicy(100000)], [70]);
const fullSchema = api.getPhoenixRiskMortgageHealthSchema();
const fullQs = fullSchema[0].questions;
assert(fullSchema[0].summary.indexOf("מעל גיל 55") >= 0, "full route says over 55");
assert(fullQs[0].text.indexOf("5 ק\"ג") >= 0, "weight wording");
assert(fullQs[8].text.indexOf("פחיות/כוסות של משקאות חריפים") >= 0, "alcohol wording");
const family = fullQs.find((q) => q.key.indexOf("e11_17_family") >= 0);
assert(family && family.text.indexOf("סרטן השד") >= 0 && family.questionnaireNos.join(",") === "22", "family line and questionnaire 22");
assert(fullQs.every((q) => q.key.indexOf("phoenix_risk_o55_or_over2m__") === 0), "full answers stay on the full fill prefix");

console.log("\n4) operational report names opened risk questionnaires only");
const opened = api.phoenixRiskOpenedQuestionnaireText(shortQs[1]);
assert(opened.indexOf("שאלונים שנפתחו") === 0 && opened.indexOf("שאלון 18") >= 0 && opened.indexOf("שאלון 20") >= 0, "opened risk questionnaires are named");
assert(api.phoenixRiskOpenedQuestionnaireText({ key: "phoenix_mortgage_u55_under2m__s3_tests", questionnaireNos: ["18"] }) === "", "mortgage report text is unchanged");
assert(api.phoenixRiskOpenedQuestionnaireText({ key: "clal_health__q1", questionnaireNos: ["1"] }) === "", "other companies are unchanged");

console.log("\n5) customer-file choice and signature areas");
const decisionFn = extractMethod(appSrc, "phoenixRiskMortgageDecision(payload, rec)");
assert(decisionFn.indexOf("isExtended: maxAge > 55") >= 0, "life form gate is age only");
assert(decisionFn.indexOf("maxSum > 2000000") < 0, "life form gate ignores the sum");
assert(appSrc.indexOf("return this.phoenixMortgageAge(payload) <= 55") >= 0, "mortgage until-55 gate stays");
assert(appSrc.indexOf("return this.phoenixMortgageAge(payload) > 55") >= 0, "mortgage over-55 gate stays");
assert(appSrc.indexOf("טופס מקורי — ריסק / משכנתא מעל גיל 55 · הפניקס") >= 0, "over-55 document name");
assert(appSrc.indexOf("מעל גיל 55 / מעל 2 מיליון") < 0, "customer file no longer names the sum rule");

const signSandbox = { console: console };
signSandbox.window = signSandbox;
signSandbox.globalThis = signSandbox;
vm.runInNewContext(fs.readFileSync(path.join(ROOT, "gi-sign-forms.js"), "utf8"), signSandbox);
["phoenix_life_short_form", "phoenix_life_full_form"].forEach((type) => {
  const boxes = signSandbox.GiSignForms.formBoxes(type);
  assert(boxes.some((cell) => cell.slot === "self"), type + " has a customer signature area");
  assert(boxes.some((cell) => cell.slot === "spouse"), type + " has a second customer signature area");
  assert(boxes.some((cell) => cell.slot === "agent"), type + " has an agent signature area");
});
const mortgageBoxes = signSandbox.GiSignForms.formBoxes("phoenix_mortgage_u55_form");
assert(mortgageBoxes.some((cell) => cell.slot === "agent") && mortgageBoxes.length === 15, "mortgage signature areas stay");

console.log("\n=== " + passed + " passed, " + failed + " failed ===");
process.exit(failed ? 1 : 0);
