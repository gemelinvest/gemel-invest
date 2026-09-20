/* GI-EXIST-POL-STATUS-DD 2026-09-19
   עמודת פעולות בטבלת הר הביטוח: דרופדאון במקום כל הצ'יפים פתוחים.
   אותן אופציות, אותו data-cancel-key=status, אותה כתיבה ל-cancellations.
   הרצה: node _test-existing-policy-status-dropdown.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260919-exist-pol-status-dd-v1";
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

function safeTrim(v){
  return String(v == null ? "" : v).trim();
}

function makeStatusSelect(pid, initial){
  const listeners = { change: [], input: [] };
  const el = {
    tagName: "SELECT",
    type: "select-one",
    value: initial || "",
    matches(sel){
      return sel !== "button, .lcPartialCovers__cb";
    },
    getAttribute(name){
      const map = {
        "data-cancel-policy": pid,
        "data-cancel-key": "status"
      };
      return Object.prototype.hasOwnProperty.call(map, name) ? map[name] : null;
    },
    addEventListener(evt, fn){
      (listeners[evt] || (listeners[evt] = [])).push(fn);
    },
    dispatch(evt){
      (listeners[evt] || []).forEach((fn) => fn());
    }
  };
  return el;
}

const wizard = read("gi-wizard.js");
const app = read("app.js");
const html = read("index.html");
const css = read("app.css");
const theme = read("theme.css");

console.log("1) cache + syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(app.includes('const BUILD = "' + TAG + '"'), "app.js BUILD");
assert(app.includes('GI_WIZARD_JS_VERSION = "' + TAG + '"'), "app.js wizard version");
assert(wizard.includes('GI_WIZARD_BUILD = "' + TAG + '"'), "gi-wizard build");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + TAG), "index.html app.css cache");

console.log("\n2) compact actions are a dropdown, options unchanged");
assert(wizard.includes("GI-EXIST-POL-STATUS-DD 2026-09-19"), "dropdown mark");
assert(wizard.includes('class="input lcHarCompactStatus"'), "compact status select class");
assert(wizard.includes('data-cancel-key="status" aria-label="סטטוס פעולה"'), "select writes status");
assert(wizard.includes("this.getExistingPolicyCancelOptions().map((o) =>"), "dropdown uses the same options helper");
assert(!/if\(part === "chips"\)\{[\s\S]{0,400}chipsHtml/.test(wizard), "compact part does not render all chips");
assert(css.includes("GI-EXIST-POL-STATUS-DD 2026-09-19"), "app.css dropdown mark");
assert(theme.includes(".lcHarCompactChips--select"), "theme.css dropdown lock");
assert(wizard.includes('data-cancel-key="status" data-cancel-chip-value="${escapeHtml(o.v)}"'), "non-compact chips still exist");

const optsBlock = wizard.match(/getExistingPolicyCancelOptions\(\)\{\s*return\s*\[([\s\S]*?)\];\s*\},/);
assert(!!optsBlock, "cancel options helper still present");
if(optsBlock){
  [
    '{v:"full", t:"ביטול מלא"}',
    '{v:"partial_health", t:"ביטול חלקי"}',
    '{v:"nochange_client", t:"ללא שינוי – לבקשת הלקוח"}',
    '{v:"agent_appoint", t:"מינוי סוכן"}',
    '{v:"nochange_collective", t:"ללא שינוי – קולקטיב"}'
  ].forEach((item) => assert(optsBlock[1].includes(item), "option unchanged: " + item));
}

console.log("\n3) כיסויים / קליק צ'יפ קיים לא נשברו");
assert(wizard.includes('premiumBreakdown.map(item => `<span class="lcHarCompactCover"><b>${escapeHtml(safeTrim(item.label) || \'כיסוי\')}</b><span>${escapeHtml(safeTrim(item.monthlyPremium) || \'0.00\')} ₪</span></span>`'), "cover HTML unchanged");
const clickTest = spawnSync(process.execPath, [path.join(ROOT, "_test-existing-policy-status-click.js")], { encoding: "utf8" });
assert(clickTest.status === 0, "_test-existing-policy-status-click.js still passes");
if(clickTest.status !== 0){
  console.error(clickTest.stdout || "");
  console.error(clickTest.stderr || "");
}

console.log("\n4) change בדרופדאון כותב את אותו סטטוס");
const cancelFields = [];
const host = new Proxy({
  Wizard: {},
  safeTrim,
  escapeHtml: (s) => String(s == null ? "" : s),
  on: (el, evt, fn) => el && el.addEventListener && el.addEventListener(evt, fn),
  $: () => null,
  $$: (sel) => {
    if(String(sel).includes("data-cancel-policy") && !String(sel).includes("data-bind")) return cancelFields;
    return [];
  },
  nowISO: () => "2026-09-19T23:52:00.000Z",
  prepareInteractiveWizardOpen: () => {},
  CustomersUI: {
    stamps: [],
    syncAgentAppointmentStampForInsured(ins, pid, ts){
      this.stamps.push({ pid, ts });
    }
  }
}, {
  get(target, prop){
    if(prop in target) return target[prop];
    if(prop === "then") return undefined;
    return () => {};
  }
});

const sandbox = {
  __GI_WIZARD_HOST: host,
  globalThis: null,
  window: null,
  document: { getElementById(){ return null; } },
  console
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
sandbox.CustomersUI = host.CustomersUI;

try{
  vm.runInNewContext(wizard, sandbox, { filename: "gi-wizard.js" });
  assert(typeof host.Wizard.bindInputs === "function", "wizard bindInputs installed");
}catch(err){
  assert(false, "load gi-wizard.js: " + (err && err.message));
  console.error(err);
}

const W = host.Wizard;
if(typeof W.bindInputs === "function"){
  const body = { style: {}, removeAttribute(){}, addEventListener(){}, contains(){ return true; } };
  const ins = {
    id: "ins1",
    data: {
      existingPolicies: [{ id: "p1", company: "הפניקס" }],
      cancellations: {}
    }
  };
  let renderCount = 0;
  W.els = { body };
  W.step = 3;
  W.isElementaryFlow = () => false;
  W.getActive = () => ins;
  W.render = () => { renderCount += 1; };

  const select = makeStatusSelect("p1", "");
  cancelFields.push(select);
  W.bindInputs(ins);

  select.value = "full";
  select.dispatch("change");
  assert(ins.data.cancellations.p1 && ins.data.cancellations.p1.status === "full", "dropdown change writes status=full");
  assert(ins.data.cancellations.p1.executionMethod === "agent", "full cancel still defaults executionMethod=agent");
  assert(renderCount >= 1, "dropdown change triggers render");
  assert(host.CustomersUI.stamps.length === 1 && host.CustomersUI.stamps[0].pid === "p1", "agent stamp still syncs on status");

  select.value = "partial_health";
  select.dispatch("change");
  assert(ins.data.cancellations.p1.status === "partial_health", "dropdown change writes status=partial_health");
  assert(ins.data.cancellations.p1.executionMethod === "agent", "partial cancel keeps default executionMethod");

  select.value = "nochange_client";
  select.dispatch("change");
  assert(ins.data.cancellations.p1.status === "nochange_client", "dropdown change writes status=nochange_client");
  assert(!ins.data.cancellations.p1.executionMethod, "non-cancel status still clears executionMethod");

  select.value = "agent_appoint";
  select.dispatch("change");
  assert(ins.data.cancellations.p1.status === "agent_appoint", "dropdown change writes status=agent_appoint");

  select.value = "nochange_collective";
  select.dispatch("change");
  assert(ins.data.cancellations.p1.status === "nochange_collective", "dropdown change writes status=nochange_collective");
}

console.log("\n" + passed + " passed, " + failed + " failed");
if(failed) process.exit(1);
