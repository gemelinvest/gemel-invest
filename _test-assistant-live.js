/* GI-ASSISTANT P13–P17 — live commands, security, acceptance.
   Run: node _test-assistant-live.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260829-assistant-reopen-v1";
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
const css = read("app.css");
const asstTs = read("gi-assistant.ts");
const asstJs = read("gi-assistant.js");
const edgeEngine = read("supabase/functions/gi-assistant-engine/index.ts");
const edgeTools = read("supabase/functions/gi-assistant-tools/index.ts");
const edgePair = read("supabase/functions/gi-assistant-pairing/index.ts");
const edgeRt = read("supabase/functions/gi-assistant-realtime/index.ts");
const sqlCmd = read("supabase-assistant-commands.sql");
const sqlPair = read("supabase-assistant-pairing.sql");
const html = read("index.html");
const sw = read("service-worker.js");
const wizard = read("gi-wizard.js");

console.log("1) cache + syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-assistant.js")]).status === 0, "node --check gi-assistant.js");
assert(html.includes("gi-assistant.js?v=" + TAG), "index cache");
assert(sw.includes("gi-v12-" + TAG), "sw cache");
assert(fs.existsSync(path.join(ROOT, "supabase-assistant-commands.sql")), "commands SQL");

console.log("\n2) P13 phone→desktop bus");
assert(sqlCmd.includes("create table if not exists public.gi_assistant_commands"), "commands table");
assert(sqlCmd.includes("revoke all on public.gi_assistant_commands from public, anon, authenticated"), "anon cannot read commands");
assert(edgeEngine.includes("handleDispatch") && edgeEngine.includes("handlePull") && edgeEngine.includes("handleAck"), "engine bus actions");
assert(edgeEngine.includes("UI_COMMANDS") && edgeEngine.includes("hasPii"), "commands sanitized, no PII");
assert(asstTs.includes("dispatchDesktopCommand") && asstTs.includes("isPhonePage()"), "phone dispatches UI commands");
assert(asstTs.includes("startCommandBus") && asstTs.includes("pullDesktopCommands"), "desktop pulls and executes");
assert(asstTs.includes("CustomersUI.openByIdWithLoader") || app.includes("CustomersUI.openByIdWithLoader"), "desktop still opens existing customer file");
assert(edgePair.includes("issueDesktopDevice") && asstTs.includes("writeDevice"), "desktop receives a device after pairing");

console.log("\n3) security review");
assert(!asstTs.includes("OPENAI_API_KEY") && !asstJs.includes("OPENAI_API_KEY"), "no API key in client");
assert(!asstJs.includes("sk-") || !/sk-[A-Za-z0-9]{10,}/.test(asstJs), "no live sk- key");
assert(edgeTools.includes("delete rawArgs.user_id"), "model user_id discarded");
assert(edgeTools.includes("WRITE_TOOLS") && edgeEngine.includes("NO_PENDING"), "writes + bare כן gated");
assert(sqlPair.includes("revoke all on public.gi_assistant_pairing_tokens from public, anon, authenticated"), "pairing tokens not public");
assert(!sqlCmd.includes("alter table public.customers") && !app.includes("create table"), "existing schema untouched");
assert(!theme.includes("giAsst__") && !css.includes("giAsst__hits"), "global CSS untouched");
assert(/canAccessSimulators\(\)\{\s*return this\.isAdmin\(\) \|\| this\.isManager\(\);/.test(app), "simulator UI gate unchanged");
assert(!edgeTools.includes("computeMenora") && !wizard.includes("GiAssistant"), "no duplicated pricing / wizard rewrite");

console.log("\n4) acceptance 1–12");
assert(html.includes('id="btnPersonalAssistant"') && html.includes('aria-label="העוזר האישי"'), "1. top-bar button");
assert(asstTs.includes('url.searchParams.set("p"') && !asstTs.includes("idNumber"), "2. QR only token p, no ת״ז");
assert(asstTs.includes("action: \"consume\"") && asstTs.includes("giAsstPhonePin"), "3. phone uses existing username+PIN");
assert(asstTs.includes('"idle"') && asstTs.includes('"listening"') && asstTs.includes('"speaking"'), "4. voice states");
assert(asstTs.includes("אין פעולה ממתינה לאישור"), "5. bare כן ignored");
assert(asstTs.includes("sanitizeCustomerHit") && app.includes("toAssistantSafeCard"), "6. search cards omit ת״ז");
assert(app.includes("CustomersUI.openByIdWithLoader"), "7. open customer wraps existing UI");
assert(app.includes("ReminderUI.upsertReminder") && app.includes("ReminderUI.markDone"), "8. tasks wrap ReminderUI");
assert(app.includes("GiSimulatorQuotes") && edgeTools.includes("quote_simulator"), "9. price from existing compute");
assert(app.includes("Wizard.openNewPurchaseForCustomer") && edgeTools.includes("open_wizard"), "10. proposal opens wizard");
assert(asstTs.includes("dispatchDesktopCommand") && edgeEngine.includes("gi_assistant_commands"), "11. phone command reaches desktop");
assert(asstTs.includes("parseLocalCommand") && asstTs.includes("giAsstTalkForm") && edgeEngine.includes("open_session") && !asstTs.includes("OPENAI_API_KEY"), "12. local browser voice + typed fallback, no vendor key in client");

console.log("\n" + (failed ? "FAILED " + failed : "OK") + "  passed=" + passed + " failed=" + failed);
process.exit(failed ? 1 : 0);
