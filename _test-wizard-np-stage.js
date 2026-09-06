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
const TAG = "20260906-sales-mail-root-v1";
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
assert(wiz.includes("const showSummaryBlock = hasRows;"), "summary area only when at least one policy exists");
assert(!wiz.includes('hasRows || npStage !== "sim"'), "empty pick stage does not force the summary area");
assert(!wiz.includes("lcNpEmpty"), "empty summary placeholder markup removed");
assert(!wiz.includes("עדיין לא נוספו פוליסות להצעה"), "empty summary copy removed");
assert(!wiz.includes("לאחר חישוב בסימולטור יופיעו כאן שורות סיכום"), "empty summary explanation removed");
assert(/toIsoDateFromAny\(raw\)\{[\s\S]{0,280}parseAnyDmyDate\(s\)/.test(wiz), "start-date ISO conversion allows future dates");
assert(!/toIsoDateFromAny\(raw\)\{[\s\S]{0,400}parseBirthDateValue\(s\)/.test(wiz), "start-date conversion no longer uses birth-date parser");
assert(/toSimulatorDmyDate\(raw\)\{[\s\S]{0,500}parseAnyDmyDate\(s\)/.test(wiz), "ops PDF start date formats future ISO as DD/MM/YYYY");
assert(!/toSimulatorDmyDate\(raw\)\{[\s\S]{0,700}parseBirthDateValue\(/.test(wiz), "ops PDF start date no longer uses birth-date parser");
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
assert(css.includes(".lcNpChip--covers"), "covers toggle uses a quiet chip in the compact row");
assert(css.includes(".lcNpProw__coversList"), "covers list styles");
assert(wiz.includes("const coversToggle = isMulti"), "covers toggle is split from the expanding panel");
assert(/lcNpProw__disc[\s\S]{0,900}\$\{coversToggle\}/.test(wiz), "covers toggle is interpolated into the compact chip row");
assert(!/class="lcNpProw__covers"[\s\S]{0,180}data-np-show-covers=/.test(wiz), "covers toggle is not a full-width block under the row");

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
assert(sims.includes("const HachsharaCriticalIllnessSimulator"), "Hachshara CI simulator exists");
{
  const start = sims.indexOf("const HachsharaCriticalIllnessSimulator");
  const end = sims.indexOf('RiskSimulators.register("הכשרה", "מחלות קשות"');
  const chunk = start >= 0 && end > start ? sims.slice(start, end) : "";
  const buildAt = chunk.indexOf("_buildResultForInsured");
  const renderAt = chunk.indexOf("_render()", buildAt);
  const built = buildAt >= 0 ? chunk.slice(buildAt, renderAt > buildAt ? renderAt : undefined) : "";
  const retAt = built.indexOf("return {");
  const inputsAt = built.indexOf("inputs:");
  assert(retAt >= 0 && inputsAt > retAt, "Hachshara CI result still keeps the inputs bag");
  assert(built.slice(retAt, inputsAt).includes("insuranceStartDate: st.insuranceStartDate"), "Hachshara CI result puts start date at top level");
}
assert(wiz.includes("r.inputs && r.inputs.insuranceStartDate"), "wizard copies nested simulator start dates onto the policy");
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
assert(wiz.includes("purchaseAllSimulatorInsureds(entries, meta){"), "wizard adds one proposal row per calculated pick");
assert(wiz.includes("keepSessionPicks: keepPicks"), "adding several rows does not reset the per-insured picks");
assert(wiz.includes("onPurchaseAllInsureds: (entries, meta) =>"), "open wires the add-all hook");
assert(sims.includes("function riskSimAllowsCouplePolicy(product){"), "couple checkbox is gated to risk/ci/cancer/health");
assert(sims.includes(">פוליסה זוגית<"), "couple checkbox label in the simulator");
assert(sims.includes("data-gishell-couple="), "couple master checkbox");
assert(sims.includes("data-gishell-couple-ins="), "per-insured couple include checkboxes");
assert(wiz.includes("purchaseSimulatorCoupleGroup("), "couple add writes one shared policy");
assert(wiz.includes("getPolicyInsuredPremiumSplit(policy, insId){"), "before/after premium is read per insured without new discount math");
assert(wiz.includes('insuredMode: (d.insuredMode === "couple" && dInsuredIds.length > 1) ? "couple"'), "addDraftPolicy preserves couple mode");
assert(css.includes("lcNpProw__metrics--split"), "summary row can show per-insured before/after");
assert(shellCss.includes(".giSimShell__couple{"), "couple checkbox styles");
assert(shellCss.includes("GI-SIM-INSURED-TABS 2026-09-05"), "insured name chips have a last-wins style block");
const tabBlock = shellCss.slice(shellCss.lastIndexOf("GI-SIM-INSURED-TABS 2026-09-05"));
assert(tabBlock.includes("font-size:17px !important"), "insured tab names are 17px");
assert(tabBlock.includes("min-height:44px !important"), "insured tabs are tall enough to read");
assert(tabBlock.includes(".giSimShell__tab:hover{"), "hover highlights the chip you are on");
assert(tabBlock.includes("border-radius:12px !important"), "each insured name is a boxed chip");
assert(!/switchSimulatorInsuredPick\(insId, company, product, snapshot\)\{[\s\S]{0,1200}this\.policyDraft\.company = co;/.test(wiz), "pick switch does not stamp the new company onto the shared draft before reopen");

console.log("\n5b3) compact summary row + hidden inner insured list");
assert(css.includes("grid-template-columns:72px minmax(0,1.6fr) auto auto"), "summary row is a tight 4-column grid");
assert(/\.lcNpProw__metrics\{display:flex;flex-direction:row/.test(css), "premiums sit in a horizontal pair");
assert(/\.lcNpProw__acts\{display:flex;flex-direction:row/.test(css), "row actions are horizontal");
assert(css.includes(".lcNpProw__act{"), "quiet compact-row action button styles");
assert(css.includes(".lcNpProw__act--disc{"), "discount action is a quiet gold-tint chip");
assert(css.includes(".lcNpProw__act--del{"), "remove action is a quiet muted chip");
assert(wiz.includes('class="lcNpProw__act lcNpProw__act--disc"'), "discount button uses quiet prow act class");
assert(wiz.includes('class="lcNpProw__act" data-editpol='), "edit button uses quiet prow act class");
assert(wiz.includes('class="lcNpProw__act lcNpProw__act--del"'), "remove button uses quiet prow act class");
assert(wiz.includes("data-discountpol=") && wiz.includes("data-editpol=") && wiz.includes("data-delpol="), "row action wiring is unchanged");
assert(css.includes(".lcNpProw__disc{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:4px;padding:0;border:0;background:transparent}"), "discount chips are not in a dashed card");
assert(css.includes(".lcNpProw__covers{margin-top:0;grid-column:1 / -1}"), "covers panel spans under the compact row");
assert(css.includes(".lcNpManualBox") && css.includes("grid-column:1 / -1"), "manual discount panel spans under the compact row");
assert(shellCss.includes('.giSimShellModal [class*="__statusList"]{ display:none !important; }') || shellCss.includes('.giSimShellModal [class*="__statusList"]{display:none !important;}'), "shell hides the inner insured status list");
assert(sims.includes('statusList.classList.add("giSimShell__hintHidden")'), "layout also hides the inner insured list");

console.log("\n5b4) health simulator covers use a compact two-column list");
assert(sims.includes('layout.classList.add("giSimShell__layout--healthCovers")'), "health layout class is applied when a cover list exists");
assert(shellCss.includes(".giSimShell__layout--healthCovers{"), "health layout gives more width to covers");
assert(shellCss.includes(".giSimShell__panel--covers [class*=\"__coverList\"]{") || shellCss.includes(".giSimShell__panel--covers [class*='__coverList']{") || shellCss.includes('.giSimShell__panel--covers [class*="__coverList"]{'), "cover list selector in the shell");
assert(shellCss.includes("grid-template-columns:repeat(2, minmax(0, 1fr))"), "cover rows sit in two columns");
assert(/padding:6px 8px !important/.test(shellCss), "cover rows are shorter");
assert(/covers\.appendChild\(coversWrap\);\s*if\(occBox\) details\.appendChild\(occBox\)/.test(sims), "occupation/underwriting sits in the details column");
assert(!/covers\.appendChild\(coversWrap\);\s*if\(occBox\) covers\.appendChild\(occBox\)/.test(sims), "occupation is no longer under the long cover list");

console.log("\n5b5) pledge/beneficiaries persist from the docked simulator onto the row");
assert(wiz.includes("applySimulatorLegalToDraft(draft, legal)"), "wizard copies simulator legal onto the draft");
assert(wiz.includes("resolveSimulatorLegal(legal, insuredId)"), "empty legal falls back to the per-insured map");
assert(wiz.includes("simulatorLegalHasContent(legal)"), "filled pledge/beneficiaries are detected before overwrite");
assert(wiz.includes("legalByInsured"), "session snapshot carries legalByInsured");
assert(wiz.includes("try { sim._giCaptureLegal?.(); } catch(_eCap) {}"), "session capture reads live legal fields first");
assert(sims.includes("handler._giCaptureLegal = function(){"), "simulator exposes a legal capture hook");
assert(sims.includes("legalByInsured: riskSimJsonClone(sim && sim._ctx && sim._ctx.wizardLegalByInsured)"), "simulator session includes legal");
const capFn = sims.slice(sims.indexOf("function riskSimCaptureLegalFromDom(sim){"), sims.indexOf("function riskSimLegalInnerHtml(sim){"));
assert(capFn.includes("function riskSimCaptureLegalFromDom(sim){"), "legal capture helper extracted");
assert(capFn.includes("if(!dock) return;"), "missing legal dock does not wipe stored values");
assert(capFn.includes("if(benRows.length)"), "beneficiaries are overwritten only when rows exist");
assert(!/if\(!dock\)[\s\S]{0,80}legal\.beneficiaries\s*=/.test(capFn), "absent dock does not assign beneficiaries");
assert(/riskSimMountLegalPanel\(sim\)\{\s*try \{ riskSimCaptureLegalFromDom\(sim\);/.test(sims), "remount captures live DOM before rewriting HTML");
assert(wiz.includes("p.pledgeBanks[0].bankName"), "summary chip reads bankName");
assert(!wiz.includes("p.pledgeBanks[0]?.name"), "summary chip no longer reads the wrong name field");
assert(wiz.includes("שיעבוד · ${escapeHtml(pledgeBankName)}"), "filled pledge chip shows the bank");
assert(wiz.includes('("מוטבים: " + bens.map'), "filled beneficiaries chip lists names");

console.log("\n5b6) couple health covers copy from primary, then per-insured detail");
assert(sims.includes("function riskSimSyncCoupleHealthCovers(sim, coverId, turnedOn)"), "couple cover sync helper exists");
assert(sims.includes("function riskSimCopyCoupleHealthCoversFromSeed(sim)"), "primary covers copy onto selected members");
assert(sims.includes("_giCoupleCoverCustomized"), "later per-insured edits stop the copy");
assert(sims.includes("_giCoupleChildIntent"), "child-only covers are tracked separately from the primary");
assert(sims.includes("function riskSimIsChildRestrictedCover(coverId, meta)"), "child-only covers are detected by id/label");
assert(sims.includes('return ins.type === "child"'), "child-only covers apply to type=child");
assert(sims.includes('title: "כיסוי לילד"'), "agent sees a child-cover notice");
assert(sims.includes("יחול רק על"), "notice names the eligible insured");
assert(sims.includes("function riskSimBindCoupleCoverSync(sim)"), "cover checkboxes are hooked in the shell");
assert(sims.includes("try { riskSimBindCoupleCoverSync(sim); } catch(_eCov) {}"), "shell bind installs couple cover sync");
assert(wiz.includes("getPolicyInsuredCoverLabels(policy, insId)"), "row can read covers per insured");
assert(wiz.includes("healthCoversPerInsured"), "policy stores covers per insured");
assert(wiz.includes("הצג פירוט"), "multi-insured row has a details button");
assert(wiz.includes("הסתר פירוט"), "details button can collapse");
assert(wiz.includes("lcNpProw__person"), "details panel has a block per insured");
assert(wiz.includes("לפני הנחה ${this.formatMoneyValue(pair.before)}"), "details show before-premium per insured");
assert(wiz.includes("אחרי הנחה ${this.formatMoneyValue(pair.after)}"), "details show after-premium per insured");
assert(css.includes(".lcNpProw__person{"), "per-insured detail styles");
assert(wiz.includes("הצג כיסוי בפוליסה"), "single health row still has the covers chip");
assert(wiz.includes("GI-NP-INSURED-LABEL"), "summary-row insured label marker");
assert(wiz.includes("GI-NP-ROWS-ADVANCE"), "summary rows let Next skip an incomplete add-draft");
assert(wiz.includes("isPolicyDraftDirty() && rows.length < 1"), "dirty add-draft is ignored when summary rows exist");
assert(wiz.includes("if(rows.length < 1 && !issueRows.length)"), "empty summary still requires at least one added policy");
assert(wiz.includes("מבוטחים בפוליסה:"), "summary row uses מבוטחים בפוליסה");
assert(!wiz.includes('<span>לקוח: <b>${escapeHtml(customerName)}</b></span>'), "summary row no longer shows לקוח from the primary label");
assert(!wiz.includes('<span>מבוטחים: <b>${escapeHtml(insuredNames.join(" · ") || "—")}</b></span>'), "old מבוטחים: label removed from the summary row");
assert(!/const customerName = safeTrim\(\(this\.insureds\.find/.test(wiz), "primary insured label is not copied onto the summary row");
assert(wiz.includes("GI-NP-COVER-PREM"), "per-cover before/after helper marker");
assert(wiz.includes("getPolicyInsuredCoverPremiumRows(policy, insId)"), "details can read before/after per cover");
assert(wiz.includes("renderPolicyCoverPremiumListHtml(policy, insId, emptyText)"), "details render per-cover before/after on the left");
assert(wiz.includes("lcNpProw__coverPay"), "cover row has a left-side premium pair");
assert(css.includes(".lcNpProw__coverPay{"), "cover premium pair styles");
assert(css.includes("justify-content:space-between"), "cover name stays right, premiums stay left");

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
assert(wiz.includes("GI-NP-OPS-SIM-DATA"), "ops PDF always lists before/after per insured from the simulator");
assert(wiz.includes("beneficiaryRows: getPolicyBeneficiaryRowsSafe(policy)"), "compact ops rows carry beneficiaries");
assert(wiz.includes('lcPdfNewPolicyDetailK">מוטבים<'), "compact ops renderer prints a beneficiaries line");
assert(wiz.includes('lcPdfNewPolicyDetailK">כיסויים לפי מבוטח<'), "compact ops renderer prints per-insured health covers");
assert(wiz.includes("perInsuredCoverRows:"), "compact ops rows carry covers per insured");
assert(wiz.includes("this.toSimulatorDmyDate(policy?.startDate)"), "compact ops rows format start date as DD/MM/YYYY");
assert(wiz.includes("coverPremiums: this.getPolicyInsuredCoverPremiumRows(policy, iid)"), "ops compact rows carry per-cover before/after");
assert(wiz.includes("lcPdfCouplePremiums--covers"), "ops PDF styles the per-cover premium list");
assert(wiz.includes("GI-NP-OPS-DEDUPE"), "ops PDF hides the unpriced cover list when priced covers exist");
assert(wiz.includes("getOperationalDiscountDisplayText(policy)"), "ops discount line uses the full discount display");
assert(wiz.includes("!hasCoverByInsured && covMeaningful"), "priced per-insured covers skip כיסוי / סכומים");

console.log("\n6) untouched — declaration routing, premium engine; center open to logged-in users");
assert(/canAccessSimulators\(\)\{\s*return !!this\.current;/.test(app), "Simulators Center gate is any logged-in user");
assert(/canOpenWizardPolicySimulator\(\)\{\s*return true;/.test(wiz), "wizard simulator still open to every agent");
assert(wiz.includes("return this.getPolicyPremiumBeforeDiscount(policy);"), "global after-discount engine untouched");
assert(wiz.includes("GI-HEALTH-ONE-DECL"), "one-declaration routing marker still present");
assert(sims.includes("const addInsHtml = sim._ctx.standalone"), "add-insured stays standalone-only");
assert(sims.includes(">הוסף להצעה<"), "approved purchase label kept");
assert(sims.includes("data-gishell-legal-confirm"), "approved pledge confirm kept");

console.log("\n7) runtime — stage transitions and docking on real Wizard methods");
function parseAnyDmyDate(value){
  const s = safeTrim(value);
  if(!s) return null;
  let y = null, m = null, d = null;
  let hit = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if(hit){
    y = Number(hit[1]); m = Number(hit[2]); d = Number(hit[3]);
  } else {
    hit = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
    if(hit){ d = Number(hit[1]); m = Number(hit[2]); y = Number(hit[3]); }
  }
  if(!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  if(Number.isNaN(dt.getTime()) || dt.getFullYear() !== y || dt.getMonth() !== (m - 1) || dt.getDate() !== d) return null;
  return { year:y, month:m, day:d, date:dt };
}
function parseBirthDateValue(value){
  const p = parseAnyDmyDate(value);
  if(!p) return null;
  if(p.date > new Date()) return null;
  return p;
}

const host = new Proxy({
  Wizard: {},
  safeTrim,
  parseAnyDmyDate,
  parseBirthDateValue,
  formatDmyFromParts(y, m, d){
    return String(d).padStart(2, "0") + "/" + String(m).padStart(2, "0") + "/" + String(y).padStart(4, "0");
  },
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

  assert(!parseBirthDateValue("01/10/2026"), "birth-date parser rejects a future insurance start date");
  assert(parseAnyDmyDate("01/10/2026") && parseAnyDmyDate("01/10/2026").year === 2026, "any-date parser keeps 01/10/2026");
  W.applyRiskSimResultsToDraft({
    i1: {
      ok: true, monthlyPremium: 64.4, sumInsured: "560000",
      insuranceStartDate: "01/10/2026"
    }
  }, { skipRender: true, skipToast: true });
  assert(W.policyDraft.startDate === "2026-10-01", "future simulator start date is copied onto the policy as ISO");
  const missingStart = W.collectNewPolicyValidationIssues({
    company: "כלל", type: "ריסק", insuredIds: ["i1"], insuredId: "i1",
    premiumPerInsured: { i1: "64.4" }, sumInsuredPerInsured: { i1: "560000" }
  }, { policyIndex: 0, checkKnownInsureds: false });
  assert(missingStart.some((row) => String(row.message || "").includes("תאריך תחילת ביטוח")), "empty start date still blocks next");
  const filledStart = W.collectNewPolicyValidationIssues({
    company: "כלל", type: "ריסק", insuredIds: ["i1"], insuredId: "i1",
    premiumPerInsured: { i1: "64.4" }, sumInsuredPerInsured: { i1: "560000" },
    startDate: W.policyDraft.startDate
  }, { policyIndex: 0, checkKnownInsureds: false });
  assert(!filledStart.some((row) => String(row.message || "").includes("תאריך תחילת ביטוח")), "copied future start date is enough to continue");

  W.policyDraft = null;
  W.ensurePolicyDraft();
  W.policyDraft.company = "הכשרה";
  W.policyDraft.type = "מחלות קשות";
  W.applyRiskSimResultsToDraft({
    i1: {
      ok: true, monthlyPremium: 38.03, compensation: "100000",
      inputs: { insuranceStartDate: "01/10/2026" }
    }
  }, { skipRender: true, skipToast: true });
  assert(W.policyDraft.startDate === "2026-10-01", "nested Hachshara CI start date is copied onto the policy");
  const hachNestedIssues = W.collectNewPolicyValidationIssues({
    company: "הכשרה", type: "מחלות קשות", insuredIds: ["i1"], insuredId: "i1",
    premiumPerInsured: { i1: "38.03" }, compensationPerInsured: { i1: "100000" },
    startDate: W.policyDraft.startDate
  }, { policyIndex: 0, checkKnownInsureds: false });
  assert(!hachNestedIssues.some((row) => String(row.message || "").includes("תאריך תחילת ביטוח")), "Hachshara CI with nested start date can continue");
  W.applyRiskSimResultsToDraft({
    i1: {
      ok: true, monthlyPremium: 38.03, compensation: "100000",
      insuranceStartDate: "01/10/2026"
    }
  }, { skipRender: true, skipToast: true });
  assert(W.policyDraft.startDate === "2026-10-01", "top-level Hachshara CI start date is copied onto the policy");
  const hachMissingStart = W.collectNewPolicyValidationIssues({
    company: "הכשרה", type: "מחלות קשות", insuredIds: ["i1"], insuredId: "i1",
    premiumPerInsured: { i1: "38.03" }, compensationPerInsured: { i1: "100000" }
  }, { policyIndex: 0, checkKnownInsureds: false });
  assert(hachMissingStart.some((row) => String(row.message || "").includes("תאריך תחילת ביטוח")), "empty Hachshara CI start date still blocks next");

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

  // ── pledge / beneficiaries from the simulator land on the compact row ──
  {
    W.render = () => {};
    W.isOpen = false;
    W.newPolicies = [];
    W.editingPolicyId = null;
    W._npSimLegalByInsured = null;
    W.policyDraft = null;
    W.ensurePolicyDraft();
    W.policyDraft.company = "כלל";
    W.policyDraft.type = "ריסק";
    const legalFilled = {
      pledge: true,
      pledgeConfirmed: true,
      pledgeBanks: [{ bankName:"בנק לאומי", bankNo:"10", branch:"123", amount:"500000", years:"20", address:"רחוב הבנק 1" }],
      beneficiaries: [{ firstName:"דן", lastName:"כהן", idNumber:"123456789", relationship:"בן", sharePct:"100" }]
    };
    W.applySimulatorLegalToDraft(W.policyDraft, legalFilled);
    assert(W.policyDraft.pledge === true, "כלל ריסק draft keeps the pledge flag");
    assert(W.policyDraft.pledgeBanks[0].bankName === "בנק לאומי", "draft stores bankName, not name");
    assert(W.policyDraft.beneficiaries[0].firstName === "דן" && W.policyDraft.beneficiaries[0].lastName === "כהן", "draft stores the beneficiary name");
    const emptyLegal = { pledge:false, pledgeConfirmed:false, pledgeBanks:[{ bankName:"" }], beneficiaries:[] };
    W._npSimLegalByInsured = { i1: legalFilled };
    const resolved = W.resolveSimulatorLegal(emptyLegal, "i1");
    assert(resolved && resolved.pledgeBanks[0].bankName === "בנק לאומי", "empty legal object falls back to the stored map");
    W.policyDraft.company = "כלל";
    W.policyDraft.type = "בריאות";
    W.policyDraft.pledge = true;
    W.policyDraft.beneficiaries = [{ firstName:"דן" }];
    W.applySimulatorLegalToDraft(W.policyDraft, legalFilled);
    assert(W.policyDraft.pledge === false && W.policyDraft.beneficiaries.length === 0, "health draft still clears pledge/beneficiaries");
    W.policyDraft = null;
    W.ensurePolicyDraft();
    W.policyDraft.company = "כלל";
    W.policyDraft.type = "ריסק";
    const pid = W.purchaseSimulatorInsured("i1", {
      ok: true, monthlyPremium: 61.32, sumInsured: "600000"
    }, legalFilled, { skipToast: true, skipRender: true, keepPicks: true });
    const row = (W.newPolicies || []).find((p) => p.id === pid);
    assert(!!row, "purchase writes a proposal row");
    assert(row && row.pledge === true && row.pledgeBanks[0].bankName === "בנק לאומי", "added row keeps the pledge bank");
    assert(row && row.beneficiaries[0].firstName === "דן" && row.beneficiaries[0].lastName === "כהן", "added row keeps the beneficiary");
    const pledgeBankName = row ? (safeTrim(row.pledgeBanks[0].bankName) || safeTrim(row.pledgeBanks[0].name)) : "";
    const pledgeText = (row && row.pledge) ? (pledgeBankName ? ("שיעבוד · " + pledgeBankName) : "שיעבוד פעיל") : "ללא שיעבוד";
    const bens = (row && Array.isArray(row.beneficiaries) ? row.beneficiaries : []).filter((b) => !!(safeTrim(b && b.firstName) || safeTrim(b && b.lastName) || safeTrim(b && b.idNumber)));
    const benText = bens.length
      ? ("מוטבים: " + bens.map((b) => [safeTrim(b.firstName), safeTrim(b.lastName)].filter(Boolean).join(" ")).join(" · "))
      : "ללא מוטבים";
    assert(pledgeText === "שיעבוד · בנק לאומי", "compact row chip shows שיעבוד · בנק לאומי");
    assert(benText === "מוטבים: דן כהן", "compact row chip shows מוטבים: דן כהן");
    W.policyDraft = null;
    W.ensurePolicyDraft();
    W.policyDraft.company = "כלל";
    W.policyDraft.type = "ריסק";
    W._npSimLegalByInsured = { i1: legalFilled };
    const pid2 = W.purchaseSimulatorInsured("i1", {
      ok: true, monthlyPremium: 61.32, sumInsured: "600000"
    }, emptyLegal, { skipToast: true, skipRender: true, keepPicks: true });
    const row2 = (W.newPolicies || []).find((p) => p.id === pid2);
    assert(row2 && row2.pledgeBanks[0].bankName === "בנק לאומי", "purchase uses the map when the passed legal is empty");
  }

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
    const prevEmptyPledgeBank = W.emptyPledgeBank;
    const prevNormalizePledgeBanks = W.normalizePledgeBanks;
    const prevIsMedicareCompany = W.isMedicareCompany;
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
    W.emptyPledgeBank = prevEmptyPledgeBank;
    W.normalizePledgeBanks = prevNormalizePledgeBanks;
    W.isMedicareCompany = prevIsMedicareCompany;
  }

  // ── פוליסה זוגית: one row, per-insured before/after, no extra discount math ──
  {
    const added = [];
    W._npSimPickByInsured = {
      i1: { company:"כלל", product:"ריסק" },
      i2: { company:"כלל", product:"ריסק" }
    };
    W.policyDraft = { company:"כלל", type:"ריסק", insuredIds:["i1"], insuredId:"i1" };
    W._npShowPick = false;
    W.newPolicies = [];
    W.addDraftPolicy = function(opts){
      const d = this.policyDraft;
      const row = {
        id: "npol_couple",
        company: d.company,
        type: d.type,
        insuredMode: d.insuredMode,
        insuredIds: (d.insuredIds || []).slice(),
        premiumPerInsured: Object.assign({}, d.premiumPerInsured || {}),
        simDiscountPerInsured: JSON.parse(JSON.stringify(d.simDiscountPerInsured || {}))
      };
      added.push(row);
      this.newPolicies = [row];
      this.policyDraft = { company:"", type:"", insuredIds:["i1","i2"], insuredId:"i1" };
      return row.id;
    };
    const none = W.purchaseAllSimulatorInsureds([
      { insId:"i1", company:"כלל", product:"ריסק", payload:{ ok:true, monthlyPremium:61.32, sumInsured:"800000" }, label:"ראשי" }
    ], { couple:true, coupleIds:["i1"] });
    assert(added.length === 0 && (!none || none.length === 0), "couple with one insured does not write a policy");
    const pids = W.purchaseAllSimulatorInsureds([
      {
        insId:"i1", company:"כלל", product:"ריסק", label:"ראשי - דוד כהן",
        payload:{ ok:true, monthlyPremium:61.32, sumInsured:"800000", simDiscount:{ optionId:"cll-r-5001", year1Pct:65, monthlyAfterDiscount:21.46 } }
      },
      {
        insId:"i2", company:"כלל", product:"ריסק", label:"משני - יעל כהן",
        payload:{ ok:true, monthlyPremium:40, sumInsured:"500000", simDiscount:{ optionId:"cll-r-50", year1Pct:50, monthlyAfterDiscount:20 } }
      }
    ], { couple:true, coupleIds:["i1","i2"] });
    assert(added.length === 1, "couple add writes a single summary row");
    assert(added[0].insuredMode === "couple" && added[0].insuredIds.join(",") === "i1,i2", "couple row keeps both insured ids");
    assert(added[0].company === "כלל" && added[0].type === "ריסק", "couple row stays on the shared product");
    assert(String(added[0].premiumPerInsured.i1).indexOf("61.32") === 0, "primary gross premium is stored on the shared row");
    assert(String(added[0].premiumPerInsured.i2).indexOf("40") === 0, "secondary gross premium is stored on the shared row");
    const split1 = W.getPolicyInsuredPremiumSplit(added[0], "i1");
    const split2 = W.getPolicyInsuredPremiumSplit(added[0], "i2");
    assert(split1.before === 61.32 && split1.after === 21.46, "primary before/after stay 61.32 / 21.46");
    assert(split2.before === 40 && split2.after === 20, "secondary before/after stay 40 / 20");
    assert(pids.length === 1, "couple add returns one policy id");
  }

  // ── couple health: covers stay per insured on the summary row ──
  {
    W.policyDraft = null;
    W.ensurePolicyDraft();
    W.policyDraft.company = "כלל";
    W.policyDraft.type = "בריאות";
    W.applyRiskSimResultsToDraft({
      i1: {
        ok: true, monthlyPremium: 80,
        covers: [{ id:"drugs", label:"תרופות", wizardKey:"תרופות" }, { id:"transplant", label:"השתלות", wizardKey:"השתלות" }],
        simDiscount: { year1Pct:10, monthlyAfterDiscount:72 }
      },
      i3: {
        ok: true, monthlyPremium: 40,
        covers: [{ id:"drugs", label:"תרופות", wizardKey:"תרופות" }, { id:"child_services", label:"שירותים לילד", wizardKey:"שירותים לילד" }],
        simDiscount: { year1Pct:10, monthlyAfterDiscount:36 }
      }
    }, { skipRender: true, skipToast: true });
    assert(W.policyDraft.healthCoversPerInsured.i1.indexOf("תרופות") >= 0, "primary health covers stored per insured");
    assert(W.policyDraft.healthCoversPerInsured.i3.indexOf("שירותים לילד") >= 0, "child health covers stored per insured");
    assert(W.policyDraft.healthCoversPerInsured.i1.indexOf("שירותים לילד") < 0, "child-only cover is not on the primary list");
    assert(W.getPolicyInsuredCoverLabels(W.policyDraft, "i3").join(",").indexOf("שירותים לילד") >= 0, "detail reader returns the child's covers");
    assert(W.getPolicyInsuredShortName("i1") === "דוד כהן", "row names use first+last name");
    assert(W.getPolicyInsuredShortName("i1").indexOf("מבוטח ראשי") < 0, "short name does not include מבוטח ראשי");
    assert(W.getPolicyInsuredShortName("i2") === "יעל כהן", "spouse short name is first+last only");
    assert(["i1","i2"].map((id) => W.getPolicyInsuredShortName(id)).join(" · ") === "דוד כהן · יעל כהן", "couple row names join without role prefixes");
    const splitC = W.getPolicyInsuredPremiumSplit({
      premiumPerInsured: W.policyDraft.premiumPerInsured,
      simDiscountPerInsured: W.policyDraft.simDiscountPerInsured
    }, "i3");
    assert(splitC.before === 40 && splitC.after === 36, "child before/after stay 40 / 36");
  }

  // ── הצג פירוט: before/after per health cover from stored simulator quotes ──
  {
    const coverPol = {
      type: "בריאות", company: "כלל",
      insuredIds: ["i1"], insuredId: "i1",
      premiumPerInsured: { i1: "118.48" },
      healthCoversPerInsured: { i1: ["ניתוחים", "השתלות"] },
      riskSimQuotes: { i1: { covers: [
        { id: "surg", wizardKey: "ניתוחים", monthlyPremium: 70 },
        { id: "trans", wizardKey: "השתלות", monthlyPremium: 48.48 }
      ]}},
      simDiscountPerInsured: { i1: { year1Pct: 15, monthlyAfterDiscount: 100.71 } }
    };
    const coverRows = W.getPolicyInsuredCoverPremiumRows(coverPol, "i1");
    assert(coverRows.length === 2, "detail helper returns a row per cover");
    assert(coverRows[0].label === "ניתוחים" && coverRows[0].before === 70 && coverRows[0].after === 59.5, "cover before/after uses stored quote + year-1 percent");
    assert(coverRows[1].label === "השתלות" && coverRows[1].before === 48.48 && Math.abs(coverRows[1].after - 41.21) < 0.011, "second cover after-discount is 15% off 48.48");
    const coverHtml = W.renderPolicyCoverPremiumListHtml(coverPol, "i1", "ללא כיסויים");
    assert(coverHtml.includes("lcNpProw__coverPay") && coverHtml.includes("לפני הנחה") && coverHtml.includes("אחרי הנחה"), "detail list puts before/after on the cover line");
    const manualPol = Object.assign({}, coverPol, {
      coverDiscountsApplied: true,
      coverDiscounts: [{ name: "ניתוחים", pct: "10" }, { name: "השתלות", pct: "0" }]
    });
    const manualRows = W.getPolicyInsuredCoverPremiumRows(manualPol, "i1");
    assert(manualRows[0].after === 63, "manual 10% discount is used when already applied");
    assert(manualRows[1].after === 48.48, "manual 0% keeps the cover at the simulator before-price");
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
          pledge: true,
          pledgeBanks: [{ bankName:"בנק לאומי", bankNo:"10", branch:"123", amount:"200000", years:"20", address:"רחוב הבנק 1" }],
          beneficiaries: [{ firstName:"דן", lastName:"כהן", idNumber:"123456789", relationship:"בן", sharePct:"50" }],
          simDiscountPerInsured: { i1: { year1Pct: 65, monthlyAfterDiscount: 21.46, label: "65%" } }
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
        },
        {
          id: "opsCoupleHealth", company: "מנורה", type: "בריאות",
          insuredIds: ["i1", "i2"], insuredId: "i1", insuredMode: "couple",
          premiumMonthly: 400, premiumPerInsured: { i1: "220", i2: "180" },
          healthCovers: ["תרופות מחוץ לסל הבריאות", "ניתוחים בישראל מהשקל הראשון"],
          healthCoversPerInsured: {
            i1: ["תרופות מחוץ לסל הבריאות", "ניתוחים בישראל מהשקל הראשון"],
            i2: ["תרופות מחוץ לסל הבריאות"]
          },
          riskSimQuotes: {
            i1: { covers: [
              { id: "meds", wizardKey: "תרופות מחוץ לסל הבריאות", monthlyPremium: 100 },
              { id: "surg", wizardKey: "ניתוחים בישראל מהשקל הראשון", monthlyPremium: 120 }
            ]},
            i2: { covers: [
              { id: "meds", wizardKey: "תרופות מחוץ לסל הבריאות", monthlyPremium: 180 }
            ]}
          },
          startDate: "01/10/2026", discountPct: "20",
          discountOption: { label: "20% ל-10 שנים — ניתוחים שקל ראשון + ייעוץ ובדיקות", packageNum: "101527", pct: 20, years: 10 },
          simDiscountPerInsured: {
            i1: { year1Pct: 20, monthlyAfterDiscount: 176, label: "20% ל-10 שנים — ניתוחים שקל ראשון + ייעוץ ובדיקות", optionId: "mnr-h-20" },
            i2: { year1Pct: 20, monthlyAfterDiscount: 144, label: "20% ל-10 שנים — ניתוחים שקל ראשון + ייעוץ ובדיקות", optionId: "mnr-h-20" }
          }
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
    assert(opsHtml.includes("כלל") && opsHtml.includes("מגדל") && opsHtml.includes("הפניקס") && opsHtml.includes("מנורה"), "ops PDF lists each company");
    assert(opsHtml.includes("בריאות") && (opsHtml.includes("תרופות") || opsHtml.includes("ניתוחים")), "ops PDF lists health product and covers");
    assert(opsHtml.includes("דוד כהן") && opsHtml.includes("יעל כהן"), "ops PDF names multi-insured people");
    assert(opsHtml.includes("01/11/2026") && !opsHtml.includes(">2026-11-01<"), "ops PDF prints Clal start date as DD/MM/YYYY");
    assert(opsHtml.includes("15/10/2026"), "ops PDF prints Phoenix start date as DD/MM/YYYY");
    assert(opsHtml.includes("שיעבוד") && opsHtml.includes("בנק לאומי"), "ops PDF compact row includes the pledge bank");
    assert(opsHtml.includes("מוטבים") && opsHtml.includes("דן כהן"), "ops PDF compact row includes beneficiary names");
    assert(opsHtml.includes("פרמיה לפי מבוטח") && opsHtml.includes("לפני") && opsHtml.includes("אחרי"), "ops PDF lists before/after premium per insured");
    assert(opsHtml.includes("כיסויים לפי מבוטח"), "ops PDF lists health covers per insured on the couple policy");
    assert(opsHtml.includes("לפני ₪100") && opsHtml.includes("אחרי ₪80"), "ops PDF shows drugs cover before/after for the primary");
    assert(opsHtml.includes("לפני ₪120") && opsHtml.includes("אחרי ₪96"), "ops PDF shows surgeries cover before/after for the primary");
    assert(opsHtml.includes("לפני ₪180") && opsHtml.includes("אחרי ₪144"), "ops PDF shows drugs cover before/after for the spouse");
    assert((opsHtml.split("ניתוחים בישראל מהשקל הראשון").length - 1) === 2, "ops PDF does not repeat unpriced health covers above the priced list");
    assert(opsHtml.includes("101527") && (opsHtml.includes("מס'") || opsHtml.includes("מס׳") || opsHtml.includes("חבילה")), "ops PDF discount line includes package number");
    assert(opsHtml.includes("ניתוחים שקל ראשון") || opsHtml.includes("20% ל-10 שנים"), "ops PDF discount line uses the full discount label");
    const clalDisc = W.getOperationalDiscountDisplayText({
      company: "כלל", type: "בריאות", discountPct: "20",
      simDiscountPerInsured: { i1: { year1Pct: 20, label: "20% על הכול מלבד סרטן — קוד 3494", optionId: "cll-h-20-exca" } }
    });
    assert(clalDisc.includes("קוד 3494") && clalDisc.includes("3494") && /מס['׳]?\s*חבילה/.test(clalDisc), "ops discount helper keeps the full simulator label and package number");
    assert(/₪\s*1[,.]?324[.,]46/.test(opsHtml) || opsHtml.includes("1,324.46") || opsHtml.includes("1324.46"), "ops PDF grand total uses after-discount (21.46+200+783+176+144)");
    assert(W.toSimulatorDmyDate("2026-11-01") === "01/11/2026", "future ISO start date converts to DD/MM/YYYY");
    assert(W.getPolicyPremiumAfterDiscount(opsPayload.newPolicies[0]) === 61.32, "legacy after-discount helper still returns before for Clal");
    assert(W.getHealthRowPremiumAfterDiscount(opsPayload.newPolicies[0]) === 21.46, "row after-discount helper still returns simulator net for Clal");
  }

  // ── GI-NP-ROWS-ADVANCE: leftover add-form does not block Next when rows exist ──
  {
    const prevGet = W.getWizardNewPolicies;
    const prevNew = W.newPolicies;
    const prevDraft = W.policyDraft;
    const prevPurchase = W.isCustomerPurchaseMode;
    W.isCustomerPurchaseMode = () => false;
    const row = {
      id: "pAdvance",
      company: "הכשרה",
      type: "ריסק",
      insuredIds: ["i1"],
      insuredId: "i1",
      premiumPerInsured: { i1: "200" },
      startDate: "01/10/2026",
      sumInsured: "500000",
      sumInsuredPerInsured: { i1: "500000" }
    };
    W.newPolicies = [row];
    W.getWizardNewPolicies = () => W.newPolicies;
    W.policyDraft = {
      company: "",
      type: "",
      healthCovers: ["ניתוחים"],
      startDate: "01/10/2026",
      premiumPerInsured: { i1: "100" },
      insuredIds: ["i1"],
      insuredId: "i1"
    };
    assert(W.isPolicyDraftDirty() === true, "leftover add-another draft is still dirty");
    const withRows = W.validateStep5();
    assert(withRows.ok === true, "Next is allowed when summary rows already exist");
    assert(!(withRows.items || []).some((m) => String(m).indexOf("שטרם נוספה") >= 0), "incomplete add-draft does not block when rows exist");
    assert(!(withRows.items || []).some((m) => String(m).indexOf("חברת ביטוח") >= 0), "empty company on the add-form does not block when rows exist");

    W.newPolicies = [];
    const noRowsDirty = W.validateStep5();
    assert(noRowsDirty.ok === false, "empty summary still blocks when the add-draft is incomplete");
    assert((noRowsDirty.items || []).some((m) => String(m).indexOf("שטרם נוספה") >= 0 || String(m).indexOf("חברת ביטוח") >= 0), "empty summary names the incomplete add-draft");

    W.policyDraft = { company: "", type: "", healthCovers: [], startDate: "", premiumPerInsured: {}, insuredIds: ["i1"] };
    const noRowsClean = W.validateStep5();
    assert(noRowsClean.ok === false, "empty summary still requires at least one added policy");
    assert((noRowsClean.items || []).some((m) => String(m).indexOf("לפחות פוליסה") >= 0), "empty summary asks for at least one policy");

    W.getWizardNewPolicies = prevGet;
    W.newPolicies = prevNew;
    W.policyDraft = prevDraft;
    W.isCustomerPurchaseMode = prevPurchase;
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
