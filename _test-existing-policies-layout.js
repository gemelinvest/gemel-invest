/* GI-EXIST-POL-LAYOUT 2026-09-19
   לייאאוט כיסויים/פעולות בטבלת פוליסות קיימות (שלב 2) — CSS בלבד.
   לוגיקת ביטול/כיסויים ב-gi-wizard.js חייבת להישאר זהה.
   הרצה: node _test-existing-policies-layout.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260919-exist-pol-layout-v1";
const WIZARD_TAG = "20260919-agent-floor-v6";
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

function blockAround(src, needle, before, after){
  const i = src.indexOf(needle);
  if(i < 0) return "";
  return src.slice(Math.max(0, i - before), i + needle.length + after);
}

const app = read("app.js");
const css = read("app.css");
const theme = read("theme.css");
const html = read("index.html");
const sw = read("service-worker.js");
const wizard = read("gi-wizard.js");

console.log("1) cache — CSS/app only, wizard unchanged");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(app.includes('const BUILD = "' + TAG + '"'), "app.js BUILD");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + TAG), "index.html app.css cache");
assert(html.includes("theme.css?v=" + TAG), "index.html theme.css cache");
assert(sw.includes("gi-v12-" + TAG), "service-worker cache");
assert(app.includes("theme-unify-flat.css?v=" + TAG), "unify-flat cache");
assert(app.includes('GI_WIZARD_JS_VERSION = "' + WIZARD_TAG + '"'), "gi-wizard cache tag not bumped");
assert(!wizard.includes("GI-EXIST-POL-LAYOUT"), "gi-wizard.js has no layout patch mark");

console.log("\n2) CSS: רשת כיסויים 2×2 — שם מימין / סכום משמאל");
assert(css.includes("GI-EXIST-POL-LAYOUT 2026-09-19"), "app.css layout mark");
assert(theme.includes("GI-EXIST-POL-LAYOUT 2026-09-19"), "theme.css layout mark");
assert(/\.lcHarCompactCovers\{[\s\S]{0,180}display:grid;[\s\S]{0,80}grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/.test(css), "covers are a 2-col grid");
assert(/\.lcHarCompactCover\{[\s\S]{0,220}justify-content:space-between/.test(css), "cover row is name/amount space-between");
assert(/\.lcHarCompactCover b\{[\s\S]{0,180}-webkit-line-clamp:2/.test(css), "cover name wraps up to two lines");
assert(/\.lcHarCompactCover span\{[\s\S]{0,160}font-variant-numeric:tabular-nums/.test(css), "cover amount is tabular");
assert(/th:nth-child\(4\)\{ width:34%; \}/.test(css), "cover column widened to 34%");
assert(/td:nth-child\(4\)\{\s*overflow:visible/.test(css), "cover cell overflow visible");

console.log("\n3) CSS: רשת פעולות 2×2 שוות גובה");
assert(/\.lcHarCompactChips\{[\s\S]{0,180}display:grid;[\s\S]{0,80}grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/.test(css), "chips are a 2-col grid");
assert(/\.lcHarCompactChips \.lcPolChip\{[\s\S]{0,220}width:100%/.test(css), "chips stretch to equal cell width");
assert(/\.lcHarCompactChips \.lcPolChip\{[\s\S]{0,280}min-height:32px/.test(css), "chips have equal min-height");
assert(/\.lcHarCompactChips \.lcWBadge\{[\s\S]{0,80}grid-column:1 \/ -1/.test(css), "pledge badge spans both chip columns");
assert(/td:last-child\{[\s\S]{0,80}overflow:visible/.test(css), "actions cell overflow visible");
assert(theme.includes("grid-template-columns: minmax(0,1fr) minmax(0,1fr) !important"), "theme.css locks the 2-col grids");

console.log("\n4) לוגיקת כיסויים ב-wizard לא זזה");
assert(wizard.includes('premiumBreakdown.map(item => `<span class="lcHarCompactCover"><b>${escapeHtml(safeTrim(item.label) || \'כיסוי\')}</b><span>${escapeHtml(safeTrim(item.monthlyPremium) || \'0.00\')} ₪</span></span>`'), "health cover HTML still label + monthlyPremium");
assert(wizard.includes('const coverPills = premiumBreakdown.length'), "coverPills still driven by premiumBreakdown");
assert(wizard.includes('? `<div class="lcHarCompactCovers">${premiumBreakdown.map'), "covers wrap is still lcHarCompactCovers");
assert(wizard.includes('class="lcHarCompactCover lcHarCompactCover--missing"'), "missing-sum cover class unchanged");
assert(wizard.includes('data-har-sum-confirm="1"'), "sum input still uses har-sum confirm");
assert(wizard.includes('data-cover-label="${escapeHtml(lbl)}"'), "partial cover toggle still uses data-cover-label");
assert(wizard.includes('data-cancel-key="partialCovers"'), "partial covers still write cancellations.partialCovers");

console.log("\n5) לוגיקת פעולות/ביטול ב-wizard לא זזה");
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
assert(wizard.includes('data-cancel-key="status" data-cancel-chip-value="${escapeHtml(o.v)}"'), "chip still writes status via data-cancel-chip-value");
assert(wizard.includes('if(part === "chips"){\n        return `<div class="lcHarCompactChips">${chipsHtml}'), "compact chips part still wraps existing chip HTML");
assert(wizard.includes("ensureExistingPolicyActionDelegation"), "delegation helper exists");
assert(wizard.includes("handleExistingPolicyActionClick"), "delegated click handler exists");
assert(wizard.includes("unlockExistingPolicyActionsAfterHarImport"), "post-import unlock exists");
const chipRender = blockAround(wizard, 'const chipsHtml = chipOptions.map((o) =>', 0, 280);
assert(chipRender.includes('class="lcPolChip'), "chips still render as lcPolChip buttons");
assert(!/getExistingPolicyCancelOptions\(\)\{[\s\S]{0,400}grid-template/.test(wizard), "wizard cancel options have no layout CSS");

console.log("\n6) רגרסיה קיימת: קליק סטטוס/כיסוי חלקי");
const clickTest = spawnSync(process.execPath, [path.join(ROOT, "_test-existing-policy-status-click.js")], { encoding: "utf8" });
assert(clickTest.status === 0, "_test-existing-policy-status-click.js still passes");
if(clickTest.status !== 0){
  console.error(clickTest.stdout || "");
  console.error(clickTest.stderr || "");
}

console.log("\n" + passed + " passed, " + failed + " failed");
if(failed) process.exit(1);
