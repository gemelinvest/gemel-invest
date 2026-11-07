/**
 * The voice assistant, its top-bar button, and its functions are gone.
 * The setup helper on the new-customer screen stays.
 * Run: node _test-voice-assistant-removed.js
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
let failed = 0;

function assert(cond, msg){
  if(cond) console.log("  PASS  " + msg);
  else {
    failed += 1;
    console.error("  FAIL  " + msg);
  }
}

const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const cfg = fs.readFileSync(path.join(ROOT, "supabase/config.toml"), "utf8");

console.log("1) the voice assistant is not in the app");
assert(!html.includes("btnPersonalAssistant"), "the top-bar button is gone");
assert(!html.includes("gi-assistant.js"), "the assistant script is not loaded");
assert(!html.includes("gi-assistant.css"), "the assistant style is not loaded");
assert(html.includes("העוזר החכם"), "the setup helper on the new-customer screen stays");
assert(!app.includes("GiAssistant") && !app.includes("__GI_ASSISTANT_BRIDGE__"), "the app no longer calls the assistant");
assert(!app.includes("canAccessPersonalAssistant"), "the assistant permission is gone");
assert(!cfg.includes("gi-assistant"), "the function flags are gone");
assert(!fs.existsSync(path.join(ROOT, "assistant.html")), "the assistant page is gone");
assert(!fs.existsSync(path.join(ROOT, "gi-assistant.js")), "the assistant program is gone");
assert(!fs.existsSync(path.join(ROOT, "supabase/functions/gi-assistant-engine/index.ts")), "the engine function is gone");
assert(!fs.existsSync(path.join(ROOT, "supabase/functions/gi-assistant-pairing/index.ts")), "the pairing function is gone");
assert(!fs.existsSync(path.join(ROOT, "supabase/functions/gi-assistant-realtime/index.ts")), "the realtime function is gone");
assert(!fs.existsSync(path.join(ROOT, "supabase/functions/gi-assistant-tools/index.ts")), "the tools function is gone");
assert(!fs.existsSync(path.join(ROOT, ".github/workflows/deploy-assistant.yml")), "the deploy workflow is gone");

if(failed){
  console.error("\nFAILED " + failed);
  process.exit(1);
}
console.log("\nOK");
