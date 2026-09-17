/* GI-SALE-TOAST 2026-09-17 — טוסט מכירה חי אחרי סיום הקמת לקוח בבריאות.
   פרמיה אמיתית (לא ₪0), 7 שניות, עיצוב נייבי. בלי לגעת במנוע חישוב / אשף.
   הרצה: node _test-sale-toast.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260917-sale-toast-prem-v1";
const THEME_TAG = "20260917-sidebar-chrome-v1";
const WIZARD_TAG = "20260917-har-cross-ins-v1";
const APP_CACHE = "20260917-sidebar-chrome-v1";
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

function sliceBetween(src, startMark, endMark){
  const start = src.indexOf(startMark);
  const end = src.indexOf(endMark, start);
  if(start < 0 || end < 0 || end <= start) return "";
  return src.slice(start, end);
}

function loadSaleToast(extras){
  const sandbox = {
    console,
    Date,
    Math,
    Number,
    String,
    Object,
    Array,
    JSON,
    setTimeout: () => 0,
    clearTimeout: () => {},
    requestAnimationFrame: (fn) => { try { fn(); } catch(_e) {} },
    document: {
      readyState: "loading",
      addEventListener() {},
      getElementById() { return null; },
      querySelector() { return null; },
      body: { classList: { contains: () => false } }
    }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  Object.assign(sandbox, extras || {});
  Object.assign(sandbox.window, extras || {});
  vm.runInNewContext(js, sandbox);
  return sandbox.window.GiSaleToast;
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const wiz = fs.readFileSync(path.join(ROOT, "gi-wizard.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
const js = fs.readFileSync(path.join(ROOT, "gi-sale-toast.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "gi-sale-toast.css"), "utf8");
const theme = fs.readFileSync(path.join(ROOT, "theme.css"), "utf8");
const sysJs = fs.readFileSync(path.join(ROOT, "gi-system-notice.js"), "utf8");

console.log("1) syntax + cache + isolated files");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-sale-toast.js")]).status === 0, "node --check gi-sale-toast.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(html.includes("gi-sale-toast.js?v=" + TAG), "index loads isolated module");
assert(html.includes("gi-sale-toast.css?v=" + TAG), "index loads isolated css");
assert(html.includes("app.js?v=" + APP_CACHE), "app.js cache");
assert(html.includes("theme.css?v=" + THEME_TAG), "theme.css cache");
assert(sw.includes("gi-v12-" + APP_CACHE), "service-worker cache");
assert(js.includes('const TAG = "' + TAG + '"'), "module tag matches cache");
assert(wiz.includes('GI_WIZARD_BUILD = "' + WIZARD_TAG + '"'), "wizard build tag");
assert(app.includes('GI_WIZARD_JS_VERSION = "' + WIZARD_TAG + '"'), "app wizard cache tag");

console.log("\n2) toast chrome + 7s auto-hide");
assert(html.includes("id=\"giSaleToastHost\""), "toast host exists");
const trayHtml = sliceBetween(html, "id=\"giBottomAlerts\"", "id=\"mcAssignModal\"");
assert(trayHtml.includes("id=\"giSaleToastHost\""), "toast sits bottom-left in the alerts row");
assert(css.includes("מכירה חדשה") === false, "copy lives in the module, not css");
assert(js.includes(">מכירה חדשה<"), "kicker is מכירה חדשה");
assert(js.includes("giSaleToast__agent"), "agent name cell");
assert(js.includes("giSaleToast__prem"), "premium cell");
assert(js.includes("const SHOW_MS = 7000"), "auto-hide is 7 seconds");
assert(js.includes("window.setTimeout(() => hideToast(), SHOW_MS)"), "hides itself after SHOW_MS");
assert(js.includes("FORM_PERSON_ICON"), "form+person icon constant");
assert(js.includes('<circle cx="12" cy="13.15" r="1.45"'), "person outline in the icon");
assert(js.includes("M7 3.75h7.25L18.5 8"), "form outline in the icon");
assert(!js.includes("🎉") && !js.includes("💰") && !js.includes("emoji"), "no emoji / toy icon");
assert(css.includes("giSaleToast__icon"), "professional icon frame");
assert(theme.includes("GI-BOTTOM-ALERTS-FULL"), "theme keeps chat cards full-width");
assert(theme.includes(".giBottomAlerts .giChatDockCard__text"), "theme unclamps chat message text");

console.log("\n3) roles + not the seller + not ops");
assert(js.includes('code === "agent"'), "agents receive the toast");
assert(js.includes('code === "teamManager"'), "team managers receive the toast");
assert(js.includes('code === "manager"'), "managers receive the toast");
assert(js.includes('code === "admin"'), "system admins receive the toast");
assert(js.includes('code === "owner"'), "owner receives the toast");
assert(js.includes('code === "ops"'), "ops role is recognized");
assert(js.includes("function isBlockedRole(role)"), "blocked-role helper");
assert(js.includes('code === "opsAgent"'), "typing / ops-agent is blocked");
assert(js.includes("function isSelfSale(payload)"), "seller is skipped");
assert(js.includes("if(sellerId && myId) return sellerId === myId"), "seller skip is by agent id");
assert(js.includes("self: false"), "broadcast does not echo to the seller");
assert(js.includes('status === "SUBSCRIBED"'), "waits until realtime channel is joined");
assert(js.includes("if(!code) return true"), "unknown role still shows the toast");
assert(js.includes("ack: true"), "broadcast send is acknowledged");
assert(!js.includes("window.Auth"), "module stays off window.Auth");

console.log("\n4) immediate broadcast, no polling, short cash sound");
assert(js.includes('CHANNEL = "gi-sale-toast"'), "own broadcast channel");
assert(js.includes('event: "sale"'), "sale broadcast event");
assert(js.includes("function publishNow(row)"), "publish helper");
assert(js.includes("function publishFromWizardFinish(saved, wizard)"), "wizard finish hook");
assert(!js.includes("setInterval"), "no polling");
assert(!js.includes("postgres_changes"), "does not wait on a table insert");
assert(js.includes("playGiSaleToastSound"), "dedicated cash-in sound");
const soundFn = sliceBetween(js, "function playGiSaleToastSound(){", "function normalize(row){");
assert(soundFn.includes("t0 + 0.22"), "cash sound envelope is ~0.22s");
assert(soundFn.includes("1244.51"), "cash-in high tick");
assert(soundFn.includes("1864.66"), "cash-in confirm tick");
assert(!soundFn.includes("0.92"), "not the long system-notice envelope");
assert(!js.includes("playGiSystemNoticeSound"), "does not reuse system-notice sound");
assert(!js.includes("playGiReminderSound"), "does not use reminder sound");
assert(!js.includes("playGiChatWhatsAppTone"), "does not use chat sound");
assert(!js.includes("playGiLeadNotifySequence"), "does not use lead sound");
assert(sysJs.includes("playGiSystemNoticeSound"), "system-notice sound stays in its module");

console.log("\n5) wizard finish hook is tiny and after a successful save");
assert(wiz.includes("GiSaleToast?.publishFromWizardFinish?.(saved, this)"), "finishWizard publishes immediately after save");
assert(wiz.includes("if(!this.isElementaryFlow() && saved)"), "health/risks only — not elementary");
const finishSrc = sliceBetween(wiz, "async finishWizard(options = {}){", "try{\n        this._clearLocalDraft()");
assert(finishSrc.includes("saveCompletedCustomer()"), "save still happens first");
assert(finishSrc.includes("publishFromWizardFinish"), "toast fires before heavy UI sync");
assert(finishSrc.indexOf("saveCompletedCustomer()") < finishSrc.indexOf("publishFromWizardFinish"), "broadcast is after save, before dashboard render");
assert(!finishSrc.includes("CustomersUI.render()"), "does not wait on customers render");
assert(js.includes("sumNewPolicyPremiumsShallow"), "premium still tries the existing shallow sum first");
assert(js.includes("GI-SALE-TOAST 2026-09-17 — premium fallbacks"), "read-only premium fallbacks stay in this module");
assert(js.includes("collectNewPoliciesForMetrics"), "gold-lead metrics helper is a fallback");
assert(js.includes("policyNetPremium"), "dashboard net premium is a fallback");
assert(js.includes("getNewPolicyFilePremiumAfterDiscount"), "file after-discount helper is a fallback");
assert(js.includes("wizard.newPolicies"), "wizard live policies are a fallback");
assert(js.includes("getOperationalPayload"), "wizard operational payload is a fallback");
assert(js.includes("premium: sumSavedPremium(saved, wizard)"), "publish passes the wizard into the resolver");

console.log("\n6) CRM engines stay");
assert(app.includes("function playGiReminderSound(){"), "reminder sound stays");
assert(app.includes("async searchCustomers(query, limit = 40, options = {}){"), "customer search stays");
assert(wiz.includes("applySwitchCancellationsToPayload"), "switch-purchase save path stays");
assert(html.includes("id=\"giSysNoticeCard\""), "system notice card stays");
assert(!js.includes("getHealthRowPremiumAfterDiscount"), "toast does not rewrite the health after-discount engine");
assert(wiz.includes("getHealthRowPremiumAfterDiscount(policy){"), "wizard health after-discount engine stays");

console.log("\n7) navy chrome beats the pale white card");
assert(css.includes("var(--gi-navy, #3870ED)"), "fill uses sidebar navy");
assert(css.includes("background: var(--gi-navy, #3870ED) !important"), "navy fill is forced");
assert(!css.includes("background:#fff"), "white card fill is gone");
assert(css.includes("min(420px"), "host is wider than the pale 340px card");
assert(css.includes(".giBottomAlerts .giSaleToastHost:not(#\\9):not(#\\9)"), "host override matches theme specificity");
assert(css.includes("width: min(420px, 100%) !important"), "host width beats theme 340px clamp");
assert(css.includes("color:#fff !important"), "copy is on navy, not pale text");
assert(css.includes("font-size:20px"), "premium amount is larger");
assert(css.includes("border-radius:24px"), "card radius matches CRM toasts");

console.log("\n8) runtime — ₪0 shallow sum still shows the sold amount");
const toast = loadSaleToast({
  CustomersUI: {
    sumNewPolicyPremiumsShallow() { return 0; },
    collectNewPoliciesForMetrics() { return []; },
    getNewPolicyFilePremiumAfterDiscount() { return 0; }
  },
  DashboardUI: {
    policyNetPremium() { return 0; }
  }
});
assert(!!toast && typeof toast.sumSavedPremium === "function", "sumSavedPremium is exported");
assert(toast.showMs === 7000, "public showMs is 7 seconds");
assert(toast.sumSavedPremium({
  payload: { newPolicies: [{ origin: "new", premiumMonthly: 188.5 }] }
}) === 188.5, "field fallback reads premiumMonthly when helpers return 0");
assert(toast.sumSavedPremium({
  payload: { newPolicies: [{ origin: "new", premiumAfterCoverDiscounts: 0, premiumAfterDiscountValue: 96.4 }] }
}) === 96.4, "skips a 0 cover-discount field and uses after-discount");
assert(toast.sumSavedPremium({
  payload: { newPolicies: [{ origin: "existing", premiumMonthly: 400 }] }
}) === 0, "existing policies are not counted as a new sale");
assert(toast.sumSavedPremium({ payload: { newPolicies: [] } }, {
  newPolicies: [{ origin: "new", simDiscountPerInsured: { a: { monthlyAfterDiscount: 55 }, b: { monthlyAfterDiscount: 20 } } }]
}) === 75, "wizard.newPolicies is used when saved payload is empty");
assert(toast.sumSavedPremium({ payload: {} }, {
  getOperationalPayload() {
    return { newPolicies: [{ premium: "₪ 210" }] };
  }
}) === 210, "wizard operational payload is used when saved payload is empty");

const goldToast = loadSaleToast({
  CustomersUI: {
    sumNewPolicyPremiumsShallow() { return 0; },
    collectNewPoliciesForMetrics() { return [{ id: "n1" }]; },
    getNewPolicyFilePremiumAfterDiscount() { return 0; }
  },
  DashboardUI: {
    policyNetPremium() { return 142.75; }
  }
});
assert(goldToast.sumSavedPremium({ payload: { newPolicies: [{ id: "n1" }] } }) === 142.75, "gold-lead metrics fallback is used when shallow sum is 0");

const shallowToast = loadSaleToast({
  CustomersUI: {
    sumNewPolicyPremiumsShallow() { return 88; },
    collectNewPoliciesForMetrics() { return [{ id: "n1" }]; }
  },
  DashboardUI: {
    policyNetPremium() { return 999; }
  }
});
assert(shallowToast.sumSavedPremium({ payload: { newPolicies: [{ premiumMonthly: 1 }] } }) === 88, "positive shallow sum still wins");

if(failed){
  console.error("\nFAILED " + failed + " / passed " + passed);
  process.exit(1);
}
console.log("\nOK " + passed + " assertions");
process.exit(0);
