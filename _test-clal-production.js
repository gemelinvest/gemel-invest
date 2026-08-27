/* GI-CLAL-PRODUCTION 2026-08-27
   Clal Apex production import (POL/MEV/TAR/SGB, EXE SFX zip).
   Run: node _test-clal-production.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const vm = require("vm");

const ROOT = __dirname;
const TAG = "20260827-clal-prod-v1";
const APP_CACHE = "20260827-clal-prod-v1";
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

function loadEngine(){
  const src = fs.readFileSync(path.join(ROOT, "gi-production-import.js"), "utf8");
  const sandbox = { window: {}, console };
  vm.runInNewContext(src, sandbox);
  return sandbox.window.GI_PRODUCTION;
}

const HE1255 = "אבגדהוזחטיךכלםמןנסעףפץצקרשת";

function encodeWin1255(str){
  const out = [];
  const s = String(str || "");
  for(let i = 0; i < s.length; i++){
    const ch = s.charAt(i);
    const idx = HE1255.indexOf(ch);
    if(idx >= 0) out.push(0xE0 + idx);
    else out.push(s.charCodeAt(i) & 0xff);
  }
  return Buffer.from(out);
}

function overlay(len, puts, fill){
  const buf = Buffer.alloc(len, fill == null ? 0x20 : fill);
  puts.forEach((p) => {
    const b = Buffer.isBuffer(p.bytes) ? p.bytes : Buffer.from(String(p.bytes), "latin1");
    b.copy(buf, p.at);
  });
  return buf;
}

function recBuf(body){
  return Buffer.concat([body, Buffer.from("\r\n")]);
}

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-production-import.js")]).status === 0, "gi-production-import.js syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "app.js syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-clal-production.js")]).status === 0, "test syntax");

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
const engSrc = fs.readFileSync(path.join(ROOT, "gi-production-import.js"), "utf8");

assert(engSrc.includes('version: "20260827-clal-prod-v1"'), "engine version");
assert(app.includes('GI_PRODUCTION_JS_HREF = "./gi-production-import.js?v=' + TAG + '"'), "app production js href");
assert(html.includes("app.js?v=" + APP_CACHE), "index app.js cache");
assert(sw.includes("gi-v12-" + APP_CACHE), "service-worker cache");
assert(app.includes('id === "כלל"'), "forceReady includes Clal");
assert(app.includes("isProductionArchiveName"), "exe/zip helper");
assert(app.includes("loadProductionArchive"), "SFX unzip helper");
assert(app.includes("HOLDNGINP"), "holdings skipped");
assert(app.includes("findEmbeddedZipOffset"), "embedded zip offset used");

const P = loadEngine();
assert(!!P && typeof P.parseFileBuffer === "function", "GI_PRODUCTION loaded");
const clalCo = (P.COMPANIES || []).find((c) => c && c.id === "כלל");
assert(!!(clalCo && clalCo.ready === true), "Clal company ready");
assert(typeof P.findEmbeddedZipOffset === "function", "findEmbeddedZipOffset exported");
assert(P.detectClalKindFromName("87580.POL") === "CLAL_POL", "detect POL");
assert(P.detectClalKindFromName("87580.MEV") === "CLAL_MEV", "detect MEV");
assert(P.detectClalKindFromName("201000520024647HOLDNGINP009.DAT") === "", "skip HOLDNGINP");
assert(P.detectClalKindFromName("תיבה/ממשק אחזקות/x.POL") === "", "skip אחזקות path");

const mz = Buffer.concat([Buffer.from("MZ"), Buffer.alloc(40, 0), Buffer.from("PK\x03\x04hello")]);
assert(P.findEmbeddedZipOffset(mz) === 42, "SFX zip offset after MZ stub");
assert(P.findEmbeddedZipOffset(Buffer.from("PK\x03\x04abc")) === 0, "plain zip offset 0");

console.log("\n2) fixture health policy 87654321");
const polBody = overlay(386, [
  { at: 0, bytes: "12345" },
  { at: 23, bytes: "87654321" },
  { at: 32, bytes: "123456782" },
  { at: 41, bytes: "211" },
  { at: 66, bytes: "00009120" },
  { at: 368, bytes: "123456782" },
  { at: 382, bytes: "2174" }
], 0x30);

const mevBody = overlay(351, [
  { at: 0, bytes: "12345087654321" },
  { at: 45, bytes: encodeWin1255("םולש") },
  { at: 49, bytes: "16" },
  { at: 78, bytes: encodeWin1255("תל אביב-יפו") },
  { at: 104, bytes: "0521234567" },
  { at: 117, bytes: encodeWin1255("ז") },
  { at: 350, bytes: "1" }
], 0x20);

const tarBody = overlay(188, [
  { at: 0, bytes: "123450000000001087654321" },
  { at: 180, bytes: "00305000" }
], 0x30);

const sgbBody = encodeWin1255("003050מדיכלל ניתוחים בישראל");

const parsed = [
  P.parseFileBuffer("12345.POL", recBuf(polBody)),
  P.parseFileBuffer("12345.MEV", recBuf(mevBody)),
  P.parseFileBuffer("12345.TAR", recBuf(tarBody)),
  P.parseFileBuffer("12345.SGB", recBuf(sgbBody))
];
assert(parsed[0].kind === "CLAL_POL", "detect CLAL_POL");
assert(parsed[1].kind === "CLAL_MEV", "detect CLAL_MEV");
assert(parsed[2].kind === "CLAL_TAR", "detect CLAL_TAR");
assert(parsed[3].kind === "CLAL_SGB", "detect CLAL_SGB");
assert(parsed[0].rows[0] && parsed[0].rows[0].policyNumber === "87654321", "POL policy 87654321");
assert(parsed[0].rows[0] && parsed[0].rows[0].premium === 91.2, "POL monthly 91.20");
assert(parsed[1].rows[0] && String(parsed[1].rows[0].fullName || "").indexOf("שלום") >= 0, "MEV name שלום after visual fix");
assert(parsed[1].rows[0] && String(parsed[1].rows[0].city || "").indexOf("תל אביב") >= 0, "MEV city stays logical");
assert(parsed[1].rows[0] && parsed[1].rows[0].gender === "זכר", "MEV gender זכר");

const policies = P.buildPolicies(parsed, "כלל");
assert(policies.length === 1, "one policy built");
const pol = policies[0] || {};
assert(pol.company === "כלל", "company כלל");
assert(pol.policyNumber === "87654321", "policy number stripped");
assert(pol.premiumMonthly === "91.20", "monthly premium 91.20");
assert(pol.agentNumber === "12345", "agent 12345");
assert((pol.ids || []).indexOf("123456782") >= 0, "id from POL");
assert(pol.type === "בריאות", "type בריאות");
assert((pol.healthCovers || []).indexOf("ניתוחים בישראל מורחב") >= 0, "cover mapped to ניתוחים בישראל מורחב");
assert(pol.inactive !== true, "in-force is active");
assert(pol.importSource === "clal-production", "import source");

console.log("\n3) applyToPayload writes npol_prod_ only");
const next = P.applyToPayload({ insureds: [{ id: "ins1", type: "primary", data: { idNumber: "123456782" } }], newPolicies: [] }, Object.assign({}, pol, {
  action: "create",
  insuredIds: ["ins1"]
}));
const created = (next.newPolicies || [])[0] || {};
assert(String(created.id || "").indexOf("npol_prod_") === 0, "id prefix npol_prod_");
assert(created.company === "כלל" || P.sameCompany(created.company, "כלל ביטוח"), "sameCompany aliases");
assert(P.sameCompany("כלל", "כלל ביטוח"), "כלל ≡ כלל ביטוח");
assert((created.healthCovers || []).indexOf("ניתוחים בישראל מורחב") >= 0, "payload healthCovers");
assert(created.productionImport && created.productionImport.source === "clal-production", "productionImport source");

console.log("\n4) life SGB maps to ריסק; holdings ignored");
const lifeSgb = P.parseFileBuffer("00176.SGB", recBuf(encodeWin1255("000028ריסק מחלה סופנית")));
assert(lifeSgb.rows[0] && /ריסק/.test(lifeSgb.rows[0].desc || ""), "life SGB desc has ריסק");
const hold = P.parseFileBuffer("201000520024647HOLDNGINP009.DAT", Buffer.from("not-apex"));
assert(!hold.kind || hold.kind === "", "holdings file is not a Clal Apex kind");

console.log("\n5) live Apex extract if present");
const liveDir = "/tmp/clal-boxes/_____16398____________________04-08-2026______07-27-49_14aa/off_182472/16398_בריאות_חיים/2026.08.03 02-16/אפקס חיים - בריאות";
if(fs.existsSync(path.join(liveDir, "87580.POL"))){
  const names = ["87580.POL", "87580.MEV", "87580.TAR", "87580.SGB"];
  const live = P.buildPolicies(names.map((n) => P.parseFileBuffer(n, fs.readFileSync(path.join(liveDir, n)))), "כלל");
  assert(live.length >= 200, "health box agent 87580 builds many policies (got " + live.length + ")");
  const hit = live.find((p) => p.policyNumber === "10356715");
  assert(!!hit, "live includes 10356715");
  assert(hit && hit.premiumMonthly === "91.20", "live premium 91.20");
  assert(hit && hit.company === "כלל", "live company כלל");
  assert(hit && (hit.ids || []).length > 0, "live has owner id");
  assert(hit && hit.type === "בריאות", "live type בריאות");
  assert(live.every((p) => p.importSource === "clal-production"), "live import source");
} else {
  console.log("  skip live health box (no extract)");
}

console.log("\n" + passed + " passed, " + failed + " failed");
if(failed) process.exit(1);
