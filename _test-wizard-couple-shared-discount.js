/* GI-COUPLE-SHARED-DISCOUNT 2026-09-07
   פוליסה זוגית: אותה הנחה לכל המבוטחים, פרמיה אחרי הנחה לכל אחד במנוע הקיים,
   ואותו סכום בדוח התפעולי ובתיק הלקוח.
   הרצה: node _test-wizard-couple-shared-discount.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260913-cancel-sum-full-partial-v2";
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

function sliceBetween(src, startToken, endToken){
  const start = src.indexOf(startToken);
  const end = src.indexOf(endToken, start + startToken.length);
  if(start < 0 || end < 0) return "";
  return src.slice(start, end);
}

function safeTrim(v){ return String(v == null ? "" : v).trim(); }

const wiz = read("gi-wizard.js");
const sims = read("gi-simulators.js");
const app = read("app.js");
const html = read("index.html");
const sw = read("service-worker.js");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-simulators.js")]).status === 0, "node --check gi-simulators.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(wiz.includes('GI_WIZARD_BUILD = "' + TAG + '"'), "wizard build tag");
assert(app.includes('GI_WIZARD_JS_VERSION = "' + TAG + '"'), "app.js wizard version");
assert(app.includes('GI_SIMULATOR_JS_HREF = "./gi-simulators.js?v=' + TAG + '"'), "simulator chunk cache");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache");
assert(sw.includes("gi-v12-" + TAG), "service worker cache");

console.log("\n2) multi-select keeps a separate discount per insured");
assert(sims.includes("function riskSimCopyCoupleDiscountFromId(sim, sourceId)"), "copy helper exists");
assert(sims.includes("function riskSimCopyCoupleDiscountFromSeed(sim)"), "seed helper exists");
assert(sims.includes("GI-MULTI-SELECT-OWN-DISCOUNT"), "own-discount marker present");
assert(sims.includes("בחירה מרובה אינה מעתיקה הנחה בין מבוטחים"), "docs say multi-select does not copy discount");
assert(sims.includes("הנחה לא מועתקת בבחירה מרובה"), "ensure-shared-results skips discount copy");
assert(!sims.includes("try { riskSimCopyCoupleDiscountFromSeed(sim); } catch(_eDiscOn) {}"), "checking multi-select no longer copies discount");
assert(!sims.includes("try { riskSimCopyCoupleDiscountFromSeed(sim); } catch(_eDisc) {}"), "add-to-proposal no longer copies discount before fill");

{
  const start = sims.indexOf("function riskSimCopyCoupleDiscountFromId(sim, sourceId){");
  const end = sims.indexOf("function riskSimCopyCoupleDiscountFromSeed(sim){", start);
  const fnSrc = sims.slice(start, end);
  const fn = new Function(
    "safeTrim",
    "riskSimAllowsCouplePolicy",
    "riskSimCoupleSelectedIds",
    "riskSimCoupleSeedInsuredId",
    fnSrc + "\nreturn riskSimCopyCoupleDiscountFromId;"
  );
  const copy = fn(
    safeTrim,
    () => true,
    (sim) => ["i1", "i2"],
    () => "i1"
  );
  const sim = {
    _giCoupleOn: true,
    _ctx: { wizardWorkspace: true, product: "ריסק" },
    _activeInsuredId: "i1",
    _giSimDiscountSel: { i1: "cll-r-5001", i2: "own-opt" }
  };
  copy(sim, "i1");
  assert(sim._giSimDiscountSel.i1 === "cll-r-5001", "keeps the source option");
  assert(sim._giSimDiscountSel.i2 === "own-opt", "does not overwrite the secondary discount");
  sim._giSimDiscountSel.i1 = "";
  copy(sim, "i1");
  assert(sim._giSimDiscountSel.i2 === "own-opt", "clearing primary discount leaves secondary untouched");
}

console.log("\n3) wizard applies the same option and recomputes each premium");
assert(wiz.includes("applyCoupleSharedSimulatorDiscount(policy)"), "wizard couple discount helper");
assert(wiz.includes("this.applyCoupleSharedSimulatorDiscount(draft)"), "couple add applies shared discount");
assert(wiz.includes("this.applyCoupleSharedSimulatorDiscount(p)"), "addDraftPolicy applies shared discount");
assert(wiz.includes("this.applyCoupleSharedSimulatorDiscount(policy)"), "discount modal reapplies the shared option to every couple member");
assert(wiz.includes('policy.insuredMode) === "couple"') || wiz.includes('policy.insuredMode === "couple"'), "discount modal treats couple as shared");
assert(wiz.includes("getPolicyPremiumAfterDiscount(policy){"), "legacy after helper remains");
assert(/getPolicyPremiumAfterDiscount\(policy\)\{[\s\S]{0,280}return this\.getPolicyPremiumBeforeDiscount\(policy\);/.test(wiz), "global after-discount engine still identity");

const host = new Proxy({
  Wizard: {},
  safeTrim,
  parseAnyDmyDate(){ return null; },
  parseBirthDateValue(){ return null; },
  formatDmyFromParts(y, m, d){
    return String(d).padStart(2, "0") + "/" + String(m).padStart(2, "0") + "/" + String(y).padStart(4, "0");
  },
  escapeHtml: (s) => String(s == null ? "" : s),
  on(){}, $(){ return null; }, $$(){ return []; },
  nowISO: () => "2026-09-07T10:00:00.000Z",
  RiskSimulators: { hasCatalog(){ return true; }, getHandler(){ return { open(){}, close(){} }; } }
}, {
  get(target, prop){
    if(prop in target) return target[prop];
    if(prop === "then") return undefined;
    return () => {};
  }
});
const sandbox = {
  __GI_WIZARD_HOST: host,
  globalThis: null,
  window: { requestAnimationFrame(fn){ fn(); }, setTimeout(fn){ return fn(); }, clearTimeout(){}, showToast(){} },
  document: { getElementById(){ return null; }, createElement(){ return {}; }, querySelectorAll(){ return []; }, querySelector(){ return null; }, addEventListener(){}, removeEventListener(){}, body: {} },
  console,
  Auth: { current: { name: "נציג בדיקה" } }
};
sandbox.globalThis = sandbox;
vm.runInNewContext(wiz, sandbox, { filename: "gi-wizard.js" });
const W = host.Wizard;

{
  W.getSimulatorDiscountApi = () => ({
    byId(_co, _ty, id){
      if(id === "cll-r-5001") return { id, label: "65%", pct: 65, years: 1, schedule: [65] };
      return null;
    },
    afterMonthly(result, opt){
      const gross = Number(result && result.monthlyPremium) || 0;
      const pct = Number(opt && opt.pct) || 0;
      return Math.round(gross * (1 - pct / 100) * 100) / 100;
    },
    year1Pct(opt){ return Number(opt && opt.pct) || 0; }
  });
  const policy = {
    insuredMode: "couple",
    insuredIds: ["i1", "i2"],
    insuredId: "i1",
    company: "כלל",
    type: "ריסק",
    premiumPerInsured: { i1: "61.32", i2: "40" },
    riskSimQuotes: {
      i1: { ok: true, monthlyPremium: 61.32 },
      i2: { ok: true, monthlyPremium: 40 }
    },
    simDiscountPerInsured: {
      i1: { optionId: "cll-r-5001", year1Pct: 65, monthlyAfterDiscount: 21.46, label: "65%" }
    }
  };
  W.applyCoupleSharedSimulatorDiscount(policy);
  assert(policy.simDiscountPerInsured.i2.optionId === "cll-r-5001", "runtime copies option id to secondary");
  assert(policy.simDiscountPerInsured.i2.monthlyAfterDiscount === 14, "runtime recomputes 65% off 40 = 14 via afterMonthly");
  assert(policy.simDiscountPerInsured.i1.monthlyAfterDiscount === 21.46, "keeps the already-computed primary after amount");
  assert(W.getPolicySimDiscountAfterTotal(policy) === 35.46, "row total is 21.46 + 14");
  assert(W.getHealthRowPremiumAfterDiscount(policy) === 35.46, "ops/row after helper uses the couple total");
  assert(W.getPolicyPremiumAfterDiscount(policy) === W.getPolicyPremiumBeforeDiscount(policy), "legacy helper still returns gross");
}

console.log("\n4) ops report prints each couple member after-discount");
{
  const opsPayload = {
    agentName: "נציג בדיקה",
    primary: { firstName: "דוד", lastName: "כהן" },
    insureds: [
      { id: "i1", type: "primary", label: "דוד כהן", data: { firstName: "דוד", lastName: "כהן" } },
      { id: "i2", type: "spouse", label: "יעל כהן", data: { firstName: "יעל", lastName: "כהן" } }
    ],
    newPolicies: [{
      id: "opsCouple", company: "כלל", type: "ריסק",
      insuredIds: ["i1", "i2"], insuredId: "i1", insuredMode: "couple",
      premiumMonthly: 101.32, premiumPerInsured: { i1: "61.32", i2: "40" },
      sumInsuredPerInsured: { i1: "800000", i2: "800000" },
      startDate: "2026-11-01",
      simDiscountPerInsured: {
        i1: { optionId: "cll-r-5001", year1Pct: 65, monthlyAfterDiscount: 21.46, label: "65%" },
        i2: { optionId: "cll-r-5001", year1Pct: 65, monthlyAfterDiscount: 14, label: "65%" }
      }
    }]
  };
  let opsHtml = "";
  try {
    const pack = W.buildOperationalPdfMarkup(opsPayload, { forPreview: true });
    opsHtml = String(pack && pack.html || "");
  } catch(err){
    assert(false, "ops markup runs (" + (err && err.message) + ")");
  }
  assert(/₪\s*61[.,]32/.test(opsHtml) && /₪\s*21[.,]46/.test(opsHtml), "ops shows primary before 61.32 and after 21.46");
  assert(/₪\s*40/.test(opsHtml) && /₪\s*14/.test(opsHtml), "ops shows secondary before 40 and after 14");
  assert(opsHtml.includes("דוד כהן") && opsHtml.includes("יעל כהן"), "ops names both couple members");
}

console.log("\n5) customer file new-policy display uses simulator after-discount");
assert(app.includes("getNewPolicyFilePremiumAfterDiscount(policy)"), "customer file helper");
assert(app.includes("this.getNewPolicyFilePremiumAfterDiscount(p)"), "new-policy collect uses after-discount helper");
assert(app.includes("Wizard.getHealthRowPremiumAfterDiscount"), "file helper prefers the ops/row after amount");
assert(app.includes('"פרמיה חודשית לאחר הנחה": premiumAfterDiscount'), "file details show after-discount, not gross");
assert(!app.includes("getPolicyPremiumAfterDiscount(policy){\n      try {\n        if(typeof Wizard !== \"undefined\" && Wizard && typeof Wizard.getPolicyPremiumAfterDiscount") === false
  || app.includes("return Wizard.getPolicyPremiumAfterDiscount(policy)"), "legacy file helper still exists");

{
  const filePol = {
    type: "ריסק",
    insuredMode: "couple",
    insuredIds: ["i1", "i2"],
    premiumPerInsured: { i1: "61.32", i2: "40" },
    premiumMonthly: "101.32",
    simDiscountPerInsured: {
      i1: { monthlyAfterDiscount: 21.46 },
      i2: { monthlyAfterDiscount: 14 }
    }
  };
  const start = app.indexOf("getNewPolicyFilePremiumAfterDiscount(policy){");
  const end = app.indexOf("\n    getHealthPolicyBasePremium", start);
  const fnSrc = start >= 0 && end > start ? app.slice(start, end) : "";
  const makeHelper = new Function("Wizard", `
    const obj = {
      getPolicyPremiumAfterDiscount(){ return 101.32; },
      ${fnSrc}
    };
    return obj.getNewPolicyFilePremiumAfterDiscount.bind(obj);
  `);
  const withWizard = makeHelper({
    getHealthRowPremiumAfterDiscount(){ return 35.46; },
    getPolicySimDiscountAfterTotal(){ return 35.46; }
  });
  assert(withWizard(filePol) === 35.46, "file helper returns 21.46+14 when Wizard after helper exists");
  const withoutWizard = makeHelper(undefined);
  assert(withoutWizard(filePol) === 35.46, "file helper sums simDiscountPerInsured without Wizard");
}

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
