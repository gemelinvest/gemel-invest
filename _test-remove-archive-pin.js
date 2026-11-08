/**
 * Archiving and purging a customer require the admin PIN.
 * The shared archive code is not accepted.
 * Run: node _test-remove-archive-pin.js
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
let failed = 0;

function assert(cond, msg){
  if(cond) console.log("  PASS  " + msg);
  else {
    failed += 1;
    console.error("  FAIL  " + msg);
  }
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");

function sliceFn(name){
  const start = app.indexOf("async function " + name);
  const next = app.indexOf("\n  async function ", start + 10);
  return start < 0 ? "" : app.slice(start, next === -1 ? start + 1800 : next);
}

console.log("1) archive no longer accepts the shared code");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "app.js parses");
assert(!app.includes("ARCHIVE_CUSTOMER_PIN"), "the shared archive constant is gone");
const gate = sliceFn("adminDestructivePinAccepted");
assert(gate.includes("verifyAdminPinForLogin"), "archive asks the server for the admin PIN");
assert(!gate.includes("1990"), "the archive gate does not contain the shared code");
const candidates = app.slice(app.indexOf("function getCustomerAdminPinCandidates"), app.indexOf("function getCustomerAdminPinCandidates") + 500);
assert(!candidates.includes("1990"), "the fallback list does not contain the shared code");
assert(app.includes('const FORBIDDEN_LOGIN_PINS = Object.freeze(["0000", "1234", "1990"])'), "new login codes still cannot be 1990");
assert(html.includes("giPinServer=1&giArchivePin=1"), "the app cache token includes the archive change");
assert(sw.includes("pin-server-v1-archive-pin-v1"), "the service worker cache token includes the archive change");

if(failed){
  console.error("\nFAILED " + failed);
  process.exit(1);
}
console.log("\nOK");
