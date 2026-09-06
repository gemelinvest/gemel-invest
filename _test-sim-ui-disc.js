/* GI-SIM-UI-DISC 2026-09-05
   טקסט גדול יותר בסימולטורים, שדות סכום/תחילה ריקים,
   ומסך הנחה בשורה לפי קטלוג הסימולטור בלי גלילה בפתיחה.
   בלי שינוי במנועי פרמיה / נוסחאות הנחה.
   הרצה: node _test-sim-ui-disc.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const vm = require("vm");

const ROOT = __dirname;
const TAG = "20260906-rows-advance-v1";
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
const wiz = read("gi-wizard.js");
const sims = read("gi-simulators.js");
const html = read("index.html");
const css = read("app.css");
const shell = read("simulators-shell.css");
const sw = read("service-worker.js");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-simulators.js")]).status === 0, "node --check gi-simulators.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=" + TAG), "index app.js cache");
assert(sw.includes("gi-v12-" + TAG), "service worker cache");
assert(app.includes('GI_SIMULATOR_JS_HREF = "./gi-simulators.js?v=' + TAG + '"'), "simulator chunk cache");
assert(app.includes("simulators-shell.css?v=" + TAG), "shell css cache");
assert(app.includes("simulators-center.css?v=" + TAG), "center css cache");
assert(wiz.includes('GI_WIZARD_BUILD = "' + TAG + '"'), "wizard build tag");

console.log("\n2) larger simulator text");
assert(shell.includes("GI-SIM-TEXT 2026-09-05"), "last-wins readable type block");
const textBlock = shell.slice(shell.lastIndexOf("GI-SIM-TEXT 2026-09-05"));
assert(textBlock.includes("font-size:17px !important"), "labels 17px last");
assert(textBlock.includes("font-size:18px !important"), "inputs 18px last");
assert(textBlock.includes("giSimDisc__picked"), "chosen discount line bumped");
assert(textBlock.includes("__result--ok"), "green result box bumped");
assert(textBlock.includes("giSimShell__ageBadgeLabel"), "age line bumped");
assert(shell.includes('font-size:14px !important') && shell.includes("__coverLabel"), "cover labels bumped");
assert(shell.includes("GI-SIM-INSURED-TABS 2026-09-05"), "insured name chips last-wins block");
const tabBlock = shell.slice(shell.lastIndexOf("GI-SIM-INSURED-TABS 2026-09-05"));
assert(tabBlock.includes("font-size:17px !important"), "insured tab names 17px last");
assert(tabBlock.includes(".giSimShell__tab:hover{"), "insured tab hover bound");
assert(tabBlock.includes("border-radius:12px !important"), "insured tab is a boxed chip");

console.log("\n3) fill fields empty except personal details");
assert(/function resolveInsuranceStartDate\([\s\S]{0,80}return "";/.test(sims), "start date is not auto-filled");
assert(!sims.includes("st.insuranceStartDate = val || riskSimTodayDmy();"), "blur does not write today into start date");
assert(!sims.includes('placeholder="לדוגמה: 100,000"'), "no compensation example placeholder");
assert(sims.includes('const compensation = "";'), "CI compensation starts empty");
assert(sims.includes('const sumInsured = "";'), "sum insured starts empty");
assert(!/const compensation =[\s\S]{0,80}\|\| "100000"/.test(sims), "no 100000 compensation default");

console.log("\n4) row discount uses simulator catalog, per insured, compact");
assert(sims.includes("host.GiSimulatorDiscounts = discApi"), "simulator discount API exported");
assert(wiz.includes("getPolicyRowDiscountOptions(policy, productType)"), "wizard reads simulator discount list");
assert(wiz.includes("_paintPolicyDiscountInsureds(policy, discountOpts)"), "multi-insured discount pills");
assert(html.includes('id="lcPolicyDiscountInsureds"'), "insured bar exists in the discount modal");
assert(css.includes("GI-NP-DISC-COMPACT"), "compact discount layout styles");
assert(/lcPolicyDiscountModal \.modal__body\{[\s\S]{0,40}overflow:hidden/.test(css), "discount body does not scroll on open");
assert(wiz.includes("_applySimulatorDiscountAfter(policy, insId, wizardOpt)"), "save uses existing afterMonthly");
assert(wiz.includes("api.afterMonthly(result, raw)"), "after-price comes from existing simulator engine");

console.log("\n5) engines untouched");
assert(wiz.includes("return this.getPolicyPremiumBeforeDiscount(policy);"), "global after-discount engine still identity");
assert(/getPolicyPremiumAfterDiscount\(policy\)\{\s*\/\/ 20260502-vFinalPremiumNoDiscountCalc:/.test(wiz), "no-discount-calc marker remains");
assert(wiz.includes("GI-HEALTH-ONE-DECL"), "declaration routing marker remains");
assert(/function giSimDiscountAfterMonthly\(result, opt\)\{/.test(sims), "simulator afterMonthly function unchanged by rewrite");

console.log("\n6) runtime — empty start date + sim discount list");
const sandbox = {
  console,
  Number,
  String,
  Array,
  Object,
  Math,
  Date,
  JSON,
  parseInt,
  isNaN,
  safeTrim(v){ return String(v == null ? "" : v).trim(); }
};
vm.createContext(sandbox);
const resolveSrc = sims.match(/function resolveInsuranceStartDate\([\s\S]*?\n  \}/);
assert(!!resolveSrc, "resolveInsuranceStartDate source extracted");
if(resolveSrc){
  vm.runInContext(resolveSrc[0] + "\nthis.resolveInsuranceStartDate = resolveInsuranceStartDate;", sandbox);
  assert(sandbox.resolveInsuranceStartDate({ insuranceStartDate: "01/01/2026" }, { data: { insuranceStartDate: "02/02/2026" } }) === "", "resolve ignores ctx/insured defaults");
}
const listSrc = sims.match(/function giSimDiscountList\(company, product\)\{[\s\S]*?\n  \}/);
const catStart = sims.indexOf("const GI_SIMULATOR_DISCOUNT_CATALOG = {");
assert(catStart >= 0, "simulator discount catalog exists");
assert(sims.includes('"כלל"') && sims.includes('"ריסק"'), "Clal risk discounts exist in the simulator catalog");

if(failed){
  console.error("\nFAILED " + failed + "/" + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + "/" + (passed + failed));
