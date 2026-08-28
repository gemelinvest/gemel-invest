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
const TAG = "20260828-sales-mail-hide-v1";
const APP_CACHE = "20260828-menora-health-decl-v1";
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

assert(engSrc.includes('version: "20260828-sales-mail-hide-v1"'), "engine version");
assert(app.includes('GI_PRODUCTION_JS_HREF = "./gi-production-import.js?v=' + TAG + '"'), "app production js href");
assert(html.includes("app.js?v=" + APP_CACHE), "index app.js cache");
assert(sw.includes("gi-v12-" + APP_CACHE), "service-worker cache");
assert(app.includes('id === "כלל"'), "forceReady includes Clal");
assert(app.includes("isProductionArchiveName"), "exe/zip helper");
assert(app.includes("loadProductionArchive"), "SFX unzip helper");
assert(app.includes("filesFromDataTransfer"), "folder drop helper");
assert(app.includes("HOLDNGINP"), "holdings skipped");
assert(app.includes("findEmbeddedZipOffset"), "embedded zip offset used");
assert(/loadAsync\(arrayBuffer\)/.test(app), "JSZip gets full EXE first (SFX CD offsets)");
assert(!/looksExe[\s\S]{0,80}arrayBuffer\.slice\(off\)/.test(app), "does not slice EXE before first JSZip load");
assert(app.includes("paintProductionPreviewRows"), "production preview is paginated");
assert(app.includes("CI_PROD_PAYLOAD_CHUNK"), "payload hydrate in small chunks");
assert(app.includes("customersShadow"), "production match also scans customersShadow");
assert(engSrc.includes("אין ת״ז או טלפון תקינים בדוח הפרודוקציה"), "no-id-or-phone reason string");
assert(!engSrc.includes("טענו קודם דוח לקוחות") && !app.includes("טענו קודם דוח לקוחות"), "does not tell user to re-upload customer report");
assert(engSrc.includes("יצירת תיק חדש מהפרודוקציה"), "unmatched with identity creates a folder");
assert(engSrc.includes("ins_prod_nm_"), "name-only insureds get ins_prod_nm_ ids");
assert(app.includes("אין צורך להעלות שוב דוח לקוחות"), "production UI says existing folders are enough");
assert(app.includes("ייפתח תיק חדש"), "UI says unmatched identity opens a new folder");
assert(app.includes("יצירת תיק"), "preview labels new folder vs new row");
assert(app.includes("cust_prod_"), "production-created folder id prefix");
assert(app.includes("personNameKeys") && engSrc.includes("personNameKeys"), "name-key helper for matching existing folders");
assert(app.includes(".range(from, from + PAGE - 1)") || app.includes(".range(from, from + PAGE"), "production fetch pages customer roster for names");
assert(app.includes("wantNames"), "production fetch collects names");
assert(app.includes('.in("phone"') || app.includes(".in(\"phone\""), "customer fetch queries phone column");
assert(app.includes("wantPhones"), "production fetch collects phones");
assert(fs.readFileSync(path.join(ROOT, "gi-customers-import.css"), "utf8").includes("min-height:0"), "modal body min-height");
assert(fs.readFileSync(path.join(ROOT, "gi-customers-import.css"), "utf8").includes("flex-shrink:0"), "modal foot does not shrink");
assert(app.includes("gi-customers-import.css?v=" + TAG), "customers css cache");

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
assert(parsed[1].rows[0] && parsed[1].rows[0].phone === "0521234567", "MEV phone 0521234567 not zeros");
assert(P.isValidIsraeliId("123456782") === true, "fixture ת״ז 123456782 checksum ok");
assert(P.isValidIsraeliId("818841410") === false, "garbage POL ת״ז 818841410 checksum fail");
assert(P.isPlausiblePhone("0000000000") === false, "all-zero phone rejected");
assert(P.isPlausiblePhone("0521234567") === true, "mobile 0521234567 accepted");
assert(P.looksVisualHebrew("םולש") === true, "םולש is visual");
assert(P.looksLogicalHebrew("שלום") === true, "שלום is logical");
assert(P.cleanPersonName("םולש") === "שלום", "cleanPersonName reverses visual");
assert(P.cleanPersonName("סבאן רפאלאש שלום") === "סבאן רפאלאש שלום", "logical health name is not reversed");
assert(P.cleanPersonName("רדנסכלא בוליאמש", true) === "שמאילוב אלכסנדר", "cp862-ambiguous name reverses when file is visual");
assert(P.cleanPersonName("רדנסכלא בוליאמש", false) === "רדנסכלא בוליאמש", "win1255-ambiguous name stays when file is logical");

