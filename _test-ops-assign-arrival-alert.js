/* GI-OPS 2026-08-27 — התראת הגעה לתור שיוכי שיקוף:
   צלצול 5 שניות + טוסט קופץ «התקבלה הצעה חדשה» / «שייך לנציג» למנהל תפעול בלבד.
   בלי צלצול על לקוחות שכבר היו בתור בטעינת הדף, ובלי התראה לנציג תפעול.
   הרצה: node _test-ops-assign-arrival-alert.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260906-mirror-script-premiums-v1";
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
const html = read("index.html");
const css = read("app.css");
const sw = read("service-worker.js");

const alertStart = app.indexOf("const OpsAssignArrivalAlert = {");
const alertEnd = app.indexOf("// ---------- Customers UI ----------", alertStart);
const alertBlock = alertStart > 0 && alertEnd > alertStart ? app.slice(alertStart, alertEnd) : "";
const assignStart = app.indexOf("const MirrorAssignmentsUI = {");
const assignEnd = app.indexOf("const ElementaryMirrorUI = {");
const assignBlock = assignStart > 0 && assignEnd > assignStart ? app.slice(assignStart, assignEnd) : "";
const submitStart = app.indexOf("function submitHealthRisksProposalToOps(rec){");
const submitEnd = app.indexOf("/* GI-OPS-SUBMIT-MIRROR-END */", submitStart);
const submitBlock = submitStart > 0 && submitEnd > submitStart ? app.slice(submitStart, submitEnd) : "";
const ringStart = app.indexOf("function playGiPhoneRing(durationMs){");
const ringEnd = app.indexOf("function tryGiSynthChime(){", ringStart);
const ringBlock = ringStart > 0 && ringEnd > ringStart ? app.slice(ringStart, ringEnd) : "";

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-ops-assign-arrival-alert.js")]).status === 0, "node --check this test");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + APP_TAG), "index.html app.css cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");

console.log("\n2) צלצול + טוסט למנהל בלבד");
assert(!!alertBlock, "OpsAssignArrivalAlert נמצא");
assert(!!ringBlock, "playGiPhoneRing נמצא");
assert(ringBlock.includes("const ms = Math.max(400, Number(durationMs) || 5000);"), "ברירת מחדל 5 שניות");
assert(ringBlock.includes("440") && ringBlock.includes("480"), "צלצול כפול-תדר 440/480");
assert(alertBlock.includes("playGiPhoneRing(5000)"), "התראה משמיעה 5 שניות");
assert(alertBlock.includes('title.textContent = "התקבלה הצעה חדשה"'), "כותרת הטוסט");
assert(alertBlock.includes('btn.textContent = "שייך לנציג"'), "לחצן שייך לנציג");
assert(alertBlock.includes("Auth.isOpsAgent()") && alertBlock.includes("return false"), "נציג תפעול מודר");
assert(alertBlock.includes("Auth.canMirrorAssign"), "רק מי שיכול לשייך (מנהל תפעול)");
assert(alertBlock.includes("if(!seenKeys.length)"), "סיד ראשוני בלי צלצול");
assert(alertBlock.includes("openAssignModalForCustomer"), "הלחצן פותח את מודל השיוך הקיים");
assert(css.includes("@keyframes opsAssignArrivalBounce"), "אנימציית קפיצה");
assert(css.includes(".opsAssignArrivalToast"), "עיצוב הטוסט");

console.log("\n3) אותה רשימת תור כמו מסך שיוכי שיקוף");
assert(alertBlock.includes("isHealthRisksWizardCompleted") && alertBlock.includes("hasSubmittedHealthRisksToOps"), "תור = הושלם + הוגש לתפעול");
assert(assignBlock.includes("hasSubmittedHealthRisksToOps"), "מסך השיוך עדיין דורש הגש לתפעול");
assert(assignBlock.includes("OpsAssignArrivalAlert.inspect()"), "רינדור מסך השיוך בודק הגעות");

