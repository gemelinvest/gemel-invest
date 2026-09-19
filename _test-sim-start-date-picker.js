#!/usr/bin/env node
'use strict';
/* GI-SIM-START-DATE-PICKER 2026-09-19
   לחיצה על «תחילת ביטוח» בכל סימולטור פותחת את לוח השנה של המערכת.
   הרצה: node _test-sim-start-date-picker.js
*/

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { spawnSync } = require('child_process');

const ROOT = __dirname;
const SIM_TAG = '20260919-sim-start-date-v1';

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function mustInclude(hay, needle, label) {
  assert.ok(hay.includes(needle), `${label}: missing ${JSON.stringify(needle)}`);
}

{
  const js = read('gi-simulators.js');
  mustInclude(js, 'GI-SIM-START-DATE-PICKER', 'start-date picker marker');
  mustInclude(js, 'function openRiskSimDmyPicker', 'open helper');
  mustInclude(js, 'function bindRiskSimDmyField', 'shared dmy bind');
  mustInclude(js, 'el.classList.add("giSimDateInput")', 'calendar affordance class');
  mustInclude(js, 'openRiskSimDmyPicker(el)', 'click opens picker');
  mustInclude(js, 'picker.show(el)', 'uses branded ElementaryDatePicker.show');
  mustInclude(js, 'host.GiSimulatorDatePicker = dateApi', 'date picker API export');
  mustInclude(js, 'data-phx-field="insuranceStartDate"', 'phoenix start date field');
  mustInclude(js, 'data-mnr-field="insuranceStartDate"', 'menora start date field');
  mustInclude(js, 'data-hachr-field="insuranceStartDate"', 'hachshara start date field');
  mustInclude(js, 'data-clalh-field="insuranceStartDate"', 'clal health start date field');
  const startBinds = js.split('bindRiskSimDmyField(modal').filter((part) => part.includes('insuranceStartDate'));
  assert.ok(startBinds.length >= 20, `insuranceStartDate bound in all simulators (got ${startBinds.length})`);
}

{
  const css = read('simulators-shell.css');
  mustInclude(css, 'GI-SIM-START-DATE-PICKER', 'css marker');
  mustInclude(css, '.giSimDateInput', 'calendar icon class');
  mustInclude(css, '.lcDatePickerPopup', 'picker z-index above simulator modal');
}

{
  const app = read('app.js');
  mustInclude(app, `gi-simulators.js?v=${SIM_TAG}`, 'sim chunk bust');
  mustInclude(app, `simulators-shell.css?v=${SIM_TAG}`, 'shell css bust');
  assert.equal(
    spawnSync(process.execPath, ['--check', path.join(ROOT, 'gi-simulators.js')]).status,
    0,
    'node --check gi-simulators.js'
  );
}

{
  let showCalls = 0;
  let lastShown = null;
  const listeners = Object.create(null);
  const input = {
    classList: { add() {}, remove() {}, contains() { return false; } },
    attributes: [{ value: 'insuranceStartDate' }],
    value: '',
    getAttribute(name) { return name === 'title' ? '' : null; },
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
  const popup = { style: {}, id: 'lcDatePickerPopup' };
  const sandbox = {
    console,
    document: {
      getElementById(id) { return id === 'lcDatePickerPopup' ? popup : null; },
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
      safeTrim(v) { return String(v == null ? '' : v).trim(); },
      escapeHtml(s) { return String(s == null ? '' : s); },
      on(el, evt, fn) { if (el && el.addEventListener) el.addEventListener(evt, fn); },
      $(sel, root) { return (root || sandbox.document).querySelector(sel); },
      $$(sel, root) { return Array.from((root || sandbox.document).querySelectorAll(sel)); },
      nowISO() { return new Date().toISOString(); },
      parseBirthDateValue() { return null; },
      parseAnyDmyDate() { return null; },
      formatDmyFromParts() { return ''; },
      applyDmyAutoFormat(el) { return el && el.value ? el.value : ''; },
      renderCompanyLogoHtmlForCompany() { return ''; },
      ensureGiSimulatorStylesLoaded() {},
      ElementaryDatePicker: {
        show(el) { showCalls += 1; lastShown = el; },
        attachToContainer() {}
      }
    }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read('gi-simulators.js'), sandbox, { filename: 'gi-simulators.js' });

  const api = sandbox.GiSimulatorDatePicker;
  assert.ok(api && typeof api.bind === 'function', 'GiSimulatorDatePicker.bind exported');
  assert.ok(typeof api.open === 'function', 'GiSimulatorDatePicker.open exported');

  api.bind(modal, '[data-phx-field="insuranceStartDate"]', {});
  assert.ok((listeners.click || []).length >= 1, 'click opens calendar');
  (listeners.click || []).forEach((fn) => fn({ type: 'click', stopPropagation() {} }));
  assert.ok(showCalls >= 1, 'click called picker.show');
  assert.strictEqual(lastShown, input, 'picker opened for the start-date input');
  assert.equal(popup.style.zIndex, '100080', 'calendar sits above simulator modal');

  console.log('OK: insurance start date click opens branded calendar');
}

console.log('OK: sim start-date picker tests passed');
