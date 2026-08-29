/* GI-ASSISTANT P8–P9 — tools + server role authz.
   Run: node _test-assistant-tools.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260829-assistant-open-file-fix-v1";
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
const theme = read("theme.css");
const asstTs = read("gi-assistant.ts");
const asstJs = read("gi-assistant.js");
const edge = read("supabase/functions/gi-assistant-tools/index.ts");
const realtime = read("supabase/functions/gi-assistant-realtime/index.ts");
const cfg = read("supabase/config.toml");
const html = read("index.html");
const sw = read("service-worker.js");

console.log("1) files + cache");
assert(fs.existsSync(path.join(ROOT, "supabase/functions/gi-assistant-tools/index.ts")), "tools edge");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-assistant.js")]).status === 0, "node --check gi-assistant.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("gi-assistant.js?v=" + TAG), "index cache");
assert(sw.includes("gi-v12-" + TAG), "sw cache");
assert(cfg.includes("[functions.gi-assistant-tools]"), "config.toml registers tools");

console.log("\n2) server is authority");
assert(edge.includes("delete rawArgs.user_id"), "model user_id is discarded");
assert(edge.includes("WRITE_TOOLS") && edge.includes("needs_confirmation"), "writes require confirmation");
assert(edge.includes("NOT_CONFIRMED") || edge.includes("pendingActionId"), "confirmed pending required to execute write");
assert(edge.includes("canViewTeamReports") && edge.includes("FORBIDDEN"), "team tools forbidden for agents");
assert(edge.includes("customerVisible"), "customer visibility mirrored");
assert(edge.includes("safeCustomer") && !/safeCustomer[\s\S]{0,200}id_number/.test(edge), "safe customer omits ת״ז");
assert(edge.includes("get_insurance_price") && edge.includes("quote_simulator"), "price tool authorizes then quotes on client");
assert(!edge.includes("PHASE_11"), "P11 pricing is no longer stubbed");
assert(!edge.includes("computeMenora") && !edge.includes("monthlyPremium ="), "edge does not compute or duplicate rates");
assert(realtime.includes("SESSION_TOOLS") && realtime.includes("search_customer"), "realtime session registers tools");
assert(realtime.includes("get_insurance_price") && realtime.includes("create_proposal"), "realtime registers price and proposal tools");

console.log("\n3) existing functions wrapped, not replaced");
assert(app.includes("CustomersUI.openByIdWithLoader"), "open customer uses existing UI");
assert(app.includes("RiskSimulators.getHandler"), "simulator uses existing handler");
assert(app.includes("ReminderUI.loadReminders"), "tasks refresh existing ReminderUI");
assert(app.includes("UI.goView"), "navigation uses existing UI.goView");
assert(!app.includes("create table"), "app.js still has no schema change");
assert(!theme.includes("giAsst__"), "theme.css untouched");
assert(asstTs.includes("invokeTool") && asstTs.includes("executeClientCommand"), "client dispatcher");
assert(asstTs.includes("function_call_output"), "tool results return to the model");
assert(edge.includes("fill_wizard") && edge.includes("wizard_next") && edge.includes("open_har_import"), "wizard fill/next/HAR tools");
assert(app.includes("Wizard.nextStep") && app.includes("Wizard.openHarBituachImport"), "wizard wraps existing next + HAR picker");

console.log("\n" + (failed ? "FAILED " + failed : "OK") + "  passed=" + passed + " failed=" + failed);
process.exit(failed ? 1 : 0);
