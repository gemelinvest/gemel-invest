/* GI-FIX 2026-08-13 — שלב 6 בריאות: כרטיס ויזואלי + זיהוי מותג/אורך בלי חיתוך.
   חסימת «הבא» רק באשראי. שמירה / הוראת קבע / מנורות שלב ללא שער חדש.
   הרצה: node _test-cc-brand-length.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const WIZARD_FILE = path.join(ROOT, "gi-wizard.js");
let failed = 0;
let passed = 0;

function assert(cond, msg){
  if(cond){
    passed += 1;
    console.log("  PASS  " + msg);
  }else{
    failed += 1;
    console.error("  FAIL  " + msg);
  }
}

function safeTrim(v){
  return String(v == null ? "" : v).trim();
}

function digitsOnly(value){
  return String(value == null ? "" : value).replace(/\D+/g, "");
}

console.log("1) syntax + cache");
const syntax = spawnSync(process.execPath, ["--check", WIZARD_FILE], { encoding: "utf8" });
assert(syntax.status === 0, "node --check gi-wizard.js");
if(syntax.status !== 0) console.error(syntax.stderr || syntax.stdout);

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const unify = fs.readFileSync(path.join(ROOT, "theme-unify-flat.css"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "app.css"), "utf8");
assert(app.includes('GI_WIZARD_JS_VERSION = "20260814-pay-card-v2"'), "app.js bumps gi-wizard cache");
assert(app.includes("theme-unify-flat.css?v=20260814-pay-card-v2"), "app.js bumps unify-flat cache");
assert(html.includes("app.js?v=20260814-face-login-v4"), "index.html bumps app.js cache");
assert(html.includes("app.css?v=20260814-face-login-v2"), "index.html bumps app.css cache");
assert(unify.includes(".lcHealthPayPanStatus"), "unify-flat has PAN status styles");
assert(!unify.includes("color-mix(in srgb, var(--brand)"), "unify-flat no longer forces a brand-tinted plastic card");
assert(css.includes(".lcHealthPayShell"), "app.css caps health card width like elementary");
assert(css.includes("max-width: min(100%, 580px)"), "health card shell is 580px like elementary");
assert(css.includes(".lcHealthPayCard__nums"), "app.css has CC numbers grid with CVV");

console.log("\n2) source contracts — additive UI, same save/HO/elementary");
const src = fs.readFileSync(WIZARD_FILE, "utf8");
const liveBind = src.slice(src.lastIndexOf("bindInputs(ins){"));
assert(liveBind.includes('if(path === "cc.cardNumber")'), "live bind formats health PAN without full render");
assert(liveBind.includes("this.formatHealthPanDisplay(dig)"), "health PAN display helper is used");
assert(!/formatHealthPanDisplay\(dig\)[\s\S]{0,80}slice\(0,\s*16\)/.test(liveBind), "health PAN bind does not slice to 16");
assert(liveBind.includes('if(path === "ho.branch")'), "HO branch lookup still follows PAN bind");
assert(liveBind.includes("this.scheduleHoBranchLookup(ins)"), "branch lookup is still debounced");
assert(liveBind.includes('if(path === "clinic")'), "clinic bind still follows payment binds");
assert(liveBind.includes("this.applyClinicChangeForInsured(ins)"), "clinic change still applies");

assert(src.includes("formatElementaryPanDisplay(digitsRaw){"), "elementary PAN helper remains");
assert(src.includes("digitsOnly(digitsRaw || '').slice(0, 16)"), "elementary still slices PAN to 16");
assert(src.includes("detectElementaryCardBrand(panDigitsRaw){"), "elementary brand helper remains");
assert(src.includes("elementaryPanSixteenDigitsOk(panDigitsRaw){"), "elementary 16-digit check remains");
assert(src.includes("key:'discover'"), "elementary Discover detection unchanged");

const healthFmt = src.slice(src.indexOf("formatHealthPanDisplay(digitsRaw){"), src.indexOf("evaluateHealthCardPan(panDigitsRaw){"));
assert(!healthFmt.includes("slice(0, 16)"), "health PAN formatter does not truncate extra digits");
assert(healthFmt.includes("digitsOnly(digitsRaw || \"\")"), "health PAN formatter stores/displays digits only");

const validateStep = src.slice(src.indexOf("validateStep(stepId){"), src.indexOf("isStepCompleteForInsured(stepId, ins){"));
assert(validateStep.includes("getHealthCardPanGate"), "validateStep(6) uses the credit PAN gate");
assert(!validateStep.includes("branchValid"), "validateStep still ignores HO branchValid");

const step6Complete = src.slice(src.indexOf("if(stepId === 6){"), src.indexOf("getStep6PaymentValidationDetail(ins){"));
assert(step6Complete.includes("return true;"), "isStepCompleteForInsured(6) still always true");
assert(/getStep6PaymentValidationDetail\(ins\)\{[\s\S]*?return \{ ok:true/.test(src), "payment validation detail still ok:true");

const saveDraftBlock = src.slice(src.indexOf("async saveDraft(){"), src.indexOf("getOperationalAgentNumbers(){"));
assert(saveDraftBlock.includes("this._persistProposalSaveInBackground(true)"), "saveDraft persist path unchanged");
assert(saveDraftBlock.includes("getPremiumValidationIssues"), "saveDraft still runs premium validation");
assert(!saveDraftBlock.includes("getHealthCardPanGate"), "saveDraft is not blocked by the new PAN gate");

assert(src.includes('id="lcHealthPayCard"'), "CC visual card is in step 6 HTML");
assert(src.includes("lcHealthPayShell"), "health card is width-capped like elementary");
assert(src.includes("lcHealthPayBrandBadge"), "brand is a text badge like elementary");
assert(src.includes("lcHealthPayCard__hoBadge"), "HO visual card uses a text badge");
assert(!src.includes("lcHealthPayLogo") && !src.includes("renderHealthCardBrandLogo"), "brand SVG logos were removed");
assert(src.includes('data-bind="cc.cardNumber"'), "CC PAN still uses data-bind");
assert(src.includes('data-bind="cc.cvv"'), "CVV remains a bound field");
assert(src.includes('data-payer="ho.bankName"'), "HO bank select still uses data-payer");
assert(!src.includes("bank-logo") && !src.includes("poalim.svg"), "no bank logo assets were added");

console.log("\n3) load real wizard methods");
const host = new Proxy({
  Wizard: {},
  safeTrim,
  digitsOnly,
  escapeHtml: (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"),
  on: () => {},
  $: () => null,
  $$: () => [],
  nowISO: () => "2026-08-13T21:00:00.000Z",
  getValidationConfigForBind: () => null,
  validateValueByKind: (_k, v) => ({ ok:true, clean: v, message:"" })
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
  window: {
    requestAnimationFrame(fn){ fn(); },
    setTimeout(fn){ fn(); return 1; },
    clearTimeout(){}
  },
  document: { getElementById(){ return null; } },
  console
};
sandbox.globalThis = sandbox;

try{
  vm.runInNewContext(src, sandbox, { filename: "gi-wizard.js" });
  assert(typeof host.Wizard.detectHealthCardBrand === "function", "detectHealthCardBrand installed");
  assert(typeof host.Wizard.getHealthCardPanGate === "function", "getHealthCardPanGate installed");
  assert(typeof host.Wizard.detectElementaryCardBrand === "function", "detectElementaryCardBrand still installed");
}catch(err){
  assert(false, "load gi-wizard.js: " + (err && err.message));
  console.error(err);
}

const W = host.Wizard;
W.flowType = "health";
W.els = { body: null };
W.insureds = [{
  id: "ins1",
  type: "primary",
  label: "ראשי",
  data: { firstName: "ישראל", lastName: "ישראלי", idNumber: "123456782" }
}];

function brandKey(pan){
  return W.detectHealthCardBrand(pan).key;
}

console.log("\n4) brand detection");
assert(brandKey("") === "unknown", "empty PAN → unknown");
assert(brandKey("4580123456789012") === "visa", "Visa 16 starting with 4");
assert(brandKey("5412753456789010") === "mastercard", "Mastercard 16 starting with 51-55");
assert(brandKey("2221001234567890") === "mastercard", "Mastercard 16 BIN 2221-2720");
assert(brandKey("378282246310005") === "amex", "Amex 15 starting with 37");
assert(brandKey("340000000000000") === "amex", "Amex 15 starting with 34");
assert(brandKey("30569311110104") === "diners", "Diners 14 starting with 305");
assert(brandKey("36000000000000") === "diners", "Diners 14 starting with 36");
assert(brandKey("12345678") === "isracard", "Isracard 8 with no international prefix");
assert(brandKey("123456789") === "isracard", "Isracard 9 with no international prefix");
assert(brandKey("6011000000000000") === "isracard", "Discover-like 16 is Isracard in health (no international prefix match)");
assert(W.detectElementaryCardBrand("6011000000000000").key === "discover", "elementary still detects Discover");
assert(W.detectElementaryCardBrand("4580123456789012").key === "visa", "elementary Visa detection unchanged");

console.log("\n5) length evaluation — no truncation");
assert(W.formatHealthPanDisplay("4580123456789012") === "4580 1234 5678 9012", "Visa display groups by 4");
assert(W.formatHealthPanDisplay("45801234567890123") === "4580 1234 5678 9012 3", "extra digit stays visible, not sliced");
assert(W.formatElementaryPanDisplay("45801234567890123") === "4580 1234 5678 9012", "elementary still slices the 17th digit");
assert(W.evaluateHealthCardPan("4580123456789012").state === "ok", "Visa 16 → ok");
assert(W.evaluateHealthCardPan("458012345678901").state === "short", "Visa 15 → short");
assert(W.evaluateHealthCardPan("45801234567890123").state === "long", "Visa 17 → long");
assert(W.evaluateHealthCardPan("378282246310005").state === "ok", "Amex 15 → ok");
assert(W.evaluateHealthCardPan("37828224631000").state === "short", "Amex 14 → short");
assert(W.evaluateHealthCardPan("30569311110104").state === "ok", "Diners 14 → ok");
assert(W.evaluateHealthCardPan("12345678").state === "ok", "Isracard 8 → ok");
assert(W.evaluateHealthCardPan("123456789").state === "ok", "Isracard 9 → ok");
assert(W.evaluateHealthCardPan("1234567").state === "short", "Isracard 7 → short");
assert(W.evaluateHealthCardPan("1234567890").state === "long", "Isracard 10 → long");
assert(W.evaluateHealthCardPan("4").state === "short", "single Visa digit is short, not screaming unknown");
assert(W.evaluateHealthCardPan("").state === "idle", "empty PAN is idle while typing");

console.log("\n6) Next gate vs save/lamps/HO");
function ccIns(pan, extra){
  return {
    data: Object.assign({
      paymentMethod: "cc",
      cc: { holderName: "", holderId: "", cardNumber: pan, exp: "", cvv: "" },
      ho: { account: "", branch: "", bankName: "", bankNo: "" }
    }, extra || {})
  };
}

W.insureds = [ccIns("")];
W.step = 6;
let gate = W.getHealthCardPanGate(W.insureds[0]);
assert(gate && gate.ok === false, "empty CC PAN blocks Next");
let v6 = W.validateStep(6);
assert(v6 && v6.ok === false, "validateStep(6) blocks empty CC PAN");
assert(W.isStepCompleteForInsured(6, W.insureds[0]) === true, "lamps stay complete even with empty PAN");
assert(W.getStep6PaymentValidationDetail(W.insureds[0]).ok === true, "getStep6PaymentValidationDetail stays ok");

W.insureds = [ccIns("4580123456789012")];
gate = W.getHealthCardPanGate(W.insureds[0]);
assert(gate && gate.ok === true, "Visa 16 allows Next even if name/exp/CVV empty");
v6 = W.validateStep(6);
assert(v6 && v6.ok === true, "validateStep(6) ok for matching Visa length");

W.insureds = [ccIns("45801234567890123")];
gate = W.getHealthCardPanGate(W.insureds[0]);
assert(gate && gate.ok === false && /יותר מדי/.test(gate.msg || ""), "Visa 17 blocks Next with long-digit message");
assert(W.insureds[0].data.cc.cardNumber === "45801234567890123", "long PAN is kept in the model, not truncated");

W.insureds = [ccIns("12345678")];
assert(W.getHealthCardPanGate(W.insureds[0]).ok === true, "Isracard 8 allows Next");
W.insureds = [ccIns("123456789")];
assert(W.getHealthCardPanGate(W.insureds[0]).ok === true, "Isracard 9 allows Next");
W.insureds = [ccIns("1234567")];
assert(W.getHealthCardPanGate(W.insureds[0]).ok === false, "Isracard 7 blocks Next");

const hoIns = {
  data: {
    paymentMethod: "ho",
    cc: { holderName: "", holderId: "", cardNumber: "", exp: "", cvv: "" },
    ho: { bankName: "בנק הפועלים", bankNo: "12", branch: "9999", account: "123" }
  }
};
W.insureds = [hoIns];
assert(W.getHealthCardPanGate(hoIns).ok === true, "HO ignores CC PAN gate");
v6 = W.validateStep(6);
assert(v6 && v6.ok === true, "validateStep(6) ok for HO even with invalid branch and empty PAN");
assert(W.isStepCompleteForInsured(6, hoIns) === true, "HO lamps unchanged");

console.log("\n7) renderStep6 markup");
W.insureds = [ccIns("4580123456789012", {
  payerChoice: "insured",
  selectedPayerId: "ins1",
  cc: { holderName: "ישראל ישראלי", holderId: "123456782", cardNumber: "4580123456789012", exp: "08/28", cvv: "123" }
})];
W.insureds[0].id = "ins1";
W.insureds[0].type = "primary";
W.insureds[0].label = "ראשי";
W.insureds[0].data.firstName = "ישראל";
W.insureds[0].data.lastName = "ישראלי";
const ccHtml = W.renderStep6(W.insureds[0]);
assert(/id="lcHealthPayCard"/.test(ccHtml), "CC render emits visual card");
assert(/data-bind="cc.cardNumber"/.test(ccHtml), "CC PAN remains data-bound");
assert(/4580 1234 5678 9012/.test(ccHtml), "CC PAN shown grouped, digits stored separately");
assert(/data-bind="cc.cvv"/.test(ccHtml), "CVV is on the visual card");
assert(/lcHealthPayBrandBadge/.test(ccHtml), "brand is a text badge like elementary");
assert(!/lcHealthPayLogo/.test(ccHtml), "CC card does not render a brand SVG logo");
assert(!/lcHealthPayCard__hoBadge/.test(ccHtml), "CC card does not show HO badge");

W.insureds = [hoIns];
const hoHtml = W.renderStep6(hoIns);
assert(/lcHealthPayCard--ho/.test(hoHtml), "HO render emits the same card shell");
assert(/lcHealthPayCard__hoBadge/.test(hoHtml), "HO badge text is הוראת קבע");
assert(/data-payer="ho.bankName"/.test(hoHtml), "HO bank select still bound");
assert(/data-bind="ho.bankNo"/.test(hoHtml) && /readonly/.test(hoHtml), "HO bankNo stays readonly");
assert(/id="lcHoBranchStatus"/.test(hoHtml), "HO branch status remains inside the card");
assert(!/src=.*bank/.test(hoHtml), "HO card has no bank image");

console.log("\n-----");
console.log("passed=" + passed + " failed=" + failed);
process.exit(failed ? 1 : 0);
