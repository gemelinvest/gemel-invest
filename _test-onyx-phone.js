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
assert(manifest.theme_color === "#F5F8FD" && manifest.background_color === "#F5F8FD" && html.includes('name="theme-color" content="#F5F8FD"') && html.includes('media="(prefers-color-scheme: dark)"') && /html,\s*body\s*\{[^}]*color-scheme:\s*only light/.test(css) && js.includes("function paintSystemBar") && js.includes('node.setAttribute("content", "#F5F8FD")') && !js.includes('"#1C62C4"'), "the Android system bar matches the app background");
assert(html.includes('name="apple-mobile-web-app-capable" content="yes"'), "iPhone can hide the browser bar");
assert(!html.includes("QR") && !html.includes("קוד QR"), "no QR button");
assert(html.includes("התחברות"), "login button stays");
assert(!html.includes("splash__city"), "splash is a flat field");
assert(/\.screen--splash\s*\{[^}]*linear-gradient\(155deg,\s*#102848/.test(css), "the launch screen uses the lit navy gradient");
assert(html.includes("./header-logo.png?v=6") && !html.includes("splash__word"), "the launch screen uses the existing light ONYX logo");
assert(html.includes("ניהול תהליכים ולקוחות") && !html.includes("הפנסיה שלך") && !html.includes("ניהול סוכנות הביטוח"), "one line under the logo");
assert(css.includes("background: #3870ED"), "splash button stays the action color");
assert(css.includes("--onyx-navy-800: #0E1B2D") && css.includes("--bar: var(--onyx-navy-800)") && css.includes("--onyx-blue-500: #087EFF"), "the navy bars and the action blue come from the design tokens");
assert(css.includes("overflow: hidden"), "the page does not pan sideways");
assert(css.includes("position: fixed") && css.includes("touch-action: none"), "the screen is locked to the viewport");
assert(css.includes("height: auto") && css.includes("max-height: none"), "the app fills the visible screen");
assert(css.includes("flex: 0 0 auto"), "the tab bar sits on the bottom edge");
assert(/\.tabbar\s*\{[^}]*bottom:\s*0/.test(css), "the tab bar is pinned to the window bottom");
assert(!css.includes("100svh"), "the shell is not left short of the window");
assert(/\.tabbar\s*\{[^}]*bottom:\s*0[^}]*height:\s*calc\(50px \+ max\(8px, var\(--safe-b\) - 16px\)\)[^}]*padding:\s*0 0 max\(8px, calc\(var\(--safe-b\) - 16px\)\)/.test(css) && css.includes("calc(50px + max(8px, var(--safe-b) - 16px))"), "the tab bar stays on the bottom and the iPhone floor is shorter");
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
assert(html.includes("כמה נמכר היום") && html.includes('id="tileSold"') && !html.includes('id="tileLeads"') && !html.includes("המספרים שלך היום") && !html.includes("סך לקוחות"), "sold today stays, and the four daily count cards are gone");
assert(html.includes(">הגש הצעה<") && html.includes('id="btnAddCustomer"') && html.includes("סימולטורים"), "home actions");
assert(html.includes("דוח מכירות") && !html.includes("צפה בדוח יומי"), "the home action opens the sales report");
assert(html.includes("פרטי לקוח") && js.includes("סה״כ פרמיה בתיק"), "customer file sums the shown premiums");
assert(js.includes('tabBtn("documents"') && js.includes('"מסמכים"') && js.includes("אין מסמכים בתיק") && !js.includes("אין היסטוריה להצגה"), "customer documents stay on their own tab");
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
assert(html.includes('id="homeHello"') && /id="homeHello"[\s\S]{0,240}מצב חשבונך[\s\S]{0,180}id="homeSummary"/.test(html) && html.split('id="homeSummary"').length === 2 && !html.includes("כאן אפשר לראות את תמונת המצב של הלקוחות שלך") && !html.includes("פעילות אחרונה") && !html.includes("המשימות הקרובות"), "the filed premium sits under the greeting, without the sentence, activity, or upcoming tasks");
assert(/#screenHome\s*\{[^}]*background:\s*var\(--bg\)/.test(css) && /\.homeLogo\s*\{[^}]*height:\s*42px/.test(css) && html.includes("header-logo.png?v=6") && html.includes('alt="ONYX"'), "the home field is the light app background and the existing logo sits in the navy bar");
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
assert(/\.tile__value\s*\{[^}]*font-weight:\s*700[^}]*color:\s*var\(--ink\)/.test(css) && /\.tile__value--money\s*\{[^}]*color:\s*var\(--ink\)/.test(css), "the statistic numbers are dark on the white cards");
assert(js.includes("function dayGreeting") && js.includes("בוקר טוב") && js.includes("צהריים טובים") && js.includes("ערב טוב") && js.includes("לילה טוב") && !js.includes('שלום, ') && js.includes("agentFirstName") && html.includes("מצב חשבונך") && js.includes("stats.pending + stats.issued") && !js.includes("סה״כ פרמיית הפקה"), "the home greets by the sun and still totals the filed premium");
assert(js.includes("stats.pending + stats.issued") && js.includes("refreshHomeMetrics") && js.includes("loadReport(true)"), "the summary adds waiting and issued premium from a fresh report");
assert(js.includes("homeTimer") && js.includes("10000") && js.includes("visibilitychange"), "home numbers refresh while the screen stays open");
assert(/\.hero\s*\{[^}]*background:\s*transparent/.test(css) && /\.hero\s*\{[^}]*box-shadow:\s*none/.test(css), "the summary has no card frame");
assert(/\.tile\s*\{[^}]*background:\s*var\(--card\)[^}]*border-radius:\s*16px/.test(css) && /\.jumps\s*\{[^}]*repeat\(4,\s*1fr\)/.test(css) && /\.jump\s*\{[^}]*background:\s*var\(--navy-surface\)[^}]*align-items:\s*center/.test(css) && /\.blockTitle::before\s*\{[^}]*background:\s*var\(--onyx-blue-500\)/.test(css) && /data-tab="home"><svg[\s\S]*?<span>ראשי<\/span>/.test(html) && html.includes('id="tilePending"') && html.includes("פגישות") && html.includes("משימות"), "the home shortcuts are one navy row, section titles carry a blue mark, and the home tab reads ראשי");
assert(html.includes("login-logo.png") && html.includes('d="M9 6l6 6-6 6"'), "login shows the original logo under a right-pointing arrow");
assert(/class="authCard authCard--center" id="mfaForm"/.test(html) && !html.includes("onyx-splash/mark.png"), "the code screen centers the same logo and drops the small mark");
assert(js.includes('id="simBirth" type="date"') && js.includes('id="simStart" type="date"') && !js.includes("פרטי המבוטח. הפרמיה מחושבת במנוע של החברה.") && js.includes("פרמיה לפני הנחה") && js.includes("פרמיה לאחר הנחה") && js.includes("הנחה ידנית") && js.includes("payload->companyDiscountOverrides") && html.includes("discount-catalog.js") && js.includes("./logos/phoenix.png") && js.includes('"simLogo"') && js.includes("simResultWrap") && js.includes("simLogos") && js.includes('["הפניקס", "מגדל", "כלל"]') && js.includes('["מנורה", "הכשרה", "איילון"]') && js.includes("הוסף מוצר ללקוח") && js.includes("הוספת מבוטח") && js.includes('id="simAddInsured"') && js.includes("סה״כ לפני הנחה") && js.includes("סה״כ לאחר הנחה") && /\.simLogo\s*\{[^}]*left:\s*14px/.test(css) && /\.simLogos__row\s*\{[^}]*repeat\(3,\s*1fr\)[^}]*gap:\s*28px/.test(css), "the company logos sit in two even rows, the result logo is in the top corner, and added insureds get a total");
assert(/\.homeActions\s*\{[^}]*color:\s*#4E5D73[^}]*font-size:\s*20px[^}]*font-weight:\s*500[^}]*linear-gradient\(to left,\s*rgba\(56,\s*112,\s*237/.test(css) && /\.hero__status\s*\{[^}]*font-size:\s*20px/.test(css) && /\.hero__account\s*\{[^}]*flex-direction:\s*row/.test(css) && html.includes("מצב חשבונך:") && /\.hero__value\s*\{[^}]*color:\s*#17457E[^}]*text-shadow:/.test(css) && /\.hero__hello\s*\{[^}]*font-size:\s*22px[^}]*font-weight:\s*700[^}]*color:\s*var\(--onyx-navy-600\)/.test(css) && /\.hero\s*\{[^}]*padding:\s*30px 2px 18px/.test(css) && /\.actions\s*\{[^}]*display:\s*flex/.test(css) && html.includes('class="homeActions">פרמיות') && html.includes('class="homeActions">פעולות מהירות') && !html.includes("action__ico") && html.includes("action__mark") && html.includes(">הגש הצעה<") && html.includes(">סימולטורים<") && html.includes(">מכירות<"), "the greeting stays navy, the account figure sits beside its label, and each action has an icon");
assert(/class="actions"[\s\S]*id="goalCard"[\s\S]*id="homeNote"/.test(html) && html.includes("ביצועים מול יעד") && html.includes('id="goalPct"') && html.includes("בוצע בפועל") && html.includes("יעד יומי:") && html.includes("יעד חודשי:") && /\.bankGoal__shell\s*\{[^}]*flex-direction:\s*column/.test(css) && /\.bankGoal--success \.bankGoal__percent[\s\S]*?#3E6FA8/.test(css) && /\.bankGoal--success \.bankGoal__progressTrack span\s*\{[^}]*#3E6FA8/.test(css) && !css.includes("#17714c") && /\.bankGoal__title\s*\{[^}]*margin-inline-start:\s*-15px[^}]*color:\s*#4E5D73[^}]*font-size:\s*20px[^}]*font-weight:\s*500[^}]*linear-gradient\(to left,\s*rgba\(56,\s*112,\s*237/.test(css) && /\.bankGoal\s*\{[^}]*#d4f0e3/.test(css) && css.includes('url("../grafbizua.png")'), "the goal card numbers and meter use a lighter navy, and its title matches the quick actions");
assert(js.includes("function loadGoalScope") && js.includes("payload->agentTargets") && js.includes("payload->teamManagerAssignments") && js.includes("monthly_sales_target") && js.includes('role === "manager" || role === "admin"') && js.includes("ids: null") && js.includes("התקדמות חודשית") && js.includes("ממתין להגדרת יעד") && js.includes("לא הוגדר יעד חודשי") && js.includes("בכמות מול חודש קודם") && js.includes('rpc("gi_dashboard_net_premium", scopeArgs(range))') && js.includes("function loadNetFor") && !js.includes('.select("payload")'), "the goal card reads each user's target without the full settings file");
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
assert(!html.includes('id="customerChips"') && !html.includes("כל הלקוחות במקום אחד") && !html.includes('id="customerCount"') && html.includes('id="customerQuery"') && html.includes('id="customerList"'), "the customers screen is a search field and then the list");
assert(js.slice(js.indexOf("function paintCustomers"), js.indexOf("function fillSelect")).includes("cust__status"), "a customer row shows its status");
assert(!js.slice(js.indexOf("function paintCustomers"), js.indexOf("function fillSelect")).includes("cust__meta"), "a customer row shows the name only");
assert(/\.cust__name\s*\{[^}]*font-weight:\s*500/.test(css) && /\.cust\s*\{[^}]*background:\s*#fff[^}]*flex-direction:\s*row/.test(css) && !js.slice(js.indexOf("function paintCustomers"), js.indexOf("function fillSelect")).includes("background:"), "customer rows are white cards with the letter at the start");
assert(!/data-tab="reports"[^>]*disabled/.test(html), "the reports tab opens");
assert(html.includes("בחר דוח להצגה") && html.includes("דוח ביטולים") && html.includes("דוח מינוי סוכן"), "the reports hub lists the three side-menu reports");
assert(js.includes('from("gi_cancellations_report")') && js.includes('from("gi_agent_appointment_report")') && js.includes('from("gi_daily_report")'), "each report reads its existing table");
assert(js.includes("GI_AGENT_APPOINTMENT_REPORT_V1") && js.includes("gi-agent-appointment-report-seed.js") && !js.includes("app.js"), "agent appointments use the system report when its table is missing");
assert(html.includes('id="ring"') && html.includes("דחה 10 דקות") && js.includes("snoozed_until") && js.includes("playRing"), "a due reminder pops up and rings");
assert(js.includes("showNotification") && sw.includes("showNotification") && sw.includes("notificationclick") && js.includes("getNotifications") && sw.includes("function showOnce") && js.includes("loadRemindersShared"), "one shade alert is posted, and the phone still rings in the background");
assert(js.includes("AbortSignal.timeout(20000)") && js.includes("function withTimeout"), "login stops waiting and frees the continue button");
assert(js.includes("מכירה באשף בריאות וסיכונים") && js.includes('kind: "sale"'), "a manager sale also pops up and rings");
assert(/<header class="homeHead">[\s\S]*id="btnMenu"[\s\S]*id="btnBell"[\s\S]*id="btnProfile"[\s\S]*id="homeAvatar"[\s\S]*class="homeLogo"/.test(html) && /\.homeLogo\s*\{[^}]*margin-inline-start:\s*auto/.test(css) && /\.homeHead\s*\{[^}]*direction:\s*rtl/.test(css) && /\.homeHead > \.who\s*\{[^}]*left:\s*50%/.test(css) && !html.includes("who__hello"), "the logo sits on the visual left, the menu and bell stay on the right, and the avatar is centered");
assert(/\.homeHead,\s*\.bar\s*\{[^}]*background:\s*var\(--navy-surface\)/.test(css) && css.includes("--navy-surface:") && css.includes("#1E5AA3") && css.includes("--bar:") && css.includes(".homeHead::before") && css.includes("pointer-events: none") && /\.authHead\s*\{[^}]*background:\s*var\(--navy-surface\)/.test(css) && /\.screen--splash\s*\{[^}]*radial-gradient/.test(css) && /\.homeHead\s*\{[^}]*border-radius:\s*0;/.test(css) && /\.menuBtn\s*\{[^}]*background:\s*transparent[^}]*width:\s*44px/.test(css) && /html,\s*body\s*\{[^}]*background:\s*var\(--app-background\)/.test(css) && /\.tabbar\s*\{[^}]*background:\s*var\(--app-background\)/.test(css) && css.includes("--safe-t"), "the navy bars carry a blue light, financial lines sit behind them, and the area under the tabs matches the app background");
assert(/\.tile__label\s*\{[^}]*min-height:\s*2\.7em/.test(css) && /\.tile__icon\s*\{[^}]*right:\s*12px/.test(css) && (html.match(/class="tile__art"/g) || []).length === 4, "issued and waiting premium titles share a line, and each tile keeps its mark at the top right");
assert(js.includes("function generatedDocument") && js.includes("payloadSnapshot") && js.includes("operational_report_health"), "a customer document without a stored file still opens from its saved report");
assert(js.includes("function shadeOpenItems") && js.includes('visibilityState === "hidden"'), "leaving the app posts the open alerts to the phone shade");
assert(!css.includes("folio-cover.svg") && !html.includes("folio-cover.svg") && /\.folioAvatar\s*\{[^}]*border-radius:\s*50%/.test(css) && /\.fileCard__contacts\s*\{[^}]*display:\s*flex/.test(css) && /\.fileCard__name\s*\{[^}]*color:\s*var\(--ink\)/.test(css) && js.includes('data-edit="1"') && js.includes("fileCard__contacts") && js.includes("תיק ביטוח") && js.includes('"היסטוריה"') && js.includes('"משימות"') && js.includes("function saveContact") && js.includes("email: email") && js.includes("פרמיה חודשית") && !js.includes("הפקדה חודשית") && !js.includes('.select("payload")'), "the customer file is a full screen without a photo, and a tap still edits the contact");
assert(js.includes('href="tel:') && js.includes("אימייל") && js.includes("כתובת מגורים"), "personal details include a dial button, email, and address");
assert(html.includes('id="docView"') && html.includes('id="btnDocSave"') && js.includes("function viewDocument"), "a document opens for viewing and can still be downloaded");
const fileBlobSrc = js.slice(js.indexOf("async function fileBlob"), js.indexOf("async function sniffMime"));
assert(js.includes("function paintPdfPages") && js.includes("pdfjs-dist@3.11.174") && js.includes("function paintSpreadsheet") && js.includes("xlsx@0.18.5") && js.includes("followupData") && js.includes("function officialOriginal") && js.includes("fillFollowupPdf") && js.includes("gi-followup-zip.js") && js.includes("pdf-lib@1.17.1") && js.includes("class=\"docPages\"") && css.includes(".docGrid") && /\.docView\s*\{[^}]*position:\s*fixed/.test(css) && css.includes("z-index: 40") && fileBlobSrc.indexOf('indexOf("data:")') >= 0 && fileBlobSrc.indexOf('indexOf("data:")') < fileBlobSrc.indexOf(".download(path)") && fileBlobSrc.indexOf(".download(path)") < fileBlobSrc.lastIndexOf("await fetch(href)") && js.includes("המסמך נטען. אפשר להוריד אותו מהכפתור למעלה.") && js.includes("function paintFittedHtml") && js.includes("docFit__sheet") && js.includes("210mm") && css.includes(".docFit") && /\.docView__body:has\(\.docFit\)/.test(css) && !js.includes("app.js") && !js.includes('.select("payload")'), "a customer-file document opens the original form, and pages, spreadsheets, and HTML fit the phone with download");
assert(js.includes("folioPol") && css.includes(".folioPol"), "policies use a cleaner card");
assert(sw.includes('addEventListener("push"') && js.includes("pushManager") && js.includes("onyx_push_vapid_public") && js.includes("onyxsub_"), "a locked phone can receive a server push");
assert(!js.includes("התראות ותזכורות מגיעות גם כשהמסך כבוי"), "the notifications screen has no long explanation");
assert(js.includes("הגיע") && js.includes("late && pushReady"), "a late reminder updates the list and does not pop again after the shade");
const pushScript = fs.readFileSync(path.join(root, "scripts/onyx-phone-push.mjs"), "utf8");
const pushWorkflow = fs.readFileSync(path.join(root, ".github/workflows/onyx-phone-push.yml"), "utf8");
const pushFunction = fs.readFileSync(path.join(root, "supabase/functions/onyx-phone-push/index.ts"), "utf8");
assert(pushScript.includes("web_push: 8030") && pushScript.includes("navigate:") && !pushScript.includes("mutable:") && pushFunction.includes("web_push: 8030") && pushFunction.includes("navigate: PHONE_URL") && pushFunction.includes("ONYX_VAPID_PUBLIC_KEY") && pushFunction.includes('like("key", "onyxsub_%")') && !pushFunction.includes("mutable:"), "the shade gets the notification while the app is closed");
assert(pushWorkflow.includes("*/5 * * * *") && pushWorkflow.includes("onyx-phone-push.mjs") && pushWorkflow.includes("functions deploy onyx-phone-push") && pushWorkflow.includes("* * * * *") && sw.includes("function pageIsAwake") && sw.includes("new MessageChannel()") && js.includes('data.type === "ping"'), "a clock sends due reminders without opening the app");
assert(spawnSync(process.execPath, [path.join(root, "scripts/onyx-phone-push.mjs"), "--self-test"]).status === 0, "the push clock accepts a due reminder and skips the rest");
assert(/function canCompose\(\) \{\s*const role = state\.profile && state\.profile\.role;\s*return role === "admin" \|\| role === "manager";/.test(js), "only a manager or a system admin receives a sale");
assert(js.includes("function armSaleWatch") && js.includes('type: "watch"') && sw.includes('data.type === "watch"') && sw.includes("onyx-sale-") && sw.includes("icon-192.png"), "a background sale uses the same worker path as a reminder");
assert(css.includes(".ring--sale .ring__text") && js.includes('kicker: "מכירה חדשה"') && js.includes("alertPremiumText(first)") && !js.includes("אין פרמיה רשומה"), "the sale alert shows the agent and the premium in the app style");
assert(js.includes('kicker: "ליד נסגר"') && js.includes('kind: "closed"') && html.includes(">כל ההתראות<") && !html.includes(">להתראות<"), "a closed lead opens the alerts list and does not pretend to be a sale");
assert(js.includes("function readStoredProfile") && js.includes("localStorage.getItem(PROFILE_KEY)") && js.includes("localStorage.setItem(PROFILE_KEY") && /async function boot\(\)[\s\S]*?readStoredProfile\(\)/.test(js) && /async function signOut\(\)[\s\S]*?clearStoredProfile\(\)/.test(js) && js.includes('assurance()) !== "aal2"'), "returning from another app keeps the signed-in profile");
assert(sw.includes('title: "ליד נסגר"') && !sw.includes("אין פרמיה רשומה") && pushFunction.includes('title: "ליד נסגר"') && !pushFunction.includes("אין פרמיה רשומה") && pushScript.includes('title: "ליד נסגר"') && !pushScript.includes("אין פרמיה רשומה"), "a closed lead on the shade has no premium sentence");
assert(js.includes('id: "closed:" + row.id + ":" + day') && sw.includes('id: "closed:" + row.id + ":" + day') && pushFunction.includes('id: "closed:" + trim(row.id) + ":" + day') && pushScript.includes('id: "closed:" + trim(row.id) + ":" + day'), "a closed lead stays one alert for that day");
assert(js.includes("onyx-phone-alerts:device") && js.includes("onyx-phone-seen") && js.includes("function alertAlreadySeen") && sw.includes("onyx-phone-seen") && sw.includes("function closedAlreadySeen") && js.includes("alertAlreadySeen(seen, item.id)"), "an alert that was already shown does not pop again on the next entry");
const shadeFn = js.slice(js.indexOf("async function shadeOpenItems"), js.indexOf('document.addEventListener("visibilitychange"'));
const pollFn = js.slice(js.indexOf("async function pollAlerts"), js.indexOf("function stopSaleWatch"));
const pushFn = sw.slice(sw.indexOf('addEventListener("push"'), sw.indexOf('addEventListener("notificationclose"'));
assert(js.includes('data.type === "sale-ring"') && sw.includes('type: "sale-ring"') && !sw.includes("sale-seen") && !pollFn.includes("absorbWorkerSeen") && !shadeFn.includes("writeAlertSeen") && pushFn.includes('type: "sale-ring"') && pushFn.indexOf("pageIsAwake") < pushFn.indexOf("rememberAlertIds") && js.includes('visible: document.visibilityState === "visible"') && sw.includes("data.visible === true") && js.includes("function notifyHiddenSales") && js.includes("function subscriptionMatches") && js.includes("applicationServerKey") && pushScript.includes('sentId + "\\n" + sub.endpoint') && pushFunction.includes('sentId + "\\n" + sub.endpoint'), "a new sale and a closed lead ring inside the open app and still reach a locked phone");
assert(!css.includes("M314 12h54") && !css.includes("opacity='.34'") && css.includes("--app-background: #F5F8FD") && !html.includes("המספרים שלך היום"), "the bars stay plain navy and the daily count heading is gone");
assert(/id="screenCustomers"[\s\S]*id="btnCustomersBack"[\s\S]*<h1>לקוחות<\/h1>/.test(html) && !/id="screenCustomers"[\s\S]*id="btnNewCustomer"/.test(html) && html.includes('id="btnAddCustomer"') && !html.includes('cx="15" cy="12"'), "the customers screen keeps the back button and drops the header add button");
assert(css.includes("scrollbar-width: none") && css.includes(".homeBody::-webkit-scrollbar") && css.includes("display: none"), "scrolling stays and the scrollbar line is hidden");
assert(js.includes("function rowsForAgentTotals") && js.includes("token(row.agent) === token(agent)") && js.includes("rowsForAgentTotals(report)"), "the sales totals follow the selected agent");
assert(js.includes('document.querySelector("#screenHome .homeBody")') && js.includes("homeBody.scrollTop = 0"), "the home screen opens from the top");
assert(html.includes('id="tileCancel"') && html.includes("פרמיית ביטול") && js.includes("function cancellationPremium") && js.includes("cancelStats(sheet).total.premium"), "cancellation premium comes from the cancellations report");
assert(js.includes("function markAlertsSeen") && js.includes("function unseenAlerts") && /async function openAlerts\(\)[\s\S]*?markAlertsSeen\(items\)/.test(js), "opening the alerts clears the bell until a new one arrives");
assert(js.includes("payload->teamManagerAssignments") && js.includes("payload->agentReportAliases") && js.includes("function teamRoster") && js.includes("tokenLists"), "a team manager's issued premium includes every assigned agent");
assert(js.includes('description.ilike.%proposalPremiumAt%') && sw.includes("proposalPremiumAt*") && /async function checkSales\(\)[\s\S]*?type: "sale-ring"[\s\S]*?watch\.seen/.test(sw), "a sale stamped today still alerts when the row was not touched today, and an open app is not marked seen first");
assert(html.includes('id="btnAddMeeting"') && html.includes("הוסף פגישה") && js.includes("function saveMeeting") && js.includes('type: "meeting"') && js.includes("https://waze.com/ul?q=") && js.includes("לא נוצר לקוח חדש") && js.includes('from("reminders").insert(row)'), "a meeting looks up an existing customer, shows the address, and opens Waze");
assert(js.includes("523.25") && js.includes("783.99") && js.includes("1046.5") && js.includes("1567.98") && /kind === "sale"[\s\S]{0,500}return;/.test(js.slice(js.indexOf("function playRing"), js.indexOf("function bytesFromBase64Url"))), "a sale or a closed lead plays the ONYX motif, and a reminder keeps its phrase");
assert(html.includes('id="screenOffer"') && html.includes('id="offerNext"') && html.includes('id="offerTitle"'), "the offer screen is on the phone");
assert(js.includes("פרטי לקוח") && js.includes("פוליסות קיימות") && js.includes("התאמת צרכים") && js.includes("פוליסות חדשות") && js.includes("פרטי משלם") && js.includes("הצהרת בריאות") && js.includes("תיאום שיחה וסיום הקמה") && js.includes('flowType: "health"') && js.includes("needsMainConsideration") && js.includes("סיום הקמת לקוח") && js.includes('from("customers").upsert') && js.includes('from("proposals").upsert') && js.includes("הלקוח משויך לנציג אחר") && html.includes("הורד דוח תפעולי") && html.includes("שליחת הדוח"), "הגש הצעה saves a health customer and proposal, then the existing report can be sent");
assert(!js.includes("פתיחת לקוח חדש נשארת באשף המשרד") && !js.includes('.select("payload")') && !js.includes("app.js"), "the phone wizard does not load the desktop app or a full settings file");

if (failed) {
  console.error("\n" + failed + " failed");
  process.exit(1);
}
console.log("\nall passed");
