#!/usr/bin/env node
"use strict";
/* GI-SIM-BIRTHDATE-DMY 2026-09-27
   תאריך לידה בסימולטורי בריאות וסיכונים נוצר ומוזן כ-DD/MM/YYYY.
   בלי שינוי מנועי פרמיה. הרצה: node _test-sim-birthdate-dmy.js
*/

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20261001-ops-referral-alert-v1";

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function extractNamedFunction(src, name) {
  const start = src.indexOf("function " + name + "(");
  if (start < 0) throw new Error("missing function " + name);
  const brace = src.indexOf("{", start);
  let depth = 0;
  for (let i = brace; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error("unclosed function " + name);
}

function loadDateFns() {
  const app = read("app.js");
  const safeTrim = "function safeTrim(v){ return String(v == null ? '' : v).trim(); }";
  const code = [
    safeTrim,
    extractNamedFunction(app, "formatDmyFromParts"),
    extractNamedFunction(app, "formatDmyFromDigits"),
    extractNamedFunction(app, "parseAnyDmyDate"),
    extractNamedFunction(app, "parseBirthDateValue")
  ].join("\n");
  const sandbox = { Date, Number, String, console };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: "date-fns.js" });
  return sandbox;
}

{
  const app = read("app.js");
  const sims = read("gi-simulators.js");
  const wiz = read("gi-wizard.js");
  const css = read("simulators-shell.css");
  assert.equal(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status, 0, "node --check app.js");
  assert.equal(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-simulators.js")]).status, 0, "node --check gi-simulators.js");
  assert.equal(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status, 0, "node --check gi-wizard.js");
  assert.ok(app.includes('GI_SIMULATOR_JS_HREF = "./gi-simulators.js?v=20261001-ops-referral-alert-v1"'), "simulator chunk cache");
  assert.ok(app.includes("simulators-shell.css?v=20260927-legal-text-v1"), "shell css cache");
  assert.ok(sims.includes("GI-SIM-BIRTHDATE-DMY"), "birthdate marker");
  assert.ok(sims.includes("function riskSimNormalizeDmyDate"), "shared normalize helper");
  assert.ok(sims.includes("function riskSimNormalizeStateDates"), "state normalize helper");
  assert.ok(sims.includes("riskSimNormalizeStateDates(handler)"), "shell open normalizes dates");
  assert.ok(wiz.includes("const n = this.toSimulatorDmyDate(bd);"), "wizard copies birthDate as DD/MM/YYYY");
  assert.ok(/\.giSimDateInput[\s\S]{0,400}unicode-bidi:\s*isolate/.test(css), "LTR isolate on sim date inputs");
  assert.ok(/\.giSimDateInput[\s\S]{0,400}direction:\s*ltr/.test(css), "LTR direction on sim date inputs");
  assert.ok(sims.includes("computeHachsharaCiPremium"), "CI premium engine still present");
  assert.ok(sims.includes("function lookupHachsharaCiRate"), "CI rate lookup still present");
  assert.ok(sims.includes("function riskSimDmyShown"), "paint helper normalizes date in HTML");
  assert.ok(sims.includes('data-hachci-field="birthDate" value="${escapeHtml(riskSimDmyShown(st.birthDate, true))}"'), "Hachshara CI paints normalized birthDate");
  assert.ok(!sims.includes('data-hachci-field="birthDate" value="${escapeHtml(st.birthDate || "")}"'), "Hachshara CI no longer paints raw birthDate");
  assert.ok(sims.includes('data-hachci-field="insuranceStartDate" value="${escapeHtml(riskSimDmyShown(st.insuranceStartDate, false))}"'), "Hachshara CI paints normalized start date");
  assert.ok(sims.includes("__input--date giSimDateInput"), "date inputs get isolate class in HTML");
  console.log("OK: source markers and cache");
}

{
  const fns = loadDateFns();
  assert.equal(fns.parseAnyDmyDate("1978-03-06").day, 6, "ISO dash is 6 March");
  assert.equal(fns.parseAnyDmyDate("1978-03-06").month, 3, "ISO dash month March");
  assert.equal(fns.parseAnyDmyDate("1978/03/06").day, 6, "ISO slash is 6 March not 3 June");
  assert.equal(fns.parseAnyDmyDate("19780306").day, 6, "8-digit ISO is 6 March");
  assert.equal(fns.parseAnyDmyDate("19780306").month, 3, "8-digit ISO month March");
  assert.equal(fns.parseAnyDmyDate("06/03/1978").day, 6, "DMY stays 6 March");
  assert.equal(fns.parseAnyDmyDate("06/03/1978").month, 3, "DMY month March");
  assert.equal(fns.parseAnyDmyDate("19051978").day, 19, "typed 19 May 1978 stays DMY");
  assert.equal(fns.parseAnyDmyDate("19051978").month, 5, "typed 19 May month May");
  assert.equal(fns.formatDmyFromDigits("1978-03-06"), "06/03/1978", "paste ISO formats DD/MM/YYYY");
  assert.equal(fns.formatDmyFromDigits("19780306"), "06/03/1978", "paste 8-digit ISO formats DD/MM/YYYY");
  assert.equal(fns.formatDmyFromDigits("06031978"), "06/03/1978", "typed DDMMYYYY stays DD/MM/YYYY");
  assert.notEqual(fns.formatDmyFromDigits("1978-03-06"), "19/78/0306", "ISO is not masked as 19/78");
  const birth = fns.parseBirthDateValue("1978-03-06");
  assert.ok(birth && birth.day === 6 && birth.month === 3, "birth parser keeps 6 March 1978");
  console.log("OK: parse and type ISO as 6 March 1978");
}

{
  const fns = loadDateFns();
  const listeners = Object.create(null);
  const input = {
    classList: { add() {}, remove() {}, contains() { return false; } },
    attributes: [{ value: "birthDate" }],
    value: "1978-03-06",
    getAttribute(name) { return name === "data-hachci-field" ? "birthDate" : (name === "title" ? "" : null); },
    setAttribute() {},
    addEventListener(type, fn) { (listeners[type] || (listeners[type] = [])).push(fn); }
  };
  const modal = {
    querySelector() { return input; },
    querySelectorAll(sel) {
      if (sel === '[data-datefmt="dmy"]') return [input];
      return [];
    }
  };
  const popup = { style: {}, id: "lcDatePickerPopup" };
  const sandbox = {
    console,
    Date,
    Number,
    String,
    Object,
    Array,
    Math,
    JSON,
    parseInt,
    isNaN,
    Number,
    document: {
      getElementById(id) { return id === "lcDatePickerPopup" ? popup : null; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      createElement() { return { style: {}, classList: { add() {} }, setAttribute() {}, appendChild() {}, addEventListener() {} }; },
      body: { appendChild() {} },
      head: { appendChild() {} },
      addEventListener() {}
    },
    window: {},
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    __GI_SIM_HOST: {
      RiskSimulators: { registry: {}, register() {} },
      safeTrim(v) { return String(v == null ? "" : v).trim(); },
      escapeHtml(s) { return String(s == null ? "" : s); },
      on(el, evt, fn) { if (el && el.addEventListener) el.addEventListener(evt, fn); },
      $(sel, root) { return (root || sandbox.document).querySelector(sel); },
      $$(sel, root) { return Array.from((root || sandbox.document).querySelectorAll(sel)); },
      nowISO() { return new Date().toISOString(); },
      parseBirthDateValue: fns.parseBirthDateValue,
      parseAnyDmyDate: fns.parseAnyDmyDate,
      formatDmyFromParts: fns.formatDmyFromParts,
      applyDmyAutoFormat(el) {
        if (!el) return "";
        el.value = fns.formatDmyFromDigits(el.value);
        return el.value;
      },
      renderCompanyLogoHtmlForCompany() { return ""; },
      ensureGiSimulatorStylesLoaded() {},
      ElementaryDatePicker: { show() {}, attachToContainer() {} }
    }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("gi-simulators.js"), sandbox, { filename: "gi-simulators.js" });

  const api = sandbox.GiSimulatorDatePicker;
  assert.ok(api && typeof api.normalize === "function", "normalize exported");
  assert.equal(api.normalize("1978-03-06", { birth: true }), "06/03/1978", "normalize ISO birth to DD/MM/YYYY");
  assert.equal(api.normalize("06/03/1978", { birth: true }), "06/03/1978", "normalize keeps DMY");
  assert.equal(api.normalize("1978/03/06", { birth: true }), "06/03/1978", "year-first slashes become 6 March");

  const sim = {
    _state: {
      i1: { birthDate: "1978-03-06", insuranceStartDate: "2026-11-01" }
    }
  };
  assert.equal(api.normalizeState(sim), true, "state normalize reports change");
  assert.equal(sim._state.i1.birthDate, "06/03/1978", "state birthDate is 6 March");
  assert.equal(sim._state.i1.insuranceStartDate, "01/11/2026", "future start date still DD/MM/YYYY");

  api.bind(modal, '[data-hachci-field="birthDate"]', {});
  assert.equal(input.value, "06/03/1978", "bind rewrites ISO in the field");
  console.log("OK: simulator normalize and bind");
}

{
  const fns = loadDateFns();
  const sims = read("gi-simulators.js");
  const sandbox = {
    Date,
    Number,
    String,
    safeTrim(v) { return String(v == null ? "" : v).trim(); },
    parseBirthDateValue: fns.parseBirthDateValue,
    parseAnyDmyDate: fns.parseAnyDmyDate,
    formatDmyFromParts: fns.formatDmyFromParts
  };
  vm.createContext(sandbox);
  vm.runInContext(
    extractNamedFunction(sims, "riskSimNormalizeDmyDate") + "\n" + extractNamedFunction(sims, "riskSimDmyShown"),
    sandbox,
    { filename: "dmy-shown.js" }
  );
  assert.equal(sandbox.riskSimDmyShown("1978-03-06", true), "06/03/1978", "paint ISO as 6 March");
  assert.equal(sandbox.riskSimDmyShown("05/11/1985", true), "05/11/1985", "paint DD/MM stays DD/MM");
  assert.equal(sandbox.riskSimDmyShown("1985-11-05", true), "05/11/1985", "paint ISO Nov 5 as 05/11/1985");
  console.log("OK: HTML paint helper");
}

{
  const sims = read("gi-simulators.js");
  const registers = sims.match(/RiskSimulators\.register\("/g) || [];
  assert.ok(registers.length >= 28, "all company/product simulators still registered (got " + registers.length + ")");
  const birthFields = sims.match(/data-[a-z]+-field="birthDate"/g) || [];
  assert.ok(birthFields.length >= 20, "birthDate fields present across simulators (got " + birthFields.length + ")");
  const birthBinds = (sims.split("bindRiskSimDmyField(modal").filter((p) => p.includes("birthDate"))).length;
  assert.ok(birthBinds >= 20, "birthDate bound with shared dmy helper (got " + birthBinds + ")");
  assert.ok(!/type="date"[^>]*birthDate|data-[a-z]+-field="birthDate"[^>]*type="date"/.test(sims), "no native date input for simulator birthDate");
  const typeDateBirth = /<input[^>]*type="date"[^>]*birthDate|<input[^>]*birthDate[^>]*type="date"/.test(sims);
  assert.equal(typeDateBirth, false, "simulator birthDate is not type=date");
  console.log("OK: audit all registered simulators");
}

console.log("OK: sim birthdate dmy tests passed");
