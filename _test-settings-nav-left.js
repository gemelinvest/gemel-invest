#!/usr/bin/env node
'use strict';
/* GI-SETTINGS-NAV-LEFT 2026-09-19
   פאנל תפריט הגדרות מערכת עובר לצד שמאל. בלי שינוי לוגיקת סעיפים.
   הרצה: node _test-settings-nav-left.js
*/

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = __dirname;
const CSS_TAG = '20260919-customers-ui-v1';
const RUBRICS = [
  'connection',
  'version',
  'security',
  'dailySalesMail',
  'campaigns',
  'landing',
  'systemNotice',
  'systemUpdates',
  'activityLog',
  'attendanceReport',
  'archivedCustomers'
];

let failed = 0;
let passed = 0;

function assert(cond, msg){
  if(cond){
    passed += 1;
    console.log('  PASS  ' + msg);
  } else {
    failed += 1;
    console.error('  FAIL  ' + msg);
  }
}

function read(name){
  return fs.readFileSync(path.join(ROOT, name), 'utf8');
}

function sliceFunction(src, startToken){
  const start = src.indexOf(startToken);
  if(start < 0) return '';
  let i = src.indexOf('{', start);
  if(i < 0) return '';
  let depth = 0;
  for(; i < src.length; i++){
    const ch = src[i];
    if(ch === '{') depth += 1;
    else if(ch === '}'){
      depth -= 1;
      if(depth === 0) return src.slice(start, i + 1);
    }
  }
  return '';
}

const html = read('index.html');
const theme = read('theme.css');
const css = read('app.css');
const app = read('app.js');

console.log('1) cache + markup order unchanged');
assert(html.includes('theme.css?v=' + CSS_TAG), 'theme.css cache bumped');
assert(html.includes('app.css?v=' + CSS_TAG), 'app.css cache bumped');
assert(html.indexOf('class="lcSettingsHub__rubrics"') < html.indexOf('class="lcSettingsHub__content"'), 'nav still precedes content in DOM');
RUBRICS.forEach((id) => {
  assert(html.includes('data-settings-rubric="' + id + '"'), 'rubric ' + id + ' still in HTML');
});
assert(html.includes('aria-label="קטגוריות הגדרות מערכת"'), 'nav label unchanged');

console.log('\n2) visual placement — nav on the left in RTL grid');
assert(theme.includes('grid-template-areas: "content rubrics"'), 'theme desktop: content right, rubrics left');
assert(theme.includes('grid-template-columns: minmax(0, 1fr) 260px'), 'theme desktop columns: content then 260px nav');
assert(theme.includes('grid-area: rubrics !important'), 'theme assigns nav to rubrics area');
assert(theme.includes('grid-area: content !important'), 'theme assigns work area to content');
assert(theme.includes('grid-template-areas: "rubrics" "content"'), 'theme mobile: nav stays above content');
assert(css.includes('grid-template-areas:"content rubrics"'), 'app.css desktop areas match');
assert(css.includes('grid-area:rubrics'), 'app.css nav area');
assert(css.includes('grid-area:content'), 'app.css content area');
assert(css.includes('grid-template-areas:"rubrics" "content"'), 'app.css mobile stack');

console.log('\n3) settings logic untouched');
assert(app.includes('initSettingsRubrics(){'), 'initSettingsRubrics exists');
assert(app.includes('setSettingsRubric('), 'setSettingsRubric exists');
assert(app.includes('syncSettingsRubricPermissions(){'), 'permissions helper exists');
const initFn = sliceFunction(app, 'initSettingsRubrics(){');
assert(initFn.includes('data-settings-rubric'), 'click still reads data-settings-rubric');
assert(initFn.includes('this.setSettingsRubric(id)'), 'click still calls setSettingsRubric');
const permFn = sliceFunction(app, 'syncSettingsRubricPermissions(){');
assert(permFn.includes('Auth.canViewActivityLog()'), 'activity log permission unchanged');
assert(permFn.includes('Auth.canManageCampaignLines()'), 'campaign permission unchanged');
assert(!app.includes('grid-template-areas'), 'app.js has no layout placement');

console.log('\n4) syntax of this test');
assert(spawnSync(process.execPath, ['--check', path.join(ROOT, '_test-settings-nav-left.js')]).status === 0, 'node --check this test');

if(failed){
  console.error('\nFAILED ' + failed + ' / ' + (passed + failed));
  process.exit(1);
}
console.log('\nOK ' + passed + ' checks');
