/* GI-LOGIN-PW-SILENCE + GI-HACH-CI-SUM-K 2026-09-27
   1) אחרי כניסה מרוקנים username/PIN כדי שכרום לא יקפוץ «לשמור את הסיסמה?» בשמירת הצעה.
   2) מחלות קשות הכשרה: הרחבת k/m לפני מינימום ₪100,000, בלי רינדור מלא על כל הקלדה.
   הרצה: node _test-hachshara-pw-ci-sum.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260928-prem-before-after-v1";
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

function sliceFn(src, startNeedle, endNeedle){
  const start = src.indexOf(startNeedle);
  if(start < 0) return "";
  const end = src.indexOf(endNeedle, start + startNeedle.length);
  if(end < 0) return src.slice(start);
  return src.slice(start, end);
}

const app = read("app.js");
const sims = read("gi-simulators.js");
const wiz = read("gi-wizard.js");
const html = read("index.html");
const sw = read("service-worker.js");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-simulators.js")]).status === 0, "node --check gi-simulators.js");
assert(app.includes('const BUILD = "' + TAG + '"'), "app.js BUILD");
assert(app.includes('GI_SIMULATOR_JS_HREF = "./gi-simulators.js?v=' + TAG + '"'), "simulator cache");
assert(app.includes('GI_WIZARD_JS_VERSION = "' + TAG + '"'), "wizard version");
assert(wiz.includes('GI_WIZARD_BUILD = "' + TAG + '"'), "gi-wizard build");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache");
assert(sw.includes("gi-v12-" + TAG), "service-worker cache");

console.log("\n2) login password-manager silence after unlock");
assert(app.includes("GI-LOGIN-PW-SILENCE"), "silence marker");
assert(app.includes("_silenceLoginPasswordManager(){"), "silence helper");
assert(app.includes("_restoreLoginPasswordManager(){"), "restore helper");
const silence = sliceFn(app, "_silenceLoginPasswordManager(){", "_restoreLoginPasswordManager(){");
assert(silence.includes('user.value = ""'), "unlock clears username");
assert(silence.includes('pin.value = ""'), "unlock clears PIN");
assert(silence.includes('user.setAttribute("autocomplete", "off")'), "username autocomplete off");
assert(silence.includes('pin.setAttribute("autocomplete", "off")'), "PIN autocomplete off");
assert(silence.includes("user.removeAttribute(\"name\")"), "username name removed while logged in");
assert(silence.includes("pin.removeAttribute(\"name\")"), "PIN name removed while logged in");
assert(silence.includes('form.setAttribute("autocomplete", "off")'), "login form autocomplete off");
const restore = sliceFn(app, "_restoreLoginPasswordManager(){", "lock(){");
assert(restore.includes('autocomplete", "username"'), "lock restores username autocomplete");
assert(restore.includes('autocomplete", "current-password"'), "lock restores PIN autocomplete");
assert(restore.includes('name", "username"'), "lock restores username name");
assert(restore.includes('name", "pin"'), "lock restores PIN name");
const unlock = sliceFn(app, "unlock(){\n      try {\n        document.body.classList.remove(\"lcAuthLock\");", "isAdmin(){");
assert(unlock.includes("this._silenceLoginPasswordManager()"), "unlock calls silence");
const lock = sliceFn(app, "lock(){\n      try {\n        window.__GI_FACE_LOGIN_DONE__", "unlock(){");
assert(lock.includes("this._restoreLoginPasswordManager()"), "lock calls restore");
const saveDraft = sliceFn(wiz, "async saveDraft(){", "getOperationalAgentNumbers(){");
assert(saveDraft.includes("_persistProposalSaveInBackground"), "saveDraft persist path untouched");
assert(!saveDraft.includes("_silenceLoginPasswordManager"), "saveDraft does not own password-manager logic");

console.log("\n3) Hachshara CI sum wiring");
const ciStart = sims.indexOf("GI-HACH-CI-SIM");
const ciEnd = sims.indexOf("RiskSimulators.register(\"הכשרה\", \"מחלות קשות\"");
assert(ciStart >= 0 && ciEnd > ciStart, "Hachshara CI block exists");
const ciBlock = sims.slice(ciStart, ciEnd + 80);
assert(ciBlock.includes("GI-HACH-CI-SUM-K"), "k/m expand marker");
assert(ciBlock.includes("giIlsExpandLocal(compensation"), "compute expands k/m before min check");
assert(ciBlock.includes("formatRiskSimSumInsuredDigits(compInput.value)"), "input uses shared sum formatter");
assert(ciBlock.includes('autocomplete="off"'), "compensation field autocomplete off");
assert(ciBlock.includes("formatRiskSimSumInsuredDigits(st.compensation"), "render shows formatted compensation");
assert(ciBlock.includes('on(compInput, "blur"'), "recalc on blur, not every keystroke");
assert(!/compInput\.addEventListener\("change", \(\) => this\._render\(\)\)/.test(ciBlock), "compensation change does not full-render");
assert(ciBlock.includes("if(!st.result?.ok) this._recalcState(st)"), "apply recalcs when result is missing after typing");
assert(ciBlock.includes("const HACHSHARA_CI_MIN_SUM = 100000"), "min ₪100,000 kept");
assert(ciBlock.includes("const HACHSHARA_CI_MAX_SUM = 1000000"), "max ₪1,000,000 kept");

console.log("\n4) runtime quotes: 200k / 100k pass min, 50k fails");
const sandbox = {
  console, Date, Math, Number, String, Array, Object, JSON, parseInt, isNaN, Infinity,
  window: {
    localStorage: { getItem(){ return null; }, setItem(){} },
    addEventListener(){},
    document: {
      createElement(){ return { style: {}, setAttribute(){}, addEventListener(){} }; },
      getElementById(){ return null; },
      querySelector(){ return null; },
      querySelectorAll(){ return []; },
      body: { appendChild(){} }
    }
  }
};
sandbox.global = sandbox;
sandbox.globalThis = sandbox;
sandbox.window.window = sandbox.window;
sandbox.__GI_SIM_HOST = {
  safeTrim(v){ return String(v == null ? "" : v).trim(); },
  escapeHtml(s){ return String(s == null ? "" : s); },
  on(){},
  $(){ return null; },
  $$(){ return []; },
  nowISO(){ return new Date().toISOString(); },
  parseBirthDateValue(){ return null; },
  parseAnyDmyDate(){ return null; },
  formatDmyFromParts(){ return ""; },
  applyDmyAutoFormat(){ return ""; },
  renderCompanyLogoHtmlForCompany(){ return ""; },
  ensureGiSimulatorStylesLoaded(){},
  RiskSimulators: { register(){}, getHandler(){ return null; }, registry: {} },
  onSimulatorsInstalled(){}
};
vm.runInNewContext(sims, sandbox);
const quote = sandbox.GiSimulatorQuotes && sandbox.GiSimulatorQuotes.quote;
assert(typeof quote === "function", "GiSimulatorQuotes.quote exported");

function ci(compensation){
  return quote("הכשרה", "מחלות קשות", { age: 43, gender: "זכר", smoker: false, compensation });
}

const book = ci(100000);
assert(!!book && book.ok === true && book.monthlyPremium === 93.6, "₪100,000 still quotes ₪93.60");

const k200 = ci("200k");
assert(!!k200 && k200.ok === true, "200k expands and quotes");
assert(k200.compensation === 200000 || k200.monthlyPremium === 187.2, "200k is ₪200,000 (2× book)");

const k100 = ci("100k");
assert(!!k100 && k100.ok === true && k100.monthlyPremium === 93.6, "100k expands to ₪100,000 and passes min");

const comma = ci("200,000");
assert(!!comma && comma.ok === true, "200,000 with commas quotes");

const k50 = ci("50k");
assert(!!k50 && k50.ok === false, "50k expands to ₪50,000 and fails min");

const rawLow = ci(50000);
assert(!!rawLow && rawLow.ok === false, "₪50,000 still below minimum");

const tooHigh = ci("2m");
assert(!!tooHigh && tooHigh.ok === false, "2m expands to ₪2,000,000 and fails max");

const risk = quote("הכשרה", "ריסק", { age: 40, gender: "זכר", smoker: false, sumInsured: 1000000 });
assert(!!risk && risk.ok === true && risk.monthlyPremium === 86.67, "risk quote unchanged");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + "/" + (passed + failed));
