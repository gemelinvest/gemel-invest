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
const TAG = "20260905-np-per-insured-v2";
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
assert(/closeNpOpenSimulator\(\)\{[\s\S]*?captureOpenSimulatorSession\(\);[\s\S]*?_npSimKeepWorkspace = true;[\s\S]*?handler\?\.close\?\.\(\);[\s\S]*?_npSimKeepWorkspace = false;/.test(wiz), "wizard-initiated close snapshots then does not bounce back to pick");
assert(wiz.includes("this._npSimSkipCloseCleanup = true;"), "adding to the proposal skips the pick bounce");

console.log("\n5b) simulator discount reaches the summary row");
assert(sims.includes("function riskSimSelectedDiscountPayload(sim, result, insId){"), "simulator builds a discount payload for the wizard");
assert(sims.includes("monthlyAfterDiscount:"), "payload carries the already-computed after-discount price");
assert(sims.includes("year1Pct: giSimDiscountYear1Pct(opt)"), "payload carries the year-1 percent");
assert(sims.includes("schedule: Array.isArray(opt.schedule)") || sims.includes("const schedule = Array.isArray(opt.schedule)"), "payload carries the multi-year schedule");
assert(/giSimDiscountYear1Pct\(opt\)\{[\s\S]{0,200}opt\.schedule\[0\]/.test(sims) || /function giSimDiscountYear1Pct\(opt\)\{[\s\S]{0,220}schedule\[0\]/.test(sims), "year-1 percent is the first year of the schedule");
assert(sims.includes("const payload = discount ? Object.assign({}, result, { simDiscount: discount }) : Object.assign({}, result);"), "purchase sends the discount alongside the result");
assert(sims.includes("sim._ctx.onPurchaseInsured?.(active.insId, active.payload, active.legal)"), "purchase hook receives the enriched payload");
assert(sims.includes("onPurchaseAllInsureds"), "הוסף להצעה can add a row per insured pick");
assert(sims.includes("Number(null) === 0") || sims.includes("Number(null)==="), "null-to-zero guard documented");
assert(sims.includes('(after == null || after === "") ? NaN : Number(after)'), "null after-discount is not coerced to 0");
assert(sims.includes("built.ok = true"), "risk results without ok get ok:true before discount calc");
assert(sims.includes("Object.assign({}, result, { ok: true })"), "discount payload forces ok for risk results");
assert(sims.includes("giSimMoneyAfterPct(monthly, pct)"), "risk without covers falls back to year-1 percent math");
assert(wiz.includes("simDiscountPerInsured"), "wizard stores the per-insured after-discount price");
assert(wiz.includes("getPolicySimDiscountAfterTotal(policy){"), "row total helper exists");
assert(wiz.includes("syncDraftDiscountFromSimulator(draft){"), "discount percent/schedule mirrored for the row chips");
const rowAfter = wiz.slice(wiz.indexOf("getHealthRowPremiumAfterDiscount(policy){"), wiz.indexOf("applyAllProposalInsuredsToDraft(){"));
assert(rowAfter.includes("getPolicySimDiscountAfterTotal(policy)"), "row after-discount consults the simulator discount");
assert(rowAfter.includes("return this.getPolicyPremiumAfterDiscount(policy);"), "row still falls back to the existing engine");
assert(/getPolicyPremiumAfterDiscount\(policy\)\{[\s\S]{0,320}return this\.getPolicyPremiumBeforeDiscount\(policy\);/.test(wiz), "global after-discount engine itself is unchanged");
assert(wiz.includes("simDiscountPerInsured: (d.simDiscountPerInsured"), "discount is copied from the draft onto the policy");
assert(wiz.includes("simDiscountPerInsured: (p.simDiscountPerInsured"), "discount survives editing an added policy");

console.log("\n5b2) per-insured company/product session survives a switch");
assert(sims.includes("function riskSimSnapshotSession(sim){"), "simulator snapshots session state before a pick switch");
assert(sims.includes("simSession"), "pick-switch payload carries simSession");
assert(sims.includes("onWizardSessionCapture"), "close wrapper can capture wizard session");
assert(wiz.includes("mergeNpSimSessionSnapshot(snapshot){"), "wizard merges per-insured session bags");
assert(wiz.includes("buildNpSimRestoreState(company, product, fallback){"), "restore is filtered by company/product");
assert(wiz.includes("buildNpSimRestoreDiscount(company, product, fallback){"), "discount restore is filtered by company/product");
assert(wiz.includes("onWizardSessionCapture: (session) =>"), "open wires session capture");
assert(wiz.includes("this._npSimReopening = true"), "pick switch marks a reopen so auto-open/close cannot wipe picks");
assert(wiz.includes("if(this._npSimReopening) return;"), "wizard close is ignored while a pick switch is reopening");
assert(sims.includes("if(handler._giOpening) return origClose();"), "open()'s inner close does not notify the wizard");
assert(sims.includes("חברה למבוטח זה"), "company dropdown is labeled for this insured");
assert(sims.includes("מוצר למבוטח זה"), "product dropdown is labeled for this insured");
assert(sims.includes('base + " · " + prod'), "tabs show each insured's chosen product");
assert(sims.includes("riskSimPurchaseWizardInsureds(sim)"), "add-to-proposal walks every insured pick");
assert(wiz.includes("purchaseAllSimulatorInsureds(entries){"), "wizard adds one proposal row per calculated pick");
assert(wiz.includes("keepSessionPicks: keepPicks"), "adding several rows does not reset the per-insured picks");
assert(wiz.includes("onPurchaseAllInsureds: (entries) =>"), "open wires the add-all hook");
assert(!/switchSimulatorInsuredPick\(insId, company, product, snapshot\)\{[\s\S]{0,1200}this\.policyDraft\.company = co;/.test(wiz), "pick switch does not stamp the new company onto the shared draft before reopen");

console.log("\n5b3) compact summary row + hidden inner insured list");
assert(css.includes("grid-template-columns:72px minmax(0,1.6fr) auto auto"), "summary row is a tight 4-column grid");
assert(/\.lcNpProw__metrics\{display:flex;flex-direction:row/.test(css), "premiums sit in a horizontal pair");
assert(/\.lcNpProw__acts\{display:flex;flex-direction:row/.test(css), "row actions are horizontal");
assert(css.includes(".lcNpProw__disc{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:4px;padding:0;border:0;background:transparent}"), "discount chips are not in a dashed card");
assert(css.includes(".lcNpProw__covers{margin-top:0;grid-column:1 / -1}"), "covers panel spans under the compact row");
assert(css.includes(".lcNpManualBox") && css.includes("grid-column:1 / -1"), "manual discount panel spans under the compact row");
assert(shellCss.includes('.giSimShellModal [class*="__statusList"]{ display:none !important; }') || shellCss.includes('.giSimShellModal [class*="__statusList"]{display:none !important;}'), "shell hides the inner insured status list");
assert(sims.includes('statusList.classList.add("giSimShell__hintHidden")'), "layout also hides the inner insured list");

console.log("\n5c) company logo in the summary row has no frame");
const rowLogo = css.slice(css.indexOf(".lcNpProw .lcCompanyLogo,.lcNpProw img{"), css.indexOf(".lcNpProw__title{"));
assert(rowLogo.includes("border:0"), "row logo has no border");
assert(rowLogo.includes("background:transparent"), "row logo has no white plate");
assert(rowLogo.includes("padding:0"), "row logo has no inner padding");
assert(rowLogo.includes("box-shadow:none"), "row logo has no shadow");
assert(/width:72px;height:36px/.test(rowLogo), "row logo is compact in the summary row");
assert(rowLogo.includes("object-fit:contain"), "row logo is never cropped");

console.log("\n5d) operational report shows before/after simulator discount");
assert(wiz.includes("GI-NP-OPS-DISCOUNT"), "ops-report discount marker present");
assert(wiz.includes("getNewPolicyPremiumBeforeSafe = (policy) =>"), "ops before-premium helper");
assert(wiz.includes("Number(this.getHealthRowPremiumAfterDiscount(policy || {}))"), "ops final premium uses row after-discount");
assert(wiz.includes('const COL_COUNT = 6;'), "ops PDF compact table has 6 columns");
assert(wiz.includes("<th>לפני הנחה</th><th>אחרי הנחה</th>"), "ops PDF shows before and after premium columns");
assert(wiz.includes("premiumBeforeLabel: premiumBefore ? this.formatMoneyValue(premiumBefore) : '—'"), "ops PDF rows carry before-premium labels");
assert(wiz.includes("sum + getNewPolicyPremiumSafe(policy)"), "ops grand total uses after-discount helper");
assert(!/totalPremiumAfterDiscount = newPolicies\.reduce\(\(sum, policy\) => sum \+ this\.getPolicyPremiumAfterDiscount\(policy\)/.test(wiz), "ops grand total no longer uses the legacy before-as-after helper");
assert(wiz.includes("['פרמיה לפני הנחה', premiumBeforeVal ? this.formatMoneyValue(premiumBeforeVal) : '']"), "ops detail blocks list before premium");
assert(wiz.includes("['פרמיה אחרי הנחה', premiumAfterVal ? this.formatMoneyValue(premiumAfterVal) : '']"), "ops detail blocks list after premium");
assert(wiz.includes("policy?.simDiscountPerInsured?.[iid]?.monthlyAfterDiscount"), "ops per-insured premium prefers simulator after-discount");
assert(/getPolicyInsuredLabelSafe = \(policy\) => \{[\s\S]{0,900}pIds\.length > 1/.test(wiz), "ops insured label joins multiple insuredIds");

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
  nowISO: () => "2026-09-03T10:00:00.000Z",
  RiskSimulators: {
    hasCatalog(){ return true; },
    getHandler(){ return { open(){}, close(){} }; }
  }
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
  console,
  Auth: { current: { name: "נציג בדיקה" } }
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

  // ── bug: Number(null)===0 used to store ₪0 after-discount for Clal/Migdal risk ──
  W.applyRiskSimResultsToDraft({
    i1: {
      ok: true, monthlyPremium: 61.32, sumInsured: "600000",
      simDiscount: { optionId:"cll-r-5001", year1Pct:65, years:6, schedule:[65,65,60,60,50,40], monthlyAfterDiscount: null }
    }
  }, { skipRender: true, skipToast: true });
  assert(!W.policyDraft.simDiscountPerInsured?.i1, "null after-discount is not stored as 0");
  assert(W.getPolicySimDiscountAfterTotal(W.policyDraft) == null, "null after-discount does not override the row total");

  W.applyRiskSimResultsToDraft({
    i1: {
      monthlyPremium: 61.32, sumInsured: "600000",
      simDiscount: { optionId:"cll-r-5001", year1Pct:65, years:6, schedule:[65,65,60,60,50,40], monthlyAfterDiscount: 21.46 }
    }
  }, { skipRender: true, skipToast: true });
  assert(W.policyDraft.simDiscountPerInsured?.i1?.monthlyAfterDiscount === 21.46, "Clal-style 65% after-discount is stored");
  assert(W.getHealthRowPremiumAfterDiscount({
    type: "ריסק",
    insuredIds: ["i1"],
    premiumPerInsured: { i1: 61.32 },
    premiumMonthly: 61.32,
    simDiscountPerInsured: W.policyDraft.simDiscountPerInsured
  }) === 21.46, "row shows 21.46 after discount, not 0");

  W.applyRiskSimResultsToDraft({
    i1: {
      monthlyPremium: 16.92, sumInsured: "400000",
      simDiscount: { optionId:"mgd-r-50", year1Pct:50, years:6, schedule:[50,50,50,50,50,50], monthlyAfterDiscount: 8.46 }
    }
  }, { skipRender: true, skipToast: true });
  assert(W.getHealthRowPremiumAfterDiscount({
    type: "ריסק",
    insuredIds: ["i1"],
    premiumPerInsured: { i1: 16.92 },
    premiumMonthly: 16.92,
    simDiscountPerInsured: W.policyDraft.simDiscountPerInsured
  }) === 8.46, "Migdal-style 50% after-discount reaches the row");

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

  // ── per-insured pick switch does not clobber the other insured ──
  {
    sandbox.RiskSimulators = host.RiskSimulators;
    const opened = [];
    W.openRiskSimulator = function(opts){ opened.push(opts || {}); };
    W.policyDraft = { company:"הכשרה", type:"ריסק", insuredIds:["i1"] };
    W.ensurePolicyDraft = function(){ if(!this.policyDraft) this.policyDraft = { company:"", type:"" }; return this.policyDraft; };
    W._npSimPickByInsured = {
      i1: { company:"הכשרה", product:"ריסק" },
      i2: { company:"הכשרה", product:"ריסק" }
    };
    W._npSimStateBag = {};
    W._npSimDiscountBag = {};
    W._npOpenSimHandler = {
      _ctx: { company:"הכשרה", product:"ריסק", wizardWorkspace:true },
      _state: { i1:{ sumInsured:"700000", result:{ ok:true, monthlyPremium:50 } }, i2:{ sumInsured:"" } },
      close(){}
    };
    W.switchSimulatorInsuredPick("i2", "כלל", "ריסק", {
      wizardPickByInsured: {
        i1: { company:"הכשרה", product:"ריסק" },
        i2: { company:"כלל", product:"ריסק" }
      },
      simSession: {
        company:"הכשרה", product:"ריסק", pickKey:"הכשרה::ריסק",
        stateByInsured: { i1:{ sumInsured:"700000", result:{ ok:true, monthlyPremium:50 } } },
        discountByInsured: { i1:"hach-r-30" }
      }
    });
    assert(W._npSimPickByInsured.i1.company === "הכשרה" && W._npSimPickByInsured.i1.product === "ריסק", "primary pick stays הכשרה · ריסק");
    assert(W._npSimPickByInsured.i2.company === "כלל" && W._npSimPickByInsured.i2.product === "ריסק", "secondary pick becomes כלל · ריסק");
    assert(W.policyDraft.company === "הכשרה", "shared draft company is not rewritten to כלל before reopen");
    assert(W._npSimStateBag.i1["הכשרה::ריסק"].sumInsured === "700000", "primary הכשרה state is stored in the session bag");
    const clalRestore = W.buildNpSimRestoreState("כלל", "ריסק", { i1:{ sumInsured:"SHOULD_NOT" } });
    assert(!clalRestore || !clalRestore.i1, "כלל restore does not include the primary הכשרה snapshot");
    const hachRestore = W.buildNpSimRestoreState("הכשרה", "ריסק", null);
    assert(hachRestore && hachRestore.i1 && hachRestore.i1.sumInsured === "700000", "returning to הכשרה restores the primary snapshot");
    const clalDisc = W.buildNpSimRestoreDiscount("כלל", "ריסק", { i1:"SHOULD_NOT" });
    assert(!clalDisc || !clalDisc.i1, "כלל discount restore does not leak the primary option");
    const hachDisc = W.buildNpSimRestoreDiscount("הכשרה", "ריסק", null);
    assert(hachDisc && hachDisc.i1 === "hach-r-30", "הכשרה discount restore returns the primary option");
    assert(opened.length === 1 && opened[0].restoreActiveId === "i2", "reopen targets the insured whose pick changed");
  }

  // ── כלל ריסק לראשי + כלל סרטן למשני: picks stay split, add creates two rows ──
  {
    const added = [];
    W._npSimReopening = false;
    W._npSimKeepWorkspace = false;
    W.handleWizardSimulatorClose();
    W._npSimPickByInsured = {
      i1: { company:"כלל", product:"ריסק" },
      i2: { company:"כלל", product:"סרטן" }
    };
    W._npSimStateBag = {
      i1: { "כלל::ריסק": { sumInsured:"800000", result:{ ok:true, monthlyPremium:61.32 } } },
      i2: { "כלל::סרטן": { sumInsured:"", compensation:"100000", result:{ ok:true, monthlyPremium:22.5 } } }
    };
    W._npSimDiscountBag = {
      i1: { "כלל::ריסק": { optionId:"cll-r-5001", year1Pct:65, monthlyAfterDiscount:21.46 } }
    };
    W.policyDraft = { company:"כלל", type:"סרטן", insuredIds:["i1","i2"], insuredId:"i2" };
    W._npShowPick = false;
    W.newPolicies = [];
    W.addDraftPolicy = function(opts){
      const d = this.policyDraft;
      const row = {
        id: "npol_" + d.company + "_" + d.type + "_" + d.insuredId,
        company: d.company,
        type: d.type,
        insuredIds: (d.insuredIds || []).slice(),
        keepSessionPicks: !!(opts && opts.keepSessionPicks),
        skipRender: !!(opts && opts.skipRender)
      };
      added.push(row);
      this.newPolicies = (this.newPolicies || []).concat([row]);
      this.policyDraft = { company:"", type:"", insuredIds:["i1","i2"], insuredId:"i1" };
      return row.id;
    };
    W.emptyPledgeBank = function(){ return { bankName:"", bankNo:"", branch:"", amount:"", years:"", address:"" }; };
    W.normalizePledgeBanks = function(){ return []; };
    W.isMedicareCompany = function(){ return false; };
    const fromBag = W.buildPurchasePayloadFromSessionBag("i1", "כלל", "ריסק");
    assert(fromBag && fromBag.monthlyPremium === 61.32, "bag rebuilds the primary כלל · ריסק result");
    assert(fromBag.simDiscount && fromBag.simDiscount.monthlyAfterDiscount === 21.46, "bag keeps the primary discount payload");
    const pids = W.purchaseAllSimulatorInsureds([
      { insId:"i1", company:"כלל", product:"ריסק", payload:null, label:"ראשי - דוד כהן" },
      { insId:"i2", company:"כלל", product:"סרטן", payload:{ ok:true, monthlyPremium:22.5, compensation:"100000" }, label:"משני - יעל כהן" }
    ]);
    assert(added.length === 2, "הוסף להצעה writes one summary row per insured pick");
    assert(added[0].company === "כלל" && added[0].type === "ריסק" && added[0].insuredIds[0] === "i1", "first row is primary כלל · ריסק");
    assert(added[1].company === "כלל" && added[1].type === "סרטן" && added[1].insuredIds[0] === "i2", "second row is secondary כלל · סרטן");
    assert(added.every((row) => row.keepSessionPicks === true), "batch add keeps per-insured picks between rows");
    assert(pids.length === 2, "purchase-all returns both policy ids");
    assert(W._npSimPickByInsured && Object.keys(W._npSimPickByInsured).length === 0, "picks reset only after both rows were added");
    assert(W._npShowPick === false, "after adding both rows the step stays on the summary");
  }

  // ── reopen/close guards do not wipe picks ──
  {
    W._npSimPickByInsured = { i1:{ company:"כלל", product:"ריסק" }, i2:{ company:"כלל", product:"סרטן" } };
    W._npSimReopening = true;
    W._npSimKeepWorkspace = false;
    W._npSimSkipCloseCleanup = false;
    W.policyDraft = { company:"כלל", type:"ריסק", insuredIds:["i1"] };
    W.handleWizardSimulatorClose();
    assert(W._npSimPickByInsured.i1.product === "ריסק" && W._npSimPickByInsured.i2.product === "סרטן", "close during reopen does not wipe per-insured picks");
    assert(W.policyDraft.company === "כלל", "close during reopen does not clear the draft company");
    W._npSimReopening = false;
  }

  // ── operational PDF: before/after discount surfaces ──
  {
    const opsPayload = {
      createdAt: "2026-09-03T10:00:00.000Z",
      agentName: "נציג בדיקה",
      primary: { firstName: "דוד", lastName: "כהן" },
      insureds,
      newPolicies: [
        {
          id: "opsClal", company: "כלל", type: "ריסק",
          insuredIds: ["i1"], insuredId: "i1",
          premiumMonthly: 61.32, premiumPerInsured: { i1: "61.32" },
          sumInsured: "600000", sumInsuredPerInsured: { i1: "600000" },
          startDate: "2026-11-01", discountPct: "65",
          simDiscountPerInsured: { i1: { year1Pct: 65, monthlyAfterDiscount: 21.46 } }
        },
        {
          id: "opsMulti", company: "מגדל", type: "ריסק",
          insuredIds: ["i1", "i2"], insuredId: "i1", insuredMode: "multi",
          premiumMonthly: 400, premiumPerInsured: { i1: "200", i2: "200" },
          sumInsuredPerInsured: { i1: "500000", i2: "500000" },
          startDate: "2026-12-01", discountPct: "50",
          simDiscountPerInsured: {
            i1: { year1Pct: 50, monthlyAfterDiscount: 100 },
            i2: { year1Pct: 50, monthlyAfterDiscount: 100 }
          }
        },
        {
          id: "opsHealth", company: "הפניקס", type: "בריאות",
          insuredIds: ["i1"], insuredId: "i1",
          premiumMonthly: 870, premiumPerInsured: { i1: "870" },
          healthCovers: ["תרופות מחוץ לסל הבריאות", "ניתוחים בישראל מהשקל הראשון"],
          startDate: "2026-10-15", discountPct: "10",
          simDiscountPerInsured: { i1: { year1Pct: 10, monthlyAfterDiscount: 783 } }
        }
      ],
      mirrorSchedule: {}
    };
    let opsHtml = "";
    try {
      const pack = W.buildOperationalPdfMarkup(opsPayload, { forPreview: true });
      opsHtml = String(pack && pack.html || "");
    } catch (err) {
      assert(false, "buildOperationalPdfMarkup runs (" + (err && err.message) + ")");
    }
    assert(opsHtml.includes("<th>לפני הנחה</th>") && opsHtml.includes("<th>אחרי הנחה</th>"), "ops PDF table headers include before/after");
    assert(/₪\s*61[.,]32/.test(opsHtml) && /₪\s*21[.,]46/.test(opsHtml), "ops PDF shows Clal before 61.32 and after 21.46");
    assert(opsHtml.includes("כלל") && opsHtml.includes("מגדל") && opsHtml.includes("הפניקס"), "ops PDF lists each company");
    assert(opsHtml.includes("בריאות") && (opsHtml.includes("תרופות") || opsHtml.includes("ניתוחים")), "ops PDF lists health product and covers");
    assert(opsHtml.includes("דוד כהן") && opsHtml.includes("יעל כהן"), "ops PDF names multi-insured people");
    assert(/₪\s*1[,.]?004[.,]46/.test(opsHtml) || opsHtml.includes("1,004.46") || opsHtml.includes("1004.46"), "ops PDF grand total uses after-discount (21.46+200+783)");
    assert(W.getPolicyPremiumAfterDiscount(opsPayload.newPolicies[0]) === 61.32, "legacy after-discount helper still returns before for Clal");
    assert(W.getHealthRowPremiumAfterDiscount(opsPayload.newPolicies[0]) === 21.46, "row after-discount helper still returns simulator net for Clal");
  }

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
