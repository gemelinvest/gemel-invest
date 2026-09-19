/* GI-MYLEADS-CHROME 2026-09-19
   לחצני הלידים שלי בכחול הסיידבאר + הדרגת צבע שורה.
   הרצה: node _test-my-leads-chrome.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260919-lead-color-wash-v1";
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
const css = read("app.css");
const theme = read("theme.css");
const unify = read("theme-unify-flat.css");
const html = read("index.html");
const sw = read("service-worker.js");

console.log("1) cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(app.includes('const BUILD = "' + TAG + '"'), "app.js BUILD");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + TAG), "index.html app.css cache");
assert(html.includes("theme.css?v=" + TAG), "index.html theme.css cache");
assert(sw.includes("gi-v12-" + TAG), "service-worker cache");
assert(app.includes("theme-unify-flat.css?v=" + TAG), "unify-flat cache");

console.log("\n2) לחצנים בכחול הסיידבאר");
assert(unify.includes("GI-MYLEADS-CHROME 2026-09-19"), "unify-flat mark");
assert(theme.includes("GI-MYLEADS-CHROME 2026-09-19"), "theme.css mark");
assert(unify.includes("#view-campaignMyLeads .btn--primary") && unify.includes("background: #3870ED"), "שייך לנציג בכחול הסיידבאר");
assert(unify.includes("#view-campaignMyLeads .mcSearch__chip.is-active") && unify.includes("background: #3870ED"), "צ'יפ הכל בכחול הסיידבאר");
assert(theme.includes("#view-campaignMyLeads .btn--primary") && theme.includes("var(--gi-navy)"), "theme.css primary uses sidebar navy");
assert(!/#view-campaignMyLeads[\s\S]{0,80}--uf-accent:\s*#1a4f7a/.test(unify.slice(unify.indexOf("GI-MYLEADS-CHROME"))), "my leads override is not the old navy");

console.log("\n3) הדרגת צבע שורה");
assert(css.includes(".lcMyLeadCard.lcLeadRow--custom-color"), "custom color class on my-lead card");
assert(css.includes("linear-gradient(to left, rgba(255,255,255,.42)") && css.includes("var(--lead-custom-color) !important"), "gradient sits over the real selected color");
assert(!css.includes("color-mix(in srgb, var(--lead-custom-color) 22%, #ffffff)"), "no pale 22% mix that swallows light colors");
assert(!/^\s*\.lcMyLeadCard\.lcLeadRow--custom-color\{\s*background:\s*var\(--lead-custom-color\)/m.test(css), "no solid custom fill on my-lead card");
assert(unify.includes("rgba(255,255,255,.42)") && unify.includes("var(--lead-custom-color) !important"), "unify keeps the color wash");
assert(theme.includes("rgba(255,255,255,.42)") && theme.includes("var(--lead-custom-color) !important"), "theme keeps the color wash");
assert(css.includes("border-inline-start-color: var(--lead-custom-color)"), "selected color stays on the accent bar");

console.log("\n" + passed + " passed, " + failed + " failed");
if(failed) process.exit(1);
