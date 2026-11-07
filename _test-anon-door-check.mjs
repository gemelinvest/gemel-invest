/**
 * The public-key check reports closed or open and keeps row text to itself.
 * Run: node _test-anon-door-check.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pinExposed, readPublicKey, restVisible, storageListed } from "./scripts/gi-anon-door-check.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
let failed = 0;

function assert(cond, msg){
  if(cond) console.log("  PASS  " + msg);
  else {
    failed += 1;
    console.error("  FAIL  " + msg);
  }
}

const source = fs.readFileSync(path.join(root, "scripts/gi-anon-door-check.mjs"), "utf8");

console.log("1) the check only reports a door");
assert(source.includes("method: \"GET\""), "table checks are reads");
assert(!/method:\s*"PATCH"|method:\s*"DELETE"|method:\s*"PUT"/i.test(source), "it does not change a row");
assert(!source.includes("R1_WRITE_PROBES"), "it has no write switch");
assert(!source.includes("console.log(body)") && !source.includes("console.log(url)") && !source.includes("console.log(key)"), "it does not print a row or the key");
assert(source.includes("select=pin") && source.includes("history_id") && !source.includes("select=row_data") && !source.includes("select=token"), "it avoids the snapshot and the device token");

console.log("\n2) closed and open answers");
const settings = readPublicKey('const SUPABASE_URL = "https://example.test";\nconst SUPABASE_PUBLISHABLE_KEY = "sb_publishable_example";\n');
assert(settings.url === "https://example.test" && settings.key === "sb_publishable_example", "it reads the public settings");
assert(restVisible(401, "", "[]") === "no", "a rejected read is closed");
assert(restVisible(200, "0-0/0", "[]") === "no", "an empty read is closed");
assert(restVisible(206, "0-0/3", "[{\"id\":\"c1\"}]") === "yes", "a counted read is open");
assert(pinExposed(401, "{\"pin\":\"secret\"}") === "no", "a rejected pin read stays closed");
assert(pinExposed(200, "{\"pin\":\"secret\"}") === "yes", "a returned pin column is open");
assert(pinExposed(200, "{\"id\":\"a1\"}") === "no", "a row without the pin column stays closed");
assert(storageListed(400, "{\"message\":\"denied\"}") === "no", "a rejected file list is closed");
assert(storageListed(200, "[]") === "no", "an empty file list is closed");
assert(storageListed(200, "[{\"name\":\"file\"}]") === "yes", "a returned file name is open");

if(failed){
  console.error("\nFAILED " + failed);
  process.exit(1);
}
console.log("\nOK");
