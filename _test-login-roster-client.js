/**
 * Login reads the narrow roster and does not fall back to the full meta row.
 * Run: node _test-login-roster-client.js
 */
"use strict";

const fs = require("fs");
const path = require("path");

const app = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
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

console.log("1) login uses only the roster");
assert(rosterStart > 0 && bootStart > rosterStart, "the roster helper is defined before login bootstrap");
assert(rosterCall > 0, "login bootstrap calls the roster");
assert(bootFn.includes("source:'roster'"), "a roster hit is the login source");
assert(!bootFn.includes("this.loadMetaRow()"), "login bootstrap does not read the full meta row");
assert(!bootFn.includes("loadTableRows(SUPABASE_TABLES.agents"), "login bootstrap does not read the agents table");
assert(!bootFn.includes("source:'server'"), "there is no full-read login source");
assert(bootFn.includes("source:'backup-cache'"), "a short local cache remains when the server does not answer");
assert(bootFn.includes("LOGIN_ROSTER_UNAVAILABLE"), "a roster miss is reported without reading the open tables");
assert(rosterFn.includes('client.rpc("gi_login_roster")'), "the helper calls the narrow function");
assert(!rosterFn.includes("customersShadow") && !rosterFn.includes("proposalsShadow"), "the helper does not copy customer or proposal rows");
assert(!rosterFn.includes("totpUri") && !rosterFn.includes(".pin"), "the helper does not copy a code or a barcode");
assert(rosterFn.includes("if(!agentsMerged.length) return null"), "an empty roster does not invent agents");
assert(app.includes("async loadMetaRow()"), "signed-in screens can still read meta");
assert(app.includes("probeConnection()"), "the connection check is unchanged");
assert(html.includes("giLoginRoster=2"), "the page asks browsers to load this login change");
const pinReadStart = app.indexOf("const readAgentPinOnlyFromServer = async");
const pinReadEnd = app.indexOf("const resolveAgentAuthEmail", pinReadStart);
const pinReadFn = app.slice(pinReadStart, pinReadEnd);
assert(pinReadStart > 0 && pinReadEnd > pinReadStart, "the login security read is present");
assert(pinReadFn.includes("Storage.loadLoginRosterPayload()"), "the barcode decision reads the roster");
assert(!pinReadFn.includes("Storage.loadMetaRow()"), "the barcode decision does not read the full meta row");

if(failed){
  console.error("\nFAILED " + failed);
  process.exit(1);
}
console.log("\nOK");
