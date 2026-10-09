/**
 * GI-SEC Pב / ISO 27001 A.8.5 — reject weak PINs on save, never lock existing login.
 * Run: node _test-weak-pin-policy.js
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
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

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

function sliceFunction(src, startToken){
  const start = src.indexOf(startToken);
  if(start < 0) return "";
  let i = src.indexOf("{", start);
  if(i < 0) return "";
  let depth = 0;
  for(; i < src.length; i++){
    const ch = src[i];
    if(ch === "{") depth += 1;
    else if(ch === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, i + 1);
    }
  }
  return "";
}

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");

console.log("\n2) helper forbids known weak pins");
assert(app.includes('const FORBIDDEN_LOGIN_PINS = Object.freeze(["0000", "1234", "1990"])'), "forbidden list is 0000/1234/1990");
assert(app.includes("function forbiddenLoginPinMessage(pin)"), "helper exists");
assert(app.includes("/^(\\d)\\1+$/.test(clean)"), "repeating digits also forbidden");

console.log("\n3) save paths use the helper; login success path does not");
const saveUser = sliceFunction(app, "async _saveFromModal(){");
assert(saveUser.includes("forbiddenLoginPinMessage(pin)"), "user create/edit checks weak PIN");
assert(saveUser.includes("weakPin"), "weak PIN blocks the save");
const gate = sliceFunction(app, "async saveUsersManagementPin(){");
assert(gate.includes("forbiddenLoginPinMessage(pin)"), "users-gate pin rejects weak codes");
const login = sliceFunction(app, "async function verifyAgentPinForLogin");
assert(login.length > 0, "login helper still exists");
assert(!login.includes("forbiddenLoginPinMessage"), "existing login is not blocked by the new policy");
assert(login.includes('"LOCKED"'), "lockout handling stays");

console.log("\n4) UI no longer suggests 0000");
assert(!html.includes('id="lcUserPin" inputmode="numeric" placeholder="0000"'), "user modal placeholder is not 0000");
assert(html.includes('id="lcUserPin" inputmode="numeric" placeholder="4–6 ספרות"'), "user modal placeholder is 4-6 digits");
assert(html.includes("אסור 0000 / 1234 / 1990"), "help text names the forbidden codes");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
