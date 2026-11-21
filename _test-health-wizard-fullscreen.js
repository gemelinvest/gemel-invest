/* Health and risks wizard fills the screen.
   A click on the old outer frame closed the wizard and revealed the dashboard.
   Run: node _test-health-wizard-fullscreen.js
*/
"use strict";

const fs = require("fs");
const path = require("path");

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

function read(name){
  return fs.readFileSync(path.join(ROOT, name), "utf8");
}

const css = read("app.css");
const wiz = read("gi-wizard.js");

const ruleStart = css.indexOf("#lcWizard:not(.is-elementaryFlow) .lcWizard__panel{");
assert(ruleStart >= 0, "health wizard panel has a full-screen rule");
const rule = ruleStart >= 0 ? css.slice(ruleStart, css.indexOf("}", ruleStart) + 1) : "";
assert(rule.includes("inset:0"), "health wizard panel has no outer inset");
assert(rule.includes("border-radius:0"), "health wizard panel has no rounded outer corners");
assert(rule.includes("border:0"), "health wizard panel has no outer border");
assert(rule.includes("height:100dvh"), "health wizard panel uses the full viewport height");
assert(rule.includes("max-height:none"), "the old short panel height does not keep a bottom gap");

const click = wiz.slice(wiz.indexOf("on(this.els.wrap, \"click\""), wiz.indexOf("on(this.els.btnAddIns"));
assert(click.includes("if(!this.isElementaryFlow()) return;"), "a frame click does not close the health wizard");
assert(click.includes("this.close()"), "elementary wizard can still close from its backdrop");

console.log(passed + " passed, " + failed + " failed");
if(failed) process.exit(1);
