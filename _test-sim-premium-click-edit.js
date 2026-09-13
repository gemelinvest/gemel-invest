#!/usr/bin/env node
'use strict';
/* GI-SIM-PREM-EDIT 2026-09-12
   לחיצה על פרמיה לפני/אחרי בכל סימולטור → תיקון ידני לדוח תפעולי + שיקוף.
   הרצה: node _test-sim-premium-click-edit.js
*/

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { spawnSync } = require('child_process');

const ROOT = __dirname;
const CACHE_TAG = '20260913-clal-mortgage-health-decl-v1';

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function mustInclude(hay, needle, label) {
  assert.ok(hay.includes(needle), `${label}: missing ${JSON.stringify(needle)}`);
}

/* ── Static: shared shell wiring ── */
{
  const js = read('gi-simulators.js');
  mustInclude(js, 'function giSimPremEditEnsure', 'prem-edit helpers');
  mustInclude(js, 'function giSimPremEditAsk', 'prem-edit helpers');
  mustInclude(js, 'function giSimPremEditApplyBeforeToState', 'prem-edit helpers');
  mustInclude(js, 'function giSimPremEditBindModal', 'prem-edit helpers');
  mustInclude(js, 'function giSimPremEditClear', 'prem-edit clear');
  mustInclude(js, 'giSimPremEditClear(sim, id)', 'clear on recalc');
  mustInclude(js, 'data-gi-prem-edit="before"', 'before click target');
  mustInclude(js, 'data-gi-prem-edit="after"', 'after click target');
  mustInclude(js, 'giSimPremEditMarkEl(el, "before")', 'before mark helper');
  mustInclude(js, 'gi-sim-prem-edit', 'synthetic discount for manual after');
  mustInclude(js, 'תיקון פרמיה ידני', 'manual after label');
  mustInclude(js, 'function riskSimSelectedDiscountPayload', 'override in selected discount');
  mustInclude(js, 'giSimPremEditGet(handler, insId)', 'buildResult honors edits');
  mustInclude(js, 'giSimPremEditBindModal(sim)', 'bind on discount chrome');
  mustInclude(js, 'classList.add("giSimPremEdit")', 'css class for affordance');
  mustInclude(js, 'host.GiSimulatorPremEdit = premEditApi', 'prem-edit API export');
  mustInclude(js, 'premiumEdited:', 'flag on discount payload');
}

{
  const css = read('simulators-shell.css');
  mustInclude(css, '.giSimPremEdit', 'prem-edit css');
  mustInclude(css, 'content: " ✎"', 'edit pencil affordance');
}

{
  const app = read('app.js');
  const html = read('index.html');
  const sw = read('service-worker.js');
  const wiz = read('gi-wizard.js');
  mustInclude(app, `BUILD = "${CACHE_TAG}"`, 'app BUILD');
  mustInclude(app, `gi-simulators.js?v=${CACHE_TAG}`, 'sim chunk bust');
  mustInclude(app, `simulators-shell.css?v=${CACHE_TAG}`, 'shell css bust');
  mustInclude(app, `GI_WIZARD_JS_VERSION = "${CACHE_TAG}"`, 'wizard version');
  mustInclude(html, `?v=${CACHE_TAG}`, 'index cache');
  mustInclude(sw, `gi-v12-${CACHE_TAG}`, 'service worker cache');
  mustInclude(wiz, `GI_WIZARD_BUILD = "${CACHE_TAG}"`, 'wizard build');
  assert.equal(
    spawnSync(process.execPath, ['--check', path.join(ROOT, 'gi-simulators.js')]).status,
    0,
    'node --check gi-simulators.js'
  );
}

/* Draft / mirror / ops still consume the same fields */
{
  const wiz = read('gi-wizard.js');
  mustInclude(wiz, 'simDiscountPerInsured', 'wizard stores per-insured discount');
  mustInclude(wiz, 'monthlyAfterDiscount', 'wizard stores after amount');
  mustInclude(wiz, 'premiumPerInsured', 'wizard stores before amount');
  mustInclude(wiz, 'r.simDiscount.monthlyAfterDiscount', 'apply result → draft after');
}