const policies = P.buildPolicies(parsed, "כלל");
assert(policies.length === 1, "one policy built");
const pol = policies[0] || {};
assert(pol.company === "כלל", "company כלל");
assert(pol.policyNumber === "87654321", "policy number stripped");
assert(pol.premiumMonthly === "91.20", "monthly premium 91.20");
assert(pol.agentNumber === "12345", "agent 12345");
assert((pol.ids || []).indexOf("123456782") >= 0, "id from POL");
assert((pol.phones || []).indexOf("0521234567") >= 0, "phone from MEV");
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
  assert(hit && String((hit.people && hit.people[0] && hit.people[0].fullName) || "").indexOf("שלום") >= 0, "live 10356715 name contains שלום");
  assert(hit && (hit.ids || []).every((id) => P.isValidIsraeliId(id)), "live 10356715 ids checksum-only");
  assert(hit && !(hit.ids || []).includes("818841410"), "live 10356715 dropped garbage 818841410");
  assert(hit && hit.type === "בריאות", "live type בריאות");
  const badIds = live.filter((p) => (p.ids || []).some((id) => !P.isValidIsraeliId(id)));
  assert(badIds.length === 0, "live health ids are all checksum-valid (got " + badIds.length + ")");
  const zeroPhones = live.filter((p) => (p.phones || []).concat((p.people || []).map((x) => x.phone)).some((ph) => ph === "0000000000"));
  assert(zeroPhones.length === 0, "live health has no 0000000000 phones (got " + zeroPhones.length + ")");
  const healthAllDir = "/tmp/clal-boxes/_____16398____________________04-08-2026______07-27-49_14aa/off_182472/16398_בריאות_חיים/2026.08.03 02-16/אפקס חיים - בריאות";
  if(fs.existsSync(path.join(healthAllDir, "00176.MEV"))){
    const shot = P.buildPolicies(["00176.POL","00176.MEV"].filter((n) => fs.existsSync(path.join(healthAllDir, n))).map((n) => P.parseFileBuffer(n, fs.readFileSync(path.join(healthAllDir, n)))), "כלל");
    const natalie = shot.find((p) => p.policyNumber === "14993141");
    assert(!!natalie, "screenshot policy 14993141 is built");
    assert(natalie && (natalie.ids || []).indexOf("314514571") >= 0, "14993141 MEV id at offset 104 is 314514571 (got " + JSON.stringify(natalie && natalie.ids) + ")");
    const nm = String((natalie.people && natalie.people[0] && natalie.people[0].fullName) || "");
    assert(nm.indexOf("אזואלוס") >= 0, "14993141 name contains אזואלוס (got " + nm + ")");
    const byNatalie = new Map();
    byNatalie.set("314514571", { id: "cust-nat", fullName: "נטלי אזואלוס", idNumber: "314514571", payload: { newPolicies: [] } });
    const natClass = P.classifyPolicies([natalie], byNatalie);
    assert(natClass[0] && (natClass[0].action === "create" || natClass[0].action === "update"), "14993141 matches existing folder by ת״ז (got " + (natClass[0] && natClass[0].action) + ")");
  }
} else {
  console.log("  skip live health box (no extract)");
}

