/* GI-STEP1-SIM-PERSONAL 2026-09-08
   פוליסה זוגית (ריסק / ריסק משכנתא / מחלות קשות / סרטן):
   תאריך תחילה וסכום פיצוי נמשכים מהראשי; מין ועישון מגיעים משלב 1 לכל מבוטח.
   הרצה: node _test-wizard-couple-step1-personal.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260913-phoenix-health-decl-v1";
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

function safeTrim(v){ return String(v == null ? "" : v).trim(); }

function sliceFn(src, startToken, endToken){
  const start = src.indexOf(startToken);
  const end = src.indexOf(endToken, start + startToken.length);
  if(start < 0 || end < 0) return "";
  return src.slice(start, end);
}

const wiz = read("gi-wizard.js");
const sims = read("gi-simulators.js");
const app = read("app.js");
const html = read("index.html");
const sw = read("service-worker.js");

console.log("1) syntax + cache (tag unchanged)");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-simulators.js")]).status === 0, "node --check gi-simulators.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-wizard-couple-step1-personal.js")]).status === 0, "node --check this test");
assert(wiz.includes('GI_WIZARD_BUILD = "' + TAG + '"'), "wizard cache tag unchanged");
assert(app.includes('GI_SIMULATOR_JS_HREF = "./gi-simulators.js?v=' + TAG + '"'), "simulator cache tag unchanged");
assert(html.includes("app.js?v=" + TAG), "index.html cache unchanged");
assert(sw.includes("gi-v12-" + TAG), "service worker cache unchanged");

console.log("\n2) source — couple copies shared fields, not gender/smoker");
assert(sims.includes("GI-STEP1-SIM-PERSONAL"), "step1 personal marker");
assert(sims.includes("function riskSimGenderFromStep1(d)"), "gender helper");
assert(sims.includes("function riskSimSmokerFromStep1(d)"), "smoker helper");
assert(sims.includes("function riskSimApplyStep1PersonalToState(sim)"), "apply-to-state helper");
assert(sims.includes("function riskSimMergeRestoredInsuredState(base, saved)"), "restore merge keeps step1 gender/smoker");
assert(sims.includes('RISK_SIM_COUPLE_SHARED_FIELDS = ["sumInsured", "compensation", "insuranceStartDate"]'), "couple shared fields are start/sum/compensation only");
assert(!/RISK_SIM_COUPLE_SHARED_FIELDS = \[[^\]]*(gender|smoker)/.test(sims), "couple shared fields do not include gender or smoker");
assert(sims.includes("riskSimCopyCoupleSharedFieldsFromId(sim, fromId)"), "switching couple tab copies shared fields first");
assert(sims.includes("try { riskSimApplyStep1PersonalToState(handler); }"), "open applies step1 personal after prefill");
assert(wiz.includes('ins.data.smokingStatus = "";'), "adding a spouse/child does not inherit primary smoking");
assert(/getPolicyPremiumAfterDiscount\(policy\)\{\s*\/\/ 20260502-vFinalPremiumNoDiscountCalc:/.test(wiz)
  || wiz.includes("return this.getPolicyPremiumBeforeDiscount(policy);"), "premium engine untouched");

console.log("\n3) runtime — gender/smoker from step 1 per insured");
const genderSrc = sliceFn(sims, "function riskSimGenderFromStep1(d){", "function riskSimSmokerFromStep1(d){");
const smokerSrc = sliceFn(sims, "function riskSimSmokerFromStep1(d){", "function riskSimApplyStep1PersonalToState(sim){");
const applySrc = sliceFn(sims, "function riskSimApplyStep1PersonalToState(sim){", "function riskSimIsoDateDaysAgo");
const mergeSrc = sliceFn(sims, "function riskSimMergeRestoredInsuredState(base, saved){", "function riskSimApplyRestoredState(sim, restore, activeId){");
assert(!!genderSrc && !!smokerSrc && !!applySrc && !!mergeSrc, "helpers extracted");

const genderFromStep1 = new Function("safeTrim", genderSrc + "\nreturn riskSimGenderFromStep1;")(safeTrim);
const smokerFromStep1 = new Function("safeTrim", smokerSrc + "\nreturn riskSimSmokerFromStep1;")(safeTrim);
const applyStep1 = new Function("safeTrim", "riskSimGenderFromStep1", "riskSimSmokerFromStep1", applySrc + "\nreturn riskSimApplyStep1PersonalToState;")(safeTrim, genderFromStep1, smokerFromStep1);
const mergeRestored = new Function("safeTrim", mergeSrc + "\nreturn riskSimMergeRestoredInsuredState;")(safeTrim);

assert(genderFromStep1({ gender: "זכר" }) === "זכר", "זכר stays זכר");
assert(genderFromStep1({ gender: "נקבה" }) === "נקבה", "נקבה stays נקבה");
assert(genderFromStep1({ gender: "male" }) === "זכר", "male maps to זכר");
assert(genderFromStep1({ gender: "female" }) === "נקבה", "female maps to נקבה");
assert(genderFromStep1({ gender: "" }) === "", "empty gender stays empty");

assert(smokerFromStep1({ smokingStatus: "yes" }) === true, "yes → מעשן");
assert(smokerFromStep1({ smokingStatus: "no" }) === false, "no → לא מעשן");
assert(smokerFromStep1({ smokingStatus: "כן" }) === true, "כן → מעשן");
assert(smokerFromStep1({ smokingStatus: "לא" }) === false, "לא → לא מעשן");
assert(smokerFromStep1({ smoker: true }) === true, "boolean smoker true");
assert(smokerFromStep1({ smokingStatus: "" }) == null, "empty smoking stays unset");

{
  const sim = {
    _ctx: {
      insureds: [
        { id: "i1", data: { gender: "זכר", smokingStatus: "yes" } },
        { id: "i2", data: { gender: "female", smokingStatus: "לא" } }
      ]
    },
    _state: {
      i1: { gender: "", smoker: null },
      i2: { gender: "", smoker: null }
    }
  };
  applyStep1(sim);
  assert(sim._state.i1.gender === "זכר" && sim._state.i1.smoker === true, "primary gets step1 male smoker");
  assert(sim._state.i2.gender === "נקבה" && sim._state.i2.smoker === false, "spouse gets her own female non-smoker");
  assert(sim._state.i1.genderSource === "step1" && sim._state.i2.smokerSource === "step1", "sources marked step1");
}

{
  const sim = {
    _ctx: { insureds: [{ id: "i2", data: { gender: "נקבה", smokingStatus: "no" } }] },
    _state: { i2: { gender: "זכר", genderSource: "manual", smoker: true, smokerSource: "manual" } }
  };
  applyStep1(sim);
  assert(sim._state.i2.gender === "זכר" && sim._state.i2.smoker === true, "already-chosen simulator gender/smoker are not overwritten");
}

{
  const merged = mergeRestored(
    { gender: "נקבה", genderSource: "step1", smoker: false, smokerSource: "step1", sumInsured: "" },
    { gender: "", smoker: null, sumInsured: "800000", insuranceStartDate: "01/10/2026" }
  );
  assert(merged.gender === "נקבה", "empty restore gender does not wipe step1 נקבה");
  assert(merged.smoker === false, "empty restore smoker does not wipe step1 לא מעשן");
  assert(merged.sumInsured === "800000", "restore still writes the shared sum");
  assert(merged.insuranceStartDate === "01/10/2026", "restore still writes the start date");
}

console.log("\n4) runtime — couple copy still fills start/compensation, not personal");
{
  const copyStart = sims.indexOf("function riskSimCopyCoupleSharedFieldsFromId(sim, sourceId){");
  const copyEnd = sims.indexOf("function riskSimCopyCoupleSharedFieldsFromSeed(sim){", copyStart);
  const fnSrc = sims.slice(copyStart, copyEnd);
  const copyFromId = new Function(
    "safeTrim",
    "riskSimAllowsCouplePolicy",
    "riskSimCoupleSelectedIds",
    fnSrc + "\nreturn riskSimCopyCoupleSharedFieldsFromId;"
  )(safeTrim, () => true, (sim) => Object.keys(sim._giCoupleIds || {}).filter((id) => sim._giCoupleIds[id]));

  const sim = {
    _giCoupleOn: true,
    _ctx: { wizardWorkspace: true, product: "מחלות קשות" },
    _giCoupleIds: { i1: true, i2: true },
    _state: {
      i1: {
        compensation: "100000",
        insuranceStartDate: "01/10/2026",
        gender: "זכר",
        smoker: true,
        result: { ok: true, monthlyPremium: 38 }
      },
      i2: {
        compensation: "",
        insuranceStartDate: "",
        gender: "נקבה",
        smoker: false,
        result: null
      }
    },
    _syncAge(st){ st.ageSynced = st.insuranceStartDate; }
  };
  copyFromId(sim, "i1");
  assert(sim._state.i2.compensation === "100000", "CI couple copies primary compensation onto secondary");
  assert(sim._state.i2.insuranceStartDate === "01/10/2026", "couple copies primary start date onto secondary");
  assert(sim._state.i2.gender === "נקבה", "couple copy does not overwrite spouse gender");
  assert(sim._state.i2.smoker === false, "couple copy does not overwrite spouse smoker");
}

{
  const copyStart = sims.indexOf("function riskSimCopyCoupleSharedFieldsFromId(sim, sourceId){");
  const copyEnd = sims.indexOf("function riskSimCopyCoupleSharedFieldsFromSeed(sim){", copyStart);
  const fnSrc = sims.slice(copyStart, copyEnd);
  const copyFromId = new Function(
    "safeTrim",
    "riskSimAllowsCouplePolicy",
    "riskSimCoupleSelectedIds",
    fnSrc + "\nreturn riskSimCopyCoupleSharedFieldsFromId;"
  )(safeTrim, (product) => product === "ריסק משכנתא", (sim) => Object.keys(sim._giCoupleIds || {}).filter((id) => sim._giCoupleIds[id]));
  const sim = {
    _giCoupleOn: true,
    _ctx: { wizardWorkspace: true, product: "ריסק משכנתא" },
    _giCoupleIds: { i1: true, i2: true },
    _state: {
      i1: { sumInsured: "900000", insuranceStartDate: "15/03/2027", gender: "זכר", smoker: false },
      i2: { sumInsured: "", insuranceStartDate: "", gender: "נקבה", smoker: true }
    },
    _syncAge(){}
  };
  copyFromId(sim, "i1");
  assert(sim._state.i2.sumInsured === "900000", "mortgage-risk couple copies primary sum");
  assert(sim._state.i2.insuranceStartDate === "15/03/2027", "mortgage-risk couple copies primary start date");
  assert(sim._state.i2.smoker === true, "mortgage-risk spouse smoker stays from step 1");
}

console.log("\n5) wizard addInsured clears smoking for the new person");
{
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
    nowISO: () => "2026-09-08T12:00:00.000Z",
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
    document: {
      getElementById(){ return null; },
      createElement(){ return {}; },
      querySelectorAll(){ return []; },
      querySelector(){ return null; },
      addEventListener(){}, removeEventListener(){},
      body: {}
    },
    console,
    Auth: { current: { name: "נציג בדיקה" } }
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(wiz, sandbox, { filename: "gi-wizard.js" });
  const W = host.Wizard;
  W.step = 1;
  W.insureds = [{
    id: "i1",
    type: "primary",
    label: "ראשי",
    data: { firstName: "דוד", gender: "זכר", smokingStatus: "yes", smokingType: "סיגריות", smokingAmount: "10" }
  }];
  W.render = function(){};
  W.setHint = function(){};
  W.syncInsuredShabanForClinic = function(){};
  W.propagateClinicFromPrimary = function(){};
  W.addInsured("spouse");
  const spouse = W.insureds.find((x) => x.type === "spouse");
  assert(!!spouse, "spouse was added");
  assert(safeTrim(spouse.data.gender) === "", "new spouse gender starts empty — filled in step 1 for her");
  assert(safeTrim(spouse.data.smokingStatus) === "", "new spouse smoking is not copied from the primary");
  assert(safeTrim(spouse.data.smokingType) === "", "new spouse smoking type is not copied from the primary");
}

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
