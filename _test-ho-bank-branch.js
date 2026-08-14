/* GI-FIX 2026-08-13 — הוראת קבע: קוד בנק אוטומטי + אימות סניף.
   בלי שינוי לוגיקת שמירה / חסימת שלב 6.
   הרצה: node _test-ho-bank-branch.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const WIZARD_FILE = path.join(ROOT, "gi-wizard.js");
const JSON_FILE = path.join(ROOT, "gi-bank-branches.json");
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

console.log("1) syntax + cache");
const syntax = spawnSync(process.execPath, ["--check", WIZARD_FILE], { encoding: "utf8" });
assert(syntax.status === 0, "node --check gi-wizard.js");
if(syntax.status !== 0) console.error(syntax.stderr || syntax.stdout);

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "theme-unify-flat.css"), "utf8");
assert(app.includes('GI_WIZARD_JS_VERSION = "20260814-pay-card-v2"'), "app.js bumps gi-wizard cache");
assert(app.includes("theme-unify-flat.css?v=20260814-pay-card-v2"), "app.js bumps unify-flat cache");
assert(html.includes("app.js?v=20260814-face-login-v4"), "index.html bumps app.js cache");
assert(css.includes(".lcHoBranchStatus"), "unify-flat has branch status styles");
assert(css.includes(".is-ok") && css.includes(".is-bad"), "ok/bad status styles exist");

console.log("\n2) branch JSON");
const index = JSON.parse(fs.readFileSync(JSON_FILE, "utf8"));
assert(index && typeof index === "object", "gi-bank-branches.json parses");
assert(!!index["12"] && !!index["12"]["41"], "Poalim 12/41 exists");
assert(index["12"]["41"].n && index["12"]["41"].a, "Poalim 12/41 has name+address");
assert(!!index["4"] && !!index["4"]["7"], "Yahav stored as bank key 4");
assert(!index["09"] && !index["9"], "Postal bank 9 is absent from dataset (expected)");
assert(!index["12"]["041"], "branch keys are normalized without leading zeros");

console.log("\n3) source contracts — additive UI, same save/validation gates");
const src = fs.readFileSync(WIZARD_FILE, "utf8");
const liveBind = src.slice(src.lastIndexOf("bindInputs(ins){"));
assert(liveBind.includes('if(k === "ho.bankName")'), "live payer handler fills bankNo on bank select");
assert(liveBind.includes("this.getBankCodeForName(v)"), "live handler uses official bank code map");
assert(liveBind.includes('if(path === "ho.branch")'), "typing branch schedules lookup");
assert(liveBind.includes("this.scheduleHoBranchLookup(ins)"), "branch lookup is debounced");
assert(liveBind.includes('if(path === "clinic")'), "clinic bind still follows branch lookup");
assert(liveBind.includes("this.applyClinicChangeForInsured(ins)"), "clinic change still applies");
assert(liveBind.includes("ensureBankBranchesLoaded().then(() => this.applyHoBranchLookup(ins))"), "step 6 reapplies lookup after render");

assert(src.includes('readonly'), "bank number field is readonly");
assert(src.includes("מתמלא אוטומטית לפי הבנק שנבחר"), "bank number help text present");
assert(src.includes('id="lcHoBranchStatus"'), "branch status element is in step 6 HTML");
assert(src.includes("בהוראת קבע: בנק, מספר בנק, סניף וחשבון."), "required HO copy unchanged");

const validateStep = src.slice(src.indexOf("validateStep(stepId){"), src.indexOf("isStepCompleteForInsured(stepId, ins){"));
assert(validateStep.includes("if(stepId === 6){"), "step 6 still has an explicit gate");
assert(validateStep.includes("getHealthCardPanGate"), "step 6 next uses credit PAN length gate");
assert(validateStep.includes("return { ok:true }"), "step 6 still returns ok when the PAN gate passes / HO");
assert(!validateStep.includes("branchValid"), "step 6 gate does not use branchValid");

const step6Complete = src.slice(src.indexOf("if(stepId === 6){"), src.indexOf("getStep6PaymentValidationDetail(ins){"));
assert(step6Complete.includes("return true;"), "isStepCompleteForInsured(6) still always true");
assert(!src.includes("branchValid") || !/getStep6PaymentValidationDetail\(ins\)\{[\s\S]*?branchValid/.test(src), "payment validation detail does not require branchValid");

const saveDraftBlock = src.slice(src.indexOf("async saveDraft(){"), src.indexOf("getOperationalAgentNumbers(){"));
assert(saveDraftBlock.includes("this._persistProposalSaveInBackground(true)"), "saveDraft persist path unchanged");
assert(saveDraftBlock.includes("getPremiumValidationIssues"), "saveDraft still runs premium validation");

assert(!src.includes("branchValid") || !/getPremiumValidationIssues\([\s\S]*?branchValid/.test(src), "premium validation does not check branchValid");

console.log("\n4) load real wizard methods");
const statusEl = { hidden: true, className: "", innerHTML: "" };
const host = new Proxy({
  Wizard: {},
  safeTrim,
  escapeHtml: (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"),
  on: () => {},
  $: () => null,
  $$: () => [],
  nowISO: () => "2026-08-13T19:00:00.000Z",
  getValidationConfigForBind: () => null,
  validateValueByKind: (_k, v) => ({ ok:true, clean: v, message:"" }),
  digitsOnly: (value) => String(value == null ? "" : value).replace(/\D+/g, "")
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
  fetch(url){
    assert(String(url).includes("gi-bank-branches.json"), "fetch loads local branch JSON");
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(index)
    });
  },
  console
};
sandbox.globalThis = sandbox;

try{
  vm.runInNewContext(src, sandbox, { filename: "gi-wizard.js" });
  assert(typeof host.Wizard.getBankCodeForName === "function", "getBankCodeForName installed");
  assert(typeof host.Wizard.lookupHoBranch === "function", "lookupHoBranch installed");
  assert(typeof host.Wizard.applyHoBranchLookup === "function", "applyHoBranchLookup installed");
}catch(err){
  assert(false, "load gi-wizard.js: " + (err && err.message));
  console.error(err);
}

const W = host.Wizard;
W.els = { body: { querySelector(){ return statusEl; } } };
W.insureds = [{ id: "ins1", type: "primary", label: "ראשי", data: { firstName: "בדיקה", lastName: "טסט" } }];
W._bankBranchesIndex = index;

console.log("\n5) official bank codes");
assert(W.getBankCodeForName("בנק הפועלים") === "12", "Poalim → 12");
assert(W.getBankCodeForName("בנק לאומי") === "10", "Leumi → 10");
assert(W.getBankCodeForName("בנק דיסקונט") === "11", "Discount → 11");
assert(W.getBankCodeForName("בנק מזרחי טפחות") === "20", "Mizrahi → 20");
assert(W.getBankCodeForName("הבנק הבינלאומי") === "31", "International → 31");
assert(W.getBankCodeForName("בנק יהב") === "04", "Yahav map still returns 04");
assert(W.getBankCodeForName("בנק הדואר") === "09", "Postal map still returns 09");
assert(W.getBankCodeForName("לא קיים") === "", "unknown bank → empty");
assert(W.normBankBranchCode("04") === "4", "04 normalizes to 4 for JSON lookup");
assert(W.normBankBranchCode("041") === "41", "041 normalizes to 41");

console.log("\n6) branch lookup correctness");
const ok = W.lookupHoBranch("12", "41");
assert(ok.state === "ok", "Poalim 41 is valid");
assert(ok.name === index["12"]["41"].n, "fills official branch name");
assert(ok.address === index["12"]["41"].a, "fills official branch address");

const padded = W.lookupHoBranch("12", "041");
assert(padded.state === "ok", "leading-zero branch 041 still matches 41");

const yahav = W.lookupHoBranch("04", "7");
assert(yahav.state === "ok" && yahav.name === index["4"]["7"].n, "Yahav 04 looks up JSON key 4");

const idle = W.lookupHoBranch("12", "");
assert(idle.state === "idle", "empty branch → idle (not invalid)");

const needBank = W.lookupHoBranch("", "41");
assert(needBank.state === "need-bank", "branch without bank → need-bank");

const bad = W.lookupHoBranch("12", "9999");
assert(bad.state === "bad", "unknown Poalim branch → bad");

const wrongBank = W.lookupHoBranch("10", "41");
assert(wrongBank.state === "bad", "Poalim 41 is invalid under Leumi");

const postal = W.lookupHoBranch("09", "1");
assert(postal.state === "bad", "postal bank has no branch index → treated as not found");

console.log("\n7) apply lookup writes additive fields only");
const ins = {
  data: {
    paymentMethod: "ho",
    ho: { bankName: "בנק הפועלים", bankNo: "12", branch: "41", account: "123" }
  }
};
W.applyHoBranchLookup(ins);
assert(ins.data.ho.branchName === index["12"]["41"].n, "apply fills branchName");
assert(ins.data.ho.branchAddress === index["12"]["41"].a, "apply fills branchAddress");
assert(ins.data.ho.branchValid === true, "apply marks valid branch");
assert(ins.data.ho.bankName === "בנק הפועלים", "does not change bankName");
assert(ins.data.ho.bankNo === "12", "does not change bankNo");
assert(ins.data.ho.branch === "41", "does not change typed branch");
assert(ins.data.ho.account === "123", "does not change account");
assert(statusEl.hidden === false && /is-ok/.test(statusEl.className), "UI shows valid status");

ins.data.ho.branch = "9999";
W.applyHoBranchLookup(ins);
assert(ins.data.ho.branchValid === false, "unknown branch marked invalid");
assert(ins.data.ho.branchName === "", "clears name when invalid");
assert(ins.data.ho.branchAddress === "", "clears address when invalid");
assert(/is-bad/.test(statusEl.className), "UI shows invalid status");
assert(ins.data.ho.account === "123", "account still untouched after invalid lookup");

ins.data.ho.branch = "";
W.applyHoBranchLookup(ins);
assert(ins.data.ho.branchValid === "", "empty branch is idle, not false");
assert(statusEl.hidden === true, "idle hides the status box");

console.log("\n8) switching bank always overwrites bankNo + rechecks branch");
ins.data.ho.bankName = "בנק לאומי";
ins.data.ho.bankNo = "12";
ins.data.ho.branch = "41";
const code = W.getBankCodeForName(ins.data.ho.bankName);
if(code) ins.data.ho.bankNo = code;
assert(ins.data.ho.bankNo === "10", "switching to Leumi overwrites 12 → 10 even if bankNo was filled");
W.applyHoBranchLookup(ins);
assert(ins.data.ho.branchValid === false, "same branch number is rechecked against the new bank");

ins.data.ho.bankName = "בנק הפועלים";
ins.data.ho.bankNo = W.getBankCodeForName(ins.data.ho.bankName);
ins.data.ho.branch = "41";
W.applyHoBranchLookup(ins);
assert(ins.data.ho.bankNo === "12" && ins.data.ho.branchValid === true, "switching back to Poalim restores valid 41");

console.log("\n9) step 6 gates still ignore branch validity");
W.insureds = [ins];
W.step = 6;
const v6 = W.validateStep(6);
assert(v6 && v6.ok === true, "validateStep(6) ok even after invalid/valid lookups");
assert(W.isStepCompleteForInsured(6, ins) === true, "isStepCompleteForInsured(6) still true");
const detail = W.getStep6PaymentValidationDetail(ins);
assert(detail && detail.ok === true, "getStep6PaymentValidationDetail still ok:true");

const html6 = W.renderStep6(ins);
assert(/readonly/.test(html6), "renderStep6 bankNo is readonly");
assert(/data-bind="ho.bankNo"/.test(html6) && /value="12"/.test(html6), "renderStep6 shows official bank number 12");
assert(/id="lcHoBranchStatus"/.test(html6), "renderStep6 includes status box");
assert(/data-bind="ho.branch"/.test(html6) && /data-bind="ho.account"/.test(html6), "branch and account fields remain");
assert(/lcHealthPayCard--ho/.test(html6), "HO uses visual payment card shell");
assert(/lcHealthPayCard__hoBadge/.test(html6), "HO badge is a text chip, not a bank logo");
assert(!/data-bind="ho.branchName"/.test(html6), "branch name is not a required input");
assert(!/data-bind="ho.branchValid"/.test(html6), "branchValid is not a form field");

console.log("\n-----");
console.log("passed=" + passed + " failed=" + failed);
process.exit(failed ? 1 : 0);
