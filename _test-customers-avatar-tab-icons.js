/* GI-CUST-AVATAR-TABS 2026-09-21 — אווטר עגול ברשימת לקוחות + אייקונים שקטים בכרטיסיות התיק
   תצוגה בלבד. לא נוגעים בלוגיקת רשימה / ספירות / ניווט כרטיסיות.
   הרצה: node _test-customers-avatar-tab-icons.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260921-cust-avatar-tabs-v1";
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

const app = read("app.js");
const html = read("index.html");
const sw = read("service-worker.js");
const theme = read("theme.css");
const unify = read("theme-unify-flat.css");
const css = read("app.css");
const wiz = read("gi-wizard.js");

const tabBar = sliceBetween(app, "renderTabBar(rec, policies){", "getCustomerDocuments(rec){");
const tabReturn = tabBar.slice(tabBar.lastIndexOf("return `"));

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-customers-avatar-tab-icons.js")]).status === 0, "node --check this test");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + TAG), "index.html app.css cache");
assert(html.includes("theme.css?v=" + TAG), "index.html theme.css cache");
assert(sw.includes("gi-v12-" + TAG), "service-worker cache");
assert(app.includes('BUILD = "' + TAG + '"'), "app.js BUILD");
assert(app.includes("theme-unify-flat.css?v=" + TAG), "unify-flat cache");

console.log("\n2) customers-list avatar is round, system colors stay");
assert(!!tabBar, "renderTabBar block found");
{
  const viewAvatar = sliceBetween(theme, "#view-customers .lcCustomers__avatar:not(#\\9):not(#\\9){", "}");
  assert(viewAvatar.includes("border-radius: 50%"), "theme.css customers avatar is 50%");
  assert(!viewAvatar.includes("border-radius: 8px"), "theme.css customers avatar is not 8px");
}
assert(theme.includes(".lcCustomers__avatar:not(#\\9):not(#\\9){") && theme.includes("border-radius: 50% !important;"), "theme.css generic customers avatar is 50%");
assert(/#view-customers \.lcCustomers__avatar\{[^}]*border-radius:\s*50%;/s.test(css), "app.css customers avatar is 50%");
assert(!/#view-customers \.lcCustomers__avatar\{[^}]*border-radius:\s*8px/s.test(css), "app.css customers avatar is not 8px");
assert(!/#view-customers \.lcCustomers__avatar[^{]*\{[^}]*border-radius:\s*0\s*!important/s.test(unify), "unify-flat no longer squares the customers avatar");
assert((unify.match(/#view-customers \.lcCustomers__avatar[^{]*\{[^}]*border-radius:\s*50%\s*!important/g) || []).length >= 2, "both unify-flat avatar rules are 50%");
assert(unify.includes("background: var(--uf-accent-soft)") && unify.includes("color: var(--uf-accent)"), "unify-flat keeps system accent colors");
assert(theme.includes("background: #e8f0f5") && theme.includes("color: #1e4d6b"), "theme.css keeps customers list system colors");
assert(css.includes("--lc-accent: #1e4d6b") && css.includes("--lc-accent-soft: #e8f0f5"), "app.css customers tokens stay");
assert(/lcCustomers__avatar[\s\S]{0,220}split\(' '\)/.test(app), "avatar still shows name initials");
assert(app.includes('class="lcCustomers__avatar" aria-hidden="true"'), "avatar markup class stays");

console.log("\n3) file tabs keep labels and get quiet topic icons to the right");
assert(!!tabBar, "tab bar source found");
assert(tabBar.includes('class="cfFile__tabIcon"'), "tab buttons render an icon class");
assert(tabBar.includes('fill="none"') && tabBar.includes('stroke="currentColor"') && tabBar.includes('stroke-width="1.8"'), "icons are quiet outline strokes");
assert(tabBar.includes('aria-hidden="true"'), "icons are decorative");
["policies", "personal", "medical", "ops", "documents"].forEach((id) => {
  assert(tabBar.includes(`${id}: '`) || tabBar.includes(`${id}: "`), "icon map has " + id);
});
assert(tabReturn.includes("tab('policies', 'פוליסות', policyCount)"), "פוליסות label stays");
assert(tabReturn.includes("tab('personal', 'מבוטחים בתיק', insuredTabCount || null)"), "מבוטחים בתיק label stays");
assert(tabReturn.includes("tab('medical', 'הצהרת בריאות', null)"), "הצהרת בריאות label stays");
assert(tabReturn.includes("tab('ops', 'תפעול', null)"), "תפעול label stays");
assert(tabReturn.includes("tab('documents', 'מסמכי לקוח', this.getCustomerDocuments(rec).length || null)"), "מסמכי לקוח label stays");
assert(tabBar.includes("${icon(id)}<span class=\"cfFile__tabLabel\">${escapeHtml(label)}</span>"), "RTL: icon is first in the button so it sits to the right of the name");
assert(tabBar.includes("data-cf-tab="), "tab data attribute stays");
assert(css.includes(".cfFile__tabIcon") && css.includes("width: 15px"), "app.css sizes the tab icon");
assert(theme.includes(".cfFile__tabIcon:not(#\\9):not(#\\9)") && theme.includes("stroke: currentColor"), "theme.css colors the icon from the tab");
assert(theme.includes("display: inline-flex !important") && theme.includes("gap: 6px !important"), "tabs lay out icon + label in a row");

console.log("\n4) list / file logic and other screens stay");
assert(tabBar.includes("this.getNewPoliciesOnly(policies).length"), "policy count still uses new policies");
assert(tabBar.includes("this.collectElementaryProducts(rec).length"), "elementary count stays");
assert(tabBar.includes("this.collectAgentAppointmentPolicies(rec).length"), "appointment count stays");
assert(tabBar.includes("this.getExistingOldPoliciesOnly(policies).length"), "old-policy count stays");
assert(tabBar.includes("this.normalizeSection(this.currentSection)"), "active-tab section helper stays");
assert(tabBar.includes("Array.isArray(rec?.payload?.insureds)"), "insured count still reads payload.insureds");
assert(app.includes("this.bindRowActionButtons()"), "customers row actions stay");
assert(app.includes('class="lcCustomerFolderBtn"'), "open-file button stays");
assert(app.includes(".bankRecent__avatar") || theme.includes(".bankRecent__avatar:not(#\\9):not(#\\9)"), "dashboard recent avatar selector stays");
assert(theme.includes(".bankRecent__avatar:not(#\\9):not(#\\9){") && sliceBetween(theme, ".bankRecent__avatar:not(#\\9):not(#\\9){", "}").includes("border-radius: var(--gi-r-pill)"), "dashboard recent avatars were not retargeted");
assert(html.includes("id=\"view-customers\""), "customers view markup stays");
assert(html.includes("id=\"customerFull\""), "customer file markup stays");
assert(wiz.includes("GI_WIZARD_BUILD"), "wizard build mark stays");
assert(app.includes("function classifyCancellationStatus(value){"), "cancellations classifier stays");
assert(app.includes("dailyReportRowVisibleToSession"), "report visibility helper stays");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " assertions");
process.exit(0);
