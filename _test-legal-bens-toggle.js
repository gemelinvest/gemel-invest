#!/usr/bin/env node
"use strict";
/* GI-LEGAL-BENS-TOGGLE 2026-09-27
   צ'קבוקס מוטבים בסימולטור ריסק: סימון מציג שורה, ביטול מסתיר ומבטל.
   בלי מנועי פרמיה. הרצה: node _test-legal-bens-toggle.js
*/

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const SIM_TAG = "20260930-phoenix-life-ci-v1";

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function sliceFn(src, startNeedle, endNeedle) {
  const start = src.indexOf(startNeedle);
  if (start < 0) return "";
  const end = src.indexOf(endNeedle, start + startNeedle.length);
  if (end < 0) return src.slice(start);
  return src.slice(start, end);
}

const sims = read("gi-simulators.js");
const app = read("app.js");

assert.equal(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-simulators.js")]).status, 0, "node --check gi-simulators.js");
assert.ok(app.includes('GI_SIMULATOR_JS_HREF = "./gi-simulators.js?v=' + SIM_TAG + '"'), "simulator cache");
assert.ok(sims.includes("GI-LEGAL-BENS-TOGGLE"), "bens toggle marker");
assert.ok(sims.includes('data-gishell-legal-bens="1"'), "beneficiaries checkbox markup");
assert.ok(sims.includes('data-gishell-legal-pledge="1"'), "pledge checkbox markup unchanged");
assert.ok(sims.includes('data-gishell-legal-ben-add="1"'), "add-beneficiary action kept");
assert.ok(sims.includes("beneficiariesOn"), "legal flag for beneficiaries checkbox");
assert.ok(sims.includes("computeHachsharaCiPremium"), "premium engines untouched");

const htmlFn = sliceFn(sims, "function riskSimLegalInnerHtml(sim){", "function riskSimMountLegalPanel(sim){");
assert.ok(htmlFn.includes("const bensOn = !!legal.beneficiariesOn"), "rows gated by checkbox");
assert.ok(htmlFn.includes("const bens = bensOn ? (legal.beneficiaries || []) : []"), "hidden when unchecked");
assert.ok(htmlFn.includes('data-gishell-legal-ben-add="1"'), "add button still in template when on");

const bindFn = sliceFn(sims, "function riskSimBindLegalPanel(sim){", "function riskSimPickHtml(sim){");
assert.ok(bindFn.includes('[data-gishell-legal-bens]'), "bind listens to beneficiaries checkbox");
assert.ok(bindFn.includes("legal.beneficiariesOn = !!el.checked"), "checkbox writes the flag");
assert.ok(bindFn.includes("legal.beneficiaries = []"), "uncheck clears beneficiaries");
assert.ok(bindFn.includes("legal.beneficiaries = [riskSimEmptyBeneficiary()]"), "check adds one empty row");
assert.ok(bindFn.includes("legal.pledge = !!el.checked"), "pledge handler unchanged");

const capFn = sliceFn(sims, "function riskSimCaptureLegalFromDom(sim){", "function riskSimLegalInnerHtml(sim){");
assert.ok(capFn.includes("[data-gishell-legal-bens]"), "capture reads beneficiaries checkbox");
assert.ok(capFn.includes("if(benRows.length)"), "beneficiaries overwritten only when rows exist");

console.log("OK: legal beneficiaries checkbox hides and cancels on uncheck");
