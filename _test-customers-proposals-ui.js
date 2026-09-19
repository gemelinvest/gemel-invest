/* GI-CUSTOMERS-PROPOSALS-UI 2026-09-19
   כפתורי פעולה בהצעות + ייצוא לקוחות בכחול התפריט,
   הסתרת מונה/הסבר בלקוחות, ותיקון סרגל החיפוש.
   בלי נגיעה בלוגיקה.
   הרצה: node _test-customers-proposals-ui.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const CSS_TAG = "20260919-customers-ui-v1";
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

function sliceBetween(src, startMark, endMark){
  const start = src.indexOf(startMark);
  const end = src.indexOf(endMark, start);
  if(start < 0 || end < 0 || end <= start) return "";
  return src.slice(start, end);
}

const html = read("index.html");
const app = read("app.js");
const css = read("app.css");
const theme = read("theme.css");
const unify = read("theme-unify-flat.css");
const verify = read("_verify-customers-live.html");

const customersStart = html.indexOf('id="view-customers"');
const customersEnd = html.indexOf('id="view-elementaryPending"');
const customersBlock = customersStart >= 0 && customersEnd > customersStart
  ? html.slice(customersStart, customersEnd) : "";

const themeCustomers = sliceBetween(
  theme,
  "GI-CUSTOMERS-PROPOSALS-UI 2026-09-19 — hide hint + count",
  "#view-customers .tableWrap .table:not(#\\9)"
);
const themeProposals = sliceBetween(
  theme,
  "GI-CUSTOMERS-PROPOSALS-UI 2026-09-19 — row primaries",
  "GI-CF-HIER"
);
const unifyProposals = sliceBetween(
  unify,
  "GI-CUSTOMERS-PROPOSALS-UI 2026-09-19 — proposals row primaries",
  "#view-customers .btn--success"
);

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-customers-proposals-ui.js")]).status === 0, "node --check this test");
assert(html.includes("app.css?v=" + CSS_TAG), "index.html app.css cache");
assert(html.includes("theme.css?v=" + CSS_TAG), "index.html theme.css cache");
assert(theme.includes("GI-CUSTOMERS-PROPOSALS-UI 2026-09-19"), "theme build marker");
assert(unify.includes("GI-CUSTOMERS-PROPOSALS-UI 2026-09-19"), "unify-flat build marker");

console.log("\n2) הצעות — כפתורי פעולה בכחול התפריט");
assert(!!themeProposals, "בלוק עיצוב כפתורי הצעות ב-theme");
assert(themeProposals.includes("background: var(--gi-navy)"), "theme primary fill is sidebar blue");
assert(themeProposals.includes("var(--gi-navy-hover)"), "theme primary hover is sidebar hover");
assert(!themeProposals.includes("#1e4d6b"), "theme proposals left dark navy");
assert(!!unifyProposals, "בלוק unify לכפתורי הצעות");
assert(unifyProposals.includes("background: var(--gi-navy)"), "unify primary fill is sidebar blue");
assert(!unifyProposals.includes("var(--uf-accent)"), "unify proposals left dark navy accent");
assert(css.includes("#view-proposals .lcCustomers__rowActions--proposals .btn.btn--primary"), "app.css proposals primary rule");
assert(css.includes("background: var(--gi-navy, #3870ED)"), "app.css proposals uses sidebar blue");

console.log("\n3) לקוחות — הסתרת מונה והסבר בלי למחוק את ה-DOM");
assert(!!customersBlock, "בלוק view-customers נמצא");
assert(customersBlock.includes('id="customersCountBadge"'), "badge stays in DOM for JS writers");
assert(customersBlock.includes("card__hint"), "hint node stays; hidden by CSS");
assert(themeCustomers.includes("display: none !important"), "theme hides hint/count");
assert(themeCustomers.includes("#customersCountBadge"), "theme hide targets the badge id");
assert(css.includes("#view-customers #customersCountBadge"), "app.css hides badge");
assert(css.includes("#view-customers .lcCustomersCard > .card__head .card__hint"), "app.css hides hint");
assert(app.includes("this.els.customersCountBadge = $(\"#customersCountBadge\")"), "JS still binds the badge");
assert(app.includes("UI.els.customersCountBadge.textContent"), "JS still writes badge text");

console.log("\n4) ייצוא לקוחות בכחול התפריט");
assert(themeCustomers.includes("#btnCustomersExport.btn.btn--primary"), "theme export selector beats unify-flat");
assert(themeCustomers.includes("background: var(--gi-navy)"), "theme export fill is sidebar blue");
assert(!themeCustomers.includes("#1e4d6b"), "theme export left dark navy");
assert(unify.includes("#view-customers #btnCustomersExport.btn.btn--primary"), "unify export uses extra class spec");
assert(unify.includes("background: var(--gi-navy) !important") && unify.includes("#btnCustomersExport"), "unify export fill is sidebar blue");
assert(css.includes("background: var(--gi-navy, #3870ED)") && css.includes("#btnCustomersExport"), "app.css export uses sidebar blue");

console.log("\n5) חיפוש לקוחות — חפש אח נפרד, בלי overflow נסתר");
assert(customersBlock.includes("lcCustomers__searchCluster"), "search cluster wrapper in HTML");
assert(customersBlock.includes('id="customersSearch"'), "search input id stays");
assert(customersBlock.includes('id="customersSearchBtn"'), "search button id stays");
{
  const wrapStart = customersBlock.indexOf("lcCustomers__searchWrap");
  const wrapOpenEnd = customersBlock.indexOf(">", wrapStart);
  const wrapClose = customersBlock.indexOf("</div>", wrapOpenEnd);
  const wrapInner = customersBlock.slice(wrapOpenEnd, wrapClose);
  assert(wrapStart >= 0 && wrapClose > wrapOpenEnd, "search wrap markup is intact");
  assert(wrapInner.includes("customersSearch"), "input remains inside the wrap");
  assert(!wrapInner.includes("customersSearchBtn"), "חפש is a sibling outside the wrap");
  assert(customersBlock.indexOf("customersSearchBtn") > wrapClose, "חפש sits after the input wrap");
}
assert(themeCustomers.includes("overflow: visible !important"), "theme search wrap does not clip חפש");
assert(themeCustomers.includes("lcCustomers__searchCluster"), "theme styles the cluster");
assert(themeCustomers.includes("max-width: 380px"), "theme caps the long search bar");
assert(themeCustomers.includes("#customersSearchBtn.search__btn"), "theme styles חפש as its own control");
assert(css.includes("overflow: visible") && css.includes("lcCustomers__searchWrap"), "app.css search wrap does not clip");
assert(css.includes("max-width: 380px"), "app.css caps search width");
assert(!themeCustomers.includes("overflow: hidden"), "theme customers search no longer uses overflow hidden");
assert(app.includes('on($("#customersSearchBtn"), "click"'), "search click handler stays");
assert(app.includes("this.els.customersSearch = $(\"#customersSearch\")"), "search input binding stays");

console.log("\n6) אין נגיעה בלוגיקה + דף אימות");
assert(app.includes("renderProposalRowHtml"), "proposal row renderer stays");
assert(app.includes('data-open-proposal="'), "continue-edit action stays");
assert(app.includes("bindProposalRowActions"), "proposal action binding stays");
assert(app.includes("CustomersUI.exportToExcel"), "export handler stays");
assert(html.includes('id="btnCustomersExport"'), "export button stays");
assert(html.includes('id="proposalsTbody"'), "proposals tbody stays");
assert(verify.includes("lcCustomers__searchCluster"), "live verify page matches search layout");
assert(verify.includes("lcCustomers__rowActions--proposals"), "live verify page includes proposals actions");
assert(verify.includes('id="customersCountBadge"'), "live verify keeps the badge node");

if(failed){
  console.error("\nFAILED " + failed + " / passed " + passed);
  process.exit(1);
}
console.log("\nOK  " + passed + " assertions");
