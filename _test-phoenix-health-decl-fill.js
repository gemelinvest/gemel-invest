/* GI-PHOENIX-HEALTH-DECL-FILL
   Lock printed PDF field order ↔ wizard keys for Phoenix official joins.
   Evidence: AcroForm Y + nearby printed text on phoenix-*-join.pdf (2026-09-13).
   Run: node _test-phoenix-health-decl-fill.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = __dirname;
const APP_TAG = "20260913-phoenix-health-decl-v1";
let passed = 0;
let failed = 0;

function assert(cond, msg){
  if(cond){
    passed += 1;
    console.log("  PASS  " + msg);
  } else {
    failed += 1;
    console.error("  FAIL  " + msg);
  }
}

function loadHelper(){
  const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
  const start = app.indexOf("const GI_OFFICIAL_FORM_FILL = {");
  const end = app.indexOf("try { window.GI_OFFICIAL_FORM_FILL = GI_OFFICIAL_FORM_FILL; }", start);
  assert(start > 0 && end > start, "GI_OFFICIAL_FORM_FILL block found");
  const ctx = { window: {}, console };
  vm.runInNewContext(app.slice(start, end) + "\nthis.GI_OFFICIAL_FORM_FILL = GI_OFFICIAL_FORM_FILL;", ctx);
  return ctx.GI_OFFICIAL_FORM_FILL;
}

console.log("1) cache tag");
const appSrc = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
assert(appSrc.includes('BUILD = "' + APP_TAG + '"'), "app BUILD tag");
assert(html.includes("app.js?v=" + APP_TAG), "index app.js tag");
assert(sw.includes("gi-v12-" + APP_TAG), "service worker cache");

console.log("\n2) health join map (IsSmoking + Q2–Q28, no Q1)");
const H = loadHelper();
const healthRows = H.phoenixHealthRows();
assert(healthRows.length === 28, "health has 28 rows");
assert(healthRows[0].smoke === true && healthRows[0].key === "phoenix_full__smoking", "health smoking named");
assert(healthRows[1].field === "Q2" && healthRows[1].key === "phoenix_full__family", "Q2 = family");
assert(healthRows[4].field === "Q5" && healthRows[4].key === "phoenix_full__heart", "Q5 = heart");
assert(healthRows[26].field === "Q27" && healthRows[26].key === "phoenix_full__medications", "Q27 = medications");
assert(healthRows[27].field === "Q28" && healthRows[27].key === "phoenix_full__disability", "Q28 = disability");
assert(!healthRows.some((r) => r.field === "Q1"), "health has no Q1 radio (smoking uses IsSmoking)");

const capHealth = {};
H.applyMappedHealthYesNo({ __giCapture: capHealth }, {
  map: "phoenix_health",
  responses: {
    phoenix_full__smoking: { p1: { answer: "yes" } },
    phoenix_full__family: { p1: { answer: "no" } },
    phoenix_full__heart: { p1: { answer: "yes" } },
    phoenix_full__medications: { p1: { answer: "no" } },
    phoenix_full__disability: { p1: { answer: "yes" } }
  },
  primaryId: "p1"
});
assert(capHealth.IsSmoking === "True", "health smoking → IsSmoking True");
assert(capHealth.Q2 === "2", "family no → Q2");
assert(capHealth.Q5 === "1", "heart yes → Q5");
assert(capHealth.Q27 === "2", "medications no → Q27");
assert(capHealth.Q28 === "1", "disability yes → Q28");
assert(!capHealth.Q1, "health never paints Q1");

console.log("\n3) life short (skip Q3; smoking named)");
const short = H.PHOENIX_HEALTH_ROWS.short;
assert(short[0].step === "s2_treatment" && short[0].field === "Q1", "short Q1 = treatment");
assert(short[1].step === "s3_tests" && short[1].field === "Q2", "short Q2 = tests");
assert(short[2].smoke === true && short[2].step === "s4_smoking", "short smoking named between Q2 and Q4");
assert(short[3].step === "s5_1_heart" && short[3].field === "Q4", "short Q4 = heart");
assert(short[9].step === "s6_vision" && short[9].field === "Q10", "short Q10 = vision");
assert(short[15].step === "s12_disability" && short[15].field === "Q16", "short Q16 = disability");
assert(!short.some((r) => r.field === "Q3"), "short has no Q3 (smoking gap)");

const capShort = {};
H.applyNamedHealthYesNo({ __giCapture: capShort }, {
  mode: "short",
  responses: {
    phoenix_risk_u55_under2m__s2_treatment: { p1: { answer: "yes" } },
    phoenix_risk_u55_under2m__s3_tests: { p1: { answer: "no" } },
    phoenix_risk_u55_under2m__s4_smoking: { p1: { answer: "yes" } },
    phoenix_risk_u55_under2m__s5_1_heart: { p1: { answer: "no" } },
    phoenix_risk_u55_under2m__s5_3_cancer: { p1: { answer: "yes" } },
    phoenix_mortgage_u55_under2m__s12_disability: { p1: { answer: "no" } }
  },
  primaryId: "p1"
});
assert(capShort.Q1 === "1", "short treatment yes → Q1");
assert(capShort.Q2 === "2", "short tests no → Q2");
assert(capShort.IsSmoking === "True", "short smoking → IsSmoking");
assert(capShort.Q4 === "2", "short heart no → Q4");
assert(capShort.Q6 === "1", "short cancer yes → Q6");
assert(capShort.Q16 === "2", "short disability via mortgage prefix → Q16");
assert(!capShort.Q3, "short never paints Q3");

console.log("\n4) life full (skip Q7; smoking named)");
const full = H.PHOENIX_HEALTH_ROWS.full;
assert(full[0].step === "e2_weight" && full[0].field === "Q1", "full Q1 = weight");
assert(full[5].step === "e7_surgery" && full[5].field === "Q6", "full Q6 = surgery");
assert(full[6].smoke === true && full[6].step === "e8_smoking", "full smoking named between Q6 and Q8");
assert(full[7].step === "e9_drugs" && full[7].field === "Q8", "full Q8 = drugs");
assert(full[9].step === "e11_1_heart" && full[9].field === "Q10", "full Q10 = heart");
assert(full[20].step === "e11_12_cancer" && full[20].field === "Q21", "full Q21 = cancer");
assert(full[25].step === "e11_17_family" && full[25].field === "Q26", "full Q26 = family");
assert(!full.some((r) => r.field === "Q7"), "full has no Q7 (smoking gap)");

const capFull = {};
H.applyNamedHealthYesNo({ __giCapture: capFull }, {
  mode: "full",
  responses: {
    phoenix_risk_o55_or_over2m__e2_weight: { p1: { answer: "yes" } },
    phoenix_risk_o55_or_over2m__e8_smoking: { p1: { answer: "no" } },
    phoenix_risk_o55_or_over2m__e11_1_heart: { p1: { answer: "yes" } },
    phoenix_mortgage_o55_or_over2m__e11_17_family: { p1: { answer: "no" } }
  },
  primaryId: "p1"
});
assert(capFull.Q1 === "1", "full weight yes → Q1");
assert(capFull.IsSmoking === "False", "full smoking no → IsSmoking False");
assert(capFull.Q10 === "1", "full heart yes → Q10");
assert(capFull.Q26 === "2", "full family via mortgage prefix → Q26");
assert(!capFull.Q7, "full never paints Q7");

console.log("\n5) CI overlay step order (declaration 303)");
const ciSrc = fs.readFileSync(path.join(ROOT, "gi-phoenix-ci-form.js"), "utf8");
assert(ciSrc.includes('key: "ci_smoking"'), "CI overlay has smoking");
assert(ciSrc.includes('key: "ci_diabetes"'), "CI overlay has diabetes 3.7");
assert(ciSrc.includes('key: "ci_family"'), "CI overlay has family 3.11");
assert(!ciSrc.includes('key: "ci_alcohol"'), "CI overlay has no alcohol (removed from 303)");
const ciKeys = H.HEALTH_QKEYS.phoenix_ci || [];
assert(ciKeys.length === 13, "CI HEALTH_QKEYS length 13");
assert(ciKeys[0] === "phoenix_critical_illness__ci_smoking", "CI key 0 smoking");
assert(ciKeys[8] === "phoenix_critical_illness__ci_diabetes", "CI key 8 diabetes");
assert(ciKeys[12] === "phoenix_critical_illness__ci_family", "CI key 12 family");

console.log("\n6) source guards");
assert(appSrc.includes("applyNamedHealthYesNo"), "named life helper exists");
assert(appSrc.includes('map: "phoenix_health"') || fs.readFileSync(path.join(ROOT, "gi-phoenix-health-form.js"), "utf8").includes('map: "phoenix_health"'), "health form uses phoenix_health map");
assert(fs.readFileSync(path.join(ROOT, "gi-phoenix-life-form.js"), "utf8").includes("applyNamedHealthYesNo"), "life form uses named helper");

console.log("\n=== " + passed + " passed, " + failed + " failed ===");
process.exit(failed ? 1 : 0);
