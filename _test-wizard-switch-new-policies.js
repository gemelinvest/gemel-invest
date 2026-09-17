/* GI-SWITCH 2026-09-17
   שיחלוף כבחירה מפורשת אחרי רכישה חדשה: דיאלוג מערכת, סימון לביטול,
   שלב 5 רק סשן, מעבר לישנות + מכתב ביטול + סימון «פוליסה ששוחלפה».
   הרצה: node _test-wizard-switch-new-policies.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260917-sale-toast-v1";
const CSS_TAG = "20260917-toast-full-v1";
const WIZARD_TAG = "20260917-har-cross-ins-v1";
const APP_CACHE = "20260917-month-net-after-v1";
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

function sliceMethod(src, name){
  const re = new RegExp("(?:^|\\n)\\s*" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\(");
  const m = re.exec(src);
  if(!m) return "";
  const start = m.index + (m[0][0] === "\n" ? 1 : 0);
  let i = m.index + m[0].length;
  let paren = 1;
  let quote = "";
  for(; i < src.length && paren > 0; i++){
    const ch = src[i];
    if(quote){
      if(ch === "\\"){ i += 1; continue; }
      if(ch === quote) quote = "";
      continue;
    }
    if(ch === "'" || ch === "\"" || ch === "`"){ quote = ch; continue; }
    if(ch === "(") paren += 1;
    else if(ch === ")") paren -= 1;
  }
  while(i < src.length && /\s/.test(src[i])) i += 1;
  if(src[i] !== "{") return "";
  let depth = 0;
  for(; i < src.length; i++){
    const ch = src[i];
    if(ch === "{") depth += 1;
    else if(ch === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, i + 1).trim();
    }
  }
  return "";
}

function safeTrim(v){
  return String(v == null ? "" : v).trim();
}

const wiz = read("gi-wizard.js");
const app = read("app.js");
const css = read("app.css");
const theme = read("theme.css");
const html = read("index.html");
const sw = read("service-worker.js");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(wiz.includes('GI_WIZARD_BUILD = "' + WIZARD_TAG + '"'), "wizard build tag");
assert(app.includes('GI_WIZARD_JS_VERSION = "' + WIZARD_TAG + '"'), "app wizard cache tag");
assert(html.includes("app.js?v=" + APP_CACHE), "index app.js cache");
assert(html.includes("app.css?v=" + CSS_TAG), "index app.css cache");
assert(html.includes("theme.css?v=" + CSS_TAG), "index theme.css cache");
assert(sw.includes("gi-v12-" + APP_CACHE), "service worker cache");

console.log("\n2) entry dialog is system-styled, not alert");
assert(wiz.includes("promptAddOrSwitchPurchaseChoice"), "add-or-switch prompt helper");
assert(wiz.includes('confirmText: "ביצוע שיחלוף"'), "switch button label");
assert(wiz.includes('cancelText: "הוספת פוליסה חדשה"'), "add-policy button label");
assert(wiz.includes("requireConfirmClick: true"), "must click a system button");
assert(wiz.includes("showWizardHarAlertModal"), "uses existing system modal");
assert(app.includes("void Wizard.openNewPurchaseForCustomer(rec.id)"), "file new-purchase still opens wizard");
assert(!/openNewPurchaseForCustomer\([\s\S]{0,80}window\.alert/.test(wiz), "no browser alert on purchase open");

console.log("\n3) switch picker + empty step 5");
assert(wiz.includes("promptSwitchCancelPolicyPicker"), "cancel picker");
assert(wiz.includes("giSwitchCancelPickModal"), "picker modal id");
assert(wiz.includes("שיחלוף — בחירת פוליסות לביטול"), "picker title");
assert(wiz.includes("switchCancelPolicyIds"), "stores selected ids");
assert(wiz.includes("this.newPolicies = [];"), "purchase/switch start with empty new list");
assert(/getWizardNewPolicies\(\)\{\s*if\(this\.isCustomerPurchaseMode\(\)\) return this\.getCustomerPurchaseSessionPolicies\(\);/.test(wiz), "wizard new list is session-only");
assert(!wiz.includes("פוליסות בתיק / לשיחלוף"), "step 5 no longer frames file policies as new");
assert(css.includes("giHarNotice__card--wide"), "wide system card for picker");
assert(css.includes("giHarNotice__card--choice"), "choice card is slightly larger");
assert(css.includes("giHarNotice__pol"), "picker policy rows");
assert(css.includes("giHarNotice__polPrem"), "premium stays on the same row");
assert(css.includes("giHarNotice__polInsureds"), "insureds stay on the same row");
assert(css.includes("giHarNotice__polLogo"), "clear company logo cell");
assert(theme.includes("giHarNotice__card--wide"), "theme allows the wide picker card");
assert(theme.includes("max-width: 860px !important"), "theme wide card is 860px");
assert(theme.includes("giHarNotice__card--choice"), "theme allows the larger choice card");
assert(theme.includes("max-width: 460px !important"), "theme choice card is 460px");
assert(wiz.includes('cardClass: "giHarNotice__card--choice"'), "choice modal uses the larger card");
assert(wiz.includes('this.renderCompanyLogoHtml(p.company, "card")'), "picker uses the clear card logo");
assert(!/promptSwitchCancelPolicyPicker[\s\S]{0,1800}renderCompanyLogoHtml\(p\.company, "mini"\)/.test(wiz), "picker no longer uses the tiny mini logo");
assert(wiz.includes("giHarNotice__polPrem"), "picker markup has a premium cell");

console.log("\n4) ID dialog no longer auto-dumps into switch");
assert(!wiz.includes('title = isSwitch ? "שיחלוף לקוח קיים"'), "ID dialog not titled as forced switch");
assert(!wiz.includes("{ mode: \"switch\", preservePrimarySessionData }"), "ID dialog does not force switch mode");

console.log("\n5) save moves switched policies to old + cancel letter inputs");
assert(wiz.includes("applySwitchCancellationsToPayload"), "save/report apply helper");
assert(wiz.includes("convertNewPolicyToExistingForSwitch"), "new→existing converter");
assert(wiz.includes('existingStatus: "switched"'), "existing row marked switched");
assert(wiz.includes("switchedFromNew: true"), "switch stamp");
assert(wiz.includes('status: "full"'), "cancel status full for official cancel forms");
assert(app.includes('label: "פוליסה ששוחלפה"'), "file badge label");
assert(app.includes('cls: "is-switched"'), "file badge class");
assert(theme.includes(".cfFile__statusBadge.is-switched"), "file badge color");
assert(wiz.includes("this.applySwitchCancellationsToPayload(next, { keepSessionOnlyNewPolicies: true })"), "report keeps session-only new products");
assert(wiz.includes("this.applySwitchCancellationsToPayload(payload)"), "save payload gets cancellations");

console.log("\n6) runtime: applySwitchCancellationsToPayload");
const applySrc = sliceMethod(wiz, "applySwitchCancellationsToPayload");
const convertSrc = sliceMethod(wiz, "convertNewPolicyToExistingForSwitch");
const sessionSrc = sliceMethod(wiz, "getCustomerPurchaseSessionPolicies");
const baselineSrc = sliceMethod(wiz, "getCustomerPurchaseBaselinePolicies");
const idSetSrc = sliceMethod(wiz, "getCustomerPurchaseBaselinePolicyIdSet");
const cancelSetSrc = sliceMethod(wiz, "getCustomerPurchaseSwitchCancelIdSet");
const cancelPolSrc = sliceMethod(wiz, "getCustomerPurchaseSwitchCancelPolicies");
assert(!!applySrc && applySrc.indexOf("function") < 0 && applySrc.includes("keepSessionOnlyNewPolicies"), "sliced apply method");
assert(!!convertSrc, "sliced convert method");

const ctx = {
  newPolicies: [{
    id: "p_new",
    company: "כלל",
    type: "בריאות",
    _purchaseSession: true,
    insuredIds: ["ins_a"],
    premiumMonthly: "120"
  }],
  customerPurchaseMode: {
    active: true,
    mode: "switch",
    customerId: "cust1",
    baselinePolicyIds: ["p_old", "p_keep"],
    switchCancelPolicyIds: ["p_old"],
    baselinePolicies: [
      { id: "p_old", company: "הפניקס", type: "ריסק", insuredIds: ["ins_a"], premiumMonthly: "90", policyNumber: "PN-1" },
      { id: "p_keep", company: "הכשרה", type: "בריאות", insuredIds: ["ins_a"], premiumMonthly: "70" }
    ]
  },
  isCustomerPurchaseMode(){ return !!(this.customerPurchaseMode && this.customerPurchaseMode.active); },
  isCustomerPurchaseSwitchMode(){ return !!(this.isCustomerPurchaseMode() && String(this.customerPurchaseMode.mode) === "switch"); },
  getPolicyInsuredIds(policy){
    return Array.isArray(policy?.insuredIds) && policy.insuredIds.length ? policy.insuredIds.slice() : (policy?.insuredId ? [policy.insuredId] : []);
  },
  normalizeAllNewPolicies(list){ return Array.isArray(list) ? list.slice() : []; }
};
function bindSliced(ctxObj, src){
  const maker = new Function("safeTrim", "return function " + src);
  return maker(safeTrim).bind(ctxObj);
}

ctx.getCustomerPurchaseBaselinePolicyIdSet = bindSliced(ctx, idSetSrc);
ctx.getCustomerPurchaseSwitchCancelIdSet = bindSliced(ctx, cancelSetSrc);
ctx.getCustomerPurchaseSessionPolicies = bindSliced(ctx, sessionSrc);
ctx.getCustomerPurchaseBaselinePolicies = bindSliced(ctx, baselineSrc);
ctx.getCustomerPurchaseSwitchCancelPolicies = bindSliced(ctx, cancelPolSrc);
ctx.convertNewPolicyToExistingForSwitch = bindSliced(ctx, convertSrc);
ctx.applySwitchCancellationsToPayload = bindSliced(ctx, applySrc);

const payload = {
  insureds: [{ id: "ins_a", label: "ראשי", type: "primary", data: { existingPolicies: [], cancellations: {} } }],
  newPolicies: [{ id: "p_old" }, { id: "p_keep" }, { id: "p_new", _purchaseSession: true }],
  operational: { newPolicies: [] }
};
ctx.applySwitchCancellationsToPayload(payload);

const newIds = (payload.newPolicies || []).map((p) => p.id).sort();
assert(JSON.stringify(newIds) === JSON.stringify(["p_keep", "p_new"].sort()), "cancelled id removed from newPolicies; keep+session remain");
assert(!(payload.newPolicies || []).some((p) => p.id === "p_old"), "switched policy not in new list");
const oldList = payload.insureds[0].data.existingPolicies || [];
assert(oldList.length === 1 && oldList[0].id === "p_old", "switched policy moved to existingPolicies");
assert(oldList[0].switchedFromNew === true && oldList[0].existingStatus === "switched", "old row stamped as switched");
const cancel = payload.insureds[0].data.cancellations.p_old;
assert(cancel && cancel.status === "full" && cancel.switchedFromNew === true, "cancellation full + switch stamp for cancel forms");
assert(Array.isArray(cancel.sharedInsuredIds) && cancel.sharedInsuredIds.includes("ins_a"), "shared insureds copied for cancel letter");

const reportPayload = {
  insureds: [{ id: "ins_a", data: { existingPolicies: [], cancellations: {} } }],
  newPolicies: [{ id: "p_old" }, { id: "p_keep" }, { id: "p_new", _purchaseSession: true }],
  operational: { newPolicies: [] }
};
ctx.applySwitchCancellationsToPayload(reportPayload, { keepSessionOnlyNewPolicies: true });
assert((reportPayload.newPolicies || []).map((p) => p.id).join(",") === "p_new", "report newPolicies stay session-only");
assert(!(reportPayload.newPolicies || []).some((p) => p.id === "p_keep" || p.id === "p_old"), "report does not list remaining/cancelled file policies as new");
assert((reportPayload.insureds[0].data.existingPolicies || []).some((p) => p.id === "p_old"), "report still lists switched policy as old/cancel");

const addPayload = {
  insureds: [{ id: "ins_a", data: { existingPolicies: [], cancellations: {} } }],
  newPolicies: [{ id: "p_old" }],
  operational: {}
};
ctx.customerPurchaseMode.mode = "purchase";
ctx.applySwitchCancellationsToPayload(addPayload);
assert((addPayload.newPolicies || []).some((p) => p.id === "p_old"), "add-policy path does not move file policies to old");
assert(!(addPayload.insureds[0].data.existingPolicies || []).length, "add-policy path does not create switched old rows");

console.log("\n" + passed + " passed, " + failed + " failed");
if(failed) process.exit(1);
