/* GI-MIRROR 2026-08-27 — שלב 6 פרטי מוטבים:
   מוטבים / בנק משעבד נמשכים מההצעה. בלי חישוב פרמיה, בלי דריסת ערכים שכבר מולאו.
   הרצה: node _test-mirror-benef-autofill.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260828-menora-health-decl-v1";
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
  const brace = src.indexOf("{", start);
  if(brace < 0) return "";
  let depth = 0;
  for(let i = brace; i < src.length; i += 1){
    const ch = src[i];
    if(ch === "{") depth += 1;
    else if(ch === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, i + 1).trim();
    }
  }
  return "";
}

const app = read("app.js");
const html = read("index.html");
const sw = read("service-worker.js");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-mirror-benef-autofill.js")]).status === 0, "node --check this test");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + APP_TAG), "index.html app.css cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");

console.log("\n2) נקודות כניסה בשיחת השיקוף");
assert(app.includes("_seedBeneficiariesStepFromProposal(rec){"), "יש זריעת מוטבים מההצעה");
assert(app.includes("_seedPolicyBeneficiariesFromSource(policy, source){"), "יש העתקה לפוליסה חיה");
assert(app.includes("this._seedBeneficiariesStepFromProposal(rec);"), "שלב 6 קורא לזריעה");
assert(app.includes("פרטי הבנק המשעבד מההצעה"), "רמז בנק מההצעה בכרטיס");
assert(app.includes("מוטבים שכבר מולאו באשף"), "רמז מוטבים מהאשף נשאר");
const seedFn = extractObjectMethod(app, "_seedBeneficiariesStepFromProposal");
const copyFn = extractObjectMethod(app, "_seedPolicyBeneficiariesFromSource");
assert(!!seedFn && !!copyFn, "חולצו פונקציות הזריעה");
assert(!seedFn.includes("autofillPledgeAmounts"), "זריעה לא ממלאת סכום שיעבוד מחדש");
assert(!seedFn.includes("getBeneficiaryBaseAmount"), "זריעה לא מחשבת בסיס חלוקה");
assert(!seedFn.includes("App.persist"), "זריעה לא שומרת לשרת");
assert(!copyFn.includes("premiumMonthly") && !copyFn.includes("getPolicyPremium"), "זריעה לא נוגעת בפרמיה");

const methodNames = [
  "_benefRowHasData",
  "_normalizeBenefRow",
  "_emptyPledgeBankRow",
  "_pledgeBankHasData",
  "_copyMissingPledgeBankFields",
  "_pledgeBanksFromPolicy",
  "_policyHasFilledPledge",
  "_policyHasPledge",
  "_fillEmptyPledgeBankFields",
  "_policiesMatchForBenefSeed",
  "_proposalPolicyBenefScore",
  "_findBestProposalPolicySource",
  "_seedPolicyBeneficiariesFromSource",
  "_seedBeneficiariesStepFromProposal",
  "_ensurePledgeBanks",
  "_benefModeForPolicy",
  "_isRiskOrMortgageRiskType",
  "_mirrorCoerceCustomerPayloadInPlace",
  "_mirrorGetNewPoliciesRaw",
  "_collectProposalPolicySourceLists"
];
let code = "var GI_MAX_PLEDGE_BANKS = 2;\n";
methodNames.forEach((name) => {
  const src = extractObjectMethod(app, name);
  assert(!!src, "חולץ " + name);
  code += "this." + name + " = function" + src.slice(name.length) + ";\n";
});

const host = {
  safeTrim(v){ return String(v == null ? "" : v).trim(); }
};
vm.runInNewContext(code, host);

console.log("\n3) מוטבים מההצעה");
const liveRisk = {
  id: "np-risk",
  company: "מגדל",
  type: "ריסק",
  beneficiaries: [],
  pledge: false
};
const proposalRisk = {
  id: "np-risk",
  company: "מגדל",
  type: "ריסק",
  beneficiaries: [{ fullName: "רות ישראלי", idNumber: "111222333", relation: "בת זוג", percent: "100" }]
};
host._seedPolicyBeneficiariesFromSource(liveRisk, proposalRisk);
assert(liveRisk.beneficiaries.length === 1, "מוטב אחד נמשך מההצעה");
assert(liveRisk.beneficiaries[0].firstName === "רות", "שם פרטי פוצל מ-fullName");
assert(liveRisk.beneficiaries[0].lastName === "ישראלי", "שם משפחה פוצל מ-fullName");
assert(String(liveRisk.beneficiaries[0].sharePct) === "100", "אחוז חלוקה מ-percent");
assert(liveRisk.beneficiaries[0].relationship === "בת זוג", "קרבה מ-relation");
assert(host._benefModeForPolicy(liveRisk) === "risk_benef", "ריסק בלי שיעבוד → מוטבים");

const keepName = {
  id: "np-risk",
  type: "ריסק",
  beneficiaries: [{ firstName: "דני", lastName: "כהן", sharePct: "100" }]
};
host._seedPolicyBeneficiariesFromSource(keepName, proposalRisk);
assert(keepName.beneficiaries[0].firstName === "דני", "לא דורסים מוטב שכבר מולא בשיחה");

console.log("\n4) בנק משעבד מההצעה");
const liveMortgage = {
  id: "np-mort",
  company: "כלל",
  type: "ריסק משכנתא",
  pledgeBanks: [{ bankName: "", bankNo: "", branch: "", amount: "", years: "", address: "" }]
};
const proposalMortgage = {
  id: "np-mort",
  company: "כלל",
  type: "ריסק משכנתא",
  pledge: true,
  pledgeBanks: [{ bankName: "בנק לאומי", bankNo: "10", branch: "801", amount: "900000", years: "25", address: "הרצל 1" }]
};
host._seedPolicyBeneficiariesFromSource(liveMortgage, proposalMortgage);
assert(liveMortgage.pledge === true, "דגל שיעבוד נמשך למשכנתא");
assert(liveMortgage.pledgeBanks[0].bankName === "בנק לאומי", "שם בנק נמשך");
assert(liveMortgage.pledgeBanks[0].branch === "801", "סניף נמשך");
assert(liveMortgage.pledgeBanks[0].amount === "900000", "סכום שיעבוד נמשך כמו בהצעה — בלי חישוב מחדש");
assert(host._benefModeForPolicy(liveMortgage) === "mortgage_bank", "ריסק משכנתא → בנק משעבד בלבד");

const livePledgeNameOnly = {
  id: "np-mort2",
  type: "ריסק משכנתא",
  pledgeBankName: "בנק הפועלים",
  mortgageAmount: "500000",
  mortgageYears: "20",
  pledgeBanks: [{ bankName: "", amount: "", years: "" }]
};
host._fillEmptyPledgeBankFields(livePledgeNameOnly);
assert(livePledgeNameOnly.pledgeBanks[0].bankName === "בנק הפועלים", "שם בנק מ-pledgeBankName כשהמערך ריק");
assert(String(livePledgeNameOnly.pledgeBanks[0].amount) === "500000", "סכום מ-mortgageAmount");

console.log("\n5) ריסק עם שיעבוד + מוטבים");
const liveBoth = { id: "np-both", company: "הפניקס", type: "ריסק", beneficiaries: [] };
const proposalBoth = {
  id: "np-both",
  company: "הפניקס",
  type: "ריסק",
  pledge: true,
  pledgeBanks: [{ bankName: "בנק דיסקונט", bankNo: "11", branch: "1", amount: "200000", years: "10", address: "אלנבי" }],
  beneficiaries: [{ firstName: "נועה", lastName: "לוי", sharePct: "100", relationship: "בת" }]
};
host._seedPolicyBeneficiariesFromSource(liveBoth, proposalBoth);
assert(liveBoth.pledge === true, "שיעבוד נמשך לריסק רגיל");
assert(liveBoth.beneficiaries[0].firstName === "נועה", "מוטב נמשך לצד הבנק");
assert(liveBoth.pledgeBanks[0].bankName === "בנק דיסקונט", "בנק נמשך לצד המוטב");
assert(host._benefModeForPolicy(liveBoth) === "risk_pledge_and_bens", "ריסק+שיעבוד → משעבד ומוטבים");

console.log("\n6) זריעה מ-operational כש-newPolicies ריק ממוטבים");
const rec = {
  payload: {
    newPolicies: [{ id: "np-risk", company: "מגדל", type: "ריסק", beneficiaries: [] }],
    operational: {
      newPolicies: [{
        id: "np-risk",
        company: "מגדל",
        type: "ריסק",
        beneficiaries: [{ firstName: "מיכל", lastName: "שמש", sharePct: "100" }]
      }]
    }
  }
};
host._seedBeneficiariesStepFromProposal(rec);
assert(rec.payload.newPolicies[0].beneficiaries[0].firstName === "מיכל", "מוטבת נמשכה מ-operational.newPolicies");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
