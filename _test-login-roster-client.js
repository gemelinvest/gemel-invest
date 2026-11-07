/**
 * Login tries the narrow roster first and keeps the full meta read as fallback.
 * Run: node _test-login-roster-client.js
 */
"use strict";

const fs = require("fs");
const path = require("path");

const app = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
let failed = 0;

function assert(cond, msg){
  if(cond) console.log("  PASS  " + msg);
  else {
    failed += 1;
    console.error("  FAIL  " + msg);
  }
}

const rosterStart = app.indexOf("async loadLoginRosterPayload()");
const bootStart = app.indexOf("async loadLoginBootstrap(");
const bootEnd = app.indexOf("async _fetchPayloadBatch(", bootStart);
const rosterFn = app.slice(rosterStart, bootStart);
const bootFn = app.slice(bootStart, bootEnd);
const rosterCall = bootFn.indexOf("this.loadLoginRosterPayload()");
const metaCall = bootFn.indexOf("this.loadMetaRow()");

console.log("1) login uses the roster and keeps the full read");
assert(rosterStart > 0 && bootStart > rosterStart, "the roster helper is defined before login bootstrap");
assert(rosterCall > 0 && metaCall > rosterCall, "a roster hit returns before the full meta read");
assert(bootFn.includes("this.loadMetaRow()"), "the full meta read stays as the fallback");
assert(bootFn.includes("loadTableRows(SUPABASE_TABLES.agents, AGENT_PUBLIC_COLUMNS)"), "the agent table read stays as the fallback");
assert(rosterFn.includes('client.rpc("gi_login_roster")'), "the helper calls the narrow function");
assert(!rosterFn.includes("customersShadow") && !rosterFn.includes("proposalsShadow"), "the helper does not copy customer or proposal rows");
assert(!rosterFn.includes("totpUri") && !rosterFn.includes(".pin"), "the helper does not copy a code or a barcode");
assert(rosterFn.includes("if(!agentsMerged.length) return null"), "an empty roster falls back to the full read");

if(failed){
  console.error("\nFAILED " + failed);
  process.exit(1);
}
console.log("\nOK");