console.log("\n4) ווים בלי שינוי persist/flow");
assert(app.includes("try { OpsAssignArrivalAlert.inspect(); } catch(_e) {}"), "inspect אחרי מיזוג דלתא");
assert(app.includes("try { OpsAssignArrivalAlert.start(); } catch(_e) {}"), "start עם שאר הצופים");
assert(app.includes("try { OpsAssignArrivalAlert.stop(); } catch(_e) {}"), "stop בלוגאאוט / טיימרים");
assert(submitBlock.includes("submittedToOpsAt: nowISO()"), "חותמת הגש לתפעול לא נגעה");
assert(submitBlock.includes("if(!alreadySubmitted){"), "אין הגשה כפולה");
assert(!submitBlock.includes("OpsAssignArrivalAlert"), "submitHealthRisksProposalToOps לא קורא להתראה ישירות");
assert(html.includes('id="view-mirrorAssignments"'), "מסך שיוכי שיקוף לא הוסר");
assert(html.includes('id="lcSendToOps"'), "הגש לתפעול במסך סיום לא נגע");

console.log("\n5) התנהגות — סיד / לקוח חדש / נציג");

function makeEl(tag){
  const el = {
    tagName: String(tag || "div").toUpperCase(),
    className: "",
    id: "",
    textContent: "",
    innerHTML: "",
    isConnected: true,
    children: [],
    attrs: {},
    listeners: {},
    parent: null,
    setAttribute(k, v){
      this.attrs[k] = String(v);
      if(k === "id") this.id = String(v);
    },
    getAttribute(k){ return this.attrs[k]; },
    appendChild(child){
      this.children.push(child);
      child.parent = this;
    },
    remove(){
      if(!this.parent) return;
      this.parent.children = this.parent.children.filter((x) => x !== this);
      this.parent = null;
    },
    addEventListener(type, fn){
      this.listeners[type] = this.listeners[type] || [];
      this.listeners[type].push(fn);
    },
    click(){
      (this.listeners.click || []).forEach((fn) => fn({
        preventDefault(){},
        stopPropagation(){}
      }));
    }
  };
  return el;
}

function submittedCustomer(id, name){
  return {
    id,
    fullName: name,
    payload: {
      opsProcess: {
        queueSource: "health_risks_wizard",
        submittedToOpsAt: "2026-08-27T10:00:00.000Z"
      },
      newPolicies: [{ id: "p1" }]
    }
  };
}

