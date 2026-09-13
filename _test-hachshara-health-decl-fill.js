/* GI-HACHSHARA-HEALTH-DECL-FILL
   Lock Hachshara official join health maps to printed AcroForm extents.
   Evidence (2026-09-13): HealthDecMainQ max — health 29, CI 27, life/mort full 20, short 12.
   Run: node _test-hachshara-health-decl-fill.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = __dirname;
const APP_TAG = "20260913-hachshara-health-decl-v1";
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

console.log("\n2) map extents match PDF AcroForm");
const H = loadHelper();
const ci = H.hachsharaHealthRows("ci");
const health = H.hachsharaHealthRows("health");
const full = H.hachsharaHealthRows("life_full");
const mort = H.hachsharaHealthRows("mortgage_full");
const short = H.hachsharaHealthRows("life_short");
assert(ci.filter((r) => r.q).length === 27, "CI → Q1–27");
assert(!ci.some((r) => r.q > 27), "CI no Q28+");
assert(health.filter((r) => r.q).length === 29, "health → Q1–29");
assert(full.filter((r) => r.q).length === 20, "life full → Q1–20");
assert(!full.some((r) => r.q > 20), "life full no Q21+");
assert(mort.filter((r) => r.q).length === 20, "mortgage full → Q1–20");
assert(short.filter((r) => r.q).length === 12, "life short → Q1–12");

console.log("\n3) named smoking + topic samples");
assert(ci[0].smoke && health[0].smoke && full[0].smoke && short[0].smoke, "all maps name smoking");
assert((ci.find((r) => r.q === 5).keys || []).indexOf("hachshara_crit__memory") >= 0, "CI Q5 = memory");
assert((health.find((r) => r.q === 5).keys || []).indexOf("hachshara__breath_chest") >= 0, "health Q5 = breath_chest");
assert((full.find((r) => r.q === 1).keys || []).indexOf("hachshara_risk_f__a1") >= 0, "full Q1 = a1 family");
assert((full.find((r) => r.q === 20).keys || []).indexOf("hachshara_risk_f__b14") >= 0, "full Q20 = b14 glands");
assert((short.find((r) => r.q === 1).keys || []).indexOf("hachshara_risk_s__q1") >= 0, "short Q1 = substances");

console.log("\n4) live fill — phantoms stay empty");
const capCi = {};
H.applyMappedHealthYesNo({ __giCapture: capCi }, {
  map: "ci",
  responses: {
    hachshara_crit__smoking: { p1: { answer: "yes" } },
    hachshara_crit__memory: { p1: { answer: "no" } },
    hachshara_crit__family_critical: { p1: { answer: "yes" } },
    hachshara_crit__infant_1: { p1: { answer: "yes" } },
    hachshara_crit__infant_2: { p1: { answer: "no" } }
  },
  primaryId: "p1"
});
assert(capCi.IsSmoking === "True", "CI smoking → IsSmoking");
assert(capCi.HealthDecMainQ5 === "2", "CI memory no → Q5");
assert(capCi.HealthDecMainQ27 === "1", "CI family yes → Q27");
assert(!capCi.HealthDecMainQ28 && !capCi.HealthDecMainQ29, "CI infants do not paint Q28/Q29");

const capFull = {};
H.applyMappedHealthYesNo({ __giCapture: capFull }, {
  map: "life_full",
  responses: {
    hachshara_risk_f__smoking: { p1: { answer: "no" } },
    hachshara_risk_f__b14: { p1: { answer: "yes" } },
    hachshara_risk_f__b15: { p1: { answer: "yes" } },
    hachshara_risk_f__b19: { p1: { answer: "yes" } }
  },
  primaryId: "p1"
});
assert(capFull.IsSmoking === "False", "full smoking → IsSmoking False");
assert(capFull.HealthDecMainQ20 === "1", "full b14 yes → Q20");
assert(!capFull.HealthDecMainQ21 && !capFull.HealthDecMainQ25, "full b15/b19 do not paint phantom Q21/Q25");

console.log("\n5) source guards");
assert(fs.readFileSync(path.join(ROOT, "gi-hachshara-ci-form.js"), "utf8").includes('map: "ci"'), "CI form uses ci map");
assert(fs.readFileSync(path.join(ROOT, "gi-hachshara-life-form.js"), "utf8").includes('map: "life_full"'), "life form uses life_full");
assert(fs.readFileSync(path.join(ROOT, "gi-hachshara-health-form.js"), "utf8").includes('map: "health"'), "health form uses health");

console.log("\n=== " + passed + " passed, " + failed + " failed ===");
process.exit(failed ? 1 : 0);
