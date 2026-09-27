#!/usr/bin/env node
"use strict";
/* GI-LEGAL-TEXT-SIZE 2026-09-27
   הגדלת טקסט בפאנל שיעבוד/מוטבים של ריסק באשף. CSS בלבד.
   הרצה: node _test-legal-panel-text-size.js
*/

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const CSS_TAG = "20260927-legal-text-v1";

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function sliceRule(css, selector) {
  const start = css.indexOf(selector);
  if (start < 0) return "";
  const brace = css.indexOf("{", start);
  const end = css.indexOf("}", brace);
  if (brace < 0 || end < 0) return "";
  return css.slice(start, end + 1);
}

const css = read("simulators-shell.css");
const sims = read("gi-simulators.js");
const app = read("app.js");

assert.equal(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-simulators.js")]).status, 0, "simulators js unchanged-syntax");
assert.ok(css.includes("GI-LEGAL-TEXT-SIZE"), "css marker");
assert.ok(app.includes("simulators-shell.css?v=" + CSS_TAG), "shell css cache bust");

const field = sliceRule(css, ".giSimShell__legalField{");
assert.ok(/font-size:\s*15px/.test(field), "legal field labels are 15px");
assert.ok(!/font-size:\s*12px/.test(field), "legal field labels are no longer 12px");

const inputs = sliceRule(css, ".giSimShell__legalField input,");
assert.ok(/font-size:\s*16px/.test(inputs), "legal inputs are 16px");
assert.ok(/min-height:\s*44px/.test(inputs), "legal inputs are taller");
assert.ok(!/font-size:\s*13px/.test(inputs), "legal inputs are no longer 13px");

const toggle = sliceRule(css, ".giSimShell__legalToggle{");
assert.ok(/font-size:\s*16px/.test(toggle), "pledge/beneficiaries toggle is 16px");

const addBtn = sliceRule(css, ".giSimShell__legalAddBtn{");
assert.ok(/font-size:\s*15px/.test(addBtn), "add buttons are 15px");

const summarySpan = sliceRule(css, ".giSimShell__legalSummaryItem span{");
assert.ok(/font-size:\s*14px/.test(summarySpan), "summary labels are 14px");
assert.ok(!/font-size:\s*11px/.test(summarySpan), "summary labels are no longer 11px");

assert.ok(sims.includes('data-gishell-legal-pledge="1"'), "pledge checkbox markup unchanged");
assert.ok(sims.includes('data-gishell-legal-ben-add="1"'), "add-beneficiary action unchanged");
assert.ok(sims.includes("function riskSimBindLegalPanel(sim){"), "legal bind logic unchanged");
assert.ok(sims.includes("function riskSimCaptureLegalFromDom(sim){"), "legal capture logic unchanged");
assert.ok(sims.includes("computeHachsharaCiPremium"), "premium engines untouched");

console.log("OK: legal panel text size enlarged, logic untouched");