console.log("\n6) commit matching — IDs, classify, no policy-as-id");
assert(typeof P.idOverlapsPolicy === "function", "idOverlapsPolicy exported");
assert(P.idOverlapsPolicy("392236070", "39223607") === true, "policy + trailing 0 is not an ID");
assert(P.idOverlapsPolicy("123456782", "87654321") === false, "real ID is not the policy");

const lifePolBody = overlay(350, [
  { at: 0, bytes: "12345" },
  { at: 31, bytes: "039223607" },
  { at: 41, bytes: "114" },
  { at: 58, bytes: "00000120" }
], 0x30);
const lifeParsed = P.parseFileBuffer("39223.POL", recBuf(lifePolBody));
const lifeRow = (lifeParsed.rows || [])[0] || {};
assert(P.normPolicy(lifeRow.policyNumber) === "39223607", "life POL policy 39223607");
assert(!lifeRow.idNumber && !lifeRow.idNumber2, "life POL overlapping digits are not used as ת״ז");

const byId = new Map();
byId.set("123456782", { id: "cust-1", fullName: "בדיקה", idNumber: "123456782", payload: { newPolicies: [] } });
const classified = P.classifyPolicies(policies, byId);
assert(classified[0] && (classified[0].action === "create" || classified[0].action === "update"), "matched ת״ז is create/update (got " + (classified[0] && classified[0].action) + ")");
assert(classified[0] && classified[0].customer && classified[0].customer.id === "cust-1", "classified customer is cust-1");
assert(!classified[0].newFolder, "matched existing folder is not newFolder");
const noCust = P.classifyPolicies(policies, new Map());
assert(noCust[0] && noCust[0].action === "create" && noCust[0].newFolder === true, "no customer map + ת״ז → new folder create");
assert(noCust[0] && noCust[0].category === "create", "new folder counted as יצירה");
assert(noCust[0] && noCust[0].customer && String(noCust[0].customer.id).indexOf("cust_prod_") === 0, "new folder stub id is cust_prod_");
assert(typeof P.newFolderGroupKey === "function", "newFolderGroupKey exported");

const byPhone = new Map();
byPhone.set("tel:0521234567", { id: "cust-p", fullName: "טל", phone: "0521234567", payload: { newPolicies: [] } });
const classifiedPhone = P.classifyPolicies(policies, byPhone);
assert(classifiedPhone[0] && (classifiedPhone[0].action === "create" || classifiedPhone[0].action === "update"), "matched phone is create/update (got " + (classifiedPhone[0] && classifiedPhone[0].action) + ")");
assert(classifiedPhone[0] && classifiedPhone[0].customer && classifiedPhone[0].customer.id === "cust-p", "classified customer is cust-p");

