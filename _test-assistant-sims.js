/* GI-ASSISTANT P11–P12 — existing simulators + wizard proposal.
   Run: node _test-assistant-sims.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const vm = require("vm");

const ROOT = __dirname;
const TAG = "20260829-assistant-sims-v1";
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

const app = read("app.js");
const sims = read("gi-simulators.js");
const theme = read("theme.css");
const css = read("app.css");
const asstTs = read("gi-assistant.ts");
const asstJs = read("gi-assistant.js");
const asstCss = read("gi-assistant.css");
const edge = read("supabase/functions/gi-assistant-tools/index.ts");
const realtime = read("supabase/functions/gi-assistant-realtime/index.ts");
const html = read("index.html");
const sw = read("service-worker.js");
const wizard = read("gi-wizard.js");

console.log("1) files + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-assistant.js")]).status === 0, "node --check gi-assistant.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-simulators.js")]).status === 0, "node --check gi-simulators.js");
assert(html.includes("gi-assistant.js?v=" + TAG), "index cache");
assert(sw.includes("gi-v12-" + TAG), "sw cache");
assert(app.includes("gi-simulators.js?v=" + TAG), "simulator chunk cache");

console.log("\n2) wraps existing compute / wizard, no new pricing engine");
assert(sims.includes("function quoteExistingSimulator"), "controlled quote export");
assert(sims.includes("computeMenoraRiskPremium(risk)"), "Menora risk uses existing compute");
assert(sims.includes("computePhoenixRiskPremium(risk)"), "Phoenix risk uses existing compute");
assert(sims.includes("host.GiSimulatorQuotes") && sims.includes("global.GiSimulatorQuotes"), "exports GiSimulatorQuotes");
assert(app.includes("ensureGiSimulatorJsLoaded()"), "open/quote load the existing chunk");
assert(app.includes("GiSimulatorQuotes") && app.includes("quoteSimulator"), "bridge quotes via export");
assert(app.includes("Wizard.openNewPurchaseForCustomer"), "proposal opens existing wizard");
assert(app.includes("canAccessSimulators(){"), "canAccessSimulators still exists");
assert(/canAccessSimulators\(\)\{\s*return this\.isAdmin\(\) \|\| this\.isManager\(\);/.test(app), "UI simulator gate unchanged");
assert(!edge.includes("computeMenora") && !edge.includes("MENORA_RISK_RATE"), "edge has no rate tables");
assert(!edge.includes("PHASE_11"), "price stub removed");
assert(!wizard.includes("GiAssistant") && !wizard.includes("quoteExistingSimulator"), "wizard internals untouched");

console.log("\n3) server authorizes, client computes, writes need confirm");
assert(edge.includes("SIM_CATALOG") && edge.includes("quote_simulator"), "server catalog + quote command");
assert(edge.includes("handleGetPrice") && !/handleGetPrice[\s\S]{0,800}monthlyPremium/.test(edge), "get price does not invent a premium");
assert(edge.includes('WRITE_TOOLS = new Set(["create_task", "update_task", "create_proposal"])'), "create_proposal is a write");
assert(edge.includes("יצירת הצעה באשף") && edge.includes("open_wizard"), "proposal opens wizard after confirm");
assert(realtime.includes("get_insurance_price") && realtime.includes("create_proposal"), "realtime tools registered");
assert(realtime.includes("אל תחשב פרמיה בעצמך"), "model told not to invent prices");
assert(asstTs.includes("applySimWraps") && asstTs.includes("quoteSimulator"), "client applies authorized quote");

console.log("\n4) scoped UI, theme untouched");
assert(asstCss.includes(".giAsst__hit--quote"), "quote hit CSS scoped");
assert(!theme.includes("giAsst__"), "theme.css untouched");
assert(!css.includes("giAsst__hit--quote"), "app.css untouched");

console.log("\n5) existing Menora compute via exported quote");
const sandbox = {
  window: {
    HealthCpi: null,
    showToast(){},
    setTimeout,
    clearTimeout,
    addEventListener(){}
  },
  globalThis: null,
  document: {
    createElement(){ return { style: {}, setAttribute(){}, addEventListener(){} }; },
    getElementById(){ return null; },
    querySelector(){ return null; },
    querySelectorAll(){ return []; },
    body: { appendChild(){} }
  },
  console,
  Date,
  Math,
  Number,
  String,
  Array,
  Object,
  Map,
  Set,
  JSON,
  parseInt,
  isNaN,
  Infinity
};
sandbox.globalThis = sandbox;
sandbox.window.document = sandbox.document;
sandbox.window.URL = URL;
sandbox.__GI_SIM_HOST = {
  safeTrim(v){ return String(v == null ? "" : v).trim(); },
  escapeHtml(s){ return String(s == null ? "" : s); },
  on(){},
  $(){ return null; },
  $$(){ return []; },
  nowISO(){ return new Date().toISOString(); },
  parseBirthDateValue(){ return null; },
  parseAnyDmyDate(){ return null; },
  formatDmyFromParts(){ return ""; },
  applyDmyAutoFormat(){ return ""; },
  renderCompanyLogoHtmlForCompany(){ return ""; },
  ensureGiSimulatorStylesLoaded(){},
  RiskSimulators: { register(){}, getHandler(){ return null; }, registry: {} },
  onSimulatorsInstalled(){}
};
vm.runInNewContext(sims, sandbox);
const quote = sandbox.GiSimulatorQuotes && sandbox.GiSimulatorQuotes.quote;
assert(typeof quote === "function", "GiSimulatorQuotes.quote exported");
const menora = quote("מנורה", "ריסק", { age: 35, gender: "זכר", smoker: false, sumInsured: 500000 });
assert(!!menora && menora.ok === true, "Menora risk quote ok");
assert(Number.isFinite(menora.monthlyPremium) && menora.monthlyPremium > 0, "Menora monthly from existing table");
assert(Number.isFinite(menora.annualPremium) && Math.abs(menora.annualPremium - menora.monthlyPremium * 12) < 0.01, "annual is monthly × 12");
const older = quote("מנורה", "ריסק", { age: 55, gender: "זכר", smoker: false, sumInsured: 500000 });
assert(!!older && older.ok === true && older.monthlyPremium > menora.monthlyPremium, "older age uses the same engine and costs more");
const missing = quote("מנורה", "ריסק", { age: 35, gender: "זכר" });
assert(!!missing && missing.ok === false && missing.open_simulator === true, "incomplete risk opens the existing simulator");
const unknown = quote("חברה-לא-קיימת", "ריסק", { age: 35, gender: "זכר", smoker: false, sumInsured: 100000 });
assert(!!unknown && unknown.ok === false && unknown.error === "UNKNOWN_SIM", "unknown company is rejected");

console.log("\n6) compiled applySimWraps");
function elStub(){
  return {
    id: "", innerHTML: "", className: "", hidden: false,
    appendChild(){ return this; }, addEventListener(){},
    querySelector(){ return elStub(); }, querySelectorAll(){ return []; },
    setAttribute(){}, getAttribute(){ return ""; }, removeAttribute(){},
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    closest(){ return null; },
    focus(){}
  };
}
const hitsBox = Object.assign(elStub(), { id: "giAsstHits", innerHTML: "" });
const asstBox = {
  window: {
    location: { href: "https://crm.example/gemel-invest/index.html" },
    localStorage: { getItem(){ return null; }, setItem(){} },
    addEventListener(){},
    setInterval(){ return 0; },
    clearInterval(){},
    GiAssistant: null,
    __GI_ASSISTANT_BRIDGE__: {
      quoteSimulator: async (_c, _p, input) => {
        if(!input || !input.sumInsured) return { ok:false, error:"sum_missing", open_simulator:true };
        return { ok:true, monthlyPremium: 12.5, annualPremium: 150, currency:"ILS" };
      },
      openSimulator(){ asstBox.window.__openedSim = true; }
    }
  },
  document: {
    readyState: "complete",
    body: Object.assign(elStub(), { getAttribute(){ return ""; } }),
    getElementById(id){ return id === "giAsstHits" ? hitsBox : null; },
    addEventListener(){},
    createElement(){ return elStub(); },
    querySelector(){ return elStub(); }
  },
  URL,
  Date
};
asstBox.window.document = asstBox.document;
asstBox.window.URL = URL;
vm.runInNewContext(asstJs, asstBox);
const api = asstBox.window.GiAssistant;
assert(!!api && typeof api.applySimWraps === "function", "compiled applySimWraps");

(async () => {
  const priced = { ok:true, client_command: { type:"quote_simulator", company:"מנורה", product:"ריסק", input:{ age:35, gender:"זכר", smoker:false, sumInsured:500000 } } };
  await api.applySimWraps("get_insurance_price", {}, priced);
  assert(priced.monthlyPremium === 12.5 && !priced.client_command, "successful quote is attached and does not open UI");
  assert(hitsBox.innerHTML.includes("12.5") && hitsBox.innerHTML.includes("מנורה"), "paints quote hit");

  const incomplete = { ok:true, client_command: { type:"quote_simulator", company:"מנורה", product:"ריסק", input:{ age:35, gender:"זכר" } } };
  await api.applySimWraps("get_insurance_price", {}, incomplete);
  assert(incomplete.needs_input === true && incomplete.client_command && incomplete.client_command.type === "open_simulator", "incomplete quote falls back to existing simulator");

  console.log("\n" + (failed ? "FAILED " + failed : "OK") + "  passed=" + passed + " failed=" + failed);
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
