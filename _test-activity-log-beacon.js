/**
 * The activity-log unload beacon sends the signed-in session.
 * Run: node _test-activity-log-beacon.js
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

function sliceBetween(text, start, end){
  const from = text.indexOf(start);
  const to = text.indexOf(end, from + start.length);
  if(from < 0 || to < 0) return "";
  return text.slice(from, to);
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const log = sliceBetween(app, "const AgentActivityLog = {", "const ATTENDANCE_LOCAL_KEY");
const beacon = sliceBetween(log, "_postBeacon(row){", "logLeadBeacon(eventType");

console.log("1) the unload beacon uses the signed-in session");
assert(log.includes("const AgentActivityLog = {"), "the activity log is present");
assert(log.includes("_storedAccessToken()") && log.includes("gemel_invest_sb_auth_v1"), "the beacon reads the stored session");
assert(beacon.includes("keepalive: true"), "the beacon survives page close");
assert(beacon.includes('Authorization: "Bearer " + token'), "the beacon sends the session");
assert(beacon.includes("apikey: key"), "the beacon still names the API key header");
assert(!beacon.includes('Authorization: "Bearer " + SUPABASE_PUBLISHABLE_KEY'), "the beacon does not send the public key as the session");
assert(beacon.includes("if(!url || !key || !token || !row) return;"), "a missing session sends nothing");
assert(log.includes("this._postBeacon(row);") && log.includes("this._postBeacon(this.buildRow(type, ctx));"), "lead and logout beacons share that send");
assert(html.includes("giActBeacon=1"), "the page loads this copy of the script");

if(failed){
  console.error("\nFAILED " + failed);
  process.exit(1);
}
console.log("\nOK");
