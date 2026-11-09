/* GI-HAREL-PRODUCTION
   Harel RB/RP/SB/SP files fill the production layer.
   The name and address columns differ from Hachshara.
   Run: node _test-harel-production.js
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

const HE = "אבגדהוזחטיךכלםמןנסעףפץצקרשת";
function cp862(s){
  let out = "";
  for(let i = 0; i < s.length; i++){
    const at = HE.indexOf(s.charAt(i));
    out += at >= 0 ? String.fromCharCode(0x80 + at) : s.charAt(i);
  }
  return out;
}
function visual(logical){
  return String(logical || "").split("").reverse().join("");
}
function right(width, text){
  const raw = cp862(text);
  return (raw.length >= width ? raw.slice(raw.length - width) : raw.padStart(width, " "));
}
function blank(n){
  return " ".repeat(n);
}
function put(line, start, text){
  return line.slice(0, start - 1) + text + line.slice(start - 1 + text.length);
}

function personLine(kind, spec){
  const width = kind === "SP" ? 1092 : 1102;
  let line = blank(width);
  line = put(line, 9, spec.policy.padStart(7, "0").slice(-7));
  line = put(line, 19, spec.agent.padStart(5, "0").slice(-5));
  line = put(line, 26, spec.id.padStart(9, "0").slice(-9));
  line = put(line, 44, right(15, visual(spec.family)));
  line = put(line, 59, right(15, visual(spec.given)));
  line = put(line, 96, right(18, spec.house + " " + visual(spec.street)));
  line = put(line, 114, right(15, visual(spec.city)));
  line = put(line, 129, spec.zip.padStart(5, "0").slice(-5));
  line = put(line, 134, cp862(spec.gender));
  line = put(line, 137, spec.birth);
  line = put(line, 153, spec.start);
  line = put(line, 161, cp862("כ"));
  if(kind === "RP") line = put(line, 404, right(20, visual(spec.product)));
  line = put(line, 390, spec.phone.padStart(12, " "));
  return line;
}
function coverLine(kind, spec){
  let line = blank(150);
  line = put(line, 9, spec.policy.padStart(7, "0").slice(-7));
  line = put(line, 23, spec.start);
  line = put(line, 71, spec.id.padStart(9, "0").slice(-9));
  line = put(line, 128, right(23, visual(spec.title)));
  if(kind === "SB") line = put(line, 37, spec.premium.padStart(15, "0").slice(-15));
  else line = put(line, 44, spec.premium.padStart(8, "0").slice(-8));
  return line;
}

console.log("1) syntax + wiring");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-production-import.js")]).status === 0, "gi-production-import.js syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "app.js syntax");
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
assert(app.includes('companyNow === "הראל"'), "harel uses the production layer");
assert(app.includes('id: "הראל", label: "הראל", ready: true'), "harel upload is available");
assert(app.includes("company: this._prod?.company"), "parser receives the selected company");
assert(app.includes("giHarelProd=1"), "production script cache token");
assert(html.includes("giHarelProd=1"), "app cache token");
assert(sw.includes("harel-prod-v1"), "service-worker cache token");
assert(app.includes("giHarelSave=1") && html.includes("giHarelSave=1") && sw.includes("harel-save-v1"), "save fix cache token");
assert(app.includes("if(!existingFull && !safeTrim(rec.agentId) && !safeTrim(rec.agentName))"), "a new harel folder is owned before save");
assert(app.includes("noteFail(saved?.error"), "a rejected save shows its reason");
assert(app.includes("CI_PROD_SAVE_CONCURRENCY = 4"), "folders save a few at a time");
assert(app.includes("assignFinished"), "progress counts finished folders");
assert(app.includes("d.toLocaleString(\"he-IL\")} מתוך ${t.toLocaleString(\"he-IL\")} (${pct}%)"), "progress count stays done out of total");
assert(app.includes("ciProgress__logo"), "progress screen shows the system logo");
assert(html.includes("giProdWait=1") && sw.includes("prod-wait-v1"), "progress screen cache token");

const P = loadEngine();
const ready = (P.COMPANIES || []).find((c) => c && c.id === "הראל");
assert(!!ready && ready.ready === true, "engine marks harel ready");

const healthPerson = personLine("RP", {
  policy: "1234567", agent: "22271", id: "200000008",
  family: "כהן", given: "דנה", house: "1", street: "רמז", city: "הוד השרון",
  zip: "20201", gender: "נ", birth: "15081956", start: "01042001",
  product: "תאונה", phone: "0974487770"
});
const healthCover = coverLine("RB", {
  policy: "1234567", id: "200000008", start: "01042013",
  premium: "00004164", title: "מוות מתאונה"
});
const lifePerson = personLine("SP", {
  policy: "7654321", agent: "82307", id: "200000016",
  family: "לוי", given: "עמית", house: "24", street: "האקליפטוס", city: "שלומי",
  zip: "85224", gender: "ז", birth: "13101979", start: "01072021",
  product: "", phone: "0507676007"
});
const lifeCover = coverLine("SB", {
  policy: "7654321", id: "200000016", start: "01072021",
  premium: "000000000122703", title: "ביטוח משכנתא"
});

function buf(text){ return Buffer.from(text + "\n", "latin1"); }
const parsed = [
  P.parseFileBuffer("RP8230709", buf(healthPerson), { company: "הראל" }),
  P.parseFileBuffer("RB8230709", buf(healthCover), { company: "הראל" }),
  P.parseFileBuffer("SP8230709", buf(lifePerson), { company: "הראל" }),
  P.parseFileBuffer("SB8230709", buf(lifeCover), { company: "הראל" })
];
assert(parsed.every((f) => f.rows.length === 1), "each harel file yields a row");

const policies = P.buildPolicies(parsed, "הראל");
assert(policies.length === 2, "health and life policies are built");
const health = policies.find((p) => p.policyNumber === "1234567");
const life = policies.find((p) => p.policyNumber === "7654321");
assert(!!health && health.company === "הראל" && health.productionLayer === true, "health row is harel production");
assert(health.primary.fullName === "דנה כהן", "insured name is logical hebrew: " + (health && health.primary.fullName));
assert(health.primary.city === "הוד השרון", "city stays whole: " + (health && health.primary.city));
assert(health.primary.street === "רמז" && health.primary.house === "1", "house number leaves the street");
assert(health.primary.phone === "097448777", "landline keeps nine digits: " + (health && health.primary.phone));
assert(health.ids[0] === "200000008", "folder id is the insured id");
assert(health.type === "תאונה", "health product label is kept");
assert(health.premiumMonthly === "41.64", "monthly premium: " + (health && health.premiumMonthly));
assert((health.covers[0] || {}).name === "מוות מתאונה", "cover name is logical");
assert(!!life && life.type === "ריסק משכנתא", "mortgage life is recognized: " + (life && life.type));
assert(life.premiumMonthly === "1227.03", "life premium: " + (life && life.premiumMonthly));

const asHach = P.buildPolicies([
  P.parseFileBuffer("RP8230709", buf(healthPerson)),
  P.parseFileBuffer("RB8230709", buf(healthCover))
], "הכשרה");
assert(asHach[0] && asHach[0].company === "הכשרה", "the same files on hachshara stay hachshara");
assert((asHach[0].primary.fullName || "") !== "דנה כהן", "hachshara keeps its own columns");

const items = P.classifyPolicies(policies, new Map());
assert(items.filter((it) => it.action === "create").length === 2, "each insured opens a production folder");
const saved = P.applyProductionReport({
  newPolicies: [{ id: "keep-me", company: "הראל" }],
  productionPolicies: []
}, items);
assert(saved.productionPolicies.length === 2, "both policies land on the production layer");
assert(saved.newPolicies.length === 1 && saved.newPolicies[0].id === "keep-me", "pretreatment is untouched");
const again = P.applyProductionReport(saved, [health]);
assert(again.productionPolicies.filter((p) => p.company === "הראל").length === 1, "a new harel report replaces only harel rows");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
