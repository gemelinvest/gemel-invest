/* GI-ASSISTANT P6 — OpenAI Realtime ephemeral token + voice UI states.
   Run: node _test-assistant-realtime.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260829-assistant-open-v1";
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
const theme = read("theme.css");
const asstTs = read("gi-assistant.ts");
const asstJs = read("gi-assistant.js");
const asstCss = read("gi-assistant.css");
const sql = read("supabase-assistant-sessions.sql");
const edge = read("supabase/functions/gi-assistant-realtime/index.ts");
const pairing = read("supabase/functions/gi-assistant-pairing/index.ts");
const cfg = read("supabase/config.toml");
const sw = read("service-worker.js");

console.log("1) files + cache + syntax");
assert(fs.existsSync(path.join(ROOT, "supabase/functions/gi-assistant-realtime/index.ts")), "edge realtime");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-assistant.js")]).status === 0, "node --check gi-assistant.js");
assert(html.includes("gi-assistant.js?v=" + TAG), "index cache");
assert(phone.includes("gi-assistant.js?v=" + TAG), "phone cache");
assert(sw.includes("gi-v12-" + TAG), "sw cache");
assert(cfg.includes("[functions.gi-assistant-realtime]"), "config.toml registers realtime");
assert(cfg.includes("verify_jwt = false"), "realtime uses app PIN/device auth, not JWT");

console.log("\n2) API key never in the browser");
assert(edge.includes('Deno.env.get("OPENAI_API_KEY")'), "key read from Edge secret");
assert(!asstTs.includes("OPENAI_API_KEY"), "TS client has no API key env name");
assert(!asstJs.includes("OPENAI_API_KEY"), "compiled JS has no API key env name");
assert(!/sk-[A-Za-z0-9]{10,}/.test(asstTs + asstJs), "no live sk- key material in client");
assert(!edge.includes("sk-proj") && !edge.includes("sk-svc"), "edge does not hardcode a live key");
assert(edge.includes("/v1/realtime/client_secrets"), "server mints via client_secrets");
assert(edge.includes("gpt-realtime-2.1"), "current realtime model");
assert(edge.includes("OPENAI_INVALID_KEY"), "maps invalid OpenAI key");
assert(asstTs.includes("/v1/realtime/calls"), "browser connects with ephemeral token only");
assert(asstTs.includes("clientSecret.indexOf(\"sk-\") === 0"), "client rejects a leaked standard key");

console.log("\n3) session authority");
assert(edge.includes("requireDevice") && edge.includes("requireAgentWithPin"), "phone device or desktop PIN");
assert(edge.includes("from(\"gi_assistant_devices\")"), "phone uses paired device");
assert(edge.includes("from(\"agents\")"), "desktop PIN uses existing agents table");
assert(sql.includes("create table if not exists public.gi_assistant_sessions"), "sessions table added");
assert(sql.includes("revoke all on public.gi_assistant_sessions from public, anon, authenticated"), "anon cannot read sessions");
assert(!sql.includes("alter table public.customers"), "customers schema untouched");
assert(!pairing.includes("openai"), "pairing function still has no OpenAI");

console.log("\n4) UI states");
["idle", "connecting", "listening", "speaking", "error"].forEach((state) => {
  assert(asstTs.includes("\"" + state + "\""), "state " + state);
});
assert(asstTs.includes("דבר עם המערכת"), "idle copy");
assert(asstTs.includes("מתחבר"), "connecting copy");
assert(asstTs.includes("מקשיב"), "listening copy");
assert(asstTs.includes("העוזר מדבר"), "speaking copy");
assert(asstCss.includes(".giAsst__micBtn") && asstCss.includes("@keyframes giAsstPulse"), "scoped voice CSS");
assert(!theme.includes("giAsst__micBtn"), "theme.css untouched");
assert(asstTs.includes("getUserMedia"), "microphone via getUserMedia");
assert(asstTs.includes("RTCPeerConnection"), "WebRTC peer connection");

console.log("\n" + (failed ? "FAILED " + failed : "OK") + "  passed=" + passed + " failed=" + failed);
process.exit(failed ? 1 : 0);
