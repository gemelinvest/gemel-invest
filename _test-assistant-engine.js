/* GI-ASSISTANT P7 — engine: context, confirmation, timeline, logging.
   Run: node _test-assistant-engine.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const vm = require("vm");

const ROOT = __dirname;
const TAG = "20260829-assistant-chat-reports-v1";
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

const theme = read("theme.css");
const asstTs = read("gi-assistant.ts");
const asstJs = read("gi-assistant.js");
const asstCss = read("gi-assistant.css");
const sql = read("supabase-assistant-engine.sql");
const edge = read("supabase/functions/gi-assistant-engine/index.ts");
const cfg = read("supabase/config.toml");
const html = read("index.html");
const sw = read("service-worker.js");

console.log("1) files + cache");
assert(fs.existsSync(path.join(ROOT, "supabase/functions/gi-assistant-engine/index.ts")), "edge engine");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-assistant.js")]).status === 0, "node --check gi-assistant.js");
assert(html.includes("gi-assistant.js?v=" + TAG), "index cache");
assert(sw.includes("gi-v12-" + TAG), "sw cache");
assert(cfg.includes("[functions.gi-assistant-engine]"), "config.toml registers engine");

console.log("\n2) server authority + no PII");
assert(edge.includes("pending_action_id"), "server stores pending_action_id");
assert(edge.includes("NO_PENDING"), "bare confirm is denied");
assert(edge.includes("executed: false"), "confirm does not execute tools");
assert(edge.includes("PII_REJECTED") && edge.includes("id_number"), "rejects ת״ז keys");
assert(edge.includes("redactSafe") && edge.includes("[מזהה]"), "redacts long digit IDs");
assert(sql.includes("create table if not exists public.gi_assistant_context"), "context table");
assert(sql.includes("create table if not exists public.gi_assistant_pending_actions"), "pending table");
assert(sql.includes("create table if not exists public.gi_assistant_timeline"), "timeline table");
assert(sql.includes("revoke all on public.gi_assistant_pending_actions from public, anon, authenticated"), "anon cannot read pending");
assert(!sql.includes("alter table public.customers"), "customers untouched");
assert(!edge.includes("create table"), "edge does not change schema");
assert(!asstTs.includes("OPENAI_API_KEY") && !asstJs.includes("OPENAI_API_KEY"), "still no API key in client");

console.log("\n3) client confirmation + timeline");
assert(asstTs.includes("אין פעולה ממתינה לאישור"), "bare כן copy");
assert(asstTs.includes("giAsst__timeline"), "timeline markup");
assert(asstTs.includes("giAsstConfirmYes"), "confirm buttons");
assert(asstCss.includes(".giAsst__timeline") && !theme.includes("giAsst__timeline"), "scoped timeline CSS");
assert(asstTs.includes("classifyIntent") && asstTs.includes("proposeWrite"), "engine API exported");
assert(edge.includes("open_session") && edge.includes("local-browser"), "local session without OpenAI");
assert(asstTs.includes("parseLocalCommand") && asstTs.includes("webkitSpeechRecognition"), "browser speech path");

console.log("\n4) compiled intent + confirm contract");
function elStub(){
  return {
    id: "", innerHTML: "", className: "", hidden: false,
    appendChild(){ return this; }, addEventListener(){},
    querySelector(){ return elStub(); }, querySelectorAll(){ return []; },
    setAttribute(){}, getAttribute(){ return ""; }, removeAttribute(){},
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    focus(){}
  };
}
const sandbox = {
  window: {
    location: { href: "https://crm.example/gemel-invest/index.html" },
    localStorage: { getItem(){ return null; }, setItem(){} },
    addEventListener(){},
    setInterval(){ return 0; },
    clearInterval(){},
    GiAssistant: null
  },
  document: {
    readyState: "complete",
    body: Object.assign(elStub(), { getAttribute(){ return ""; } }),
    getElementById(){ return null; },
    addEventListener(){},
    createElement(){ return elStub(); },
    querySelector(){ return elStub(); }
  },
  URL,
  Date
};
sandbox.window.document = sandbox.document;
sandbox.window.URL = URL;
vm.runInNewContext(asstJs, sandbox);
const api = sandbox.window.GiAssistant;
assert(!!api && typeof api.classifyIntent === "function", "compiled classifyIntent");
assert(api.classifyIntent("כן") === "confirm", "כן is confirm");
assert(api.classifyIntent("לא") === "cancel", "לא is cancel");
assert(api.classifyIntent("פתח תיק") === "other", "other intent is not confirm");
assert(typeof api.parseLocalCommand === "function", "compiled parseLocalCommand");
assert(api.parseLocalCommand("חפש ישראל כהן").tool === "search_customer", "search maps to search_customer");
assert(api.parseLocalCommand("כן") === null, "confirm is not a local tool");
assert(api.redactSafe("לקוח 123456789") === "לקוח [מזהה]", "redact digits");
assert(api.getPendingAction() === null, "no pending by default");

console.log("\n" + (failed ? "FAILED " + failed : "OK") + "  passed=" + passed + " failed=" + failed);
process.exit(failed ? 1 : 0);
