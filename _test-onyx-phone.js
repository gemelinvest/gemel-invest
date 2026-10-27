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
assert(!html.includes("splash__city"), "splash is a flat field");
assert(!/\.screen--splash\s*\{[^}]*linear-gradient/.test(css), "splash stays a flat white field");
assert(/\.screen--splash\s*\{[^}]*background:\s*#fff/.test(css), "splash is white");
assert(html.includes("./logo.png") && !html.includes("splash__word"), "splash uses the original logo");
assert(html.includes("ניהול תהליכים ולקוחות") && !html.includes("הפנסיה שלך") && !html.includes("ניהול סוכנות הביטוח"), "one line under the logo");
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
assert(html.includes("פרמיה שהופקה") && html.includes("פרמיה הממתינה להפקה"), "premium tiles");
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
assert(/\.homeHead\s*\{[^}]*direction:\s*rtl/.test(css) && html.includes("header-logo.png") && html.includes('id="btnMenu"'), "the home bar runs from the menu to the name");
assert(/\.hero\s*\{[^}]*text-align:\s*right/.test(css), "the monthly amount sits on the right");
assert(html.includes(">לקוחות<"), "customers tab");
assert(html.includes("חפש לקוח לפי שם, ת.ז. או מספר טלפון"), "customer search field");
assert(html.includes('data-tab="alerts"') && html.includes('id="btnBell"') && !html.includes('data-tab="more"'), "the bell sits where more used to be");
assert(/data-more="sales"[\s\S]*?setRow__label">מכירות</.test(html) && /id="btnReport"[\s\S]*?>מכירות</.test(html) && html.includes("פעילות נציגים") && html.includes("לידים") && html.includes("שליחת עדכון מערכת"), "more menu and the quick action say sales");
assert(js.includes('rpc("gi_daily_sales_by_agent"'), "sales uses the daily agent summary");
assert(js.includes("payload->agentBranches") && !js.includes('.select("payload")'), "office branches are read without the full settings file");
assert(js.includes("מודיעין") && js.includes("חיפה") && js.includes("סה״כ שני האזורים"), "sales shows both areas and their total");
assert(js.includes("אין מכירות ביום זה"), "an empty sales day stays empty");
assert(js.includes('from("gi_agent_live")') && js.includes("120000"), "agent activity reads who is live now");
assert(js.includes("LEAD_META_JSON") && js.includes("proposalPremiumAt") && js.includes("פרמיה לפי קמפיין"), "today's closed premium is grouped by campaign");
assert(js.includes("head: true"), "the lead count still does not download every lead");
assert(js.includes('from("gi_system_notices")') && js.includes("אין הרשאה לשלוח הודעת מערכת") && js.includes('role === "admin" || role === "manager"'), "a system notice reuses the existing table and manager permission");
assert(js.includes("name === \"alerts\""), "the alerts tab keeps the tab bar");
assert(/\.hero__value\s*\{[^}]*color:\s*var\(--blue\)/.test(css) && /\.tile__value\s*\{[^}]*color:\s*#F6F0E6/.test(css), "the balance stays blue and the tile numbers are warm white");
assert(js.includes('שלום: ') && js.includes("agentFirstName") && html.includes("מצב חשבונך") && html.includes("פרמיה שהוגשה") && js.includes("stats.pending + stats.issued") && !js.includes("סה״כ פרמיית הפקה"), "the home summary greets like a bank balance");
assert(js.includes("stats.pending + stats.issued") && js.includes("refreshHomeMetrics") && js.includes("loadReport(true)"), "the summary adds waiting and issued premium from a fresh report");
assert(js.includes("homeTimer") && js.includes("10000") && js.includes("visibilitychange"), "home numbers refresh while the screen stays open");
assert(/\.hero\s*\{[^}]*background:\s*transparent/.test(css) && /\.hero\s*\{[^}]*box-shadow:\s*none/.test(css), "the summary has no card frame");
assert(/\.tile\s*\{[^}]*linear-gradient[^}]*#6E97F4/.test(css) && /\.tile__label\s*\{[^}]*color:\s*#F6F0E6/.test(css) && /\.tile\s*\{[^}]*min-height:\s*168px/.test(css), "the four tiles are light blue with a white shine and warm white type");
assert(html.includes("login-logo.png") && html.includes('d="M9 6l6 6-6 6"'), "login shows the original logo under a right-pointing arrow");
assert(/class="authCard authCard--center" id="mfaForm"/.test(html) && !html.includes("onyx-splash/mark.png"), "the code screen centers the same logo and drops the small mark");
assert(js.includes('id="simBirth" type="date"') && js.includes('id="simStart" type="date"') && !js.includes("פרטי המבוטח. הפרמיה מחושבת במנוע של החברה.") && js.includes("פרמיה לפני הנחה") && js.includes("פרמיה לאחר הנחה") && js.includes("הנחה ידנית") && js.includes("payload->companyDiscountOverrides") && html.includes("discount-catalog.js") && js.includes("./logos/phoenix.png") && js.includes('"simLogo"') && js.includes("simResultWrap"), "simulator dates open a calendar, a discount can follow the premium, and the company logo sits beside it");
assert(/\.homeActions\s*\{[^}]*color:\s*#fff[^}]*linear-gradient\(to left,\s*#6AA6DE[^}]*#ffffff 100%\)/.test(css) && html.includes('class="homeActions"'), "quick actions sit on a sky bar that fades to white");
assert(js.includes("function groupSum") && js.includes('id="simSum"'), "insurance and compensation sums show their zeros");
assert(js.includes("function playSplash") && js.includes("requestAnimationFrame") && css.includes(".screen--splash.is-on .splash__logo") && css.includes("translate3d(0, 0, 0)"), "the splash animation starts on a later frame for iPhone");
assert(js.includes("countIncomingLeads") && js.includes('.neq("assigned_agent_id", "")'), "incoming leads are the ones a surveyor assigned");
assert(js.includes('rpc("gi_dashboard_sales_by_company"') && js.includes("btnSold"), "sold today opens the company breakdown");
assert(js.includes("setInterval") && js.includes("refreshActivity"), "agent activity refreshes while the screen stays open");
assert(js.includes('from("reminders")') && js.includes("חזרה ללקוח") && js.includes("מעקב מסמכים") && js.includes("השלמת חוסרים"), "a reminder uses the existing reminder types");
assert(js.includes("מכירה באשף בריאות וסיכונים") && js.includes("ליד נסגר") && js.includes("canCompose()"), "sale alerts are for a manager");
assert(html.includes('id="btnBell"'), "the bell opens");

console.log("\n5) reminders ring, customers, and the three reports");
assert(!html.includes('id="homeRole"') && !html.includes("who__hello"), "the home bar no longer shows the name");
assert(!html.includes('id="customerChips"'), "customer status filters are gone");
assert(!js.slice(js.indexOf("function paintCustomers"), js.indexOf("function fillSelect")).includes("cust__status"), "a customer row has no status");
assert(!js.slice(js.indexOf("function paintCustomers"), js.indexOf("function fillSelect")).includes("cust__meta"), "a customer row shows the name only");
assert(/\.cust__name\s*\{[^}]*font-weight:\s*500/.test(css) && /\.cust\s*\{[^}]*backdrop-filter:[^}]*flex-direction:\s*row-reverse/.test(css) && css.includes("#F6F0E6") && !js.slice(js.indexOf("function paintCustomers"), js.indexOf("function fillSelect")).includes("background:"), "customer rows are glass, the letter is on the left, and the mark is one light blue");
assert(!/data-tab="reports"[^>]*disabled/.test(html), "the reports tab opens");
assert(html.includes("בחר דוח להצגה") && html.includes("דוח ביטולים") && html.includes("דוח מינוי סוכן"), "the reports hub lists the three side-menu reports");
assert(js.includes('from("gi_cancellations_report")') && js.includes('from("gi_agent_appointment_report")') && js.includes('from("gi_daily_report")'), "each report reads its existing table");
assert(js.includes("GI_AGENT_APPOINTMENT_REPORT_V1") && js.includes("gi-agent-appointment-report-seed.js") && !js.includes("app.js"), "agent appointments use the system report when its table is missing");
assert(html.includes('id="ring"') && html.includes("דחה 10 דקות") && js.includes("snoozed_until") && js.includes("playRing"), "a due reminder pops up and rings");
assert(js.includes("showNotification") && sw.includes("showNotification") && sw.includes("notificationclick"), "the phone still rings when the browser is in the background");
assert(js.includes("מכירה באשף בריאות וסיכונים") && js.includes('kind: "sale"'), "a manager sale also pops up and rings");
assert(/<header class="homeHead">[\s\S]*id="btnMenu"[\s\S]*class="homeLogo"[\s\S]*id="btnProfile"[\s\S]*id="homeAvatar"/.test(html) && !html.includes("who__hello"), "the logo is centered and the avatar sits on the left");
assert(/\.homeHead\s*\{[^}]*background:\s*var\(--blue\)[^}]*border-radius:\s*0 0 28px 28px/.test(css) && !/\.homeHead\s*\{[^}]*backdrop-filter:/.test(css), "the top bar is the light blue with a curved bottom");
assert(/\.tile__label\s*\{[^}]*min-height:\s*2\.7em/.test(css), "issued and waiting premium titles share a line");
assert(js.includes("function generatedDocument") && js.includes("payloadSnapshot") && js.includes("operational_report_health"), "a customer document without a stored file still opens from its saved report");
assert(js.includes("function shadeOpenItems") && js.includes('visibilityState === "hidden"'), "leaving the app posts the open alerts to the phone shade");
assert(/\.fileCard\s*\{[^}]*linear-gradient/.test(css) && /\.fileCard__name\s*\{[^}]*color:\s*#fff/.test(css), "the customer name sits on a light blue gradient in white");
assert(js.includes('href="tel:') && js.includes("אימייל") && js.includes("כתובת מגורים"), "personal details include a dial button, email, and address");
assert(html.includes('id="docView"') && html.includes('id="btnDocSave"') && js.includes("function viewDocument"), "a document opens for viewing and can still be downloaded");
assert(js.includes("pol__side") && css.includes(".pol__side"), "policies use a cleaner card");
assert(sw.includes('addEventListener("push"') && js.includes("pushManager") && js.includes("onyx_push_vapid_public") && js.includes("onyxsub_"), "a locked phone can receive a server push");
assert(!js.includes("התראות ותזכורות מגיעות גם כשהמסך כבוי"), "the notifications screen has no long explanation");
assert(js.includes("הגיע") && js.includes("late && pushReady"), "a late reminder updates the list and does not pop again after the shade");
const pushScript = fs.readFileSync(path.join(root, "scripts/onyx-phone-push.mjs"), "utf8");
const pushWorkflow = fs.readFileSync(path.join(root, ".github/workflows/onyx-phone-push.yml"), "utf8");
assert(pushScript.includes("web_push: 8030") && pushScript.includes("navigate:") && !pushScript.includes("mutable:"), "the shade gets the notification while the app is closed");
assert(pushWorkflow.includes("*/5 * * * *") && pushWorkflow.includes("onyx-phone-push.mjs"), "a clock sends due reminders without opening the app");
assert(spawnSync(process.execPath, [path.join(root, "scripts/onyx-phone-push.mjs"), "--self-test"]).status === 0, "the push clock accepts a due reminder and skips the rest");
assert(/function canCompose\(\) \{\s*const role = state\.profile && state\.profile\.role;\s*return role === "admin" \|\| role === "manager";/.test(js), "only a manager or a system admin receives a sale");
assert(js.includes("function armSaleWatch") && js.includes('type: "watch"') && sw.includes('data.type === "watch"') && sw.includes("onyx-sale-") && sw.includes("icon-192.png"), "a background sale uses the same worker path as a reminder");
assert(css.includes(".ring--sale .ring__text") && js.includes('kicker: "מכירה חדשה"'), "the sale alert shows the agent and the premium in the app style");

if (failed) {
  console.error("\n" + failed + " failed");
  process.exit(1);
}
console.log("\nall passed");
