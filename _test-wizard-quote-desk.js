/* GI-NP-QUOTE-DESK — סידור ריסק באשף בלי לגעת בחישוב, בבריאות או במשכנתא.
   הרצה: node _test-wizard-quote-desk.js
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

const sims = read("gi-simulators.js");
const shell = read("simulators-shell.css");
const app = read("app.js");
const sw = read("service-worker.js");

const gateStart = sims.indexOf("function riskSimQuoteDeskProduct");
const gateEnd = sims.indexOf("function riskSimLayoutStandaloneBody");
assert(gateStart > 0 && gateEnd > gateStart, "quote desk helpers exist before the layout");
const helpers = sims.slice(gateStart, gateEnd);
assert(helpers.includes('safeTrim(sim._ctx.product) === "ריסק"'), "quote desk is only the risk product");
assert(helpers.includes("sim._ctx.wizardWorkspace && !coversWrap"), "quote desk requires the wizard and no cover list");
assert(!helpers.includes('"ריסק משכנתא"'), "mortgage is not on the quote desk path");

const layoutStart = sims.indexOf("function riskSimLayoutStandaloneBody");
const layoutEnd = sims.indexOf("function riskSimCoverScrollKey");
const layout = sims.slice(layoutStart, layoutEnd);
assert(layout.includes('layout.classList.add("giSimShell__layout--quoteDesk")'), "wizard risk layout is marked");
assert(layout.includes("layout.appendChild(covers)"), "health and other products still get the second column");
assert(layout.includes("riskSimQuoteDeskArrangeFields(grid, ageBox)"), "risk fields are reordered inside the same card");
assert(layout.includes('coversWrap ? "giSimShell__panel--covers"'), "cover list panel class is unchanged");

const footStart = sims.indexOf("const quoteDeskFoot = wizardFoot");
const footEnd = sims.indexOf("function riskSimBindStandaloneChrome", footStart);
const foot = sims.slice(footStart, footEnd);
assert(foot.includes('safeTrim(sim._ctx && sim._ctx.product) === "ריסק"'), "footer hierarchy is risk-only");
assert(foot.includes("giSimShell__premTray"), "premium figures sit in one tray");
assert(foot.indexOf("calcBtnHtml") < foot.indexOf("buyBtnHtml") && foot.includes("? `${calcBtnHtml}${buyBtnHtml}${closeBtnHtml}`"), "calculate stays the first action on the quote desk");
assert(foot.includes("`${backBtnHtml}${closeBtnHtml}${calcBtnHtml}${buyBtnHtml}`"), "other products keep the previous footer order");

assert(sims.includes("if(tray) tray.appendChild(block)"), "after-discount premium joins the tray when it exists");
assert(sims.includes("else if(actions) foot.insertBefore(block, actions)"), "without a tray the after-discount premium stays where it was");

assert(shell.includes(".giSimShell__layout--quoteDesk"), "quote desk styles exist");
assert(shell.includes(".giSimShell__layout--quoteDesk .giSimShell__panel--details [class*=\"__grid\"]"), "details grid is two columns only on the quote desk");
assert(/giSimShellModal--docked \.giSimShell__layout\{[^}]*flex:1 1 auto !important/.test(shell), "the shared docked layout stretch rule stays");
assert(!/\.giSimShellModal--docked \.giSimShell__panel--details \[class\*="__result--ok"\]\{/.test(shell), "navy result card is not limited to the details column");

assert(app.includes('GI_SIMULATOR_JS_HREF = "./gi-simulators.js?v=20261007-np-health-buy-v1"'), "simulator cache prefix stays");
assert(app.includes('"&giQuoteDesk=1"'), "simulator cache gains the quote desk token");
assert(app.includes("simulators-shell.css?v=20260927-legal-text-v1&giHealthMan=1&giNpPlan=1&giOnyxMark=1&giQuoteDesk=1"), "shell css cache gains the quote desk token");
assert(sw.includes("meta-fn-v1-quote-desk-v1"), "service worker cache changes with the layout");

function safeTrim(v){ return String(v == null ? "" : v).replace(/\s+/g, " ").trim(); }
class Node {
  constructor(className, text){
    this.className = className || "";
    this.textContent = text || "";
    this.children = [];
    this.parentNode = null;
  }
  querySelector(sel){
    const all = this.querySelectorAll(sel);
    return all[0] || null;
  }
  querySelectorAll(sel){
    const out = [];
    const wantsLabel = sel.indexOf("__label") >= 0 || sel.indexOf("label") >= 0;
    const walk = (node) => {
      if(wantsLabel && String(node.className || "").indexOf("__label") >= 0) out.push(node);
      node.children.forEach(walk);
    };
    this.children.forEach(walk);
    return out;
  }
  appendChild(child){
    if(child.parentNode){
      child.parentNode.children = child.parentNode.children.filter((c) => c !== child);
    }
    child.parentNode = this;
    this.children.push(child);
    return child;
  }
}
function field(label){
  const wrap = new Node("lcClalRisk__field");
  wrap.appendChild(new Node("lcClalRisk__label", label));
  return wrap;
}

const runner = new Function("safeTrim", helpers + "\nreturn { riskSimQuoteDeskProduct, riskSimQuoteDeskArrangeFields };");
const api = runner(safeTrim);
const grid = new Node("lcClalRisk__grid");
["תאריך לידה", "תחילת ביטוח", "מין", "עישון", "סכום ביטוח", "עיסוק"].forEach((label) => grid.appendChild(field(label)));
const age = new Node("giSimShell__ageBadge", "50");
api.riskSimQuoteDeskArrangeFields(grid, age);
const order = grid.children.map((child) => {
  if(String(child.className).indexOf("ageBadge") >= 0) return "גיל";
  const lab = child.children[0];
  return lab ? lab.textContent : "";
});
assert(JSON.stringify(order) === JSON.stringify(["תאריך לידה", "מין", "תחילת ביטוח", "גיל", "עישון", "סכום ביטוח", "עיסוק"]), "fields sit birth, gender, start, age, then the rest");

const ctx = (product, wizard, covers) => api.riskSimQuoteDeskProduct({ _ctx: { product, wizardWorkspace: wizard } }, covers);
assert(ctx("ריסק", true, null) === true, "wizard risk without covers uses the quote desk");
assert(ctx("ריסק משכנתא", true, null) === false, "mortgage stays on the previous layout");
assert(ctx("בריאות", true, {}) === false, "health with a cover list stays on the previous layout");
assert(ctx("ריסק", false, null) === false, "simulator center risk stays on the previous layout");
assert(ctx("מחלות קשות", true, null) === false, "critical illness stays on the previous layout");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