const nameKeys = P.personNameKeys("אזואלוס אליז נטליכרכום");
assert(nameKeys.indexOf("נטלי אזואלוס") >= 0 || nameKeys.indexOf("אזואלוס נטלי") >= 0, "glued street still yields אזואלוס+נטלי keys (got " + nameKeys.slice(0,6).join("|") + ")");
const byName = new Map();
byName.set("name:נטלי אזואלוס", { id: "cust-n", fullName: "נטלי אזואלוס", payload: { newPolicies: [] } });
byName.set("name:אזואלוס נטלי", { id: "cust-n", fullName: "נטלי אזואלוס", payload: { newPolicies: [] } });
const namedPol = {
  company: "כלל",
  type: "בריאות",
  policyNumber: "14993141",
  ids: [],
  phones: [],
  people: [{ fullName: "אזואלוס אליז נטליכרכום" }],
  premiumMonthly: "10.00",
  inactive: false
};
const classifiedName = P.classifyPolicies([namedPol], byName);
assert(classifiedName[0] && (classifiedName[0].action === "create" || classifiedName[0].action === "update"), "unique name match is create/update (got " + (classifiedName[0] && classifiedName[0].action) + ")");
assert(classifiedName[0] && classifiedName[0].customer && classifiedName[0].customer.id === "cust-n", "name match customer is cust-n");
const emptyName = P.classifyPolicies([namedPol], new Map());
assert(emptyName[0] && emptyName[0].newFolder === true && emptyName[0].action === "create", "name without folder creates a new folder");
assert(emptyName[0] && emptyName[0].customer && String(emptyName[0].customer.id).indexOf("cust_prod_") === 0, "name-only stub id is cust_prod_");
const twoSameName = P.classifyPolicies([
  Object.assign({}, namedPol, { policyNumber: "14993141" }),
  Object.assign({}, namedPol, { policyNumber: "14993142" })
], new Map());
assert(twoSameName[0] && twoSameName[1] && twoSameName[0].customer.id === twoSameName[1].customer.id, "two policies same name share a new folder");
assert(P.newFolderGroupKey(namedPol) === P.newFolderGroupKey(Object.assign({}, namedPol, { policyNumber: "x" })), "group key ignores policy number when name exists");
const noIdent = {
  company: "כלל",
  type: "בריאות",
  policyNumber: "999",
  ids: [],
  phones: [],
  people: [],
  premiumMonthly: "1.00",
  inactive: false
};
const noIdentClass = P.classifyPolicies([noIdent], new Map());
assert(noIdentClass[0] && noIdentClass[0].action === "skip" && noIdentClass[0].category === "unmatched", "no identity stays unmatched skip");
const namePayload = P.applyToPayload({ insureds: [], newPolicies: [] }, Object.assign({}, namedPol, { action: "create" }));
assert((namePayload.insureds || []).some((x) => String(x.id || "").indexOf("ins_prod_nm_") === 0), "name-only insured id is ins_prod_nm_");
assert(String((namePayload.newPolicies || [])[0] && (namePayload.newPolicies || [])[0].id || "").indexOf("npol_prod_") === 0, "name-only policy still npol_prod_");

const garbagePol = overlay(386, [
  { at: 0, bytes: "87580" },
  { at: 23, bytes: "10356715" },
  { at: 32, bytes: "516770780" },
  { at: 41, bytes: "211" },
  { at: 66, bytes: "00009120" },
  { at: 368, bytes: "818841410" },
  { at: 382, bytes: "2174" }
], 0x30);
const garbageRow = (P.parseFileBuffer("87580.POL", recBuf(garbagePol)).rows || [])[0] || {};
assert(!garbageRow.idNumber && !garbageRow.idNumber2, "POL checksum-invalid IDs are dropped");

const CP862_HE = "אבגדהוזחטיךכלםמןנסעףפץצקרשת";
function encodeCp862(str){
  const out = [];
  const s = String(str || "");
  for(let i = 0; i < s.length; i++){
    const ch = s.charAt(i);
    const idx = CP862_HE.indexOf(ch);
    if(idx >= 0) out.push(0x80 + idx);
    else out.push(s.charCodeAt(i) & 0xff);
  }
  return Buffer.from(out);
}
const lifeMevVisual = overlay(220, [
  { at: 0, bytes: "12345065640070" },
  { at: 39, bytes: encodeCp862("רדנסכלא בוליאמש") },
  { at: 104, bytes: "0542383257" }
], 0x20);
const lifeMevParsed = P.parseFileBuffer("12345.MEV", recBuf(lifeMevVisual));
const lifeMevRow = (lifeMevParsed.rows || [])[0] || {};
assert(String(lifeMevRow.fullName || "").indexOf("שמאילוב") >= 0, "cp862 visual name becomes שמאילוב (got " + lifeMevRow.fullName + ")");
assert(lifeMevRow.phone === "0542383257", "cp862 MEV phone 0542383257");

