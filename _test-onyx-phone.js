/* ONYX phone shell: new files only, existing login, no extra payload download.
   הרצה: node _test-onyx-phone.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = __dirname;
let failed = 0;

function assert(cond, msg) {
  if (cond) console.log("  PASS  " + msg);
  else {
    failed += 1;
    console.error("  FAIL  " + msg);
  }
}

const html = fs.readFileSync(path.join(root, "phone/index.html"), "utf8");
const js = fs.readFileSync(path.join(root, "phone/phone.js"), "utf8");
const css = fs.readFileSync(path.join(root, "phone/phone.css"), "utf8");
const sw = fs.readFileSync(path.join(root, "phone/sw.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "phone/manifest.webmanifest"), "utf8"));

console.log("1) syntax and shell");
assert(spawnSync(process.execPath, ["--check", path.join(root, "phone/phone.js")]).status === 0, "phone.js parses");
assert(spawnSync(process.execPath, ["--check", path.join(root, "phone/sw.js")]).status === 0, "sw.js parses");
assert(manifest.display === "standalone", "installs as a standalone app");
assert(manifest.theme_color === "#3870ED", "theme is the sidebar blue");
assert(html.includes('name="apple-mobile-web-app-capable" content="yes"'), "iPhone can hide the browser bar");
assert(!html.includes("QR") && !html.includes("קוד QR"), "no QR button");
assert(html.includes("התחברות"), "login button stays");
assert(!html.includes("splash__city") && !css.includes("linear-gradient"), "splash is a flat field");
assert(/\.screen--splash\s*\{[^}]*background:\s*#fff/.test(css), "splash is white");
assert(html.includes("./logo.png") && !html.includes("splash__word"), "splash uses the original logo");
assert(html.includes("הפנסיה שלך") && !html.includes("ניהול סוכנות הביטוח") && !html.includes("ביחד ללקוחות"), "one line under the logo");
assert(css.includes("background: #3870ED"), "splash button stays blue");
assert(css.includes("#3870ED"), "sidebar blue is used");
assert(css.includes("overflow: hidden"), "the page does not pan sideways");
assert(css.includes("position: fixed") && css.includes("touch-action: none"), "the screen is locked to the viewport");
assert(css.includes("height: auto") && css.includes("max-height: none"), "the app fills the visible screen");
assert(css.includes("flex: 0 0 auto"), "the tab bar sits on the bottom edge");
assert(/\.tabbar\s*\{[^}]*bottom:\s*0/.test(css), "the tab bar is pinned to the window bottom");
assert(!css.includes("100svh"), "the shell is not left short of the window");
assert(!/\.tabbar\s*\{[^}]*safe-b/.test(css), "the tab bar does not keep a bottom gap");
assert(!js.includes("shell.style.height = height"), "the frame is not shrunk above the bottom");
assert(js.includes("function lockScreen"), "sideways drags are cancelled");
assert(js.includes("function fitFrame") && js.includes("visualViewport"), "Safari keeps the buttons on the visible bottom");
assert(manifest.icons.some((icon) => icon.purpose === "maskable" && icon.src.indexOf("./icon-512.png") === 0), "Android icon is the white phone icon");
assert(html.includes('rel="apple-touch-icon" href="./icon-180.png'), "iPhone home icon is the white phone icon");
assert(!html.includes("../icon-192.png"), "iPhone does not use the transparent site icon");
assert(html.includes("user-scalable=no"), "pinch zoom does not slide the page");

console.log("\n2) existing login, no new factor");
assert(js.includes("/functions/v1/gi-open-agent-session"), "opens the existing session");
assert(js.includes("mfa.challenge") && js.includes("mfa.verify"), "uses the existing 6-digit code");
assert(!js.includes("mfa.enroll"), "does not create a new factor");
assert(js.includes("aal2"), "data waits for the second step");
assert(js.includes("האפליקציה פתוחה למנהל, לנציג ולמנהל צוות בלבד."), "only the three roles");

console.log("\n3) narrow reads");
assert(js.includes('rpc("gi_dashboard_net_premium"'), "sold today uses the dashboard summary");
assert(js.includes('rpc("gi_dashboard_sales_by_company"'), "company sheet uses the same summary");
assert(js.includes('from("gi_daily_report")'), "premium tiles use the sales report row");
assert(js.includes('.select("header_row,data_rows")'), "daily report read uses the columns that exist");
assert(!/\.select\([^)]*report_as_of_date/.test(js), "daily report read does not ask for the missing date column");
assert(js.includes("head: true"), "lead count does not download lead rows");
assert(!js.slice(js.indexOf("async function loadCustomers"), js.indexOf("function positive")).includes("payload"), "customer list does not download payloads");
assert(/loadCustomerFile[\s\S]{0,400}payload/.test(js), "opening a customer reads that one file");
assert(js.includes(".limit(q ? 20 : 40)"), "customer list stays short");
assert(!js.includes("app.js"), "phone code does not load the desktop app");

console.log("\n4) screens that were requested");
assert(html.includes("פרמיה שהופקה") && html.includes("פרמיה שממתינה להפקה"), "premium tiles");
assert(html.includes("כמה נמכר היום") && html.includes("כמה לידים נכנסו"), "sold and leads tiles");
assert(html.includes("הוסף לקוח חדש") && html.includes("סימולטורים"), "home actions");
assert(html.includes("דוח מכירות") && !html.includes("צפה בדוח יומי"), "the home action opens the sales report");
assert(html.includes("פרטי לקוח") && js.includes("סה״כ פרמיה בתיק"), "customer file sums the shown premiums");
assert(js.includes("מסמכי לקוח") && !js.includes("אין היסטוריה להצגה"), "customer documents replace history");
assert(!js.slice(js.indexOf("function policyRows"), js.indexOf("function policyTitle")).includes("existingPolicies"), "the file lists agency policies only");
assert(js.includes("שיוך לקוח לנציג") && js.includes('role === "admin" || role === "manager"'), "only a manager can assign a customer");
assert(html.includes("פרופיל והגדרות") && !js.includes("צפייה בדוח מפורט") && js.includes("צפייה בדוח תפעולי"), "a policy opens the operational report");
assert(js.includes("פרטי לקוח") && js.includes("פוליסות חדשות") && js.includes("הצהרת בריאות") && js.includes("אמצעי תשלום"), "the operational report keeps the system sections");
assert(css.includes("@keyframes onyxLogoIn") && html.includes("splash__mark") && css.includes("prefers-reduced-motion"), "the entry logo animates in the existing design");
assert(html.includes("סימולטורים") && !html.includes("הק הצעת מחיר"), "quick action opens the simulator center");
assert(js.includes("GiSimulatorQuotes") && js.includes("gi-simulators.js") && !js.includes("app.js"), "premium is calculated by the system engine");
assert(html.includes(">פוליסה<") && js.includes("הפקדות") && js.includes("כיסויים"), "a policy opens with its own details");
assert(js.includes("הפרטים שלי") && js.includes("הגדרות התראות") && js.includes("אבטחה וכניסה") && js.includes("עזרה ותמיכה") && js.includes("יציאה מהמערכת"), "profile menu matches the screen");
assert(!html.includes("בהשוואה לחודש קודם") && !js.includes("paintDelta"), "the comparison line is gone");
assert(/\.homeHead\s*\{[^}]*direction:\s*ltr/.test(css), "the home header places the photo on the left");
assert(/\.hero\s*\{[^}]*text-align:\s*right/.test(css), "the monthly amount sits on the right");
assert(html.includes(">לקוחות<"), "customers tab");
assert(html.includes("חפש לקוח לפי שם, ת.ז. או מספר טלפון"), "customer search field");
assert(!/data-tab="more"[^>]*disabled/.test(html), "the more tab opens");
assert(html.includes("דוח מכירות") && html.includes("פעילות נציגים") && html.includes("לידים") && html.includes("שליחת עדכון מערכת"), "more menu has the four choices");
assert(js.includes('rpc("gi_daily_sales_by_agent"'), "sales uses the daily agent summary");
assert(js.includes("payload->agentBranches") && !js.includes('.select("payload")'), "office branches are read without the full settings file");
assert(js.includes("מודיעין") && js.includes("חיפה") && js.includes("סה״כ שני האזורים"), "sales shows both areas and their total");
assert(js.includes("אין מכירות ביום זה"), "an empty sales day stays empty");
assert(js.includes('from("gi_agent_live")') && js.includes("120000"), "agent activity reads who is live now");
assert(js.includes("LEAD_META_JSON") && js.includes("proposalPremiumAt") && js.includes("פרמיה לפי קמפיין"), "today's closed premium is grouped by campaign");
assert(js.includes("head: true"), "the lead count still does not download every lead");
assert(js.includes('from("gi_system_notices")') && js.includes("אין הרשאה לשלוח הודעת מערכת") && js.includes('role === "admin" || role === "manager"'), "a system notice reuses the existing table and manager permission");
assert(js.includes("name === \"more\""), "the more menu keeps the tab bar");
assert(/\.hero__value\s*\{[^}]*color:\s*var\(--blue\)/.test(css) && /\.tile__value\s*\{[^}]*color:\s*var\(--blue\)/.test(css), "home numbers use the sidebar blue");
assert(js.includes("countIncomingLeads") && js.includes('.neq("assigned_agent_id", "")'), "incoming leads are the ones a surveyor assigned");
assert(js.includes('rpc("gi_dashboard_sales_by_company"') && js.includes("btnSold"), "sold today opens the company breakdown");
assert(js.includes("setInterval") && js.includes("refreshActivity"), "agent activity refreshes while the screen stays open");
assert(js.includes('from("reminders")') && js.includes("חזרה ללקוח") && js.includes("מעקב מסמכים") && js.includes("השלמת חוסרים"), "a reminder uses the existing reminder types");
assert(js.includes("מכירה באשף בריאות וסיכונים") && js.includes("ליד נסגר") && js.includes("canCompose()"), "sale alerts are for a manager");
assert(html.includes('id="btnBell"'), "the bell opens");

console.log("\n5) reminders ring, customers, and the three reports");
assert(/\.who__role\s*\{[^}]*margin-top:\s*1px/.test(css), "the role sits close under the name");
assert(!html.includes('id="customerChips"'), "customer status filters are gone");
assert(!js.slice(js.indexOf("function paintCustomers"), js.indexOf("function fillSelect")).includes("cust__status"), "a customer row has no status");
assert(!js.slice(js.indexOf("function paintCustomers"), js.indexOf("function fillSelect")).includes("cust__meta"), "a customer row shows the name only");
assert(/\.cust__name\s*\{[^}]*font-size:\s*20px/.test(css), "customer names are larger");
assert(!/data-tab="reports"[^>]*disabled/.test(html), "the reports tab opens");
assert(html.includes("בחר דוח להצגה") && html.includes("דוח ביטולים") && html.includes("דוח מינוי סוכן"), "the reports hub lists the three side-menu reports");
assert(js.includes('from("gi_cancellations_report")') && js.includes('from("gi_agent_appointment_report")') && js.includes('from("gi_daily_report")'), "each report reads its existing table");
assert(js.includes("GI_AGENT_APPOINTMENT_REPORT_V1") && js.includes("gi-agent-appointment-report-seed.js") && !js.includes("app.js"), "agent appointments use the system report when its table is missing");
assert(html.includes('id="ring"') && html.includes("דחה 10 דקות") && js.includes("snoozed_until") && js.includes("playRing"), "a due reminder pops up and rings");
assert(js.includes("showNotification") && sw.includes("showNotification") && sw.includes("notificationclick"), "the phone still rings when the browser is in the background");
assert(js.includes("מכירה באשף בריאות וסיכונים") && js.includes('kind: "sale"'), "a manager sale also pops up and rings");

if (failed) {
  console.error("\n" + failed + " failed");
  process.exit(1);
}
console.log("\nall passed");
