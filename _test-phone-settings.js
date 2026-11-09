/**
 * Phone screens read global settings through gi_app_settings.
 * Notifications and a vehicle referral stay on their functions.
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
assert(!helper.includes("app_meta"), "the settings read no longer uses the table");
assert((phone.match(/readGlobalSettings\(/g) || []).length === 6, "five screens and the helper use the settings read");
assert(!phone.includes("payload->teamManagerAssignments"), "team screens no longer project the table");
assert(!phone.includes("payload->agentTargets"), "goals no longer project the table");
assert(!phone.includes("payload->agentBranches"), "branches no longer project the table");
assert(!phone.includes("payload->directoryContactExtras"), "contacts no longer project the table");
assert(!phone.includes("payload->companyDiscountOverrides"), "discounts no longer project the table");
assert(phone.includes('sb.rpc("gi_phone_push_key")'), "the push key uses the function");
assert(!phone.includes("onyx_push_vapid_public"), "the push key no longer reads the table");
assert(phone.includes('sb.rpc("gi_phone_push_save"'), "saving a push subscription uses the function");
assert(!phone.includes("onyxsub_"), "saving a push subscription no longer writes the table");
assert(phone.includes('sb.rpc("gi_phone_referral_save"'), "the referral uses the function");
assert(!phone.includes('.update({ payload: next, updated_at: next.updatedAt })'), "the referral no longer rewrites the settings row");
assert((phone.match(/from\("app_meta"\)/g) || []).length === 0, "the phone no longer reads the settings table");
assert(sw.includes('onyx-phone-shell-v110'), "the phone cache token moved");
assert(html.includes("phone.js?v=95"), "the phone script token moved");

if(failed){
  console.error("\nFAILED " + failed);
  process.exit(1);
}
console.log("\nOK");
