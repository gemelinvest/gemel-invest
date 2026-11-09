/* GI-PHOENIX-PRODUCTION
   Phoenix production layer (MU fixed-width IBM862).
   Run: node _test-phoenix-production.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const vm = require("vm");

const ROOT = __dirname;
const TAG = "20260828-sales-mail-hide-v1";
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

const FIXTURE_B64 = "MDk5MTk1jIkgjYmJjIyLII2JgJCaMjKLiwowOTkzMjQgICCMIoWHII2Jh4WaiZAyMgowOTk3MjKNiYyFlImIhSCahYyamYQyMgowOTk3NDIgIISYiJGXgCCahZSFmJoyMgowOTk3NDQgICAyMDE2IIGEhoQgjJEyMgowOTk5MzAgiZSJjIeFII2Jh4WaiZAyMgowOTk5ODaFiIyFgY6AII2JmoWYiZkyMgowMDAxMDgyMDI2Cjk5MDEwODIwMjYyMDI2MDkwMTAwMDE0NzgxMDAwMDAwMDAwMCAgICAgICAgICAgICAgICAgIDEyMjUwMDM0MzQwNTE2NzQ5NjAyMTE1NjE4Mjc2MjA0OTMwNTA4OTUKMDExMTk3NzM4MDk3MTYwMTIwMjMxNjAxMjAyMzEwMDEyMDIzMTYwMTIwMjM0NTAyMjAxOTkxOTUwNjAwMDEzMzE3MDAwMjAxMjAyMzAxMjAyMzAxMjAyNzQwMY4wMDAwNjI0MTIwMDAwNTkzNDYwMDAwMDAwNzIwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDExMzcxMDkzMTAzMTM2ODY3ODQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMDAwMDAxMTMxMzY4Njc4NDAwMDAwMDAwMTIwMDAwMDUwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDEzMjYwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAxMDAwMDAwNjU3NyswMDAwMDAwMDAwjDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMjAwMDEyMDAwODMzMDAxICAwMSAwMDAwMDAwMDAwMDAwMDAwUCAwMDAwMDAwMDMxMzY4Njc4NDAwjDAwMDAwMDAgMDAwMDAwMDAwMDAwMDAwMDAwICAgICAwjI4KMDIxMTk3NzM4MDk3OTE5NTAwMDAwMTIwMjMwMTIwMjMwMDAwMDAwMDAwMDQxMDAwMDAwMDAwMDA0MjU3NTcwMDAwMDEwMDAwMDAwNDUwMjIwMTkwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDEwMDAwMDAxMDAxMjAyMzAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwICAgICAgICAgICAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA1NDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAKMDIxMTk3NzM4MDk3OTMyNDAzMDEwMTIwMjMwMTIwMjMwMDAwMDAwMDAwMDMxMDAwMDAwNjczMjAxMzA4MDgwMDAwMDEwMDAwNTA1NDUwMjIwMTkwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDEwMDAwMDAxMDAxMjAyMzAwMDAwMDYwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwNTA1hjMzMzcyODAzOCAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA1NDA5NTQyMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAKMDIxMTk3NzM4MDk3OTcyMjAzMDEwMTIwMjMwMTIwMjMwMDAwMDAwMDAwMDMxMDAwMDAwNzI0ODAxMzA4MDgwMDAwMDEwMDAwNTQ0NDUwMjIwMTkwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDEwMDAwMDAxMDAxMjAyMzAwMDAwMDY1MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwNTQ0hjMzMzcyODAzOCAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA1NDA0NTQyMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAKMDIxMTk3NzM4MDk3OTc0MjAzMDEwMTIwMjMwMTIwMjMwMDAwMDAwMDAwMDMxMDAwMDAwNDEyODAxMzA4MDgwMDAwMDEwMDAwMzEwNDUwMjIwMTkwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDEwMDAwMDAxMDAxMjAyMzAwMDAwMDM3MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMzEwhjMzMzcyODAzOCAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA2NDE3NTQyMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAKMDIxMTk3NzM4MDk3OTc0NDAzMDEwMTIwMjMwMTIwMjMwMDAwMDAwMDAwMDMxMDAwMDAwODI5MjAxMzA4MDgwMDAwMDEwMDAwNjIzNDUwMjIwMTkwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDEwMDAwMDAxMDAxMjAyMzAwMDAwMDc0MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwNjIzhjMzMzcyODAzOCAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA1NDA2NTQyMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAKMDIxMTk3NzM4MDk3OTkzMDAzMDEwNjIwMjQwNjIwMjQwMDAwMDAwMDAwMDMxMDAwMDA0NDcwMDAxNDA3MDcwMDAwMDEwMDAzMzU2NDUwMjIwMTkwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDEwMDAwMDAxMDA2MjAyNDAwMDAwNDAyMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAzMzU2hjMzMzcyODAzOCAwMDAwMDAwMDAwMDAwMDMwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA2Nzg0NzQwMTAwMDAwMDAwMDAwMDEwMDAzMDAwMDAwMDAwMDAwMDAwMDAwMDAKMDIxMTk3NzM4MDk3OTk4NjAzMDEwMTIwMjMwMTIwMjMwMDAwMDAwMDAwMDMxMDAwMDAxNjUwMDAxMzA4MDgwMDAwMDEwMDAxMjM5NDUwMjIwMTkwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDEwMDAwMDAxMDAxMjAyMzAwMDAwMTQ4MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAxMjM5hjMzMzcyODAzOCAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA2NjUwNTQyMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAKMDQxMTk3NzM4MDk3hjMxMzY4Njc4NI4wMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMCAwMDAwMDAwMDAwMDAwMDAwICAgICAgICCBhZeRiYAgICAgkYmQgzE5ODAwOTI5hiAgICAgICAgII2JjIIgmJSLICAgIDAgICAgICAgICCNiYyCIJiUizMwODY1MDAwMDAwMDAwMJiOMDI0MDAyNDAwMDAwjIwwMDAwMDAwMCAgICAgICAgII2JjIIgmJSLICAgIDAgICAgICAgICCNiYyCIJiUizMwODY1MDAwMDAwNTI1MjU1ODAwREVOMjk5QEdNQUlMLkNPTSAgICAgICAgICAgICAgmSAwMDAwMDAwMDA0MjcgIDAwMDAKMDQxMTk3NzM4MDk3hjMzMzcyODAzOIExMDAwMDAwMDAwMDEwMTIwMjMwMTAxMjAyMzAwMDAwMDAwMDEwMTIwMjMwMDAwMDAwMCAwMDAwMDAwMDE2MDEyMDIzICAgICAgICCBhZeRiYAgICAghIWFgDIwMTAwMTE2kCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICCNiYyCIJiUizMwODY1MDAwMDAwMDAwMJiLMDAwMDAwMDAwMDAwjIwwMDAwMDAwMCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDAwMDAwMDAwMDAwNTI1MjU1ODAwREVOMjk5QEdNQUlMLkNPTSAgICAgICAgICAgICAgmSAwMDAwMDAwMDA0MjcgIDAwMDAKMTkxMjg3MTc1MDg1MDEgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIIyXmY4gk4OFkiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAK";

function fixtureBuffer(){
  const text = Buffer.from(FIXTURE_B64, "base64").toString("latin1").replace("191287175085", "191197738097");
  return Buffer.from(text, "latin1");
}

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-production-import.js")]).status === 0, "gi-production-import.js syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "app.js syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-phoenix-production.js")]).status === 0, "test syntax");

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "app.css"), "utf8");
const engSrc = fs.readFileSync(path.join(ROOT, "gi-production-import.js"), "utf8");

assert(engSrc.includes('version: "20260828-sales-mail-hide-v1"'), "engine version unchanged");
assert(app.includes('GI_PRODUCTION_JS_HREF = "./gi-production-import.js?v=' + TAG + '"'), "app production js href unchanged");
assert(html.includes("app.js?v=20261007-lead-dup-v1&giSign=29"), "index app.js cache prefix");
assert(html.includes("giDocZoom=2"), "doc zoom token kept");
assert(html.includes("giPhxProd=1"), "phoenix cache token");
assert(html.includes("giPhxOpen=1"), "production open cache token");
assert(sw.includes("half-year-v1"), "service-worker half-year token kept");
assert(sw.includes("phx-prod-v1"), "service-worker phoenix token");
assert(/\.cfPolTabs\{[^}]*justify-content:flex-start/.test(css), "tabs sit on the visual right");
assert(css.includes(".cfProdTable td{") && css.includes("white-space:normal"), "production cells wrap");
assert(app.includes("function uniqueProductionAgent"), "unique agent helper");
assert(app.includes('const phoenixImport = companyNow === "הפניקס"'), "phoenix import flag");
assert(app.includes("P.applyProductionLayer"), "commit uses production layer");
assert(app.includes("if(!existingFull && !safeTrim(rec.agentId) && !safeTrim(rec.agentName))"), "a new production folder gets an owner before save");
assert(app.includes("existingFull.agent_id"), "an existing folder keeps its agent");
assert(app.includes('const productionLayerImport = phoenixImport || companyNow === "מנורה"'), "phoenix stays on the production layer");
assert(app.includes("טרום טיפול") && app.includes(">פרודוקציה<"), "policy source tabs");
assert(app.includes('_policyWalletTab = "pretreatment"'), "pretreatment is the default tab");
assert(app.includes("async _pullProductionPolicies(id)"), "file pulls production rows from the server");
assert(app.includes("production_policies:payload->productionPolicies"), "pull reads production policies only");
assert((app.match(/void this\._pullProductionPolicies\(id\)/g) || []).length >= 2, "cached and empty files both pull");
assert(app.includes("_productionPoliciesStamp(localRows)"), "production compare uses a stamp");
assert(!app.includes("JSON.stringify(rec.payload.productionPolicies"), "production compare does not stringify the whole array");
assert(app.includes("_productionTabIsOnScreen(safeId)"), "second paint only while the production tab is open");
assert(html.includes("giPhxOpen=1") && html.includes("giProdPaint=1"), "production paint cache token appended");
assert(sw.includes("phx-open-v1") && sw.includes("prod-paint-v1"), "service-worker production paint token appended");
assert(app.includes("לקוח קיים מתעדכן בלי תיק כפול"), "preview says an existing customer is updated");

const P = loadEngine();
assert(!!P && typeof P.parseFileBuffer === "function", "GI_PRODUCTION loaded");
assert(typeof P.applyProductionLayer === "function", "applyProductionLayer exported");
assert(typeof P.fillProductionIdentity === "function", "fillProductionIdentity exported");
const phx = (P.COMPANIES || []).find((c) => c && c.id === "הפניקס");
assert(!!(phx && phx.ready === true), "Phoenix company ready");

console.log("\n2) fixture policy 1197738097");
const parsed = P.parseFileBuffer("MU_SC_GREGORI_2026_09", fixtureBuffer());
assert(parsed.kind === "PHOENIX", "detect PHOENIX");
const policies = P.buildPolicies([parsed], "הפניקס");
assert(policies.length === 1, "one policy built");
const pol = policies[0] || {};
assert(pol.company === "הפניקס", "company");
assert(pol.policyNumber === "1197738097", "full policy number");
assert(pol.premiumMonthly === "65.77", "monthly premium 65.77");
assert(pol.startDate === "16/01/2023", "start 16/01/2023");
assert(pol.type === "בריאות", "type בריאות");
assert(pol.reportPeriod === "08/2026", "period 08/2026");
assert(pol.productionLayer === true, "production layer flag");
assert(pol.agentName === "" && pol.agentNumber === "", "no agent identity in the report");
assert(JSON.stringify(pol.ids) === JSON.stringify(["313686784"]), "matching id is the primary only");

const primary = (pol.people || []).find((p) => p.primary) || {};
const child = (pol.people || []).find((p) => p.idNumber === "333728038") || {};
assert(primary.fullName === "דניס איסקוב", "primary name");
assert(primary.idNumber === "313686784", "primary id");
assert(primary.birthDate === "29/09/1980", "primary birth");
assert(primary.gender === "זכר", "primary gender");
assert(primary.relation === "מבוטח עיקרי", "primary relation");
assert(primary.phone === "0525255800", "phone");
assert(primary.email === "DEN299@GMAIL.COM", "email");
assert(primary.city === "כפר גלים", "city");
assert(primary.zip === "3086500", "zip");
assert(child.fullName === "אווה איסקוב", "child name");
assert(child.birthDate === "16/01/2010", "child birth");
assert(child.gender === "נקבה", "child gender");
assert(child.relation === "ילד", "child relation");

const coverName = (code) => ((pol.covers || []).find((c) => c.code === code) || {}).name || "";
assert(coverName("9324") === "ניתוחים חו\"ל", "cover ניתוחים חו\"ל");
assert(coverName("9722") === "השתלות וטיפולים", "cover השתלות וטיפולים");
assert(coverName("9742") === "תרופות אקסטרה", "cover תרופות אקסטרה");
assert(coverName("9744") === "2016 סל הזהב", "cover 2016 סל הזהב");
assert(coverName("9195") === "תנאים כלליים יל22", "cover תנאים כלליים יל22");
assert(coverName("9986") === "שירותים אמבולטו", "cover name kept as decoded");
const surg = (pol.covers || []).find((c) => c.code === "9930") || {};
assert(surg.name === "ניתוחים וחליפי" && surg.start === "06/2024", "later cover start");
assert((pol.exclusions || []).indexOf("משקל עודף") >= 0, "exclusion משקל עודף");
assert((pol.exclusions || []).indexOf("עודף משקל") < 0, "exclusion is not word-reversed");

console.log("\n3) later month replaces the same policy");
const olderText = Buffer.from(FIXTURE_B64, "base64").toString("latin1")
  .replace("0001082026", "0001072026")
  .replace("0000006577+", "0000006156+");
const older = P.parseFileBuffer("MU_SC_GREGORI_2026_08", Buffer.from(olderText, "latin1"));
const latest = P.buildPolicies([older, parsed], "הפניקס");
assert(latest.length === 1, "two months stay one policy");
assert(latest[0] && latest[0].premiumMonthly === "65.77", "higher period keeps 65.77");
assert(latest[0] && latest[0].reportPeriod === "08/2026", "higher period label");

console.log("\n4) production layer does not touch pretreatment policies");
let payload = { newPolicies: [{ id: "keep", company: "הפניקס", policyNumber: "" }], productionPolicies: [] };
payload = P.applyProductionLayer(payload, pol);
payload = P.applyProductionLayer(payload, Object.assign({}, pol, { premiumMonthly: "61.56" }));
assert(payload.productionPolicies.length === 1, "re-import does not duplicate");
assert(payload.productionPolicies[0].premiumMonthly === "61.56", "latest premium replaces the row");
assert(payload.productionPolicies[0].policyNumber === "1197738097", "stored policy number");
assert(payload.newPolicies.length === 1 && payload.newPolicies[0].id === "keep", "newPolicies unchanged");

console.log("\n5) existing customer is filled, not overwritten, and not duplicated");
const existing = {
  insureds: [{ id: "ins1", type: "primary", data: { firstName: "קיים", lastName: "", idNumber: "313686784", phone: "0500000000", email: "", city: "" } }],
  newPolicies: [{ id: "keep" }]
};
const filled = P.fillProductionIdentity(JSON.parse(JSON.stringify(existing)), [pol], { createInsureds: false });
assert(filled.insureds.length === 1, "existing file does not gain the child");
assert(filled.insureds[0].data.firstName === "קיים", "filled first name stays");
assert(filled.insureds[0].data.phone === "0500000000", "filled phone stays");
assert(filled.insureds[0].data.email === "DEN299@GMAIL.COM", "empty email is filled");
assert(filled.insureds[0].data.city === "כפר גלים", "empty city is filled");
assert(filled.newPolicies.length === 1, "identity fill leaves newPolicies");
const created = P.fillProductionIdentity({ insureds: [], newPolicies: [] }, [pol], { createInsureds: true });
assert(created.insureds.length === 2, "new file gets both insureds");
assert(created.insureds[0].type === "primary" && created.insureds[1].type === "child", "primary then child");

console.log("\n6) one folder per primary id");
const map = new Map();
map.set("313686784", { id: "cust_real", idNumber: "313686784" });
const updated = P.classifyPolicies([pol], map);
assert(updated[0] && updated[0].action === "update" && updated[0].category === "update", "existing id is an update");
assert(updated[0] && updated[0].newFolder !== true, "existing id does not open a new folder");
assert(updated[0] && updated[0].customer && updated[0].customer.id === "cust_real", "update targets the existing customer");

const fresh = P.classifyPolicies([pol], new Map());
assert(fresh[0] && fresh[0].action === "create" && fresh[0].newFolder === true, "unknown id opens one new folder");
const twin = Object.assign({}, pol, { policyNumber: "2287854083" });
const sameFamily = P.attachNewFolderStubs(P.classifyPolicies([pol, twin], new Map()));
assert(sameFamily[0].customer && sameFamily[1].customer && sameFamily[0].customer.id === sameFamily[1].customer.id, "same primary id shares one folder");
const other = Object.assign({}, pol, {
  policyNumber: "1548168085",
  ids: ["203456789"],
  people: [{ idNumber: "203456789", fullName: "אחר לוי", primary: true }],
  phones: []
});
const split = P.attachNewFolderStubs(P.classifyPolicies([pol, other], new Map()));
assert(split[0].customer.id !== split[1].customer.id, "a different primary id is a different folder");
const both = new Map([
  ["313686784", { id: "cust_a" }],
  ["333728038", { id: "cust_b" }]
]);
const review = P.classifyPolicies([Object.assign({}, pol, { ids: ["313686784", "333728038"] })], both);
assert(review[0] && review[0].action === "skip" && review[0].category === "review", "two existing folders are not duplicated");

console.log("\n" + passed + " passed, " + failed + " failed");
if(failed) process.exit(1);
