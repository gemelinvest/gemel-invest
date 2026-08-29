/* GI-ASSISTANT — local browser voice, no vendor payment.
   Run: node _test-assistant-local-voice.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const vm = require("vm");

const ROOT = __dirname;
const TAG = "20260829-assistant-local-v1";
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

const asstTs = read("gi-assistant.ts");
const asstJs = read("gi-assistant.js");
const edge = read("supabase/functions/gi-assistant-engine/index.ts");
const html = read("index.html");
const sw = read("service-worker.js");
const theme = read("theme.css");
const css = read("app.css");

console.log("1) files + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-assistant.js")]).status === 0, "node --check gi-assistant.js");
assert(html.includes("gi-assistant.js?v=" + TAG), "index cache");
assert(sw.includes("gi-v12-" + TAG), "sw cache");
assert(edge.includes("action === \"open_session\""), "engine opens local session");
assert(edge.includes("model: \"local-browser\""), "session model is local-browser");
assert(!theme.includes("giAsst__") && !css.includes("giAsst__hits"), "global CSS untouched");

console.log("\n2) no vendor key required to start voice");
assert(asstTs.includes("startLocalListening") && asstTs.includes("parseLocalCommand"), "local STT + router");
assert(asstTs.includes("speechSynthesis"), "local TTS");
assert(!/mintVoiceToken\(\)/.test(asstTs.split("async function startVoice")[1].split("async function stopVoice")[0]), "startVoice does not mint OpenAI");
assert(!asstTs.includes("OPENAI_API_KEY") && !asstJs.includes("OPENAI_API_KEY"), "no API key in client");
assert(/canAccessSimulators\(\)\{\s*return this\.isAdmin\(\) \|\| this\.isManager\(\);/.test(read("app.js")), "simulator UI gate unchanged");

console.log("\n3) Hebrew command router");
function elStub(){
  return {
    id: "", innerHTML: "", className: "", hidden: false,
    appendChild(){ return this; }, addEventListener(){},
    querySelector(){ return this; }, querySelectorAll(){ return []; },
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
    speechSynthesis: { getVoices(){ return []; }, speak(){}, cancel(){} },
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
  Date,
  SpeechSynthesisUtterance: function(){}
};
sandbox.window.document = sandbox.document;
sandbox.window.URL = URL;
vm.runInNewContext(asstJs, sandbox);
const api = sandbox.window.GiAssistant;
assert(!!api && typeof api.parseLocalCommand === "function", "parseLocalCommand exported");
assert(api.parseLocalCommand("חפש דוד לוי").tool === "search_customer", "חפש → search");
assert(api.parseLocalCommand("חפש דוד לוי").args.query.indexOf("דוד") >= 0, "search keeps the name");
assert(api.parseLocalCommand("פתח תיק של רחל").tool === "find_customer_by_id", "פתח תיק → find");
assert(api.parseLocalCommand("משימות").tool === "get_tasks", "משימות → tasks");
assert(api.parseLocalCommand("עבור ללקוחות").args.view === "customers", "עבור ללקוחות");
assert(api.parseLocalCommand("מחיר מנורה ריסק").tool === "get_insurance_price", "מחיר → quote wrap");
assert(api.parseLocalCommand("מחיר מנורה ריסק").args.company === "מנורה", "quote company");
assert(api.parseLocalCommand("פתח סימולטור מנורה ריסק").tool === "open_simulator", "open existing simulator");
assert(api.parseLocalCommand("כן") === null, "כן stays confirm-only");
assert(api.parseLocalCommand("עזרה").kind === "help", "עזרה is help");

console.log("\n" + (failed ? "FAILED " + failed : "OK") + "  passed=" + passed + " failed=" + failed);
process.exit(failed ? 1 : 0);
