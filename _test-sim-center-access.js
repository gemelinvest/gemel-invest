/* GI-SIM-CENTER-ACCESS 2026-09-05
   לחצן מרכז הסימולטורים בטופ-בר פתוח לכל משתמש מחובר.
   בלי שינוי במנועי פרמיה / הצהרת בריאות / שער הסימולטור באשף.
   הרצה: node _test-sim-center-access.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260906-rows-advance-v1";
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

const app = read("app.js");
const wiz = read("gi-wizard.js");
const html = read("index.html");
const sw = read("service-worker.js");

function sliceCanAccess(){
  const start = app.indexOf("canAccessSimulators(){");
  const end = app.indexOf("canAccessPersonalAssistant(){", start);
  if(start < 0 || end <= start) return "";
  return app.slice(start, end);
}

function evalGate(current){
  const body = sliceCanAccess();
  const obj = new Function("return {" + body + "}")();
  obj.current = current;
  return obj.canAccessSimulators();
}

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache bumped");
assert(sw.includes("gi-v12-" + TAG), "service worker cache bumped");
assert(app.includes('GI_WIZARD_JS_VERSION = "' + TAG + '"'), "app.js wizard version bumped");
assert(wiz.includes('GI_WIZARD_BUILD = "' + TAG + '"'), "gi-wizard build tag bumped");

console.log("\n2) top-bar center gate is any logged-in user");
const gate = sliceCanAccess();
assert(gate.includes("canAccessSimulators(){"), "canAccessSimulators body found");
assert(/return !!this\.current;/.test(gate), "gate returns !!this.current");
assert(!/isAdmin/.test(gate) && !/isManager/.test(gate), "gate no longer checks admin/manager");
assert(evalGate({ id: "a1", role: "agent" }) === true, "agent session can open the center");
assert(evalGate({ id: "e1", role: "elementary" }) === true, "elementary session can open the center");
assert(evalGate({ id: "o1", role: "ops" }) === true, "ops session can open the center");
assert(evalGate({ id: "r1", role: "referent" }) === true, "referent session can open the center");
assert(evalGate({ id: "m1", role: "manager" }) === true, "manager session can still open the center");
assert(evalGate({ id: "ad1", role: "admin" }) === true, "admin session can still open the center");
assert(evalGate(null) === false, "logged-out session cannot open the center");
assert(evalGate(undefined) === false, "missing session cannot open the center");

console.log("\n3) button visibility and open() still use the same gate");
assert(app.includes("const allowed = !!(Auth?.current && Auth.canAccessSimulators?.())"), "syncVisibility still requires a session + gate");
assert(html.includes('id="btnSimulatorsCenter"'), "top-bar button still exists");
assert(html.includes('title="מרכז הסימולטורים"'), "top-bar button label unchanged");
assert(app.includes("if(!Auth.canAccessSimulators?.()){"), "click/open still consult the gate");
assert(app.includes("יש להתחבר למערכת לפני פתיחת מרכז הסימולטורים."), "logged-out click still asks to sign in");

console.log("\n4) wizard simulator gate and engines untouched");
assert(/canOpenWizardPolicySimulator\(\)\{\s*return true;/.test(wiz), "wizard simulator still open to every agent");
const renderStart = wiz.indexOf("renderStep5(){");
const renderEnd = wiz.indexOf("renderStep6(ins){", renderStart);
const renderFn = (renderStart >= 0 && renderEnd > renderStart) ? wiz.slice(renderStart, renderEnd) : "";
assert(renderFn.includes("canOpenWizardPolicySimulator"), "step 5 still uses the wizard gate");
assert(!renderFn.includes("Auth.canAccessSimulators"), "step 5 does not use the center gate");
assert(wiz.includes("GI-HEALTH-ONE-DECL"), "one-declaration routing marker still present");
assert(wiz.includes("return this.getPolicyPremiumBeforeDiscount(policy);"), "global after-discount engine untouched");
assert(app.includes("canAccessPersonalAssistant(){"), "personal assistant gate still exists separately");
assert(/canAccessPersonalAssistant\(\)\{\s*return this\.isAdmin\(\) \|\| this\.isManager\(\);/.test(app), "personal assistant stays admin/manager");

if(failed){
  console.error("\nFAILED " + failed + "/" + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + "/" + (passed + failed));
