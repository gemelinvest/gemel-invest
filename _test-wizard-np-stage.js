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
const TAG = "20260903-np-workspace-v7";
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

console.log("\n2) the context bar above the picker is gone");
assert(!wiz.includes("renderNewPolicyContextBar"), "context bar renderer removed");
assert(!wiz.includes("getWizardContextRole"), "context role helper removed");
assert(!wiz.includes("getWizardContextInsuredName"), "context name helper removed");
assert(!wiz.includes("lcNpCtx"), "no context bar markup left in the wizard");
assert(!wiz.includes("מבוטחים בהצעה — נשאבים לסימולטור"), "context bar copy removed");
assert(!css.includes(".lcNpCtx"), "context bar styles removed");

console.log("\n3) three stages — pick / docked simulator / summary");
assert(wiz.includes('const npStage = workspaceOpen ? "sim"'), "stage resolver exists");
assert(wiz.includes('(hasRows && this._npShowPick !== true) ? "summary" : "pick"'), "summary stage when rows exist and pick not forced");
assert(wiz.includes('class="lcNpWrapper lcNpWrapper--${npStage}"'), "stage class on the wrapper");
assert(wiz.includes("סיכום הפוליסות בהצעה"), "summary title kept");
assert(!wiz.includes('class="lcNpStageHead__title">בחירת חברה ומוצר<'), "pick stage head title removed");
assert(!wiz.includes("בחרו חברה ומוצר מהרשימות"), "pick stage head explanation removed");
assert(!wiz.includes("כל פוליסה בשורת סיכום: לוגו"), "summary explanation removed");
assert(!wiz.includes("lcNpInlineHero"), "new-policies hero header removed");
assert(!wiz.includes("הוספת פוליסה חדשה להצעה"), "new-policies hero subtitle removed");
assert(!wiz.includes('class="lcNpPickCard__title">חברה ומוצר<'), "pick card title removed");
assert(wiz.includes("data-np-add-more"), "add-another-policy control");
assert(wiz.includes("הוסף פוליסה נוספת</button>"), "add-another-policy label");
assert(!wiz.includes("פוליסות שנרכשו להצעה"), "old summary heading replaced");
assert(!css.includes(".lcNpStageHead{"), "pick stage head styles removed");
assert(css.includes(".lcNpSumHead{"), "summary head styles");
assert(css.includes(".lcNpAddMore{"), "add-another-policy styles");

