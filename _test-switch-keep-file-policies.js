/* GI-SWITCH-KEEP 2026-10-08
   שיחלוף שומר פוליסות שלא סומנו, גם אם נשאר עליהן דגל סשן משמירה קודמת.
   בלי צילום מקור לא מחליפים את תיק הלקוח ברשימת הסשן.
   שורת פוליסה מציגה כ.א או הוראת קבע ו-4 ספרות אחרונות בלבד.
   הרצה: node _test-switch-keep-file-policies.js
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
const html = read("index.html");

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-switch-keep-file-policies.js")]).status === 0, "node --check this test");

console.log("\n2) switch keeps unmarked file policies");
const names = [
  "applySwitchCancellationsToPayload",
  "getCustomerPurchaseBaselinePolicies",
  "getCustomerPurchaseSessionPolicies",
  "getCustomerPurchaseBaselinePolicyIdSet",
  "getCustomerPurchaseSwitchCancelIdSet",
  "getCustomerPurchaseSwitchCancelPolicies",
  "convertNewPolicyToExistingForSwitch"
];
const src = {};
names.forEach((name) => { src[name] = sliceMethod(wiz, name); });
names.forEach((name) => assert(!!src[name], "sliced " + name));
assert(src.getCustomerPurchaseBaselinePolicies.includes("if(!fromSnapshot && policy?._purchaseSession) return false;"), "stale session flag ignored on file snapshot");
assert(src.applySwitchCancellationsToPayload.includes("לא מחליפים את תיק הלקוח ברשימת הסשן"), "missing snapshot does not replace the file list");

function makeCtx(mode){
  const ctx = {
    newPolicies: mode.newPolicies || [],
    customerPurchaseMode: mode.customerPurchaseMode,
    isCustomerPurchaseMode(){ return !!(this.customerPurchaseMode && this.customerPurchaseMode.active); },
    isCustomerPurchaseSwitchMode(){ return !!(this.isCustomerPurchaseMode() && String(this.customerPurchaseMode.mode) === "switch"); },
    getPolicyInsuredIds(policy){
      return Array.isArray(policy?.insuredIds) && policy.insuredIds.length ? policy.insuredIds.slice() : (policy?.insuredId ? [policy.insuredId] : []);
    },
    normalizeAllNewPolicies(list){ return Array.isArray(list) ? list.slice() : []; }
  };
  names.forEach((name) => {
    const maker = new Function("safeTrim", "return function " + src[name]);
    ctx[name] = maker(safeTrim).bind(ctx);
  });
  return ctx;
}

const stale = makeCtx({
  newPolicies: [{ id: "p_new", company: "כלל", type: "ריסק", _purchaseSession: true, insuredIds: ["ins_a"], premiumMonthly: "188.7" }],
  customerPurchaseMode: {
    active: true,
    mode: "switch",
    baselinePolicyIds: ["p_health", "p_ci", "p_risk"],
    switchCancelPolicyIds: ["p_risk"],
    baselinePolicies: [
      { id: "p_health", company: "כלל", type: "בריאות", _purchaseSession: true, insuredIds: ["ins_a"], premiumMonthly: "417.35" },
      { id: "p_ci", company: "הכשרה", type: "מחלות קשות", _purchaseSession: true, insuredIds: ["ins_a"], premiumMonthly: "368.49" },
      { id: "p_risk", company: "כלל", type: "ריסק", _purchaseSession: true, insuredIds: ["ins_a"], premiumMonthly: "527.28" }
    ]
  }
});
const stalePayload = {
  insureds: [{ id: "ins_a", data: { existingPolicies: [], cancellations: {} } }],
  newPolicies: [
    { id: "p_health", _purchaseSession: true },
    { id: "p_ci", _purchaseSession: true },
    { id: "p_risk", _purchaseSession: true },
    { id: "p_new", _purchaseSession: true }
  ],
  operational: { newPolicies: [] }
};
stale.applySwitchCancellationsToPayload(stalePayload);
const staleIds = (stalePayload.newPolicies || []).map((p) => p.id).sort();
assert(JSON.stringify(staleIds) === JSON.stringify(["p_ci", "p_health", "p_new"]), "unmarked policies stay and the new one is added");
assert(!(stalePayload.newPolicies || []).some((p) => p.id === "p_risk"), "only the marked policy leaves the new list");
assert((stalePayload.insureds[0].data.existingPolicies || []).some((p) => p.id === "p_risk"), "marked policy moves to existing");
assert((stalePayload.newPolicies || []).length === 3, "file is not reduced to the session policy alone");

const missing = makeCtx({
  newPolicies: [{ id: "p_new", _purchaseSession: true, insuredIds: ["ins_a"], premiumMonthly: "100" }],
  customerPurchaseMode: {
    active: true,
    mode: "switch",
    baselinePolicyIds: [],
    switchCancelPolicyIds: ["p_marked"],
    baselinePolicies: []
  }
});
const missingPayload = {
  insureds: [{ id: "ins_a", data: { existingPolicies: [], cancellations: {} } }],
  newPolicies: [
    { id: "p_a", premiumMonthly: "10" },
    { id: "p_b", premiumMonthly: "20" },
    { id: "p_marked", premiumMonthly: "30" },
    { id: "p_new", _purchaseSession: true, premiumMonthly: "100" }
  ],
  operational: { newPolicies: [] }
};
missing.applySwitchCancellationsToPayload(missingPayload);
const missingIds = (missingPayload.newPolicies || []).map((p) => p.id).sort();
assert(JSON.stringify(missingIds) === JSON.stringify(["p_a", "p_b", "p_new"]), "without a snapshot the other file policies stay");
assert(!(missingPayload.newPolicies || []).some((p) => p.id === "p_marked"), "marked id is still the only one removed");

console.log("\n3) payment status on the policy row");
const paySrc = sliceMethod(app, "formatPolicyPaymentStatus");
assert(!!paySrc, "sliced formatPolicyPaymentStatus");
assert(!paySrc.includes("getPaymentHost"), "row label does not mutate payment defaults");
assert(app.includes("customerPolicyRow__pay"), "policy row renders the payment pill");
assert(css.includes("customerPolicyRow__pay"), "payment pill has a style");
assert(html.includes("giSwitchKeep=1"), "cache token includes the switch fix");
const formatPolicyPaymentStatus = new Function("safeTrim", "return function " + paySrc)(safeTrim);

const cardRec = { payload: { primary: { paymentMethod: "cc", cc: { cardNumber: "4580123412345678", cvv: "123" }, ho: { account: "999999", bankName: "לאומי" } } } };
const cardLabel = formatPolicyPaymentStatus(cardRec);
assert(cardLabel === "כ.א · 5678", "credit card shows כ.א and last 4");
assert(!cardLabel.includes("4580123412345678"), "full card number is not shown");
assert(!cardLabel.includes("123"), "cvv is not shown");
assert(!cardLabel.includes("לאומי"), "bank name is not shown on a card row");

const hoRec = { payload: { insureds: [{ data: { paymentMethod: "ho", ho: { account: "12-345-6789", bankName: "הפועלים", branch: "123" } } }] } };
const hoLabel = formatPolicyPaymentStatus(hoRec);
assert(hoLabel === "הוראת קבע · 6789", "standing order shows הוראת קבע and last 4 of the account");
assert(!hoLabel.includes("12345"), "account number beyond the last 4 is not shown");
assert(!hoLabel.includes("הפועלים"), "bank name is not shown");
assert(!hoLabel.includes("branch") && !hoLabel.includes("123"), "branch is not shown");

assert(formatPolicyPaymentStatus({ payload: { primary: { paymentMethod: "cc", cc: { cardNumber: "12" } } } }) === "", "short card number shows nothing");
assert(formatPolicyPaymentStatus({ payload: { primary: {} } }) === "", "missing payment method shows nothing");
assert(formatPolicyPaymentStatus({ payload: {} }) === "", "empty file shows nothing");

console.log("\n" + passed + " passed, " + failed + " failed");
if(failed) process.exit(1);
