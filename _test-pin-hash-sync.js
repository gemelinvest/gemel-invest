/**
 * Contract checks for PIN hash sync trigger.
 * Run: node _test-pin-hash-sync.js
 */
const fs = require("fs");
const path = require("path");
const sql = fs.readFileSync(path.join(__dirname, "supabase-gi-pin-hash-sync.sql"), "utf8");

function assert(cond, msg){
  if(!cond) throw new Error(msg);
}

assert(/create or replace function public\.gi_sync_agent_pin_hash/i.test(sql), "must define sync function");
assert(/before insert or update of pin on public\.agents/i.test(sql), "must fire before pin writes");
assert(/new\.pin_hash := extensions\.crypt/i.test(sql), "must rehash from the new pin");
assert(/new\.pin is not distinct from old\.pin/i.test(sql), "must skip when pin did not change");
assert(/btrim\(new\.pin\) <> ''/i.test(sql), "must not wipe hash when pin is cleared");
assert(/revoke all on function public\.gi_sync_agent_pin_hash/i.test(sql), "must revoke public execute");

console.log("OK _test-pin-hash-sync.js");