/* ── Runtime: override map → discount payload ── */
{
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    document: {
      getElementById() { return null; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      createElement() {
        return {
          style: {},
          classList: { add() {}, remove() {}, contains() { return false; } },
          setAttribute() {},
          appendChild() {},
          addEventListener() {},
          querySelector() { return null; },
          querySelectorAll() { return []; }
        };
      },
      body: { appendChild() {} },
      head: { appendChild() {} },
      addEventListener() {}
    },
    window: {},
    localStorage: {
      _d: Object.create(null),
      getItem(k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
      setItem(k, v) { this._d[k] = String(v); },
      removeItem(k) { delete this._d[k]; }
    },
    alert() {},
    confirm() { return true; },
    prompt() { return null; },
    URLSearchParams,
    location: { search: '', href: 'http://localhost/', hash: '' },
    history: { replaceState() {} },
    navigator: { clipboard: { writeText() { return Promise.resolve(); } } },
    CSS: { escape(s) { return String(s); } },
    MutationObserver: function () { this.observe = function () {}; },
    NodeFilter: { SHOW_ELEMENT: 1 },
    getComputedStyle() { return {}; },
    Image: function () {},
    Blob: function () {},
    FileReader: function () {},
    FormData: function () {},
    fetch() { return Promise.resolve({ ok: true, json: async () => ({}) }); },
    __GI_SIM_HOST: {
      RiskSimulators: { registry: {}, register() {} },
      safeTrim(v) { return String(v == null ? '' : v).trim(); },
      escapeHtml(s) {
        return String(s == null ? '' : s)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      },
      on(el, evt, fn) { if (el && el.addEventListener) el.addEventListener(evt, fn); },
      $(sel, root) { return (root || sandbox.document).querySelector(sel); },
      $$(sel, root) { return Array.from((root || sandbox.document).querySelectorAll(sel)); },
      nowISO() { return new Date().toISOString(); },
      parseBirthDateValue() { return null; },
      formatDmyFromParts() { return ''; },
      applyDmyAutoFormat(el) { return el && el.value ? el.value : ''; },
      renderCompanyLogoHtmlForCompany() { return ''; },
      ensureGiSimulatorStylesLoaded() {}
    }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);

  vm.runInContext(read('gi-simulators.js'), sandbox, { filename: 'gi-simulators.js' });

  const api = sandbox.GiSimulatorPremEdit;
  assert.ok(api && typeof api.set === 'function', 'GiSimulatorPremEdit exported');
  assert.equal(api.parseMoney('1,234.5'), 1234.5);

  const sim = {
    id: 'test-sim',
    _activeInsuredId: 'ins-a',
    _ctx: { company: 'הכשרה', product: 'ריסק' },
    _giPremEditByInsured: Object.create(null),
    _state: {
      'ins-a': {
        result: { ok: true, monthlyPremium: 100, annualPremium: 1200 }
      }
    }
  };

  /* Before-only edit → no simDiscount without catalog option */
  api.set(sim, 'ins-a', { before: 88 });
  let payload = api.selectedDiscountPayload(
    sim,
    { ok: true, monthlyPremium: 100, annualPremium: 1200 },
    'ins-a'
  );
  assert.equal(payload, null, 'before-only without catalog discount → no simDiscount');

  /* After edit without catalog discount → synthetic discount */
  api.set(sim, 'ins-a', { after: 70 });
  payload = api.selectedDiscountPayload(
    sim,
    { ok: true, monthlyPremium: 100, annualPremium: 1200 },
    'ins-a'
  );
  assert.ok(payload, 'synthetic after discount present');
  assert.equal(payload.monthlyAfterDiscount, 70, 'after override value');
  assert.equal(payload.optionId, 'gi-sim-prem-edit', 'synthetic option id');
  assert.equal(payload.label, 'תיקון פרמיה ידני', 'synthetic label');
  assert.equal(payload.premiumEdited, true, 'premiumEdited flag');

  /* Draft-shaped fields (same path as apply-to-proposal) */
  const edit = api.get(sim, 'ins-a');
  const built = {
    ok: true,
    monthlyPremium: Number.isFinite(Number(edit.before)) ? Number(edit.before) : 100,
    annualPremium: Number.isFinite(Number(edit.before))
      ? Math.round(Number(edit.before) * 12 * 100) / 100
      : 1200,
    simDiscount: payload
  };
  assert.equal(built.monthlyPremium, 88, 'before override on result');
  const draftLike = {
    premiumPerInsured: { 'ins-a': built.monthlyPremium },
    simDiscountPerInsured: { 'ins-a': built.simDiscount }
  };
  assert.equal(draftLike.premiumPerInsured['ins-a'], 88);
  assert.equal(draftLike.simDiscountPerInsured['ins-a'].monthlyAfterDiscount, 70);

  /* Clear on recalc (per insured) */
  api.clear(sim, 'ins-a');
  assert.equal(api.get(sim, 'ins-a'), null, 'edits cleared');
  payload = api.selectedDiscountPayload(
    sim,
    { ok: true, monthlyPremium: 100, annualPremium: 1200 },
    'ins-a'
  );
  assert.equal(payload, null, 'no synthetic discount after clear');

  console.log('OK: runtime premium click-edit overrides');
}

console.log('OK: sim premium click-edit tests passed');
