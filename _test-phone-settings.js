/**
 * Phone screens read global settings through gi_app_settings.
 * The push key, the push save, and the referral write stay on the table.
 * Run: node _test-phone-settings.js
 */
"use strict";

const fs = require("fs");
const path = require("path");

const phone = fs.readFileSync(path.join(__dirname, "phone/phone.js"), "utf8");
const sw = fs.readFileSync(path.join(__dirname, "phone/sw.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "phone/index.html"), "utf8");
let failed = 0;

function assert(cond, msg){
  if(cond) console.log("  PASS  " + msg);
  else {
    failed += 1;
    console.error("  FAIL  " + msg);
  }
}

const start = phone.indexOf("async function readGlobalSettings()");
const end = phone.indexOf("async function teamRoster(", start);
const helper = phone.slice(start, end);

console.log("1) phone settings go through the function");
assert(start > 0 && end > start, "the helper is defined before the team roster");
assert(helper.includes('sb.rpc("gi_app_settings")'), "the helper calls the settings function");
assert(helper.indexOf('sb.rpc("gi_app_settings")') < helper.indexOf('sb.from("app_meta")'), "the function is tried before the table");
assert(helper.includes('.select("payload,updated_at")'), "the table read remains as the fallback");
assert((phone.match(/readGlobalSettings\(/g) || []).length === 6, "five screens and the helper use the settings read");
assert(!phone.includes("payload->teamManagerAssignments"), "team screens no longer project the table");
assert(!phone.includes("payload->agentTargets"), "goals no longer project the table");
assert(!phone.includes("payload->agentBranches"), "branches no longer project the table");
assert(!phone.includes("payload->directoryContactExtras"), "contacts no longer project the table");
assert(!phone.includes("payload->companyDiscountOverrides"), "discounts no longer project the table");
assert(phone.includes('eq("key", "onyx_push_vapid_public")'), "the push key stays on its own row");
assert(phone.includes('key: "onyxsub_"'), "saving a push subscription stays on the table");
assert(phone.includes('.update({ payload: next, updated_at: next.updatedAt })'), "the referral write stays on the table");
assert(sw.includes('onyx-phone-shell-v107'), "the phone cache token moved");
assert(html.includes("phone.js?v=92"), "the phone script token moved");

if(failed){
  console.error("\nFAILED " + failed);
  process.exit(1);
}
console.log("\nOK");