const lifeDir = "/tmp/clal-boxes/_____16396_________________10-08-2026______12-52-52_e4cd/off_155639/16396_כלל_חיים/2026.07.31 00-00/אפקס חיים";
if(fs.existsSync(path.join(lifeDir, "87580.POL"))){
  const liveLife = P.buildPolicies([
    P.parseFileBuffer("87580.POL", fs.readFileSync(path.join(lifeDir, "87580.POL"))),
    P.parseFileBuffer("87580.MEV", fs.readFileSync(path.join(lifeDir, "87580.MEV")))
  ], "כלל");
  const fake = liveLife.filter((p) => (p.ids || []).some((id) => P.idOverlapsPolicy(id, p.policyNumber)));
  assert(fake.length === 0, "live life agent 87580 has no policy-as-id leftovers (got " + fake.length + ")");
  const alex = liveLife.find((p) => p.policyNumber === "11227428")
    || liveLife.find((p) => String(((p.people || [])[0] || {}).fullName || "").indexOf("שמאילוב") >= 0);
  assert(!!alex && String(((alex.people || [])[0] || {}).fullName || "").indexOf("שמאילוב") >= 0,
    "live life name שמאילוב not reversed (got " + String(((alex || {}).people || [])[0] && ((alex || {}).people || [])[0].fullName) + ")");
  const lifeZero = liveLife.filter((p) => (p.phones || []).includes("0000000000"));
  assert(lifeZero.length === 0, "live life has no 0000000000 phones");
  const byTel = new Map();
  liveLife.forEach((p, i) => {
    (p.phones || []).forEach((ph) => {
      const k = P.phoneKey(ph);
      if(k && !byTel.has(k)) byTel.set(k, { id: "life-"+i, fullName: "x", phone: ph, payload: { newPolicies: [] } });
    });
  });
  const lifeClass = P.classifyPolicies(liveLife, byTel);
  const lifeCreate = lifeClass.filter((x) => x.action === "create" || x.action === "update").length;
  console.log("  MEASURE live life 87580: policies=" + liveLife.length + " uniquePhones=" + byTel.size + " create+update=" + lifeCreate + " canCommit=" + (lifeCreate > 0));
  assert(lifeCreate > 0, "live life canCommit true when customers exist for extracted phones (got " + lifeCreate + ")");
} else {
  console.log("  skip live life overlap check");
}

console.log("\n7) measured button enablement vs empty customer map");
function countCommit(items){
  return (items || []).filter((x) => x.action === "create" || x.action === "update").length;
}
const healthDir = "/tmp/clal-boxes/_____16398____________________04-08-2026______07-27-49_14aa/off_182472/16398_בריאות_חיים/2026.08.03 02-16/אפקס חיים - בריאות";
if(fs.existsSync(path.join(healthDir, "87580.POL"))){
  const healthPols = P.buildPolicies(["87580.POL","87580.MEV","87580.TAR","87580.SGB"].map((n) => P.parseFileBuffer(n, fs.readFileSync(path.join(healthDir, n)))), "כלל");
  const emptyN = countCommit(P.classifyPolicies(healthPols, new Map()));
  console.log("  MEASURE live health 87580: policies=" + healthPols.length + " emptyMap create+update=" + emptyN + " canCommit=" + (emptyN > 0));
  assert(emptyN > 0, "empty customer map with identity → canCommit true via new folders (got " + emptyN + ")");
  const byBoth = new Map();
  healthPols.forEach((p, i) => {
    (p.ids || []).forEach((id) => {
      if(!byBoth.has(id)) byBoth.set(id, { id: "h-id-"+i, fullName: "x", idNumber: id, payload: { newPolicies: [] } });
    });
    (p.phones || []).forEach((ph) => {
      const k = P.phoneKey(ph);
      if(k && !byBoth.has(k)) byBoth.set(k, { id: "h-ph-"+i, fullName: "x", phone: ph, payload: { newPolicies: [] } });
    });
  });
  const matchedN = countCommit(P.classifyPolicies(healthPols, byBoth));
  console.log("  MEASURE live health 87580: id+phone map size=" + byBoth.size + " create+update=" + matchedN + " canCommit=" + (matchedN > 0));
  assert(matchedN > 0, "with matching ת״ז/טלפון already in the customer table, canCommit true (got " + matchedN + ")");
}

console.log("\n" + passed + " passed, " + failed + " failed");
if(failed) process.exit(1);
