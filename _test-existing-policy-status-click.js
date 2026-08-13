/* GI-FIX 2026-08-13 — רגרסיה: צ'יפי סטטוס פוליסה אחרי ייבוא הר הביטוח.
   מריץ את המתודות האמיתיות מתוך gi-wizard.js בלי DOM מלא.
   הרצה: node _test-existing-policy-status-click.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const WIZARD_FILE = path.join(ROOT, "gi-wizard.js");
let failed = 0;
let passed = 0;

function assert(cond, msg){
  if(cond){
    passed += 1;
    console.log("  PASS  " + msg);
  }else{
    failed += 1;
    console.error("  FAIL  " + msg);
  }
}

function safeTrim(v){
  return String(v == null ? "" : v).trim();
}

function createBody(){
  const listeners = { click: [] };
  return {
    _giExistingPolicyActionBound: false,
    style: {},
    innerHTML: "",
    removeAttribute(){},
    addEventListener(evt, fn){
      (listeners[evt] || (listeners[evt] = [])).push(fn);
    },
    contains(){ return true; },
    dispatchClick(target){
      const ev = { target, preventDefault(){ this._prevented = true; } };
      (listeners.click || []).forEach((fn) => fn(ev));
      return ev;
    },
    listenerCount(evt){
      return (listeners[evt] || []).length;
    }
  };
}

function makeChip(pid, value, key){
  const el = {
    getAttribute(name){
      const map = {
        "data-cancel-policy": pid,
        "data-cancel-key": key || "status",
        "data-cancel-chip-value": value
      };
      return Object.prototype.hasOwnProperty.call(map, name) ? map[name] : null;
    },
    closest(sel){
      if(sel === ".lcPartialCovers__item") return null;
      if(sel === "[data-cancel-exec-option]") return null;
      if(sel === "[data-cancel-chip-value]") return el;
      return null;
    }
  };
  return el;
}

function makeExecBtn(pid, value){
  const el = {
    getAttribute(name){
      const map = {
        "data-cancel-policy": pid,
        "data-cancel-key": "executionMethod",
        "data-cancel-exec-option": value
      };
      return Object.prototype.hasOwnProperty.call(map, name) ? map[name] : null;
    },
    closest(sel){
      if(sel === ".lcPartialCovers__item") return null;
      if(sel === "[data-cancel-exec-option]") return el;
      return null;
    }
  };
  return el;
}

function makeCoverItem(pid, label, cb){
  const item = {
    querySelector(sel){
      if(sel === ".lcPartialCovers__cb") return cb;
      return null;
    },
    closest(sel){
      if(sel === ".lcPartialCovers__item") return item;
      return null;
    }
  };
  cb.closest = (sel) => {
    if(sel === ".lcPartialCovers__item") return item;
    return null;
  };
  return item;
}

function makeCoverCb(pid, label){
  return {
    getAttribute(name){
      const map = {
        "data-cancel-policy": pid,
        "data-cover-label": label
      };
      return Object.prototype.hasOwnProperty.call(map, name) ? map[name] : null;
    }
  };
}

console.log("1) syntax check gi-wizard.js");
const syntax = spawnSync(process.execPath, ["--check", WIZARD_FILE], { encoding: "utf8" });
assert(syntax.status === 0, "node --check gi-wizard.js");
if(syntax.status !== 0){
  console.error(syntax.stderr || syntax.stdout);
}

console.log("\n2) source contracts (binding, not business logic)");
const src = fs.readFileSync(WIZARD_FILE, "utf8");
assert(src.includes("ensureExistingPolicyActionDelegation"), "delegation helper exists");
assert(src.includes("handleExistingPolicyActionClick"), "delegated click handler exists");
assert(src.includes("unlockExistingPolicyActionsAfterHarImport"), "post-import unlock exists");
assert(/root\._giExistingPolicyActionBound/.test(src), "binds once on wizard body");
assert(/on\(root,\s*"click"/.test(src), "click listener is on the persistent body");
assert(/if\(el\.matches && el\.matches\("button, \.lcPartialCovers__cb"\)\) return;/.test(src), "bindInputs skips status/cover buttons");
assert(!/\$\$\("\[data-cancel-chip-value\]"/.test(src), "no per-chip querySelectorAll binding");
assert(src.includes('try { this.unlockExistingPolicyActionsAfterHarImport(); } catch(_e) {}'), "unlock runs after successful Har import");

const optsBlock = src.match(/getExistingPolicyCancelOptions\(\)\{\s*return\s*\[([\s\S]*?)\];\s*\},/);
assert(!!optsBlock, "cancel options helper still present");
if(optsBlock){
  const expected = [
    '{v:"full", t:"ביטול מלא"}',
    '{v:"partial_health", t:"ביטול חלקי"}',
    '{v:"nochange_client", t:"ללא שינוי – לבקשת הלקוח"}',
    '{v:"agent_appoint", t:"מינוי סוכן"}',
    '{v:"nochange_collective", t:"ללא שינוי – קולקטיב"}'
  ];
  expected.forEach((item) => assert(optsBlock[1].includes(item), "option unchanged: " + item));
}

console.log("\n3) load real wizard methods");
const host = new Proxy({
  Wizard: {},
  safeTrim,
  escapeHtml: (s) => String(s == null ? "" : s),
  on: (el, evt, fn) => el && el.addEventListener && el.addEventListener(evt, fn),
  $: () => null,
  $$: () => [],
  nowISO: () => "2026-08-13T06:00:00.000Z",
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
  document: {
    getElementById(){ return null; }
  },
  console
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
sandbox.CustomersUI = host.CustomersUI;

try{
  vm.runInNewContext(src, sandbox, { filename: "gi-wizard.js" });
  assert(typeof host.Wizard.handleExistingPolicyActionClick === "function", "wizard methods installed");
}catch(err){
  assert(false, "load gi-wizard.js: " + (err && err.message));
  console.error(err);
}

const W = host.Wizard;
if(typeof W.handleExistingPolicyActionClick === "function"){
  console.log("\n4) status row ensure + first-click after innerHTML replace");
  const body = createBody();
  const ins = {
    id: "ins1",
    data: {
      existingPolicies: [{ id: "p1", company: "כלל" }],
      cancellations: {}
    }
  };
  let renderCount = 0;
  W.els = { body };
  W.step = 3;
  W.isElementaryFlow = () => false;
  W.getActive = () => ins;
  W.render = () => { renderCount += 1; };

  W.ensureExistingPolicyActionDelegation();
  assert(body.listenerCount("click") === 1, "first bind attaches one click listener");
  body.innerHTML = '<button data-cancel-chip-value="full"></button>';
  W.ensureExistingPolicyActionDelegation();
  assert(body.listenerCount("click") === 1, "re-bind after innerHTML replace does not duplicate listeners");

  body.dispatchClick(makeChip("p1", "full"));
  assert(ins.data.cancellations.p1 && ins.data.cancellations.p1.status === "full", "first click writes status=full");
  assert(ins.data.cancellations.p1.executionMethod === "agent", "full cancel defaults executionMethod=agent");
  assert(renderCount === 1, "first click triggers render");
  assert(host.CustomersUI.stamps.length === 1 && host.CustomersUI.stamps[0].pid === "p1", "agent appointment stamp sync on status");

  console.log("\n5) remaining statuses + execution method + partial covers");
  body.dispatchClick(makeChip("p1", "nochange_client"));
  assert(ins.data.cancellations.p1.status === "nochange_client", "status=nochange_client");
  assert(!ins.data.cancellations.p1.executionMethod, "non-cancel status clears executionMethod");

  body.dispatchClick(makeChip("p1", "partial_health"));
  assert(ins.data.cancellations.p1.status === "partial_health", "status=partial_health");
  assert(ins.data.cancellations.p1.executionMethod === "agent", "partial cancel defaults executionMethod=agent");

  ins.data.cancellations.p1.executionMethod = "client";
  body.dispatchClick(makeChip("p1", "full"));
  assert(ins.data.cancellations.p1.executionMethod === "client", "manual executionMethod is kept when switching full/partial");

  body.dispatchClick(makeExecBtn("p1", "company"));
  assert(ins.data.cancellations.p1.executionMethod === "company", "execution chip writes executionMethod");

  const cb = makeCoverCb("p1", "אמבולטורי");
  const coverItem = makeCoverItem("p1", "אמבולטורי", cb);
  body.dispatchClick(cb);
  assert(Array.isArray(ins.data.cancellations.p1.partialCovers) && ins.data.cancellations.p1.partialCovers.includes("אמבולטורי"), "partial cover toggle on");
  body.dispatchClick(coverItem);
  assert(!ins.data.cancellations.p1.partialCovers.includes("אמבולטורי"), "partial cover toggle off");

  console.log("\n6) guards: other steps / elementary / missing row");
  const before = JSON.stringify(ins.data.cancellations);
  W.step = 2;
  body.dispatchClick(makeChip("p1", "agent_appoint"));
  assert(JSON.stringify(ins.data.cancellations) === before, "ignores clicks outside step 3");
  W.step = 3;
  W.isElementaryFlow = () => true;
  body.dispatchClick(makeChip("p1", "agent_appoint"));
  assert(JSON.stringify(ins.data.cancellations) === before, "ignores clicks in elementary flow");
  W.isElementaryFlow = () => false;

  const row = W.ensureExistingPolicyCancellationRow({ data: {} }, "p-new");
  assert(!!row && row.attachments && typeof row.attachments === "object", "ensure row creates cancellations + attachments");

  console.log("\n7) unlock after har import restores pointer-events");
  body.style.pointerEvents = "none";
  body.setAttribute = () => {};
  W.unlockExistingPolicyActionsAfterHarImport();
  assert(body.style.pointerEvents === "auto", "unlock restores pointer-events on wizard body");
  assert(body.listenerCount("click") === 1, "unlock does not add a second listener");
}

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
