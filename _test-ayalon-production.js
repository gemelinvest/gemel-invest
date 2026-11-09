/* GI-AYALON-PRODUCTION
   Ayalon production files (m41–m72, Windows-1255) fill the production layer.
   Run: node _test-ayalon-production.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const vm = require("vm");

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

function loadEngine(){
  const src = fs.readFileSync(path.join(ROOT, "gi-production-import.js"), "utf8");
  const sandbox = { window: {}, console };
  vm.runInNewContext(src, sandbox);
  return sandbox.window.GI_PRODUCTION;
}

const FIXTURE_B64 = "TTQxCjQwNTY4NDA5NzgwMDcwNzM3NDIyMDMzNDgxNTYwMDAwMDAwMDAwMDAwMDA3MDAxMTIxMjAxNDA1MDEyMDE0MDUwMTAwMDAwMDAwMjAzMzQ4MTU2MjAzMzQ4MTU2MTA0MDMwMDEyMzE4MDAwMDQyODA1MDAwMDAwMDAwMDExMDAwMDAwMDAwMDAwMDAwMDAwMDU4NTAwMTAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDIwMTQwNTEyMjAxNDA1MDEKNDA1Njg0MDk3ODAxNDA5ODE0NzIwMzYzMjAzOTAwMDAwMDAwMDAwMDAwMDcwMDExMjEyMDI0MDMwMTIwMjQwMzAxMDAwMDAwMDAyMDM2MzIwMzkyMDM2MzIwMzkxMDQwMzAwMTM3NDkwMDAwNDI4MDMwMDAwMDAwMDAwMTEwMDAwMDAwMDAwMDAwMDAwMDAwNzQ0OTAxMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMjAyNDAyMTEyMDI0MDIwMQpNNDgKNDA1Njg0MDk3ODIwMzM0ODE1Nuny6fkg6ffp+CAgICAgICAgICAgICAgIPjl9OnvICAgICAgICAgICAgIDQ0ICDr9Pgg8eHgICAgICAgICAgNDQyMDk0NjAwMDAwMDAwMDAxOTkyMDUwOTEgICAgICAgICAgICAgICD05fLsL/Ll4eMgICAgICAgICAgICAgICAgICAgICAgICAwMDAwMDAwMDAwMDAwMDAwMDIwMTQwNTAxMDAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDAwMDAwMDAwMDAwMDAwMDAwMTcwMgo0MDU2ODQwOTc4MjAzNjMyMDM54Ozh6ezp5CD0+OcgICAgICAgICAgICAg7uzh+CAgICAgICAgICAgICAgNjAgIO7x6ez6IPbp5e8gICAgICA5OTc3MDAwMDAwMDAwMDAwMDE5OTExMjIwMiAgICAgICAgICAgIODp9OX4IO739uXy6SAgICAgICAgICAgICAgICAgICAgICAgIDEwMDAwMDAwMDAwMDAwMDAwMjAyMzA4MDEwMCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMDAwMDAwMDAwMDAwMDAwMDAwMTI1Ck00Mwo0MDU2ODQwOTc4MDA3MDczNzQyMDE2MzEyMDE0MDUwMTEzMDEwMjIwMDAxNTAwMDAwMDAwMDE1MDAwMDAwMDA1MDkzNDAwNTA5MzQwMDAwNTA5MzQ1ODU4MDEwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAxMjAxNDA1MDEyMDE0MDUwMTEwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMAo0MDU2ODQwOTc4MDE0MDk4MTQ3NjI4NjcyMDI0MDMwMTE1MTIwMTEwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAxMjAyODAwMDk2MjIwMDAwMDk2MjI4ODg4MDEwMTAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAxMjAyNDAzMDEyMDI0MDIwMTEwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMQpNNzAKNDA1Njg0MDk3ODAwNzA3Mzc0MjAxNjMxMjAxNDA1MDExMzAxMDIyMDAwMTc5OTkyNjgwMDAxNzk5OTI2ODAwNTA5MzQwMDUwOTM0MDAwMDUwOTM0NTg1ODAxMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMTIwMTQwNTAxMjAxNDA1MDExMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDE0NzgxMDAwMDIwMgo0MDU2ODQwOTc4MDA3MDczNzQyMDE2MzEyMDE0MDUwMTEzMDEwMjIwMDAxNzk0ODEyNDAwMDE3OTQ4MTI0MDA1MDkzNDAwNTA5MzQwMDAwNTA5MzQ1ODU4MDEwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAxMjAxNDA1MDEyMDE0MDUwMTEwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMTQ3MzkwMDAwMjAyCk00NQo0MDU2ODQwOTc4MDE0MDk4MTQ3MTEyMTk5NTk2NzPg7OHp7OnkIOjs6eQgICAgICAgICAgICAxCjQwNTY4NDA5NzgwMTQwOTgxNDcxMjMzNjY4NzkwMODs4ens6eQg6eXx8yDn6SAgICAgICAgIDEKTTUwCjYzMSAgICAgICAgICAgICAgICBBTCDk4vDkIO764OXw5DEwMDAKODY35Pn67OX6IOXo6fQnIO7p5ecnIOHn5ewg4Ofp4+QgMTAwMQpNNDcKNDA1Njg0MDk3ODAwMDAwMjAzMzQ4MTU2MDA3MDczNzQyMjAyNjA4MDEwMDEwMDAwMDEwMTAwMDAwNzAyMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwNzAyMDIwMjYwODI4MjAyNjA4MjgKTTQ2CjQwNTY4NDA5NzgwMDcwNzM3NDIwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMjEKTTU4CjQwNTY4NDEzMzUwMTM4Mjc1OTcwMDAwMDAwMC00MDg5MDAwMDAwMDM2ODkxNDAwMDAwMDAwNTYxODA=";

function fixtureSections(){
  const text = Buffer.from(FIXTURE_B64, "base64").toString("latin1");
  const parts = text.split(/\n(?=M\d+\n)/);
  const out = {};
  parts.forEach((part) => {
    const lines = part.split("\n").filter(Boolean);
    const key = lines.shift();
    out[key] = lines.join("\n") + "\n";
  });
  return out;
}

function buf(text){
  return Buffer.from(text, "latin1");
}

console.log("1) syntax + wiring");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-production-import.js")]).status === 0, "gi-production-import.js syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "app.js syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-ayalon-production.js")]).status === 0, "test syntax");

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
assert(app.includes('companyNow === "איילון"'), "ayalon uses the production layer");
assert(app.includes("P.applyProductionReport"), "commit still writes the production report");
assert(app.includes('id: "איילון", label: "איילון", ready: true'), "ayalon upload is available");
assert(app.includes("giAyalonProd=1"), "production script cache token");
assert(html.includes("giAyalonProd=1"), "app cache token");
assert(sw.includes("ayalon-prod-v1"), "service-worker cache token");
assert(app.includes("Array.isArray(p.notes)"), "production detail shows the extra facts");

const P = loadEngine();
const ready = (P.COMPANIES || []).find((c) => c && c.id === "איילון");
assert(!!ready && ready.ready === true, "engine marks ayalon ready");

const sections = fixtureSections();
const named = P.parseFileBuffer("m41_תמצית.txt", buf(sections.M41));
assert(named.kind === "AYALON_M41" && named.rows.length === 2, "m41 name is recognized");
const unnamed = P.parseFileBuffer("policies.txt", buf(sections.M41.split("\n")[0] + "\n"));
assert(unnamed.kind === "AYALON_M41", "a 193-digit summary is still m41");
const indexed = P.parseFileBuffer("amounts.txt", buf(sections.M70.split("\n")[0] + "\n"));
assert(indexed.kind === "AYALON_M70", "a 193-digit cover row is m70, not m41");

const parsed = [
  P.parseFileBuffer("m41_תמצית.txt", buf(sections.M41)),
  P.parseFileBuffer("m48_מבוטחים.txt", buf(sections.M48)),
  P.parseFileBuffer("m43_כיסויים.txt", buf(sections.M43)),
  P.parseFileBuffer("m70_סכומים.txt", buf(sections.M70)),
  P.parseFileBuffer("m45_ילדים.txt", buf(sections.M45)),
  P.parseFileBuffer("m50_תעריפים.txt", buf(sections.M50)),
  P.parseFileBuffer("m47_גביה.txt", buf(sections.M47)),
  P.parseFileBuffer("m46_פדיון.txt", buf(sections.M46)),
  P.parseFileBuffer("m58_נתונים.txt", buf(sections.M58))
];
assert(parsed.every((f) => f.kind && f.rows.length), "every sample file yields rows");

console.log("\n2) policies land on the production layer");
const policies = P.buildPolicies(parsed, "איילון");
assert(policies.length === 2, "one row per m41 policy");
const life = policies.find((p) => p.policyNumberFull === "007073742");
const health = policies.find((p) => p.policyNumberFull === "014098147");
assert(!!life && life.productionLayer === true, "layer flag is set");
assert(life && life.policyMatchKey === "7073742", "match key drops leading zeros");
assert(life && life.policyNumber === "007073742", "full policy number is kept");
assert(life && life.premiumMonthly === "58.50", "monthly installment is kept");
assert(life && life.sumInsured === "179992.68", "indexed sum replaces the original sum");
assert(life && life.covers.length === 1, "older index snapshots do not duplicate the cover");
assert(life && life.covers[0].name === "AL הגנה מתאונה", "tariff name comes from m50");
assert(life && life.primary.fullName === "יקיר יעיש", "family name stays the last name");
assert(life && life.ids.length === 1 && life.ids[0] === "203348156", "the folder follows the primary id");
assert(life && life.notes.some((n) => n === "מדד בסיס: 12318"), "basis index is kept");
assert(life && life.notes.some((n) => n === "מדד: 14781"), "current index is kept");
assert(life && life.notes.some((n) => n.indexOf("28/08/2026") >= 0 && n.indexOf("70.20") >= 0), "latest collection is kept");
assert(health && health.type === "בריאות", "health tariff becomes a health policy");
assert(health && health.premiumMonthly === "74.49", "health premium comes from the summary");
assert(health && health.primary.fullName === "פרח אלביליה", "insured name is joined from m48");
assert(health && health.primary.birthDate === "20/12/1991", "birth date is kept");
assert(health && health.primary.city === "מסילת ציון", "city is kept");
assert(health && health.covers.some((c) => c.name.indexOf("השתלות") >= 0), "cover description is kept");
const childIds = (health ? health.people : []).filter((p) => p.relation === "ילד").map((p) => p.idNumber);
assert(childIds.length === 2, "children stay on the policy");
assert(health && childIds.every((id) => health.ids.indexOf(id) < 0), "a child does not open the folder");
assert(health && health.people.some((p) => p.fullName === "טליה אלביליה"), "child given name comes first");

const fin = parsed.find((f) => f.kind === "AYALON_M58").rows[0];
assert(fin && fin.fees < 0 && fin.balance > 0, "financial row keeps the sign and the balance");

console.log("\n3) a new report replaces ayalon rows and leaves pretreatment");
const payload = { newPolicies: [{ id: "keep-me", company: "איילון" }], productionPolicies: [] };
const saved = P.applyProductionReport(JSON.parse(JSON.stringify(payload)), policies);
assert(saved.newPolicies.length === 1 && saved.newPolicies[0].id === "keep-me", "pretreatment policies stay");
assert(saved.productionPolicies.length === 2, "both policies are stored on the production layer");
assert(saved.productionPolicies.every((p) => p.policyNumberFull && p.notes && p.notes.length), "stored rows keep the full number and the facts");
const again = P.applyProductionReport(saved, [health]);
const ayalonRows = again.productionPolicies.filter((p) => p.company === "איילון");
assert(ayalonRows.length === 1 && ayalonRows[0].policyNumberFull === "014098147", "a policy missing from the new report is removed");
const twice = P.applyProductionReport(again, [health]);
assert(twice.productionPolicies.filter((p) => p.company === "איילון").length === 1, "uploading the same report does not duplicate");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
