/* GI-HAR-STALE-MANUAL 2026-10-07
   מכירה ללקוח קיים כשעבר חודש מהר הביטוח:
   אפשר להתקדם אחרי פוליסה ידנית אחת, או אחרי קובץ הר עדכני.
   בלי כפתור «לקוח ללא הר ביטוח». בלי שינוי נוסחת פרמיה.
   הרצה: node _test-har-stale-manual-policy.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
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

function extractMethod(src, name){
  const re = new RegExp("\\n\\s*(async\\s+)?" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\(");
  const m = re.exec(src);
  if(!m) return "";
  const start = m.index;
  let i = start + m[0].length;
  let paren = 1;
  let inStr = null;
  for(; i < src.length && paren > 0; i += 1){
    const ch = src[i];
    if(inStr){
      if(ch === "\\"){ i += 1; continue; }
      if(ch === inStr) inStr = null;
      continue;
    }
    if(ch === '"' || ch === "'" || ch === "`"){ inStr = ch; continue; }
    if(ch === "(") paren += 1;
    else if(ch === ")") paren -= 1;
  }
  while(i < src.length && /\s/.test(src[i])) i += 1;
  if(src[i] !== "{") return "";
  let depth = 0;
  for(; i < src.length; i += 1){
    const ch = src[i];
    if(ch === "{") depth += 1;
    else if(ch === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, i + 1);
    }
  }
  return "";
}

function bindMethod(ctx, src, name){
  const block = extractMethod(src, name);
  const open = block.indexOf("(");
  if(open < 0) throw new Error("cannot bind " + name);
  let i = open + 1;
  let paren = 1;
  let inStr = null;
  for(; i < block.length && paren > 0; i += 1){
    const ch = block[i];
    if(inStr){
      if(ch === "\\"){ i += 1; continue; }
      if(ch === inStr) inStr = null;
      continue;
    }
    if(ch === '"' || ch === "'" || ch === "`"){ inStr = ch; continue; }
    if(ch === "(") paren += 1;
    else if(ch === ")") paren -= 1;
  }
  const params = block.slice(open + 1, i - 1);
  while(i < block.length && /\s/.test(block[i])) i += 1;
  if(block[i] !== "{") throw new Error("cannot bind body for " + name);
  const body = block.slice(i + 1, block.lastIndexOf("}"));
  ctx[name] = new Function(params, body);
}

console.log("1) syntax + cache — בלי להחליף תג קיים");
const appCheck = spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")], { encoding: "utf8" });
assert(appCheck.status === 0, "node --check app.js");
const wizCheck = spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")], { encoding: "utf8" });
assert(wizCheck.status === 0, "node --check gi-wizard.js");

const app = read("app.js");
const wizard = read("gi-wizard.js");
const html = read("index.html");
const sw = read("service-worker.js");

assert(app.includes('const BUILD = "20261007-lead-dup-v1"'), "BUILD tag stays");
assert(app.includes('GI_WIZARD_JS_VERSION = "20261007-lead-dup-v1"'), "wizard version tag stays");
assert(wizard.includes('GI_WIZARD_BUILD = "20261007-lead-dup-v1"'), "gi-wizard build tag stays");
assert(html.includes("app.js?v=20261007-lead-dup-v1&giSign=29"), "index.html keeps the existing app.js tag");
assert(html.includes("&giHarManual=1"), "index.html busts app.js for this fix");
assert(app.includes('gi-wizard.js?v=" + GI_WIZARD_JS_VERSION + "&giPriorDecl=1&giQueue=1&giHarManual=1"'), "wizard href keeps priorDecl/queue and adds giHarManual");
assert(sw.includes("20261007-lead-dup-v1"), "service-worker keeps the existing tag");
assert(sw.includes("har-manual-v1"), "service-worker adds har-manual-v1");

console.log("\n2) שער הר ביטוח ישן — פוליסה ידנית משחררת, קובץ עדכני נשאר");
const staleFn = extractMethod(wizard, "isHarBituachStaleForInsured");
const addFn = extractMethod(wizard, "addExistingPolicy");
const delFn = extractMethod(wizard, "delExistingPolicy");
const nextChunk = wizard.slice(wizard.indexOf("if(this.step === 3 && !this.isElementaryFlow()){"), wizard.indexOf("const v = this.validateStep(this.step);"));
assert(staleFn.includes("insuredHasManualExistingPolicy(ins)"), "stale gate asks about a manual policy");
assert(staleFn.indexOf("insuredHasManualExistingPolicy") < staleFn.indexOf('status) === "stale"'), "manual policy wins over sticky stale status");
assert(staleFn.includes("freshThisSession"), "fresh uploaded har still clears stale");
assert(extractMethod(wizard, "getStep3HarStaleInsureds").includes("isHarBituachStaleForInsured"), "next-step stale list still uses the same helper");
assert(nextChunk.includes("עבר יותר מחודש מאז הר הביטוח בתיק"), "stale modal copy stays when har is old and nothing was added");
assert(nextChunk.includes("getStep3HarUploadMissingInsureds"), "missing-har confirm path stays");
assert(addFn.includes("importedFromHarBituach:false"), "add policy still marks the row as manual");
assert(addFn.includes("syncHarStaleGateAfterExistingPolicyChange"), "adding a policy refreshes the stale gate");
assert(delFn.includes("syncHarStaleGateAfterExistingPolicyChange"), "removing a policy refreshes the stale gate");
assert(!wizard.includes("לקוח ללא הר ביטוח"), "no extra skip button");
assert(wizard.includes("אישור המשך ללא הר ביטוח"), "existing missing-har confirm stays");

console.log("\n3) לוגיקת דשבורד / פרמיה לא זזה");
assert(app.includes("wizardSaleAfterDiscount(p)"), "month/today still use after-discount");
assert(app.includes("_isHealthOrRiskWizardSale(p)"), "today card still health+risk only");
assert(wizard.includes("getPolicyPremiumAfterDiscount"), "wizard after-discount engine stays");

console.log("\n4) התנהגות: פוליסה מיובאת ישנה חוסמת, פוליסה ידנית משחררת");
function safeTrim(v){ return String(v == null ? "" : v).trim(); }
function nowISO(){ return "2026-10-07T12:00:00.000Z"; }
function isHarBituachTimestampStale(iso){
  const raw = safeTrim(iso);
  if(!raw) return true;
  const t = Date.parse(raw);
  if(!Number.isFinite(t) || t <= 0) return true;
  return (Date.now() - t) > (30 * 24 * 60 * 60 * 1000);
}
const HAR_BITUACH_FRESH_MS = 30 * 24 * 60 * 60 * 1000;
global.safeTrim = safeTrim;
global.nowISO = nowISO;
global.isHarBituachTimestampStale = isHarBituachTimestampStale;
global.HAR_BITUACH_FRESH_MS = HAR_BITUACH_FRESH_MS;

function makeWizard(){
  const ctx = {
    customerPurchaseMode: { active: true, customerId: "cust_1" },
    isCustomerPurchaseMode(){ return !!(this.customerPurchaseMode && this.customerPurchaseMode.active && this.customerPurchaseMode.customerId); },
    isElementaryFlow(){ return false; },
    _harImportState: {},
    insureds: [],
    render(){}
  };
  [
    "insuredHasPersistedHarBituach",
    "_ensureHarImportStateEntry",
    "hydrateHarImportStateFromInsured",
    "getHarImportState",
    "setHarImportState",
    "hasHarFileUploaded",
    "insuredHasManualExistingPolicy",
    "syncHarStaleGateAfterExistingPolicyChange",
    "isHarBituachStaleForInsured",
    "getStep3HarStaleInsureds",
    "getStep3HarUploadMissingInsureds",
    "addExistingPolicy",
    "delExistingPolicy"
  ].forEach((name) => bindMethod(ctx, wizard, name));
  return ctx;
}

const imported = {
  id: "pol_old",
  importedFromHarBituach: true,
  importSourceAt: "2026-08-01T10:00:00.000Z",
  importSourceFile: "har.xlsx"
};
const ins = {
  id: "ins1",
  data: {
    firstName: "בדיקה",
    lastName: "בדיקה",
    existingPolicies: [imported],
    harBituachAck: { at: "2026-08-01T10:00:00.000Z", fileName: "har.xlsx", empty: false, policyCount: 1 },
    cancellations: {}
  }
};
const W = makeWizard();
W.insureds = [ins];
W._harImportState = { ins1: { status: "stale", fileUploaded: false, freshThisSession: false, importedAt: "2026-08-01T10:00:00.000Z" } };

assert(W.insuredHasPersistedHarBituach(ins) === true, "old har in the file still counts as persisted");
assert(W.insuredHasManualExistingPolicy(ins) === false, "imported-only list is not a manual add");
assert(W.isHarBituachStaleForInsured(ins) === true, "purchase mode + old har still blocks");
assert(W.getStep3HarStaleInsureds().length === 1, "next-step still collects the stale insured");

W.addExistingPolicy(ins);
assert(W.insuredHasManualExistingPolicy(ins) === true, "one manual row is enough");
assert(W.isHarBituachStaleForInsured(ins) === false, "stale gate opens after a manual add");
assert(W.getStep3HarStaleInsureds().length === 0, "next-step no longer blocks after a manual add");
assert(String(W.getHarImportState(ins).message || "").includes("פוליסה ידנית"), "status text tells the agent they can continue");

const manualId = ins.data.existingPolicies.find((p) => p.importedFromHarBituach !== true).id;
W.delExistingPolicy(ins, manualId);
assert(W.insuredHasManualExistingPolicy(ins) === false, "removing the manual row restores the gate input");
assert(W.isHarBituachStaleForInsured(ins) === true, "stale returns if the only manual row is deleted");

const fresh = makeWizard();
const insFresh = { id: "ins2", data: { existingPolicies: [imported], harBituachAck: { at: "2026-08-01T10:00:00.000Z" } } };
fresh.insureds = [insFresh];
fresh._harImportState = { ins2: { status: "stale", freshThisSession: true, fileUploaded: true, importedAt: nowISO() } };
assert(fresh.isHarBituachStaleForInsured(insFresh) === false, "fresh uploaded har still lets the agent continue");

const noPurchase = makeWizard();
noPurchase.customerPurchaseMode = null;
const insNew = { id: "ins3", data: { existingPolicies: [] } };
noPurchase.insureds = [insNew];
assert(noPurchase.isHarBituachStaleForInsured(insNew) === false, "new-customer flow is not gated by stale har");
assert(noPurchase.getStep3HarUploadMissingInsureds().length === 1, "new customer without policies still needs har or a policy");
noPurchase.addExistingPolicy(insNew);
assert(noPurchase.getStep3HarUploadMissingInsureds().length === 0, "a manual policy still satisfies the missing-har path");

if(failed){
  console.error("\nFAILED " + failed + " / " + (failed + passed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
