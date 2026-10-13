#!/usr/bin/env node
"use strict";
/* GI-BEN-ADD-SECOND
   באשף בריאות וסיכונים, «+ הוסף מוטב» אחרי מוטב ראשון נדרס כי הרענון
   תפס שוב את שורת ה-DOM הישנה. כמו הוספת בנק שני: persist ואז skipCapture.
   הרצה: node _test-legal-ben-second-add.js
*/

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const SIM_TAG = "20261007-np-health-buy-v1";

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function sliceBetween(src, startNeedle, endNeedle) {
  const start = src.indexOf(startNeedle);
  assert.ok(start >= 0, "missing " + startNeedle);
  const end = src.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(end > start, "missing end after " + startNeedle);
  return src.slice(start, end);
}

function safeTrim(v) {
  return String(v == null ? "" : v).trim();
}

const sims = read("gi-simulators.js");
const app = read("app.js");
const html = read("index.html");

assert.equal(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-simulators.js")]).status, 0, "node --check gi-simulators.js");
assert.equal(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status, 0, "node --check app.js");
assert.ok(app.includes('GI_SIMULATOR_JS_HREF = "./gi-simulators.js?v=' + SIM_TAG + '"'), "simulator cache prefix stays");
assert.ok(app.includes('&giMultiIns=1" + "&giBen2=1"'), "simulator href busts the second-beneficiary fix");
assert.ok(html.includes("giAuthLock=1&giBen2=1"), "index.html loads the app.js that points at the new simulator");
assert.ok(sims.includes("GI-BEN-ADD-SECOND"), "second-beneficiary marker");

const addSrc = sliceBetween(
  sims,
  'const addBen = modal.querySelector("[data-gishell-legal-ben-add]");',
  'modal.querySelectorAll("[data-gishell-legal-ben-remove]")'
);
assert.ok(addSrc.includes("persist();"), "add persists the first row before pushing");
assert.ok(addSrc.includes("legal.beneficiaries.push(riskSimEmptyBeneficiary())"), "add pushes one empty beneficiary");
assert.ok(addSrc.includes("riskSimRefreshLegalPanel(sim, { skipCapture: true })"), "add refresh does not recapture the one-row DOM");
assert.ok(!/riskSimRefreshLegalPanel\(sim\)\s*;/.test(addSrc), "add no longer refreshes without skipCapture");

const removeSrc = sliceBetween(
  sims,
  'modal.querySelectorAll("[data-gishell-legal-ben-remove]")',
  "function riskSimPickHtml(sim){"
);
assert.ok(removeSrc.includes("legal.beneficiaries.splice(idx, 1)"), "remove still drops the chosen row");
assert.ok(removeSrc.includes("riskSimRefreshLegalPanel(sim, { skipCapture: true })"), "remove refresh does not restore the row from the old DOM");
assert.ok(!/riskSimRefreshLegalPanel\(sim\)\s*;/.test(removeSrc), "remove no longer refreshes without skipCapture");

const bensToggle = sliceBetween(
  sims,
  'modal.querySelectorAll("[data-gishell-legal-bens]")',
  'modal.querySelectorAll("[data-gishell-legal-heirs]")'
);
assert.ok(bensToggle.includes("legal.beneficiaries = [riskSimEmptyBeneficiary()]"), "checking מוטבים still opens the first row");
assert.ok(bensToggle.includes("riskSimRefreshLegalPanel(sim);"), "first-row checkbox refresh stays unchanged");

const mountSrc = sliceBetween(sims, "function riskSimMountLegalPanel(sim, opts){", "function riskSimRefreshLegalPanel(sim, opts){");
assert.ok(mountSrc.includes("if(!(opts && opts.skipCapture)){"), "mount still recaptures unless asked to skip");

const capBody = sliceBetween(
  sims,
  'const benRows = dock.querySelectorAll("[data-gishell-legal-ben]");',
  "const map = riskSimEnsureLegalMap(sim);"
);
const captureBens = new Function(
  "dock",
  "legal",
  "safeTrim",
  "riskSimEmptyBeneficiary",
  capBody + "\nreturn legal;"
);

function emptyBen() {
  return { firstName: "", lastName: "", idNumber: "", birthDate: "", phone: "", relationship: "", sharePct: "" };
}
function row(idx, values) {
  return {
    getAttribute(name) {
      return name === "data-gishell-legal-ben" ? String(idx) : "";
    },
    querySelector(sel) {
      const match = /data-gishell-legal-ben-field="([^"]+)"/.exec(sel);
      const field = match ? match[1] : "";
      return { value: values[field] || "" };
    }
  };
}
function dockOf(rows) {
  return {
    querySelectorAll(sel) {
      return sel === "[data-gishell-legal-ben]" ? rows : [];
    }
  };
}

const kept = { beneficiariesOn: true, beneficiaries: [{ firstName: "דנה" }, emptyBen()] };
const recaptured = captureBens(dockOf([row(0, { firstName: "דנה" })]), {
  beneficiariesOn: true,
  beneficiaries: [{ firstName: "דנה" }, emptyBen()]
}, safeTrim, emptyBen);
assert.equal(recaptured.beneficiaries.length, 1, "recapture of the old row drops the beneficiary that was just pushed");
assert.equal(recaptured.beneficiaries[0].firstName, "דנה", "recapture keeps the first beneficiary");
assert.equal(kept.beneficiaries.length, 2, "skipCapture leaves both the filled row and the new empty row");

const two = captureBens(dockOf([
  row(0, { firstName: "דנה", sharePct: "60" }),
  row(1, { firstName: "יוסי", sharePct: "40" })
]), { beneficiaries: [] }, safeTrim, emptyBen);
assert.equal(two.beneficiaries.length, 2, "capture keeps two rows once both are on screen");
assert.equal(two.beneficiaries[1].firstName, "יוסי", "second row is read by its index");
assert.equal(two.beneficiaries[1].sharePct, "40", "second share is kept");

console.log("OK: second beneficiary stays after add");
