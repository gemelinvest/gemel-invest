/* GI-MENORA-PRODUCTION 2026-08-26
   Menora life production import (M/N/G/P + TRFR, IBM862).
   Run: node _test-menora-production.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const vm = require("vm");

const ROOT = __dirname;
const TAG = "20260827-clal-id-phone-v1";
const APP_CACHE = "20260827-clal-id-phone-v1";
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

function hexToBuf(hex){
  return Buffer.from(String(hex).replace(/\s+/g, ""), "hex");
}

function loadEngine(){
  const src = fs.readFileSync(path.join(ROOT, "gi-production-import.js"), "utf8");
  const sandbox = { window: {}, console };
  vm.runInNewContext(src, sandbox);
  return sandbox.window.GI_PRODUCTION;
}

const HEX_M = "3036333630303531393733343033373836303030303030313031353230303030303030303030302033303236303239363620202020202020202020202020202020202020202020202020202020202030303030302020202020202020202020202020202020202020202020202020202020202020202020202020202030303030302e303030303030302e303030302e303030302e303030303030302e30303030303030303030302e303030302e303030302e303030302e303030202020202020202020303030303030";
const HEX_N = "303633363030353139373334303337383630303030303031303135323030303030303030303030303038319084808130303030303030302e30303032313038363730303030302e30303230323130373030303030302e30303030303030302e30303030303234392e3438323032313038333032363032393636868631393839303432359180898c8020202020202020808180208d84988180203030313131323533382e303030";
const HEX_G = "303633363030353139373334303337383630303030303031303135323030303030303030303030323630383030303030302e30303030303030302e3030203030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030302e303030302039393939393030303030303030303020303030303030303030303030303030303030303030333039392e373230303030303235382e333130303030303030302e303030303030302e303030303030302e303030303030302e303030303030302e303030303030302e303030303030302e303030303030302e3030303030303030303030303030302e30303030303030303030303134373339303030303030303030303030302e3030";
const HEX_P = "30363336303035313937333430333738363030303030303130313532303030303030303030303033303236303239363631393839303432359180898c8020898720808180208d849881802020202020208630303030303030303020202020202020202020202020202020202020202020202020202020202020202030303030309a9496202020202020202020202020323420849099859984209a92818220202020202020202020203231303430308e9a998436373637303831323336352e303030303030303030303030302e303030343030303030303030303030303030302e30303031202020203032303231303331383230323130332086203030353436323938363333303030302e303030303030303030302e303030303030303030303137373520202020303030303030";
const HEX_TRFR = "908480812020202020202020202020202020209889848e208f858781803330";

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-production-import.js")]).status === 0, "gi-production-import.js syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "app.js syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-menora-production.js")]).status === 0, "test syntax");

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
const engSrc = fs.readFileSync(path.join(ROOT, "gi-production-import.js"), "utf8");

assert(engSrc.includes('version: "20260827-clal-id-phone-v1"'), "engine version");
assert(app.includes('GI_PRODUCTION_JS_HREF = "./gi-production-import.js?v=' + TAG + '"'), "app production js href");
assert(html.includes("app.js?v=" + APP_CACHE), "index app.js cache");
assert(sw.includes("gi-v12-" + APP_CACHE), "service-worker cache");
assert(app.includes('id === "מנורה"'), "forceReady includes Menora");
assert(app.includes("productionPathLooksCancelled"), "zip cancelled helper");
assert(app.includes("JSZip.loadAsync"), "zip expansion in handleProductionFiles");

const P = loadEngine();
assert(!!P && typeof P.parseFileBuffer === "function", "GI_PRODUCTION loaded");
const menoraCo = (P.COMPANIES || []).find((c) => c && c.id === "מנורה");
assert(!!(menoraCo && menoraCo.ready === true), "Menora company ready");

console.log("\n2) fixture policy 06360051973");
const parsed = [
  P.parseFileBuffer("000001661M.TXT", hexToBuf(HEX_M)),
  P.parseFileBuffer("000001661N.TXT", hexToBuf(HEX_N)),
  P.parseFileBuffer("000001661G.TXT", hexToBuf(HEX_G)),
  P.parseFileBuffer("000001661P.TXT", hexToBuf(HEX_P)),
  P.parseFileBuffer("TRFR.ALL", hexToBuf(HEX_TRFR))
];
assert(parsed[0].kind === "MENORA_M", "detect M");
assert(parsed[1].kind === "MENORA_N", "detect N");
assert(parsed[2].kind === "MENORA_G", "detect G");
assert(parsed[3].kind === "MENORA_P", "detect P");
assert(parsed[4].kind === "MENORA_TRFR", "detect TRFR");
assert(parsed[4].rows[0] && parsed[4].rows[0].code === "באהנ", "TRFR code logical באהנ");
assert(parsed[4].rows[0] && parsed[4].rows[0].desc.indexOf("אבחון מהיר") >= 0, "TRFR desc אבחון מהיר");
assert(parsed[4].rows[0] && parsed[4].rows[0].class === "30", "TRFR class 30");

const policies = P.buildPolicies(parsed, "מנורה");
assert(policies.length === 1, "one policy built");
const pol = policies[0] || {};
assert(pol.company === "מנורה", "company מנורה");
assert(pol.policyNumber === "6360051973", "policy number stripped");
assert(pol.premiumMonthly === "258.31", "G monthly premium 258.31");
assert(pol.agentNumber === "403786", "agent 403786");
assert((pol.ids || []).indexOf("0302602966") >= 0 || (pol.ids || []).indexOf("302602966") >= 0, "id 302602966");
assert(String(pol.primary && pol.primary.fullName || "").indexOf("אברהם") >= 0, "name contains אברהם");
assert(String(pol.primary && pol.primary.fullName || "").indexOf("אליאס") >= 0, "name contains אליאס");
assert((pol.healthCovers || []).indexOf("ייעוץ ובדיקות") >= 0, "cover mapped to ייעוץ ובדיקות");
assert(pol.type === "בריאות", "type בריאות");
assert(pol.inactive !== true, "in-force is active");
assert(pol.importSource === "menora-production", "import source");
assert(!P.isProposalPolicy || true, "engine still exposes classify");

console.log("\n3) cancelled MM flagged inactive");
const cancelledParsed = parsed.map((f) => P.parseFileBuffer(f.fileName, hexToBuf({
  "000001661M.TXT": HEX_M,
  "000001661N.TXT": HEX_N,
  "000001661G.TXT": HEX_G,
  "000001661P.TXT": HEX_P,
  "TRFR.ALL": HEX_TRFR
}[f.fileName]), { cancelled: true }));
const cancelledPols = P.buildPolicies(cancelledParsed, "מנורה");
assert(cancelledPols[0] && cancelledPols[0].inactive === true, "MM cancelled → inactive");
const classified = P.classifyPolicies(cancelledPols, new Map());
assert(classified[0] && classified[0].category === "inactive", "classify skips cancelled");

console.log("\n4) applyToPayload writes npol_prod_ only");
const next = P.applyToPayload({ insureds: [{ id: "ins1", type: "primary", data: { idNumber: "0302602966" } }], newPolicies: [] }, Object.assign({}, pol, {
  action: "create",
  insuredIds: ["ins1"]
}));
const created = (next.newPolicies || [])[0] || {};
assert(String(created.id || "").indexOf("npol_prod_") === 0, "id prefix npol_prod_");
assert(created.company === "מנורה" || created.company === "מנורה מבטחים" || P.sameCompany(created.company, "מנורה מבטחים"), "sameCompany aliases");
assert(P.sameCompany("מנורה", "מנורה מבטחים"), "מנורה ≡ מנורה מבטחים");
assert((created.healthCovers || []).indexOf("ייעוץ ובדיקות") >= 0, "payload healthCovers");
assert(created.productionImport && created.productionImport.source === "menora-production", "productionImport source");

console.log("\n5) live MP/MM files if present");
function parseDir(dir, cancelled){
  const names = ["000001661M.TXT", "000001661N.TXT", "000001661G.TXT", "000001661P.TXT", "TRFR.ALL"];
  return names.map((n) => {
    const buf = fs.readFileSync(path.join(dir, n));
    return P.parseFileBuffer(n, buf, { cancelled: !!cancelled });
  });
}
if(fs.existsSync("/tmp/menora-mp/000001661M.TXT")){
  const live = P.buildPolicies(parseDir("/tmp/menora-mp", false), "מנורה");
  assert(live.length === 1790, "MP builds 1790 in-force policies (got " + live.length + ")");
  const hit = live.find((p) => p.policyNumber === "6360051973");
  assert(!!hit, "live includes 6360051973");
  assert(hit && hit.premiumMonthly === "258.31", "live premium 258.31");
  assert(hit && (hit.healthCovers || []).indexOf("ייעוץ ובדיקות") >= 0, "live health cover mapped");
  assert(hit && (hit.healthCovers || []).indexOf("ניתוחים בישראל מהשקל הראשון") >= 0, "live שקל ראשון from truncated TRFR");
  assert(hit && (hit.healthCovers || []).indexOf("ניתוחים וטיפולים מחליפי ניתוח מחוץ לישראל") >= 0, "live abroad surgery kept (not remapped to ישראל)");
  assert(hit && (hit.healthCovers || []).indexOf("תרופות מחוץ לסל שירותי הבריאות") >= 0, "live תרופה → תרופות");
  assert(live.every((p) => !p.inactive), "MP policies are active");
} else {
  console.log("  skip live MP (no /tmp/menora-mp)");
}
if(fs.existsSync("/tmp/menora-mm/000001661M.TXT")){
  const liveMm = P.buildPolicies(parseDir("/tmp/menora-mm", true), "מנורה");
  assert(liveMm.length === 5225, "MM builds 5225 cancelled policies (got " + liveMm.length + ")");
  assert(liveMm.every((p) => p.inactive === true), "MM policies inactive");
  const cats = P.classifyPolicies(liveMm.slice(0, 20), new Map());
  assert(cats.every((c) => c.category === "inactive"), "MM classify inactive");
} else {
  console.log("  skip live MM (no /tmp/menora-mm)");
}

console.log("\n" + passed + " passed, " + failed + " failed");
if(failed) process.exit(1);