console.log("\n3b) health row shows covers behind a button, not a dense line");
assert(wiz.includes("הצג כיסוי בפוליסה"), "show-covers button label");
assert(wiz.includes('data-np-show-covers='), "show-covers button wiring");
assert(wiz.includes("_npCoversOpenId"), "covers panel open state");
assert(!/detailText = \(p\.type === \"בריאות\"\)\s*\?\s*\(`כיסויים: \$\{coverSummary\}`\)/.test(wiz), "dense covers line removed from health rows");
assert(css.includes(".lcNpProw__coversBtn"), "covers button styles");
assert(css.includes(".lcNpProw__coversList"), "covers list styles");

console.log("\n3c) sum-insured field has no example placeholder");
assert(!sims.includes('placeholder="לדוגמה: 1,000,000"'), "simulator no longer shows 1,000,000 example");
assert(!sims.includes('placeholder="1,000,000"'), "simulator no longer shows bare 1,000,000 placeholder");
assert(!wiz.includes('placeholder="לדוגמה: 1,000,000"'), "wizard draft sum field has no example");

console.log("\n3d) edit reopens the simulator with the saved data");
assert(wiz.includes("buildSimulatorRestoreState(draft){"), "restore-state builder exists");
assert(wiz.includes("buildSimulatorRestoreDiscount(draft){"), "restore-discount builder exists");
assert(wiz.includes("simStateByInsured"), "policy stores a simulator state snapshot");
assert(wiz.includes("restoreState: restoreState || undefined"), "open passes restoreState into the simulator");
assert(wiz.includes("restoreDiscountByInsured: restoreDiscountByInsured || undefined"), "open passes the selected discount back");
assert(sims.includes("payload.simStateSnapshot = riskSimJsonClone(stSnap)"), "purchase snapshots the active insured state");
assert(sims.includes("restoreDiscountByInsured"), "simulator shell accepts restoreDiscountByInsured");
assert(/startEditNewPolicy\(pid\)\{[\s\S]*?simStateByInsured: \(p\.simStateByInsured/.test(wiz), "edit copies the snapshot onto the draft");
assert(/startEditNewPolicy\(pid\)\{[\s\S]*?this\._npShowPick = false;/.test(wiz), "edit stays in the simulator/summary workspace");
assert(/startEditNewPolicy\(pid\)\{[\s\S]*?closeNpOpenSimulator\(\)/.test(wiz), "edit closes any open simulator before reopening");

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

console.log("\n5b) simulator discount reaches the summary row");
assert(sims.includes("function riskSimSelectedDiscountPayload(sim, result){"), "simulator builds a discount payload for the wizard");
assert(sims.includes("monthlyAfterDiscount:"), "payload carries the already-computed after-discount price");
assert(sims.includes("year1Pct: giSimDiscountYear1Pct(opt)"), "payload carries the year-1 percent");
assert(sims.includes("schedule: Array.isArray(opt.schedule)") || sims.includes("const schedule = Array.isArray(opt.schedule)"), "payload carries the multi-year schedule");
assert(/giSimDiscountYear1Pct\(opt\)\{[\s\S]{0,200}opt\.schedule\[0\]/.test(sims) || /function giSimDiscountYear1Pct\(opt\)\{[\s\S]{0,220}schedule\[0\]/.test(sims), "year-1 percent is the first year of the schedule");
assert(sims.includes("const payload = discount ? Object.assign({}, result, { simDiscount: discount }) : Object.assign({}, result);"), "purchase sends the discount alongside the result");
assert(sims.includes("sim._ctx.onPurchaseInsured?.(insId, payload, legal)"), "purchase hook receives the enriched payload");
assert(wiz.includes("simDiscountPerInsured"), "wizard stores the per-insured after-discount price");
assert(wiz.includes("getPolicySimDiscountAfterTotal(policy){"), "row total helper exists");
assert(wiz.includes("syncDraftDiscountFromSimulator(draft){"), "discount percent/schedule mirrored for the row chips");
const rowAfter = wiz.slice(wiz.indexOf("getHealthRowPremiumAfterDiscount(policy){"), wiz.indexOf("applyAllProposalInsuredsToDraft(){"));
assert(rowAfter.includes("getPolicySimDiscountAfterTotal(policy)"), "row after-discount consults the simulator discount");
assert(rowAfter.includes("return this.getPolicyPremiumAfterDiscount(policy);"), "row still falls back to the existing engine");
assert(/getPolicyPremiumAfterDiscount\(policy\)\{[\s\S]{0,320}return this\.getPolicyPremiumBeforeDiscount\(policy\);/.test(wiz), "global after-discount engine itself is unchanged");
assert(wiz.includes("simDiscountPerInsured: (d.simDiscountPerInsured"), "discount is copied from the draft onto the policy");
assert(wiz.includes("simDiscountPerInsured: (p.simDiscountPerInsured"), "discount survives editing an added policy");

console.log("\n5c) company logo in the summary row has no frame");
const rowLogo = css.slice(css.indexOf(".lcNpProw .lcCompanyLogo,.lcNpProw img{"), css.indexOf(".lcNpProw__title{"));
assert(rowLogo.includes("border:0"), "row logo has no border");
assert(rowLogo.includes("background:transparent"), "row logo has no white plate");
assert(rowLogo.includes("padding:0"), "row logo has no inner padding");
assert(rowLogo.includes("box-shadow:none"), "row logo has no shadow");
assert(/width:128px;height:70px/.test(rowLogo), "row logo is bigger so it reads clearly");
assert(rowLogo.includes("object-fit:contain"), "row logo is never cropped");

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
  assert(typeof W.dockNpOpenSimulator === "function", "Wizard chunk loaded into VM");
} catch(err){
  assert(false, "Wizard chunk loaded into VM (" + err.message + ")");
}

if(W && typeof W.dockNpOpenSimulator === "function"){
  const insureds = [
    { id:"i1", type:"primary", label:"מבוטח ראשי - דוד כהן", data:{ firstName:"דוד", lastName:"כהן" } },
    { id:"i2", type:"spouse", label:"מבוטח משני בן / בת זוג - יעל כהן", data:{ firstName:"יעל", lastName:"כהן" } },
    { id:"i3", type:"child", label:"מבוטח משני ילד - נועם כהן", data:{ firstName:"נועם", lastName:"כהן" } }
  ];
  W.insureds = insureds;
  let policies = [];
  W.getWizardNewPolicies = () => policies;

  // ── simulator discount lands on the row ──
  const riskPolicy = {
    id:"pR", company:"הפניקס", type:"ריסק",
    insuredIds:["i1"], insuredId:"i1",
    premiumPerInsured:{ i1:"200" },
    simDiscountPerInsured:{ i1:{ optionId:"phx-r-100-50", label:"50/50/40/30/20/15", year1Pct:50, years:6, schedule:[50,50,40,30,20,15], monthlyAfterDiscount:100 } }
  };
  assert(W.getPolicyPremiumBeforeDiscount(riskPolicy) === 200, "before-discount stays the simulator gross price");
  assert(W.getPolicySimDiscountAfterTotal(riskPolicy) === 100, "after-discount total comes from the simulator");
  assert(W.getHealthRowPremiumAfterDiscount(riskPolicy) === 100, "risk row shows the discounted price, not the gross one");
  assert(W.getPolicyPremiumAfterDiscount(riskPolicy) === 200, "the global engine itself is untouched");

  const twoInsured = {
    id:"pM", company:"הפניקס", type:"ריסק",
    insuredIds:["i1","i2"], insuredId:"i1",
    premiumPerInsured:{ i1:"200", i2:"150" },
    simDiscountPerInsured:{
      i1:{ year1Pct:50, monthlyAfterDiscount:100 },
      i2:{ year1Pct:40, monthlyAfterDiscount:90 }
    }
  };
  assert(W.getPolicySimDiscountAfterTotal(twoInsured) === 190, "multi-insured row sums each insured's discounted price");

  const partial = {
    id:"pP", company:"הפניקס", type:"ריסק",
    insuredIds:["i1","i2"], insuredId:"i1",
    premiumPerInsured:{ i1:"200", i2:"150" },
    simDiscountPerInsured:{ i1:{ year1Pct:50, monthlyAfterDiscount:100 } }
  };
  assert(W.getPolicySimDiscountAfterTotal(partial) === 250, "insured without a discount keeps their gross price");

  const noDiscount = {
    id:"pN", company:"הפניקס", type:"ריסק",
    insuredIds:["i1"], insuredId:"i1",
    premiumPerInsured:{ i1:"200" }
  };
  assert(W.getPolicySimDiscountAfterTotal(noDiscount) === null, "no simulator discount -> no override");
  assert(W.getHealthRowPremiumAfterDiscount(noDiscount) === 200, "without a discount the row keeps before == after");

  const healthManual = {
    id:"pH", company:"הפניקס", type:"בריאות",
    insuredIds:["i1"], insuredId:"i1",
    premiumPerInsured:{ i1:"870" },
    coverDiscountsApplied:true, premiumAfterCoverDiscounts:609,
    simDiscountPerInsured:{ i1:{ year1Pct:10, monthlyAfterDiscount:783 } }
  };
  assert(W.getHealthRowPremiumAfterDiscount(healthManual) === 609, "saved manual per-cover discount still wins over the simulator one");

  // percent + schedule mirrored so the row chips read right
  const draft = { simDiscountPerInsured:{ i1:{ year1Pct:50, years:6, schedule:[50,50,40,30,20,15] } } };
  W.syncDraftDiscountFromSimulator(draft);
  assert(draft.discountPct === "50", "draft discount percent mirrors year 1");
  assert(draft.discountYears === "6", "draft discount years mirrors the schedule length");
  assert(Array.isArray(draft.discountSchedule) && draft.discountSchedule.length === 6, "draft keeps the six-year schedule");
  assert(draft.discountSchedule[0].year === 1 && draft.discountSchedule[0].pct === 50, "schedule year 1 is the first percent");
  assert(draft.discountSchedule[5].pct === 15, "schedule year 6 is the last percent");
  assert(W.getPolicyDiscountCompactSummary({ discountPct:"50", discountSchedule: draft.discountSchedule }).length > 0, "discount chip has text to show");

  const flat = { simDiscountPerInsured:{ i1:{ year1Pct:20, years:10, schedule:[] } } };
  W.syncDraftDiscountFromSimulator(flat);
  assert(flat.discountPct === "20" && flat.discountYears === "10", "single-percent discounts mirror percent and years");

  // ── end-to-end: what the simulator sends -> what the draft stores ──
  W.render = () => {};
  W.policyDraft = null;
  W.ensurePolicyDraft();
  W.policyDraft.company = "הפניקס";
  W.policyDraft.type = "ריסק";
  W.applyRiskSimResultsToDraft({
    i1: {
      ok: true, monthlyPremium: 200, sumInsured: "1000000",
      simDiscount: { optionId:"phx-r-100-50", label:"50/50/40/30/20/15", year1Pct:50, years:6, schedule:[50,50,40,30,20,15], monthlyAfterDiscount:100 }
    }
  }, { skipRender: true, skipToast: true });
  assert(W.policyDraft.simDiscountPerInsured?.i1?.monthlyAfterDiscount === 100, "applying a simulator result stores the discounted price");
  assert(W.policyDraft.discountPct === "50", "applying a simulator result mirrors the discount percent");
  assert(safeTrim(W.policyDraft.premiumPerInsured?.i1) === "200.00", "the gross premium is still what the engine reads");

  W.applyRiskSimResultsToDraft({ i1: { ok: true, monthlyPremium: 200 } }, { skipRender: true, skipToast: true });
  assert(!W.policyDraft.simDiscountPerInsured?.i1, "recalculating without a discount clears the stored one");

  // ── edit restore: snapshot + fallback from quotes/sum ──
  W.applyRiskSimResultsToDraft({
    i1: {
      ok: true, monthlyPremium: 180.55, sumInsured: "1000000",
      covers: [{ id:"drugs", label:"תרופות", wizardKey:"תרופות" }],
      simDiscount: { optionId:"phx-h-10", year1Pct:10, monthlyAfterDiscount:162.5 },
      simStateSnapshot: { sumInsured:"1,000,000", selected:{ drugs:true }, result:{ ok:true, monthlyPremium:180.55 }, savedAt:"t1" }
    }
  }, { skipRender: true, skipToast: true });
  assert(W.policyDraft.simStateByInsured?.i1?.selected?.drugs === true, "applying a result stores the simulator snapshot");
  const restore = W.buildSimulatorRestoreState(W.policyDraft);
  assert(restore?.i1?.sumInsured === "1,000,000", "restore state keeps the saved sum insured");
  assert(restore?.i1?.selected?.drugs === true, "restore state keeps the selected covers");
  const restoreDisc = W.buildSimulatorRestoreDiscount(W.policyDraft);
  assert(restoreDisc?.i1 === "phx-h-10", "restore discount maps the option id by insured");
  const fallback = W.buildSimulatorRestoreState({
    sumInsuredPerInsured:{ i2:"750000" },
    premiumPerInsured:{ i2:"99.00" },
    riskSimQuotes:{ i2:{ ok:true, monthlyPremium:99, covers:[{ id:"transplant", label:"השתלות" }] } }
  });
  assert(fallback?.i2?.sumInsured === "750000", "without a snapshot, restore rebuilds sum from the policy");
  assert(fallback?.i2?.selected?.transplant === true, "without a snapshot, restore rebuilds selected covers from quotes");

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
