/* GI-OPS 2026-09-14 — שעבוד: ספרה יחידה בשדה «לכמה שנים» (2 = שנתיים, 02 = שנתיים).
   הרצה: node _test-ops-pledge-years-digit.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260914-ils-km-shorthand-v1";
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

function sliceFn(src, startToken){
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

const wiz = read("gi-wizard.js");
const sims = read("gi-simulators.js");
const app = read("app.js");
const html = read("index.html");
const css = read("app.css");
const sw = read("service-worker.js");
const shellCss = read("simulators-shell.css");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-simulators.js")]).status === 0, "node --check gi-simulators.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(app.includes('BUILD = "' + TAG + '"'), "app.js BUILD");
assert(app.includes('GI_WIZARD_JS_VERSION = "' + TAG + '"'), "wizard version");
assert(app.includes('GI_SIMULATOR_JS_HREF = "./gi-simulators.js?v=' + TAG + '"'), "simulator href");
assert(app.includes("simulators-shell.css?v=" + TAG), "shell css href");
assert(wiz.includes('GI_WIZARD_BUILD = "' + TAG + '"'), "wizard build");
assert(html.includes("app.js?v=" + TAG), "index.html app.js");
assert(html.includes("app.css?v=" + TAG), "index.html app.css");
assert(sw.includes("gi-v12-" + TAG), "service-worker cache");

console.log("\n2) normalizePledgeYears — 2 and 02 are both two years");
const wizNormSrc = sliceFn(wiz, "normalizePledgeYears(value)");
const simNormSrc = sliceFn(sims, "function riskSimNormalizePledgeYears(value)");
assert(!!wizNormSrc, "wizard helper extracted");
assert(!!simNormSrc, "simulator helper extracted");
const normalizePledgeYears = new Function("function " + wizNormSrc + "; return normalizePledgeYears;")();
const riskSimNormalizePledgeYears = new Function(simNormSrc + "; return riskSimNormalizePledgeYears;")();
assert(normalizePledgeYears("2") === "2", "wizard: 2 → 2");
assert(normalizePledgeYears("02") === "2", "wizard: 02 → 2");
assert(normalizePledgeYears(" 2 ") === "2", "wizard: padded 2 → 2");
assert(normalizePledgeYears("0") === "", "wizard: 0 is empty");
assert(normalizePledgeYears("") === "", "wizard: blank is empty");
assert(normalizePledgeYears("30") === "30", "wizard: 30 stays 30");
assert(riskSimNormalizePledgeYears("2") === "2", "sim: 2 → 2");
assert(riskSimNormalizePledgeYears("02") === "2", "sim: 02 → 2");
assert(riskSimNormalizePledgeYears("0") === "", "sim: 0 is empty");

console.log("\n3) validation accepts a single digit");
assert(wiz.includes('k === "years" ? !!this.normalizePledgeYears(b[k])'), "step-4 missing-fields uses numeric years");
assert(wiz.includes("!this.normalizePledgeYears(b.years)"), "step-5 continue uses numeric years");
assert(wiz.includes("next.years = this.normalizePledgeYears(next.years)"), "simulator legal copies normalized years");

console.log("\n4) simulator confirm does not approve empty years, does keep 2");
const confirmSrc = sliceFn(sims, "function riskSimBindLegalPanel(sim)");
assert(confirmSrc.includes("riskSimPledgeBankMissingLabel"), "אשר checks required pledge fields");
assert(sims.includes("משך השיעבוד בשנים"), "אשר names the years field");
assert(confirmSrc.includes("legal.pledgeConfirmed = true"), "אשר still confirms when complete");
assert(confirmSrc.includes("if(missing)"), "אשר returns when years/other fields are missing");
assert(sims.includes("years: riskSimNormalizePledgeYears(read(\"years\")) || read(\"years\")"), "capture keeps a typed 2");
assert(/data-gishell-legal-bank-field="years"[^>]*dir="ltr"|dir="ltr"[^>]*data-gishell-legal-bank-field="years"/.test(sims), "simulator years is LTR");
assert(wiz.includes('data-pdraft-bank="years"') && wiz.includes('placeholder="למשל 2"'), "wizard years placeholder shows a single digit is ok");
assert(css.includes('input[data-pdraft-bank="years"]'), "wizard years LTR style");
assert(shellCss.includes('input[data-gishell-legal-bank-field="years"]'), "simulator years LTR style");
assert(shellCss.includes("max-height:min(52vh, 440px)"), "legal dock is tall enough to show years");

console.log("\n5) missing-label treats 2 as filled");
const missLabelSrc = sliceFn(sims, "function riskSimPledgeBankMissingLabel(b)");
assert(!!missLabelSrc, "missing-label helper extracted");
const riskSimPledgeBankMissingLabel = new Function(
  "safeTrim",
  "riskSimNormalizePledgeYears",
  missLabelSrc + "; return riskSimPledgeBankMissingLabel;"
)((v) => String(v == null ? "" : v).trim(), riskSimNormalizePledgeYears);
const filled = { bankName:"מזרחי", bankNo:"20", branch:"477", amount:"45000", years:"2", address:"זבוטינסקי" };
assert(riskSimPledgeBankMissingLabel(filled) === "", "full bank with years=2 is complete");
assert(riskSimPledgeBankMissingLabel(Object.assign({}, filled, { years:"02" })) === "", "years=02 is complete");
assert(riskSimPledgeBankMissingLabel(Object.assign({}, filled, { years:"" })) === "משך השיעבוד בשנים", "empty years is the missing field");
assert(riskSimPledgeBankMissingLabel(Object.assign({}, filled, { years:"0" })) === "משך השיעבוד בשנים", "years=0 is missing");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
