/* GI-NP-STAGE 2026-09-03
   שלב פוליסות חדשות לפי המוקאפים: פס הקשר (לקוח / מבוטחים / מונה),
   שלושה מצבים (בחירה → סימולטור משובץ → סיכום שורות), ו«הוסף פוליסה נוספת».
   הסימולטור האמיתי משובץ בגוף השלב במקום חלון צף — בלי לגעת במנועי פרמיה,
   בהצהרת בריאות או במרכז הסימולטורים.
   הרצה: node _test-wizard-np-stage.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260903-np-workspace-v5";
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

function safeTrim(v){ return String(v == null ? "" : v).trim(); }

const wiz = read("gi-wizard.js");
const app = read("app.js");
const html = read("index.html");
const css = read("app.css");
const sw = read("service-worker.js");
const sims = read("gi-simulators.js");
const shellCss = read("simulators-shell.css");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-simulators.js")]).status === 0, "node --check gi-simulators.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(wiz.includes('GI_WIZARD_BUILD = "' + TAG + '"'), "gi-wizard build tag bumped");
assert(app.includes('GI_WIZARD_JS_VERSION = "' + TAG + '"'), "app.js wizard version bumped");
assert(app.includes('GI_SIMULATOR_JS_HREF = "./gi-simulators.js?v=' + TAG + '"'), "simulator chunk cache bumped");
assert(app.includes("simulators-shell.css?v=" + TAG), "shell css cache bumped");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache bumped");
assert(html.includes("app.css?v=" + TAG), "index.html app.css cache bumped");
assert(sw.includes("gi-v12-" + TAG), "service worker cache bumped");

console.log("\n2) context bar — customer / insured pills / policy counter");
assert(wiz.includes("renderNewPolicyContextBar(){"), "context bar renderer exists");
assert(wiz.includes('class="lcNpCtx"'), "context bar markup");
assert(wiz.includes("מבוטחים בהצעה — נשאבים לסימולטור"), "context bar labels the insured pills");
assert(wiz.includes(">פוליסות שנוספו<"), "context bar shows the added-policies counter");
assert(wiz.includes("getWizardContextRole(ins, index){"), "context role helper");
assert(wiz.includes('if(type === "spouse") return "בן / בת זוג";'), "context bar keeps the mockup spouse label");
assert(css.includes(".lcNpCtx{"), "context bar styles");
assert(css.includes(".lcNpCtx__pill{"), "context pill styles");

console.log("\n3) three stages — pick / docked simulator / summary");
assert(wiz.includes('const npStage = workspaceOpen ? "sim"'), "stage resolver exists");
assert(wiz.includes('(hasRows && this._npShowPick !== true) ? "summary" : "pick"'), "summary stage when rows exist and pick not forced");
assert(wiz.includes('class="lcNpWrapper lcNpWrapper--${npStage}"'), "stage class on the wrapper");
assert(wiz.includes('class="lcNpStageHead__title">בחירת חברה ומוצר<'), "pick stage title matches the mockup");
assert(wiz.includes("סיכום הפוליסות בהצעה"), "summary title matches the mockup");
assert(wiz.includes("data-np-add-more"), "add-another-policy control");
assert(wiz.includes("הוסף פוליסה נוספת</button>"), "add-another-policy label");
assert(!wiz.includes("פוליסות שנרכשו להצעה"), "old summary heading replaced");
assert(css.includes(".lcNpStageHead{"), "pick stage head styles");
assert(css.includes(".lcNpSumHead{"), "summary head styles");
assert(css.includes(".lcNpAddMore{"), "add-another-policy styles");

console.log("\n4) the real simulator is docked into the step, not floating");
assert(wiz.includes('id="lcNpSimDock"'), "dock container in the workspace");
assert(wiz.includes("dockNpOpenSimulator(){"), "dock helper");
assert(wiz.includes("undockNpOpenSimulator(){"), "undock helper");
assert(wiz.includes('modal.classList.add("giSimShellModal", "giSimShellModal--docked")'), "docked class applied");
assert(/render\(\)\{\s*if\(!this\.els\.wrap\) return;[\s\S]{0,220}undockNpOpenSimulator\(\)/.test(wiz), "undock runs before the body innerHTML is replaced");
assert(wiz.includes("try { this.dockNpOpenSimulator(); } catch(_eDock) {}"), "dock runs right after the simulator opens");
assert(wiz.includes("try { this.dockNpOpenSimulator(); } catch(_eReDock) {}"), "dock is restored on a repeated step render");
assert(shellCss.includes(".giValModal.giSimShellModal--docked{"), "docked simulator styles");
assert(shellCss.includes("position:relative !important"), "docked simulator is not a fixed overlay");
assert(/giSimShellModal--docked \.giValModal__backdrop\{\s*display:none/.test(shellCss), "docked simulator hides the backdrop");
const dockedCard = shellCss.slice(
  shellCss.indexOf(".giValModal.giSimShellModal--docked .giValModal__card,"),
  shellCss.indexOf(".giValModal.giSimShellModal--docked .giValModal__body{")
);
assert(dockedCard.includes("display:block !important"), "docked card drops the flex column so the body is not shrunk");
assert(dockedCard.includes("height:auto !important"), "docked card grows with its content");
assert(dockedCard.includes("overflow:visible !important"), "docked card does not clip a tall product (health covers list)");
assert(/giSimShellModal--docked \.giValModal__body\{[^}]*flex:0 0 auto !important/.test(shellCss), "docked body keeps its natural height");
assert(/giSimShellModal--docked \.giSimShell__layout\{[^}]*flex:0 0 auto !important/.test(shellCss), "docked two-column layout keeps its natural height");
assert(/giSimShellModal--docked \.giSimShell__brandLogo\{[^}]*left:16px !important/.test(shellCss), "docked gmail logo moves off the company title");
assert(css.includes(".lcNpSimDock:not(:empty) + .lcNpWsHint{display:none}"), "reopen hint hidden while docked");
assert(wiz.includes("החלפת חברה ומוצר לכל מבוטח מתבצעת בתוך הסימולטור"), "outer switch is not duplicated when the simulator is docked");

console.log("\n5) closing the simulator returns the step to pick / summary");
assert(sims.includes("onWizardClose"), "simulator exposes a wizard-close hook");
assert(sims.includes("const closeAndNotify = () => {"), "close hook fires after the real close");
assert(wiz.includes("handleWizardSimulatorClose(){"), "wizard close handler");
assert(wiz.includes("onWizardClose: () => this.handleWizardSimulatorClose()"), "handler wired into the simulator ctx");
assert(/closeNpOpenSimulator\(\)\{[\s\S]*?_npSimKeepWorkspace = true;[\s\S]*?handler\?\.close\?\.\(\);[\s\S]*?_npSimKeepWorkspace = false;/.test(wiz), "wizard-initiated close does not bounce back to pick");
assert(wiz.includes("this._npSimSkipCloseCleanup = true;"), "adding to the proposal skips the pick bounce");

console.log("\n6) untouched — declaration routing, premium engine, simulators center");
assert(/canAccessSimulators\(\)\{\s*return this\.isAdmin\(\) \|\| this\.isManager\(\);/.test(app), "Simulators Center gate still admin/manager");
assert(/canOpenWizardPolicySimulator\(\)\{\s*return true;/.test(wiz), "wizard simulator still open to every agent");
assert(wiz.includes("return this.getPolicyPremiumBeforeDiscount(policy);"), "global after-discount engine untouched");
assert(wiz.includes("GI-HEALTH-ONE-DECL"), "one-declaration routing marker still present");
assert(sims.includes("const addInsHtml = sim._ctx.standalone"), "add-insured stays standalone-only");
assert(sims.includes(">הוסף להצעה<"), "approved purchase label kept");
assert(sims.includes("data-gishell-legal-confirm"), "approved pledge confirm kept");

console.log("\n7) runtime — stage transitions and docking on real Wizard methods");
const host = new Proxy({
  Wizard: {},
  safeTrim,
  escapeHtml: (s) => String(s == null ? "" : s),
  on(){}, $(){ return null; }, $$(){ return []; },
  nowISO: () => "2026-09-03T10:00:00.000Z"
}, {
  get(target, prop){
    if(prop in target) return target[prop];
    if(prop === "then") return undefined;
    return () => {};
  }
});

function makeNode(id){
  const node = {
    id: id || "",
    children: [],
    parentElement: null,
    classList: {
      _s: new Set(),
      add(...c){ c.forEach((x) => this._s.add(x)); },
      remove(...c){ c.forEach((x) => this._s.delete(x)); },
      contains(c){ return this._s.has(c); }
    },
    appendChild(child){
      if(child.parentElement){
        child.parentElement.children = child.parentElement.children.filter((x) => x !== child);
      }
      child.parentElement = node;
      node.children.push(child);
      return child;
    },
    querySelector(sel){
      const want = String(sel).replace(/^#/, "");
      const walk = (n) => {
        for(const c of n.children){
          if(c.id === want) return c;
          const hit = walk(c);
          if(hit) return hit;
        }
        return null;
      };
      return walk(node);
    },
    querySelectorAll(){ return []; }
  };
  return node;
}

const fakeBody = makeNode("body");
const sandbox = {
  __GI_WIZARD_HOST: host,
  globalThis: null,
  window: { requestAnimationFrame(fn){ fn(); }, setTimeout(fn){ return fn(); }, clearTimeout(){}, showToast(){} },
  document: {
    getElementById(){ return null; },
    createElement(){ return makeNode(""); },
    querySelectorAll(){ return []; },
    querySelector(){ return null; },
    addEventListener(){}, removeEventListener(){},
    body: fakeBody
  },
  console
};
sandbox.globalThis = sandbox;

let W = null;
try {
  vm.runInNewContext(wiz, sandbox, { filename: "gi-wizard.js" });
  W = host.Wizard;
  assert(typeof W.renderNewPolicyContextBar === "function", "Wizard chunk loaded into VM");
} catch(err){
  assert(false, "Wizard chunk loaded into VM (" + err.message + ")");
}

if(W && typeof W.renderNewPolicyContextBar === "function"){
  const insureds = [
    { id:"i1", type:"primary", label:"מבוטח ראשי - דוד כהן", data:{ firstName:"דוד", lastName:"כהן" } },
    { id:"i2", type:"spouse", label:"מבוטח משני בן / בת זוג - יעל כהן", data:{ firstName:"יעל", lastName:"כהן" } },
    { id:"i3", type:"child", label:"מבוטח משני ילד - נועם כהן", data:{ firstName:"נועם", lastName:"כהן" } }
  ];
  W.insureds = insureds;
  let policies = [];
  W.getWizardNewPolicies = () => policies;

  const barEmpty = W.renderNewPolicyContextBar();
  assert(barEmpty.includes("דוד כהן"), "context bar shows the primary customer name");
  assert(barEmpty.includes("דוד כהן · מבוטח ראשי"), "primary pill uses the mockup role");
  assert(barEmpty.includes("יעל כהן · בן / בת זוג"), "spouse pill uses the mockup role");
  assert(barEmpty.includes("נועם כהן · ילד"), "child pill uses the mockup role");
  assert(/פוליסות שנוספו<\/span><b>0<\/b>/.test(barEmpty), "counter is 0 before any policy");

  policies = [{ id:"p1", company:"הפניקס", type:"בריאות" }];
  const barOne = W.renderNewPolicyContextBar();
  assert(/פוליסות שנוספו<\/span><b>1<\/b>/.test(barOne), "counter follows the added policies");

  // ── stage transitions on close ──
  let renders = 0;
  W.render = () => { renders += 1; };
  W.isOpen = true;
  W.step = 5;
  W.policyDraft = null;
  W.ensurePolicyDraft = function(){
    if(!this.policyDraft) this.policyDraft = { company:"", type:"", insuredIds:[] };
    return this.policyDraft;
  };

  policies = [];
  W.policyDraft = { company:"הפניקס", type:"בריאות", insuredIds:["i1"] };
  W._npShowPick = false;
  W._npSimKeepWorkspace = false;
  W._npSimSkipCloseCleanup = false;
  W._npOpenSimHandler = { _modal: makeNode("simModal") };
  W.handleWizardSimulatorClose();
  assert(W.policyDraft.company === "" && W.policyDraft.type === "", "closing the simulator clears company/product");
  assert(W._npShowPick === true, "with no policies the step returns to pick");
  assert(W._npOpenSimHandler === null, "closed simulator handler released");
  assert(renders === 1, "close triggers exactly one step render");

  policies = [{ id:"p1", company:"הפניקס", type:"בריאות" }];
  W.policyDraft = { company:"כלל", type:"ריסק", insuredIds:["i1"] };
  W._npShowPick = true;
  W._npOpenSimHandler = { _modal: makeNode("simModal2") };
  W.handleWizardSimulatorClose();
  assert(W._npShowPick === false, "with policies already added the step returns to the summary");

  // wizard-initiated close must not bounce back to pick
  let closed = 0;
  W.policyDraft = { company:"מגדל", type:"ריסק", insuredIds:["i1"] };
  W._npShowPick = false;
  W._npOpenSimHandler = { _modal: makeNode("simModal3"), close(){ closed += 1; W.handleWizardSimulatorClose(); } };
  W.closeNpOpenSimulator();
  assert(closed === 1, "closeNpOpenSimulator closes the handler");
  assert(W.policyDraft.company === "מגדל" && W.policyDraft.type === "ריסק", "wizard-initiated close keeps company/product");
  assert(W._npSimKeepWorkspace === false, "keep-workspace guard is released after the close");

  // purchase path: sim closes itself, step must stay on the summary
  W.policyDraft = { company:"הפניקס", type:"ריסק", insuredIds:["i1"] };
  W._npSimSkipCloseCleanup = true;
  W._npShowPick = false;
  W._npOpenSimHandler = { _modal: makeNode("simModal4") };
  W.handleWizardSimulatorClose();
  assert(W.policyDraft.company === "הפניקס", "close right after adding to the proposal does not reset the draft");
  assert(W._npSimSkipCloseCleanup === false, "skip flag is consumed once");

  // ── docking ──
  const wizardBody = makeNode("wizardBody");
  const dock = makeNode("lcNpSimDock");
  wizardBody.appendChild(dock);
  fakeBody.appendChild(wizardBody);
  const modal = makeNode("dockMe");
  fakeBody.appendChild(modal);
  W.els = { body: wizardBody, wrap: makeNode("wrap") };
  W._npOpenSimHandler = { _modal: modal };

  W.dockNpOpenSimulator();
  assert(modal.parentElement === dock, "dock moves the simulator into the step work area");
  assert(modal.classList.contains("giSimShellModal--docked"), "docked class added");
  assert(modal.classList.contains("giSimShellModal"), "shell class kept while docked");

  W.undockNpOpenSimulator();
  assert(modal.parentElement === fakeBody, "undock parks the simulator back on document.body");
  assert(dock.children.length === 0, "dock is empty after undock");

  W.dockNpOpenSimulator();
  assert(modal.parentElement === dock, "re-dock after a render puts the simulator back");

  // no dock element (other step) → simulator parked on body, never lost
  W.els = { body: makeNode("otherStepBody"), wrap: makeNode("wrap") };
  W.dockNpOpenSimulator();
  assert(modal.parentElement === fakeBody, "without a dock the simulator is parked on body instead of being dropped");
}

if(failed){
  console.error("\nFAILED  passed=" + passed + " failed=" + failed);
  process.exit(1);
}
console.log("\nOK " + passed + "/" + (passed + failed));