function loadWatcher(opts){
  const store = Object.assign({}, opts.ls || {});
  const body = makeEl("body");
  const ids = {};
  const sandbox = {
    Auth: opts.auth,
    State: { data: { customers: opts.customers || [] } },
    localStorage: {
      getItem(k){ return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem(k, v){ store[k] = String(v); }
    },
    document: {
      body,
      documentElement: body,
      getElementById(id){ return ids[id] || null; },
      createElement(tag){
        const el = makeEl(tag);
        const origSet = el.setAttribute.bind(el);
        el.setAttribute = function(k, v){
          origSet(k, v);
          if(k === "id") ids[String(v)] = el;
        };
        Object.defineProperty(el, "id", {
          get(){ return el._id || ""; },
          set(v){ el._id = String(v); ids[String(v)] = el; }
        });
        return el;
      }
    },
    window: {
      setTimeout(){ return 1; },
      setInterval(){ return 11; },
      clearInterval(){}
    },
    playGiPhoneRing(ms){
      sandbox.rings.push(ms);
      return function stop(){ sandbox.stopped += 1; };
    },
    isHealthRisksWizardCompleted(c){
      return !!(c && c.payload && (c.payload.opsProcess?.queueSource === "health_risks_wizard" || (c.payload.newPolicies || []).length));
    },
    hasSubmittedHealthRisksToOps(c){
      return !!(c && c.payload && c.payload.opsProcess && c.payload.opsProcess.submittedToOpsAt);
    },
    MirrorCallUI: {
      openAssignModalForCustomer(rec, onDone){
        sandbox.assigns.push({ id: rec && rec.id, name: rec && rec.fullName, onDone: typeof onDone === "function" });
      }
    },
    MirrorAssignmentsUI: { render(){ sandbox.renders += 1; } },
    rings: [],
    assigns: [],
    stopped: 0,
    renders: 0,
    store
  };
  sandbox.window.setTimeout = sandbox.window.setTimeout;
  vm.runInNewContext(alertBlock + "\nthis.result = OpsAssignArrivalAlert;", sandbox);
  const w = sandbox.result;
  w._started = true;
  w._seen = w._load();
  return { w, sandbox };
}

const managerAuth = {
  current: { id: "ops1", name: "מנהל תפעול", role: "ops" },
  isOps(){ return true; },
  isOpsAgent(){ return false; },
  canMirrorAssign(){ return true; }
};
const agentAuth = {
  current: { id: "oa1", name: "נציג", role: "opsAgent" },
  isOps(){ return false; },
  isOpsAgent(){ return true; },
  canMirrorAssign(){ return false; }
};

const existing = submittedCustomer("c-old", "לקוח קיים");
const seedRun = loadWatcher({ auth: managerAuth, customers: [existing], ls: {} });
const seedRes = seedRun.w.inspect();
assert(seedRes.seeded === true && seedRes.announced.length === 0, "סיד לקוחות קיימים בטעינה ראשונה");
assert(seedRun.sandbox.rings.length === 0, "אין צלצול על לקוחות שכבר בתור");
assert(seedRun.sandbox.document.body.children.length === 0, "אין טוסט על לקוחות שכבר בתור");
assert(JSON.parse(seedRun.sandbox.store.gi_ops_assign_arrival_seen_v1)["c-old"] === true, "המזהה הקיים נשמר כנראה");

const reloadRun = loadWatcher({
  auth: managerAuth,
  customers: [existing],
  ls: { gi_ops_assign_arrival_seen_v1: JSON.stringify({ "c-old": true }) }
});
const reloadRes = reloadRun.w.inspect();
assert(reloadRes.seeded === false && reloadRes.announced.length === 0, "רענון דף לא מצלצל שוב");
assert(reloadRun.sandbox.rings.length === 0, "אין צלצול אחרי רענון");

const newbie = submittedCustomer("c-new", "ישראל ישראלי");
const newRun = loadWatcher({
  auth: managerAuth,
  customers: [existing, newbie],
  ls: { gi_ops_assign_arrival_seen_v1: JSON.stringify({ "c-old": true }) }
});
const newRes = newRun.w.inspect();
assert(newRes.announced.join(",") === "c-new", "לקוח חדש בתור מזוהה");
assert(newRun.sandbox.rings.length === 1 && newRun.sandbox.rings[0] === 5000, "צלצול אחד ל-5 שניות");
const host = newRun.sandbox.document.body.children[0];
const toast = host && host.children[0];
assert(!!toast && toast.className === "opsAssignArrivalToast", "טוסט קופץ נוצר");
assert(toast.children[0].textContent === "התקבלה הצעה חדשה", "כותרת בטוסט");
assert(toast.children[1].textContent === "ישראל ישראלי", "שם הלקוח בטוסט");
assert(toast.children[2].textContent === "שייך לנציג", "לחצן שיוך בטוסט");
toast.children[2].click();
assert(newRun.sandbox.assigns.length === 1 && newRun.sandbox.assigns[0].id === "c-new", "שייך לנציג פותח את מודל השיוך");
assert(newRun.sandbox.assigns[0].onDone === true, "אחרי שיוך מרעננים את מסך השיוך");

const pendingOnly = {
  id: "c-pending",
  fullName: "עדיין לא הוגש",
  payload: { opsProcess: { queueSource: "health_risks_wizard" }, newPolicies: [{ id: "p1" }] }
};
const pendingRun = loadWatcher({
  auth: managerAuth,
  customers: [existing, pendingOnly],
  ls: { gi_ops_assign_arrival_seen_v1: JSON.stringify({ "c-old": true }) }
});
const pendingRes = pendingRun.w.inspect();
assert(pendingRes.announced.length === 0 && pendingRun.sandbox.rings.length === 0, "בלי הגש לתפעול אין התראה");

const agentRun = loadWatcher({
  auth: agentAuth,
  customers: [existing, newbie],
  ls: {}
});
const agentRes = agentRun.w.inspect();
assert(agentRes.announced.length === 0 && agentRun.sandbox.rings.length === 0, "נציג תפעול לא מקבל צלצול/טוסט");

const idle = loadWatcher({ auth: managerAuth, customers: [newbie], ls: {} });
idle.w._started = false;
const idleRes = idle.w.inspect();
assert(idleRes.announced.length === 0 && idle.sandbox.rings.length === 0, "בלי start אין התראה");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
