/* GI-CF-SUM-DATE 2026-09-10
   תיק לקוח: סכום ביטוח + תאריך DD/MM/YYYY בשורת סרטן/מחלות/ריסק/ריסק משכנתא.
   רקע עליון מדורג מלבן לכחול כמו התפריט. בלי נגיעה באשף/כניסה/לוגיקה.
   הרצה: node _test-cf-new-policy-sum-date.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260910-cf-open-paint-v1";
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

function sliceFunction(src, startToken){
  const start = src.indexOf(startToken);
  if(start < 0) return "";
  let i = src.indexOf("{", start);
  if(i < 0) return "";
  let depth = 0;
  for(; i < src.length; i++){
    const ch = src[i];
    if(ch === "{") depth += 1;
    else if(ch === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, i + 1);
    }
  }
  return "";
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const wiz = fs.readFileSync(path.join(ROOT, "gi-wizard.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
const theme = fs.readFileSync(path.join(ROOT, "theme.css"), "utf8");

console.log("1) syntax + aligned cache tags");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(app.includes('const BUILD = "' + TAG + '"'), "BUILD");
assert(app.includes('GI_WIZARD_JS_VERSION = "' + TAG + '"'), "GI_WIZARD_JS_VERSION aligned with BUILD");
assert(wiz.includes('GI_WIZARD_BUILD = "' + TAG + '"'), "gi-wizard BUILD aligned");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache");
assert(html.includes("theme.css?v=" + TAG), "index.html theme.css cache");
assert(sw.includes("gi-v12-" + TAG), "service-worker cache");

console.log("\n2) display helpers exist; save/login/wizard untouched");
assert(app.includes("formatCfPolicyStartDate"), "date display helper");
assert(app.includes("formatCfRiskOrCiSumDisplay"), "sum display helper");
assert(app.includes('type !== "ריסק משכנתא" && type !== "סרטן" && type !== "מחלות קשות"'), "only the four requested products");
assert(app.includes("this.formatCfPolicyStartDate(policy.startDate || rawPol.startDate)"), "row uses formatted date");
assert(app.includes("targetSum || ((isLife && displaySum)"), "amount uses helper first");
assert(app.includes("_verifyPendingMfa"), "MFA path untouched");
assert(app.includes("function giWizardChunkLooksInstallable"), "wizard drift-accept remains");
assert(app.includes("Auth._submit = async function()"), "login submit untouched");
assert(!app.includes("softRecoverStaleWizardBuild();\n            if(recovering)"), "wizard load still does not full-page-reload");

console.log("\n3) header background: white → sidebar blue, not pale cyan");
assert(theme.includes("linear-gradient(180deg, #FFFFFF 0%, #D6E4FF 48%, #3870ED 155%)"), "header white-to-navy like sidebar");
assert(!/customerFull__top[\s\S]{0,280}#E8F1FF 0%/.test(theme), "old pale-cyan header fill removed");
assert(theme.includes(".sidebar:not(#\\9):not(#\\9)") && theme.includes("background: var(--gi-navy) !important"), "sidebar navy token unchanged");
assert(theme.includes(".cfFile__idCard:not(#\\9):not(#\\9)"), "customer identity card CSS remains");

console.log("\n4) runtime: date flipped ISO → DD/MM/YYYY; sums from stored fields");
const dateFn = sliceFunction(app, "formatCfPolicyStartDate(value)");
const sumFn = sliceFunction(app, "formatCfRiskOrCiSumDisplay(policy, rawPol, coverRows)");
assert(dateFn.length > 40, "extracted date helper");
assert(sumFn.length > 80, "extracted sum helper");

const sandbox = {
  parseAnyDmyDate(value){
    const s = String(value == null ? "" : value).trim();
    let hit = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if(hit) return { year: Number(hit[1]), month: Number(hit[2]), day: Number(hit[3]) };
    hit = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
    if(hit) return { year: Number(hit[3]), month: Number(hit[2]), day: Number(hit[1]) };
    return null;
  },
  formatDmyFromParts(y, m, d){
    return String(d).padStart(2, "0") + "/" + String(m).padStart(2, "0") + "/" + String(y).padStart(4, "0");
  },
  safeTrim(v){ return String(v == null ? "" : v).trim(); }
};
vm.createContext(sandbox);
vm.runInContext(
  "this.asMoneyNumber = function(v){ const n = Number(String(v == null ? '' : v).replace(/[^\\d.\\-]/g, '')); return Number.isFinite(n) ? n : 0; };\n" +
  "this.formatMoneyValue = function(n){ return '₪' + Number(n).toLocaleString('he-IL'); };\n" +
  "function " + dateFn + "\nfunction " + sumFn + "\n" +
  "this.formatCfPolicyStartDate = formatCfPolicyStartDate;\n" +
  "this.formatCfRiskOrCiSumDisplay = formatCfRiskOrCiSumDisplay;",
  sandbox
);

const ui = {
  asMoneyNumber: sandbox.asMoneyNumber,
  formatMoneyValue: sandbox.formatMoneyValue,
  formatCfPolicyStartDate: sandbox.formatCfPolicyStartDate,
  formatCfRiskOrCiSumDisplay(policy, rawPol, coverRows){
    return sandbox.formatCfRiskOrCiSumDisplay.call(this, policy, rawPol, coverRows);
  }
};

assert(ui.formatCfPolicyStartDate("2026-10-01") === "01/10/2026", "ISO date flipped to DD/MM/YYYY");
assert(ui.formatCfPolicyStartDate("01/10/2026") === "01/10/2026", "already-correct date stays");
assert(ui.formatCfPolicyStartDate("") === "—", "empty date is dash");
assert(ui.formatCfRiskOrCiSumDisplay({ type: "ריסק" }, { sumInsured: "500000" }, []).indexOf("500,000") >= 0, "risk sumInsured on the row");
assert(ui.formatCfRiskOrCiSumDisplay({ type: "ריסק משכנתא" }, { sumInsured: "1,000,000" }, []).indexOf("1,000,000") >= 0, "mortgage-risk formatted sum");
assert(ui.formatCfRiskOrCiSumDisplay({ type: "סרטן" }, { compensation: "250000" }, []).indexOf("250,000") >= 0, "cancer compensation on the row");
assert(ui.formatCfRiskOrCiSumDisplay({ type: "מחלות קשות" }, { compensationPerInsured: { a: "300000" } }, []).indexOf("300,000") >= 0, "illness per-insured amount");
assert(ui.formatCfRiskOrCiSumDisplay({ type: "בריאות" }, { sumInsured: "500000" }, []) === "", "health policies unchanged");
assert(ui.formatCfRiskOrCiSumDisplay({ type: "ריסק" }, { sumInsured: "150.79" }, []) === "", "premium-sized number is not treated as sum");

console.log("\n" + (failed ? ("FAILED: " + failed) : ("OK — " + passed + " checks")));
process.exit(failed ? 1 : 0);
