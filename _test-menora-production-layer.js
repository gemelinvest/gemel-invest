/* GI-MENORA-PRODUCTION-LAYER
   Menora uses the Phoenix production layer. buildMenoraPolicies stays unmarked.
   Run: node _test-menora-production-layer.js
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

function hexConst(name){
  const src = fs.readFileSync(path.join(ROOT, "_test-menora-production.js"), "utf8");
  const m = src.match(new RegExp("const " + name + " = \"([0-9a-f]+)\""));
  if(!m) throw new Error("missing " + name);
  return Buffer.from(m[1], "hex");
}

function findNamed(root, base){
  if(!root || !fs.existsSync(root)) return "";
  const stack = [root];
  while(stack.length){
    const dir = stack.pop();
    const names = fs.readdirSync(dir);
    for(let i = 0; i < names.length; i++){
      const full = path.join(dir, names[i]);
      let st;
      try { st = fs.statSync(full); } catch(_e) { continue; }
      if(st.isDirectory()) stack.push(full);
      else if(names[i] === base) return full;
    }
  }
  return "";
}

console.log("1) syntax + screen wiring");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-production-import.js")]).status === 0, "gi-production-import.js syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "app.js syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-menora-production-layer.js")]).status === 0, "test syntax");

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "app.css"), "utf8");
const engSrc = fs.readFileSync(path.join(ROOT, "gi-production-import.js"), "utf8");

assert(engSrc.includes('version: "20260828-sales-mail-hide-v1"'), "engine version unchanged");
assert(app.includes('GI_PRODUCTION_JS_HREF = "./gi-production-import.js?v=20260828-sales-mail-hide-v1"'), "production js href unchanged");
assert(html.includes("giDocZoom=2") && html.includes("giPhxProd=1") && html.includes("giPhxOpen=1"), "previous cache tokens kept");
assert(html.includes("giMenoraProd=1"), "menora cache token appended");
assert(sw.includes("half-year-v1") && sw.includes("phx-prod-v1") && sw.includes("phx-open-v1"), "previous service-worker tokens kept");
assert(sw.includes("menora-prod-v1"), "service-worker menora token appended");
assert(/\.cfPolTabs\{[^}]*justify-content:flex-start/.test(css), "tabs sit on the visual right");
assert(app.includes("markMenoraProductionLayer"), "ui marks menora after build");
assert(app.includes('safeTrim(this._prod?.company) === "מנורה" && typeof P.markMenoraProductionLayer'), "mark runs only for menora");
assert(app.includes("if(productionLayerImport){"), "commit uses the production layer for menora");
assert(app.includes("P.applyProductionLayer"), "commit writes productionPolicies");
assert(app.includes("if(!productionLayerImport) stampRecordAgentOwnership(rec, { force: true })"), "logged-in user is not stamped on a menora folder");
assert(app.includes("productionBufferArchiveKind"), "archive magic is checked before parsing");
assert(app.includes("extractProductionRarEntries"), "rar extractor is wired");
assert(/\\\.\\(zip\\|exe\\|rar\\|arj\\)/.test(app) || app.includes("rar|arj"), "rar and arj are archive names");
assert(app.includes('magic === "rar"'), "rar bytes are not parsed as policy rows");
assert(app.includes("renderCompanyLogoHtmlForCompany(safeTrim(p.company), \"mini\")"), "production row shows the company logo");
assert(css.includes(".cfProdCo{"), "logo sits beside the company name");
assert(fs.existsSync(path.join(ROOT, "assets/logos/menora.jfif")), "menora logo file");
assert(fs.existsSync(path.join(ROOT, "assets/logos/afenix.jfif")), "phoenix logo file");
assert(fs.existsSync(path.join(ROOT, "vendor/unrar/js/unrar.wasm")), "unrar wasm vendored");
assert(app.includes("found._idCollisions"), "same id in two folders is recorded");
assert(engSrc.includes("idHitsCollision"), "production layer skips a duplicated id");

const P = loadEngine();
assert(typeof P.markMenoraProductionLayer === "function", "markMenoraProductionLayer exported");
assert(typeof P.buildPolicies === "function" && typeof P.applyToPayload === "function", "old builders stay exported");

console.log("\n2) fixture stays on the old builder until it is marked");
const parsed = [
  P.parseFileBuffer("000001661M.TXT", hexConst("HEX_M")),
  P.parseFileBuffer("000001661N.TXT", hexConst("HEX_N")),
  P.parseFileBuffer("000001661G.TXT", hexConst("HEX_G")),
  P.parseFileBuffer("000001661P.TXT", hexConst("HEX_P")),
  P.parseFileBuffer("TRFR.ALL", hexConst("HEX_TRFR"))
];
const built = P.buildPolicies(parsed, "מנורה");
assert(built.length === 1, "one policy built");
assert(built[0] && built[0].productionLayer !== true, "builder does not set the production layer");
assert(built[0] && built[0].premiumMonthly === "258.31", "old premium stays 258.31");
const oldPayload = P.applyToPayload({
  insureds: [{ id: "ins1", type: "primary", data: { idNumber: "0302602966" } }],
  newPolicies: []
}, Object.assign({}, built[0], { action: "create", insuredIds: ["ins1"] }));
assert((oldPayload.newPolicies || []).length === 1, "unmarked policy still writes newPolicies");
assert(String((oldPayload.newPolicies[0] || {}).id || "").indexOf("npol_prod_") === 0, "old id prefix stays");

const marked = P.markMenoraProductionLayer(built);
assert(built[0].productionLayer !== true, "marking does not change the built policy");
assert(marked[0] && marked[0].productionLayer === true, "marked policy is a production layer");
assert(marked[0].agentName === "", "agent number is not treated as an agent name");
assert(marked[0].agentNumber === "403786", "agent number is kept for display");
assert((marked[0].ids || []).length === 1, "only the primary id is used for matching");
assert((marked[0].covers || []).some((c) => c.name === "ייעוץ ובדיקות" && c.code), "cover name and code are kept");
assert(marked[0].people[0] && marked[0].people[0].primary === true, "the insured is primary");
assert(!!(marked[0].people[0].city || marked[0].people[0].street), "address is kept");

const layered = P.applyProductionLayer({
  newPolicies: oldPayload.newPolicies.slice(),
  productionPolicies: []
}, marked[0]);
assert(layered.newPolicies.length === 1 && layered.newPolicies[0].id === oldPayload.newPolicies[0].id, "production layer leaves pretreatment policies");
assert(layered.productionPolicies.length === 1, "one production row");
assert(layered.productionPolicies[0].policyNumber === "6360051973", "stored policy number");
assert(layered.productionPolicies[0].premiumMonthly === "258.31", "stored monthly premium");
assert(layered.productionPolicies[0].company === "מנורה", "stored company");
assert((layered.productionPolicies[0].covers || []).some((c) => c.name === "ייעוץ ובדיקות"), "stored cover name");
assert(layered.productionPolicies[0].people[0] && layered.productionPolicies[0].people[0].street !== undefined, "stored street");
const again = P.applyProductionLayer(layered, Object.assign({}, marked[0], { premiumMonthly: "260.76" }));
assert(again.productionPolicies.length === 1 && again.productionPolicies[0].premiumMonthly === "260.76", "same policy is replaced, not duplicated");
assert(again.newPolicies.length === 1, "replace leaves pretreatment policies");

console.log("\n3) one folder per primary id, cancelled stays out");
const twin = P.markMenoraProductionLayer([
  built[0],
  Object.assign({}, built[0], { policyNumber: "1111222233" })
]);
const shared = P.attachNewFolderStubs(P.classifyPolicies(twin, new Map()));
assert(shared[0] && shared[1] && shared[0].newFolder === true && shared[0].customer.id === shared[1].customer.id, "two policies of one id open one folder");
const known = new Map();
known.set("302602966", { id: "cust_known", idNumber: "302602966" });
const updated = P.classifyPolicies(P.markMenoraProductionLayer(built), known);
assert(updated[0] && updated[0].action === "update" && updated[0].customer.id === "cust_known", "existing id is an update");
assert(updated[0].newFolder !== true, "existing id does not open a second folder");
const collision = new Map();
collision.set("302602966", { id: "cust_a" });
collision._idCollisions = new Set(["302602966", "0302602966"]);
const review = P.classifyPolicies(P.markMenoraProductionLayer(built), collision);
assert(review[0] && review[0].action === "skip" && review[0].category === "review", "two folders for one id are not written");
const dead = P.markMenoraProductionLayer([Object.assign({}, built[0], { inactive: true })]);
const skipped = P.classifyPolicies(dead, new Map());
assert(skipped[0] && skipped[0].category === "inactive" && skipped[0].action === "skip", "cancelled policy is not an active row");

const rarHead = Buffer.from("526172211a070100", "hex");
const sniff = P.parseFileBuffer("drop.rar", rarHead);
assert(!sniff || sniff.kind !== "RB" || !(sniff.rows || []).length, "a rar header is not a hachshara policy book");

console.log("\n4) live archive when the Menora files are on disk");
function parseSet(dir, cancelled){
  const names = ["000001661M.TXT", "000001661N.TXT", "000001661G.TXT", "000001661P.TXT", "TRFR.ALL"];
  return names.map((n) => P.parseFileBuffer(n, fs.readFileSync(path.join(dir, n)), { cancelled: !!cancelled }));
}
const mpFile = findNamed("/tmp/menora-mp", "000001661M.TXT");
const mmFile = findNamed("/tmp/menora-mm", "000001661M.TXT");
if(mpFile){
  const live = P.buildPolicies(parseSet(path.dirname(mpFile), false), "מנורה");
  const markedLive = P.markMenoraProductionLayer(live);
  assert(live.length === 1815, "MP builds 1815 policies (got " + live.length + ")");
  assert(live.every((p) => p.productionLayer !== true), "live builder stays unmarked");
  assert(markedLive.every((p) => p.productionLayer === true), "live rows are marked for the production tab");
  assert(markedLive.filter((p) => p.inactive).length === 0, "MP rows are active");
  const hit = markedLive.find((p) => p.policyNumber === "6360051973");
  assert(!!hit && hit.premiumMonthly === "260.76", "live 6360051973 premium 260.76");
  const ids = new Set(markedLive.map((p) => (p.ids || [])[0]).filter(Boolean));
  const grouped = P.attachNewFolderStubs(P.classifyPolicies(markedLive.filter((p) => (p.ids || [])[0]), new Map()));
  const folders = new Set(grouped.map((g) => g.customer && g.customer.id));
  assert(folders.size === ids.size, "one new folder per primary id");
} else {
  console.log("  skip live MP");
}
if(mmFile){
  const liveMm = P.buildPolicies(parseSet(path.dirname(mmFile), true), "מנורה");
  assert(liveMm.length === 5322, "MM builds 5322 policies (got " + liveMm.length + ")");
  assert(liveMm.every((p) => p.inactive === true), "MM policies are inactive");
  const cats = P.classifyPolicies(P.markMenoraProductionLayer(liveMm.slice(0, 30)), new Map());
  assert(cats.every((c) => c.category === "inactive"), "MM is not imported as active");
} else {
  console.log("  skip live MM");
}

async function liveRar(){
  const rarPath = "/home/ubuntu/.cursor/projects/workspace/uploads/______b1ec.rar";
  if(!fs.existsSync(rarPath)){
    console.log("  skip live rar");
    return;
  }
  const { createExtractorFromData } = await import("./vendor/unrar/index.esm.js");
  const wasmBinary = fs.readFileSync(path.join(ROOT, "vendor/unrar/js/unrar.wasm"));
  const data = fs.readFileSync(rarPath);
  const extractor = await createExtractorFromData({ wasmBinary, data });
  const extracted = extractor.extract();
  const names = [];
  for(const file of extracted.files){
    names.push(file.fileHeader.name || "");
    assert(file.extraction && file.extraction.length > 1000, "inner archive has bytes");
    assert(file.extraction[0] === 0x50 && file.extraction[1] === 0x4B, "inner ARJ is a zip");
  }
  assert(names.length === 2, "rar contains the two menora archives");
  assert(names.some((n) => /MP/.test(n) || /פרט/.test(n)), "in-force archive is inside");
  assert(names.some((n) => /MM/.test(n) || /מבוטל/.test(n)), "cancelled archive is inside");
}

liveRar().then(() => {
  console.log("\n" + passed + " passed, " + failed + " failed");
  if(failed) process.exit(1);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
