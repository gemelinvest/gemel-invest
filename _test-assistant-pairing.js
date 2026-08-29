/* GI-ASSISTANT P4 — secure QR pairing.
   Run: node _test-assistant-pairing.js
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

const html = read("index.html");
const phone = read("assistant.html");
const app = read("app.js");
const theme = read("theme.css");
const asstTs = read("gi-assistant.ts");
const asstJs = read("gi-assistant.js");
const sql = read("supabase-assistant-pairing.sql");
const edge = read("supabase/functions/gi-assistant-pairing/index.ts");
const cfg = read("supabase/config.toml");
const sw = read("service-worker.js");

console.log("1) files + syntax");
assert(fs.existsSync(path.join(ROOT, "assistant.html")), "assistant.html");
assert(fs.existsSync(path.join(ROOT, "supabase/functions/gi-assistant-pairing/index.ts")), "edge function");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-assistant.js")]).status === 0, "node --check gi-assistant.js");
assert(html.includes("gi-assistant.js?v=" + TAG), "index cache");
assert(html.includes("gi-assistant.css?v=" + TAG), "css cache");
assert(phone.includes("gi-assistant.js?v=" + TAG), "phone page cache");
assert(sw.includes("gi-v12-" + TAG), "sw cache");
assert(cfg.includes("[functions.gi-assistant-pairing]"), "config.toml registers function");
assert(cfg.includes("verify_jwt = false"), "pairing uses custom PIN auth, not JWT");

console.log("\n2) QR must not carry secrets");
assert(asstTs.includes('url.searchParams.set("p"'), "QR holds only pairing token param p");
assert(!asstTs.includes('searchParams.set("user_id"'), "no user_id in QR");
assert(!asstTs.includes('searchParams.set("agentId"'), "no agentId in QR");
assert(!phone.includes("id_number") && !phone.includes("ת\"ז"), "phone page has no ת״ז fields beyond copy");
assert(asstTs.includes('keys.some((k) => k !== "p")'), "client rejects QR URLs with extra params");
assert(edge.includes("sha256Hex(publicToken)"), "server stores token hash only");
assert(edge.includes("desktop_secret_hash"), "desktop secret stored hashed");
assert(edge.includes("TOKEN_TTL_MS = 5 * 60 * 1000"), "token TTL is 5 minutes");
assert(edge.includes(".is(\"used_at\", null)"), "consume is single-use");
assert(edge.includes("AGENT_MISMATCH"), "consume binds to the starter agent");
assert(edge.indexOf("AGENT_MISMATCH") < edge.indexOf('.update({ used_at: now })'), "mismatch does not burn the token");

console.log("\n3) server authority + existing auth");
assert(edge.includes("requireAgentWithPin"), "PIN checked on the server");
assert(edge.includes("from(\"agents\")"), "uses existing agents table");
assert(!edge.includes("create table"), "edge does not change schema");
assert(sql.includes("revoke all on public.gi_assistant_pairing_tokens from public, anon, authenticated"), "anon cannot read tokens");
assert(sql.includes("grant all on public.gi_assistant_pairing_tokens to service_role"), "only service role");
assert(sql.includes("create table if not exists public.gi_assistant_devices"), "devices table added");
assert(!sql.includes("alter table public.customers"), "customers schema untouched");
assert(!sql.includes("alter table public.agents"), "agents schema untouched");
assert(app.includes("supabaseUrl: SUPABASE_URL"), "bridge reuses existing Supabase URL");
assert(theme.includes(".topbar__actions .lcTopBtn") && !theme.includes("giAsst__form"), "theme.css still has no assistant pairing CSS");

console.log("\n4) phone entry + desktop flow");
assert(phone.includes('data-gi-asst-page="phone"'), "phone page boots assistant module");
assert(phone.includes("העוזר האישי שלי"), "phone title");
assert(asstTs.includes('action: "create"'), "desktop create");
assert(asstTs.includes('action: "consume"'), "phone consume");
assert(asstTs.includes('action: "status"'), "desktop poll");
assert(asstTs.includes("renderActivateBody"), "PIN step before QR");

console.log("\n5) phoneEntryUrl contract");
function elStub(){
  return {
    id: "",
    innerHTML: "",
    className: "",
    hidden: false,
    appendChild(){ return this; },
    addEventListener(){},
    querySelector(){ return elStub(); },
    setAttribute(){},
    getAttribute(){ return ""; },
    removeAttribute(){},
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
    createElement(){ return elStub(); }
  },
  URL,
  Date
};
sandbox.window.document = sandbox.document;
sandbox.window.URL = URL;
vm.runInNewContext(asstJs, sandbox);
const api = sandbox.window.GiAssistant;
assert(!!api && typeof api.phoneEntryUrl === "function", "compiled API exposes phoneEntryUrl");
if(api && typeof api.phoneEntryUrl === "function"){
  const href = api.phoneEntryUrl("tok_abc");
  const url = new URL(href);
  assert(url.pathname.endsWith("/assistant.html"), "QR points at assistant.html");
  assert(url.searchParams.get("p") === "tok_abc", "QR param is the public token");
  assert([...url.searchParams.keys()].join(",") === "p", "QR has no other query keys");
}

console.log("\n" + (failed ? "FAILED " + failed : "OK") + "  passed=" + passed + " failed=" + failed);
process.exit(failed ? 1 : 0);
