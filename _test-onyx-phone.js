/* ONYX phone shell: new files only, existing login, no extra payload download.
   הרצה: node _test-onyx-phone.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
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
assert(manifest.theme_color === "#F5F8FD" && manifest.background_color === "#F5F8FD" && html.includes('name="theme-color" content="#F5F8FD"') && html.includes('media="(prefers-color-scheme: dark)"') && /html,\s*body\s*\{[^}]*color-scheme:\s*only light/.test(css) && js.includes("function paintSystemBar") && js.includes('splash ? "#FFFFFF"') && js.includes('entry ? "#FBF7F2" : "#1E5AA3"') && js.includes('screen === "login" || screen === "mfa"') && !js.includes('node.setAttribute("content", "#F5F8FD")') && !js.includes('"#1C62C4"'), "the status bar stays white on the launch screen, warm on login, then navy in the app");
assert(html.includes('name="apple-mobile-web-app-capable" content="yes"'), "iPhone can hide the browser bar");
assert(!html.includes("QR") && !html.includes("קוד QR"), "no QR button");
assert(html.includes("התחברות"), "login button stays");
assert(!html.includes("splash__city"), "splash is a flat field");
assert(/\.screen--splash\s*\{[^}]*background-color:\s*#fff/.test(css) && /\.screen--splash\s*\{[^}]*background-image:\s*none/.test(css) && css.includes(".screen--splash::before") && css.includes("stroke='%231E5AA3'") && css.includes("stroke-opacity='.14'") && !html.includes("התחברות <span") && !/\.screen--splash\s*\{[^}]*#102848/.test(css) && !/\.screen--splash\s*\{[^}]*#FBF7F2/.test(css), "the launch screen is white with quiet financial lines, and the entry button has no arrow");
assert(html.includes("./splash-logo.png?v=1") && !html.includes("splash__word"), "the launch screen keeps the logo in the center");
assert(html.includes("ניהול תהליכים ולקוחות") && !html.includes("הפנסיה שלך") && !html.includes("ניהול סוכנות הביטוח"), "one line under the logo");
assert(/\.splash__enter\s*\{[^}]*background:\s*var\(--navy-surface\)/.test(css) && css.includes("background: #3870ED"), "the entry button is navy with the light, and the action blue stays on the other controls");
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
assert(js.includes("function fitFrame") && js.includes("visualViewport") && js.includes("function keyboardOverlap") && js.includes('chat.classList.toggle("is-keyboard"') && css.includes(".screen--chat.is-keyboard") && css.includes("padding-bottom: calc(var(--keyboard) + 12px)") && !js.includes("shell.style.height = height"), "Safari keeps the buttons on the visible bottom and the chat field stays above the keyboard");
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
assert(js.includes('item("documents", "מסמכים")') && js.includes("אין מסמכים בתיק") && !js.includes("אין היסטוריה להצגה") && !js.includes("fileTabs") && !js.includes("עריכת פרטי קשר") && /function paintFolioMenu[\s\S]*?שיוך לקוח לנציג[\s\S]*?היסטוריה[\s\S]*?משימות[\s\S]*?מסמכים/.test(js) && !/function paintFolioMenu[\s\S]{0,900}ת\.ז\./.test(js), "history, tasks, and documents open from the customer menu");
assert(!js.slice(js.indexOf("function policyRows"), js.indexOf("function policyTitle")).includes("existingPolicies"), "the file lists agency policies only");
assert(js.includes("שיוך לקוח לנציג") && js.includes('role === "admin" || role === "manager"'), "only a manager can assign a customer");
assert(html.includes("פרופיל והגדרות") && !js.includes("צפייה בדוח מפורט") && js.includes("צפייה בדוח תפעולי"), "a policy opens the operational report");
assert(js.includes("פרטי לקוח") && js.includes("פוליסות חדשות") && js.includes("הצהרת בריאות") && js.includes("אמצעי תשלום"), "the operational report keeps the system sections");
assert(css.includes("@keyframes onyxLogoIn") && css.includes("@keyframes onyxSplashField") && css.includes("@keyframes onyxSplashWords") && css.includes("@keyframes onyxSplashEnter") && html.includes("splash__mark") && css.includes("prefers-reduced-motion"), "the entry logo animates in a fuller splash sequence");
assert(html.includes("סימולטורים") && !html.includes("הק הצעת מחיר"), "quick action opens the simulator center");
assert(js.includes("GiSimulatorQuotes") && js.includes("gi-simulators.js") && !js.includes("app.js"), "premium is calculated by the system engine");
assert(html.includes(">פוליסה<") && js.includes("הפקדות") && js.includes("כיסויים"), "a policy opens with its own details");
assert(js.includes("הפרטים שלי") && js.includes("הגדרות התראות") && js.includes("אבטחה וכניסה") && js.includes("עזרה ותמיכה") && js.includes("יציאה מהמערכת"), "profile menu matches the screen");
assert(!html.includes("בהשוואה לחודש קודם") && !js.includes("paintDelta"), "the comparison line is gone");
assert(/\.homeHead\s*\{[^}]*direction:\s*rtl/.test(css) && html.includes("home-logo.png") && html.includes('id="btnMenu"'), "the home bar runs from the menu to the name");
assert(/\.hero\s*\{[^}]*text-align:\s*right/.test(css), "the monthly amount sits on the right");
assert(html.includes('id="homeHello"') && /id="homeHello"[\s\S]{0,240}מצב חשבונך[\s\S]{0,180}id="homeSummary"/.test(html) && html.split('id="homeSummary"').length === 2 && !html.includes("כאן אפשר לראות את תמונת המצב של הלקוחות שלך") && !html.includes("פעילות אחרונה") && !html.includes("המשימות הקרובות"), "the filed premium sits under the greeting, without the sentence, activity, or upcoming tasks");
assert(/#screenHome\s*\{[^}]*background:\s*var\(--bg\)/.test(css) && /\.homeLogo\s*\{[^}]*height:\s*26px/.test(css) && html.includes("home-logo.png?v=2") && html.includes('alt="ONYX"'), "the home field is the light app background and the logo sits in the navy bar");
assert(html.includes(">לקוחות<"), "customers tab");
assert(html.includes("חפש לקוח לפי שם, ת.ז. או מספר טלפון"), "customer search field");
assert(html.includes('data-tab="alerts"') && html.includes('id="btnBell"') && !html.includes('data-tab="more"'), "the bell sits where more used to be");
assert(/data-more="sales"[\s\S]*?setRow__label">מכירות</.test(html) && /id="btnReport"[\s\S]*?>מכירות</.test(html) && html.includes("פעילות נציגים") && html.includes("לידים") && html.includes("הודעת מערכת") && !html.includes("שליחת עדכון מערכת"), "more menu and the quick action say sales");
assert(js.includes('rpc("gi_daily_sales_by_agent"'), "sales uses the daily agent summary");
assert(js.includes("payload->agentBranches") && !js.includes('.select("payload")'), "office branches are read without the full settings file");
assert(js.includes("מודיעין") && js.includes("חיפה") && js.includes("סה״כ שני האזורים"), "sales shows both areas and their total");
assert(js.includes("אין מכירות ביום זה"), "an empty sales day stays empty");
assert(js.includes('from("gi_agent_live")') && js.includes("120000"), "agent activity reads who is live now");
assert(js.includes("LEAD_META_JSON") && js.includes("proposalPremiumAt") && js.includes("function campaignRows"), "closed premium still reads the lead stamp");
assert(js.includes("head: true"), "the lead count still does not download every lead");
assert(js.includes('from("gi_system_notices")') && js.includes("אין הרשאה לשלוח הודעת מערכת") && js.includes('role === "admin" || role === "manager"'), "a system notice reuses the existing table and manager permission");
assert(js.includes("name === \"alerts\""), "the alerts tab keeps the tab bar");
assert(/\.tile__label\s*\{[^}]*font-size:\s*15px/.test(css) && /\.tile__value\s*\{[^}]*display:\s*inline-block[^}]*font-weight:\s*700[^}]*linear-gradient\(180deg,\s*#07080C 0%,\s*#1A3058 42%,\s*#7E9BBD 100%\)/.test(css) && /\.tile__value--money\s*\{[^}]*display:\s*inline-block[^}]*linear-gradient\(180deg,\s*#07080C 0%,\s*#1A3058 42%,\s*#7E9BBD 100%\)[^}]*background-clip:\s*text/.test(css), "tile titles are a little larger and the amounts fade from black into a soft navy");
assert(js.includes("function dayGreeting") && /function dayGreeting\(now\) \{[\s\S]*?hour >= 5 && hour < 12\) return "בוקר טוב"[\s\S]*?hour >= 12 && hour < 16\) return "צהריים טובים"[\s\S]*?hour >= 16 && hour < 23\) return "ערב טוב"[\s\S]*?return "לילה טוב"/.test(js) && /function homeHelloLine\(now\) \{[\s\S]*?agentFirstName\(state\.profile && state\.profile\.name\)[\s\S]*?greet \+ " " \+ name/.test(js) && (js.match(/hello\.textContent = homeHelloLine\(\)/g) || []).length === 2 && !js.includes("jerusalemSun") && !js.includes('שלום, ') && html.includes("מצב חשבונך") && js.includes("stats.pending + stats.issued") && !js.includes("סה״כ פרמיית הפקה"), "the home greets by the clock and shows only the viewer's first name");
assert(js.includes("stats.pending + stats.issued") && js.includes("refreshHomeMetrics") && js.includes("loadReport(true)"), "the summary adds waiting and issued premium from a fresh report");
assert(js.includes("homeTimer") && js.includes("10000") && js.includes("visibilitychange"), "home numbers refresh while the screen stays open");
assert(/\.hero\s*\{[^}]*background:\s*transparent/.test(css) && /\.hero\s*\{[^}]*box-shadow:\s*none/.test(css), "the summary has no card frame");
assert(/\.tile\s*\{[^}]*background:\s*var\(--card\)[^}]*border-radius:\s*16px/.test(css) && /\.jumps\s*\{[^}]*repeat\(4,\s*1fr\)/.test(css) && /\.jump\s*\{[^}]*background:\s*var\(--navy-surface\)[^}]*align-items:\s*center/.test(css) && /\.blockTitle::before\s*\{[^}]*background:\s*var\(--onyx-blue-500\)/.test(css) && /data-tab="home"><svg[\s\S]*?<span>ראשי<\/span>/.test(html) && html.includes('id="tilePending"') && html.includes("פגישות") && html.includes("משימות"), "the home shortcuts are one navy row, section titles carry a blue mark, and the home tab reads ראשי");
assert(html.includes("login-logo.png") && html.includes('d="M9 6l6 6-6 6"'), "login shows the original logo under a right-pointing arrow");
assert(/class="authCard authCard--center" id="mfaForm"/.test(html) && !html.includes("onyx-splash/mark.png"), "the code screen centers the same logo and drops the small mark");
assert(js.includes('id="simBirth" type="date"') && js.includes('id="simStart" type="date"') && !js.includes("פרטי המבוטח. הפרמיה מחושבת במנוע של החברה.") && js.includes("פרמיה לפני הנחה") && js.includes("פרמיה לאחר הנחה") && js.includes("הנחה ידנית") && js.includes("payload->companyDiscountOverrides") && html.includes("discount-catalog.js") && js.includes("./logos/phoenix.png") && js.includes('"simLogo"') && js.includes("simResultWrap") && js.includes("simLogos") && js.includes('["הפניקס", "מגדל", "כלל"]') && js.includes('["מנורה", "הכשרה", "איילון"]') && js.includes("הוסף מוצר ללקוח") && js.includes("הוספת מבוטח") && js.includes('id="simAddInsured"') && js.includes("סה״כ לפני הנחה") && js.includes("סה״כ לאחר הנחה") && /\.simLogo\s*\{[^}]*left:\s*14px/.test(css) && /\.simLogos__row\s*\{[^}]*repeat\(3,\s*1fr\)[^}]*gap:\s*28px/.test(css), "the company logos sit in two even rows, the result logo is in the top corner, and added insureds get a total");
assert(/\.homeActions\s*\{[^}]*color:\s*#4E5D73[^}]*font-size:\s*20px[^}]*font-weight:\s*500[^}]*linear-gradient\(to left,\s*rgba\(56,\s*112,\s*237/.test(css) && /\.hero__status\s*\{[^}]*font-size:\s*20px/.test(css) && /\.hero__account\s*\{[^}]*flex-direction:\s*row/.test(css) && html.includes("מצב חשבונך:") && /\.hero__value\s*\{[^}]*color:\s*#17457E[^}]*text-shadow:\s*none/.test(css) && /\.hero__hello\s*\{[^}]*font-size:\s*22px[^}]*font-weight:\s*700[^}]*color:\s*var\(--onyx-navy-600\)/.test(css) && /\.hero\s*\{[^}]*padding:\s*30px 2px 18px/.test(css) && /\.actions\s*\{[^}]*display:\s*flex/.test(css) && html.includes('class="homeActions">פרמיות') && html.includes('class="homeActions">פעולות מהירות') && !html.includes("action__ico") && html.includes("action__mark") && html.includes(">הגש הצעה<") && html.includes(">סימולטורים<") && html.includes(">מכירות<"), "the greeting stays navy, the account figure sits beside its label, and each action has an icon");
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
assert(js.slice(js.indexOf("function paintCustomers"), js.indexOf("function fillSelect")).includes("cust__branches") && js.includes('["פרט", "custBranch--prat"]') && js.includes('["בריאות", "custBranch--health"]') && !js.slice(js.indexOf("function paintCustomers"), js.indexOf("function fillSelect")).includes("פעיל"), "a customer row shows the file branches instead of a status");
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
assert(/<header class="homeHead">[\s\S]*id="btnMenu"[\s\S]*id="btnBell"[\s\S]*id="btnChat"[\s\S]*class="homeLogo"/.test(html) && /data-more="profile"[\s\S]*setRow__ico[\s\S]*פרופיל והגדרות/.test(html) && !html.includes('id="homeAvatar"') && !html.includes('id="btnProfile"') && /\.homeLogo\s*\{[^}]*margin-inline-start:\s*auto/.test(css) && /\.homeHead\s*\{[^}]*direction:\s*rtl/.test(css) && !html.includes("who__hello") && js.includes('key === "profile"'), "the logo sits on the visual left, the chat button sits beside the bell, and profile opens from the menu");
assert(/\.homeHead,\s*\.bar\s*\{[^}]*background:\s*var\(--navy-surface\)/.test(css) && css.includes("--navy-surface:") && css.includes("#1E5AA3") && css.includes("--bar:") && css.includes(".homeHead::before") && css.includes("pointer-events: none") && /\.authHead\s*\{[^}]*background:\s*transparent/.test(css) && /\.screen--auth\s*\{[^}]*background:\s*#FBF7F2/.test(css) && /\.screen--splash\s*\{[^}]*background-color:\s*#fff/.test(css) && !html.includes("ואחר כך הקוד מהאפליקציה") && /\.homeHead\s*\{[^}]*border-radius:\s*0;/.test(css) && /\.menuBtn\s*\{[^}]*background:\s*transparent[^}]*width:\s*44px/.test(css) && /html,\s*body\s*\{[^}]*background:\s*var\(--app-background\)/.test(css) && /\.tabbar\s*\{[^}]*background:\s*var\(--app-background\)/.test(css) && css.includes("--safe-t"), "the navy bars carry a blue light, financial lines sit behind them, and the area under the tabs matches the app background");
assert(/\.tile__label\s*\{[^}]*min-height:\s*2\.7em/.test(css) && /\.tile__icon\s*\{[^}]*right:\s*12px/.test(css) && (html.match(/class="tile__art"/g) || []).length === 4, "issued and waiting premium titles share a line, and each tile keeps its mark at the top right");
assert(js.includes("function generatedDocument") && js.includes("payloadSnapshot") && js.includes("operational_report_health"), "a customer document without a stored file still opens from its saved report");
assert(js.includes("function shadeOpenItems") && js.includes('visibilityState === "hidden"'), "leaving the app posts the open alerts to the phone shade");
assert(!css.includes("folio-cover.svg") && !html.includes("folio-cover.svg") && /\.folioAvatar\s*\{[^}]*border-radius:\s*50%/.test(css) && /\.fileCard__contacts\s*\{[^}]*display:\s*flex/.test(css) && /\.fileCard__name\s*\{[^}]*color:\s*var\(--ink\)/.test(css) && js.includes('data-edit="1"') && js.includes("fileCard__contacts") && js.includes("תיק ביטוח") && js.includes('"היסטוריה"') && js.includes('"משימות"') && js.includes("function saveContact") && js.includes("email: email") && js.includes("פרמיה חודשית") && !js.includes("הפקדה חודשית") && !js.includes('.select("payload")'), "the customer file is a full screen without a photo, and a tap still edits the contact");
assert(js.includes('href="tel:') && js.includes("אימייל") && js.includes("כתובת מגורים"), "personal details include a dial button, email, and address");
assert(html.includes('id="docView"') && html.includes('id="btnDocSave"') && js.includes("function viewDocument"), "a document opens for viewing and can still be downloaded");
const fileBlobSrc = js.slice(js.indexOf("async function fileBlob"), js.indexOf("async function sniffMime"));
assert(js.includes("function paintPdfPages") && js.includes("pdfjs-dist@3.11.174") && js.includes("function paintSpreadsheet") && js.includes("xlsx@0.18.5") && js.includes("followupData") && js.includes("function officialOriginal") && js.includes("fillFollowupPdf") && js.includes("gi-followup-zip.js") && js.includes("pdf-lib@1.17.1") && js.includes("class=\"docPages\"") && css.includes(".docGrid") && /\.docView\s*\{[^}]*position:\s*fixed/.test(css) && css.includes("z-index: 40") && fileBlobSrc.indexOf('indexOf("data:")') >= 0 && fileBlobSrc.indexOf('indexOf("data:")') < fileBlobSrc.indexOf(".download(path)") && fileBlobSrc.indexOf(".download(path)") < fileBlobSrc.lastIndexOf("await fetch(href)") && js.includes("המסמך נטען. אפשר להוריד אותו מהכפתור למעלה.") && js.includes("function paintFittedHtml") && js.includes("docFit__sheet") && js.includes("210mm") && css.includes(".docFit") && /\.docView__body:has\(\.docFit\)/.test(css) && !js.includes("app.js") && !js.includes('.select("payload")'), "a customer-file document opens the original form, and pages, spreadsheets, and HTML fit the phone with download");
assert(js.includes("folioPol") && css.includes(".folioPol") && js.includes("function policyInsuredName") && /const who = status\.live \? policyInsuredName\(policy, payload\)/.test(js) && css.includes(".folioPol__text .folioPol__who"), "an active policy row names the insured");
assert(sw.includes('addEventListener("push"') && js.includes("pushManager") && js.includes("onyx_push_vapid_public") && js.includes("onyxsub_"), "a locked phone can receive a server push");
assert(!js.includes("התראות ותזכורות מגיעות גם כשהמסך כבוי"), "the notifications screen has no long explanation");
assert(js.includes("הגיע") && js.includes("late && pushReady"), "a late reminder updates the list and does not pop again after the shade");
const alertsFn = js.slice(js.indexOf("function paintAlerts"), js.indexOf("function openAlerts"));
const alertsOpen = js.slice(js.indexOf("function openAlerts"), js.indexOf("function paintReminderForm"));
assert(!alertsFn.includes("תזכורת") && alertsFn.includes("אין התראות היום") && !alertsOpen.includes("loadMyReminders") && !js.includes(">תזכורות<") && !js.includes("אין תזכורות פתוחות") && !html.includes('id="btnNewReminder"') && html.includes("תזכורת חדשה") && html.includes('data-compose="task"') && html.includes("משימה חדשה") && js.includes('task: "משימה"') && js.includes("שמור משימה") && /function saveReminder[\s\S]*?openTasks\(/.test(js), "alerts show only alerts, and the tasks screen adds a reminder or a task");
assert(html.includes('id="folioMenu"') && html.includes('id="folioMenuBackdrop"') && /\.folioMenu button,[\s\S]*?font-size:\s*18px/.test(css) && /\.folioMenu button\.is-on\s*\{[^}]*color:\s*var\(--blue\)/.test(css), "the customer menu is a large card that opens on the left");
const pushScript = fs.readFileSync(path.join(root, "scripts/onyx-phone-push.mjs"), "utf8");
const pushWorkflow = fs.readFileSync(path.join(root, ".github/workflows/onyx-phone-push.yml"), "utf8");
const pushFunction = fs.readFileSync(path.join(root, "supabase/functions/onyx-phone-push/index.ts"), "utf8");
assert(pushScript.includes("web_push: 8030") && pushScript.includes("navigate:") && !pushScript.includes("mutable:") && pushFunction.includes("web_push: 8030") && pushFunction.includes("navigate || PHONE_URL") && pushFunction.includes("ONYX_VAPID_PUBLIC_KEY") && pushFunction.includes('like("key", "onyxsub_%")') && !pushFunction.includes("mutable:"), "the shade gets the notification while the app is closed");
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
assert(js.includes('data.type === "sale-ring"') && sw.includes('type: "sale-ring"') && !sw.includes("sale-seen") && !pollFn.includes("absorbWorkerSeen") && !shadeFn.includes("writeAlertSeen") && pushFn.includes('type: "sale-ring"') && pushFn.indexOf("showNotification") < pushFn.indexOf("pageIsAwake") && pushFn.indexOf("showNotification") < pushFn.indexOf("rememberAlertIds") && js.includes('visible: document.visibilityState === "visible"') && sw.includes("data.visible === true") && js.includes("function notifyHiddenSales") && js.includes("function subscriptionMatches") && js.includes("applicationServerKey") && pushScript.includes('sentId + "\\n" + sub.endpoint') && pushFunction.includes('sentId + "\\n" + sub.endpoint'), "a new sale and a closed lead ring inside the open app and still reach a locked phone");
assert(!css.includes("M314 12h54") && !css.includes("opacity='.34'") && css.includes("--app-background: #F5F8FD") && !html.includes("המספרים שלך היום"), "the bars stay plain navy and the daily count heading is gone");
assert(/id="screenCustomers"[\s\S]*id="btnCustomersBack"[\s\S]*<h1>לקוחות<\/h1>/.test(html) && !/id="screenCustomers"[\s\S]*id="btnNewCustomer"/.test(html) && html.includes('id="btnAddCustomer"') && !html.includes('cx="15" cy="12"'), "the customers screen keeps the back button and drops the header add button");
assert(css.includes("scrollbar-width: none") && css.includes(".homeBody::-webkit-scrollbar") && css.includes("display: none"), "scrolling stays and the scrollbar line is hidden");
assert(js.includes("function rowsForAgentTotals") && js.includes("token(row.agent) === token(agent)") && js.includes("rowsForAgentTotals(report)"), "the sales totals follow the selected agent");
assert(js.includes('document.querySelector("#screenHome .homeBody")') && js.includes("homeBody.scrollTop = 0"), "the home screen opens from the top");
assert(html.includes('id="tileCancel"') && html.includes("פרמיית ביטול") && js.includes("function cancellationPremium") && js.includes("cancelStats(sheet).total.premium"), "cancellation premium comes from the cancellations report");
assert(js.includes("function markAlertsSeen") && js.includes("function unseenAlerts") && /async function openAlerts\(\)[\s\S]*?markAlertsSeen\(items\)/.test(js), "opening the alerts clears the bell until a new one arrives");
assert(js.includes("payload->teamManagerAssignments") && js.includes("payload->agentReportAliases") && js.includes("function teamRoster") && js.includes("tokenLists"), "a team manager's issued premium includes every assigned agent");
assert(js.includes('description.ilike.%proposalPremiumAt%') && sw.includes("proposalPremiumAt*") && /async function checkSales\(\)[\s\S]*?type: "sale-ring"[\s\S]*?showOnce[\s\S]*?watch\.seen/.test(sw), "a sale stamped today still alerts when the row was not touched today, and an open app is not marked seen first");
assert(html.includes('data-more="simulators"') && html.includes(">סימולטורים<") && !html.includes('data-more="documents"') && js.includes('key === "simulators"') && js.includes("openSim()"), "the menu opens the simulator center instead of documents");
assert(css.includes(".folioHero::after") && /polygon\(0 0, 100% 0, 50% 100%\)/.test(css) && js.includes('class="folioHero"') && js.includes('class="folioStage"') && /\.folioStage\s*\{[^}]*background:\s*var\(--navy-surface\)/.test(css), "the customer card ends in a downward triangle on the navy header");
assert(!html.includes('id="btnAddMeeting"') && html.includes("שמור פגישה") && js.includes("function saveMeeting") && js.includes("openMeetSheet") && js.includes('id: "meet_"') && js.includes('type: "callback"') && js.includes("function isMeeting") && js.includes('return "פגישה"') && js.includes("https://waze.com/ul?q=") && js.includes("לא נוצר לקוח חדש") && js.includes('from("reminders").insert(row)'), "a meeting looks up an existing customer, shows the address, and opens Waze");
assert(js.includes('state.fileTab = "policies"') && js.includes("function fileSectionTab") && /tab === "policies" \? portfolio : ""/.test(js) && js.includes('fileSectionTab() !== "policies"'), "a customer file opens on its policies, and history, tasks, or documents open inside it");
assert(/'<span class="folioLine__ico">' \+ icon \+ "<\/span><b"/.test(js) && /\.folioLine\s*\{[^}]*justify-content:\s*flex-start/.test(css), "phone, email, and address icons sit on the right");
assert(/\.action\s*\{[^}]*background:\s*var\(--navy-surface\)[^}]*0 0 22px rgba\(57, 148, 255, \.72\)/.test(css) && css.includes(".action::before"), "quick actions are navy with a glow");
assert(js.includes("523.25") && js.includes("783.99") && js.includes("1046.5") && js.includes("1567.98") && /kind === "sale"[\s\S]{0,500}return;/.test(js.slice(js.indexOf("function playRing"), js.indexOf("function bytesFromBase64Url"))), "a sale or a closed lead plays the ONYX motif, and a reminder keeps its phrase");
assert(html.includes('id="screenOffer"') && html.includes('id="offerNext"') && html.includes('id="offerTitle"'), "the offer screen is on the phone");
assert(js.includes("פרטי לקוח") && js.includes("פוליסות קיימות") && js.includes("התאמת צרכים") && js.includes("פוליסות חדשות") && js.includes("פרטי משלם") && js.includes("הצהרת בריאות") && js.includes("תיאום שיחה וסיום הקמה") && js.includes('flowType: "health"') && js.includes("needsMainConsideration") && js.includes("סיום הקמת לקוח") && js.includes('from("customers").upsert') && js.includes('from("proposals").upsert') && js.includes("הלקוח משויך לנציג אחר") && html.includes("הורד דוח תפעולי") && html.includes("שליחת הדוח"), "הגש הצעה saves a health customer and proposal, then the existing report can be sent");
assert(!js.includes("פתיחת לקוח חדש נשארת באשף המשרד") && !js.includes('.select("payload")') && !js.includes("app.js"), "the phone wizard does not load the desktop app or a full settings file");
assert(!html.includes('data-more="leads"') && html.includes('data-jump="leads"') && html.includes('data-tab="leads"') && html.includes('id="btnLeadDay"') && html.includes('id="leadCalPop" hidden') && js.includes('leadDay: ""') && js.includes("אין לידים לתאריך זה") && js.includes("data-lead-day") && js.includes("data-lead-month") && js.includes("function setLeadCal") && js.includes("function leadOwns") && js.includes("stampDateIL(row.created_at)") && !js.includes('id="leadCal"></div><div id="leadList"'), "leads open on that day's list, and the calendar opens from the top-left date button");
assert(/data-tab="leads"[\s\S]{0,400}id="leadTabBadge" hidden/.test(html) && /async function openLeadsDay\(dayKey\) \{\s*writeLeadBadgeIds\(new Set\(\)\)/.test(js) && js.includes("leadBadgeNote(id, leadsOpen)") && js.includes("onyx-phone-lead-badge") && /\.tabBadge\s*\{[^}]*background:\s*var\(--navy-surface\)[^}]*color:\s*#fff[^}]*rgba\(57, 148, 255, \.72\)/.test(css), "the leads tab keeps a navy count until the leads screen is opened");
assert(html.includes('id="screenLead"') && js.includes('href="tel:') && js.includes("העתק לינק ללקוח") && js.includes("הלינק הועתק") && js.includes("לא ניתן להכין את הלינק") && js.includes("קיבלת לינק לצפייה במעקב בדיקת תיק הביטוח שלך. לחץ לפתיחה.") && js.includes("ליד חדש") && js.includes("תיעוד נציג") && js.includes("תיעוד מכירה") && js.includes("אין תיעוד") && js.includes("חובה לתעד סיכום שיחה") && js.includes("חובה לתעד מה נמכר ללקוח") && !js.slice(js.indexOf("function openLead"), js.indexOf("function reviewStageName")).includes("REVIEW_SHARE + code</"), "a lead opens its details, a direct call, the same statuses, and a copy button that does not print the link");
const leadPaint = js.slice(js.indexOf("function paintOpenLead"), js.indexOf("async function saveLead"));
assert(html.includes('id="leadBarContact"') && js.includes("https://wa.me/972") && js.includes('aria-label="וואטסאפ"') && js.includes("idIssueDate") && js.includes("תאריך הנפקה") && leadPaint.indexOf('class="leadSide"') < leadPaint.indexOf('class="leadStatus"') && leadPaint.indexOf('class="leadStatus"') < leadPaint.indexOf('class="leadInquiry"') && leadPaint.indexOf('class="leadInquiry"') < leadPaint.indexOf('class="leadFacts"') && leadPaint.includes('class="leadBtn"') && /#leadBody \.leadBtn,\s*a\.leadBtn\s*\{[^}]*background:\s*var\(--navy-surface\)[^}]*0 0 22px rgba\(57, 148, 255, \.72\)/.test(css), "an open lead centers the phone under the name, keeps the campaign on the right, and opens status above the request");
assert(js.includes('kind: "lead"') && js.includes("שויך לך ליד") && js.includes('item.kind === "lead" ? "פתח"') && js.includes("onyx-phone-assign") && js.includes('data.type === "lead-open"') && sw.includes("onyx-lead-") && sw.includes('type: "lead-open"') && pushScript.includes("function assignmentAlerts") && pushScript.includes("assign:") && pushFunction.includes("assign:"), "an assigned lead rings for that agent and opens from פתח");
assert(html.includes('data-more="activity" hidden') && js.includes('if (!canAssign())') && js.includes('activity.hidden = !canAssign()'), "agent activity is shown only to a manager or a system admin");
assert(/data-more="sales"[\s\S]*data-more="reports"[\s\S]*data-more="simulators"[\s\S]*data-more="notice"[\s\S]*data-more="profile"/.test(html) && !html.includes('data-more="chat"') && js.includes('class="saleNum"') && js.includes("saleGroup") && css.includes(".saleNum") && css.includes("#12345F"), "the menu starts at sales and ends with profile, and sales numbers are glossy navy by area");
assert(!html.includes('id="taskChips"') && !html.includes('id="taskAdds"') && html.includes('id="btnTaskAdd"') && html.includes('id="taskAddMenu"') && js.includes('host.innerHTML = shown.length'), "the tasks screen keeps the plus and stays empty until a task or reminder is saved");
assert(html.includes('id="meetCal"') && js.includes("data-cal-day") && js.includes("openMeetSheet()") && js.includes('state.composeReturn = "meetings"') && css.includes("#screenMeetings .monthCal") && css.includes("--navy-surface") && js.includes("customer_name"), "meetings fill the navy month, a date opens the meeting form, and the customer stays marked on that day");
assert(html.includes('id="btnChat"') && html.includes('aria-label="צאט"') && html.includes('id="chatBadge"') && html.includes(">צאט<") && html.includes('id="screenChat"') && html.includes('id="chatUserQuery"') && html.includes("חיפוש משתמש") && html.indexOf('id="chatFind"') < html.indexOf('id="chatBody"') && js.includes("gi_chat_messages") && js.includes("invest-chat-presence-room") && js.includes("invest-chat-badge-") && js.includes("function sendChat") && js.includes("function chatListedUsers") && js.includes("function refreshChatBadge") && js.includes("onyx-phone-chat-seen:") && /async function openChat\(\) \{[\s\S]*?await resolveChatMe\(\);\s*markChatSeen\(\)/.test(js) && js.includes("chatUserQuery") && js.includes("chatAvatar") && css.includes(".chatFind") && css.includes(".chatBadge") && css.includes(".chatBubble--mine") && css.includes(".chatAvatar") && css.includes(".chatSend"), "chat opens from the bell row, and an unread count clears when the chat is opened");
assert(/\.chatBadge\s*\{[^}]*background:\s*var\(--navy-surface\)[^}]*color:\s*#fff[^}]*rgba\(57, 148, 255/.test(css), "the unread chat count is a navy bubble with a blue glow");
const chatBadgeSrc = js.slice(js.indexOf("function chatBadgeText"), js.indexOf("function paintChatBadge"));
const chatBadgeBox = { Number };
vm.runInNewContext(chatBadgeSrc, chatBadgeBox);
assert(chatBadgeBox.chatBadgeText(0) === "" && chatBadgeBox.chatBadgeText(4) === "4" && chatBadgeBox.chatBadgeText(120) === "99+", "the chat bubble shows the unread count and caps at 99+");
assert(js.includes("new_policies_count") && js.includes("premiumAfterDiscountValue") && js.includes("sale:cust:") && sw.includes("premiumAfterDiscountValue") && sw.includes("sale:cust:") && pushScript.includes("function policySales") && pushFunction.includes("premiumAfterDiscountValue") && pushScript.includes("8 * 60 * 60 * 1000") && pushFunction.includes("8 * 60 * 60 * 1000"), "a sale is read from the new policy saved today, and an assignment still alerts after the clock is late");
assert(html.includes("phone.css?v=97") && html.includes("phone.js?v=82") && sw.includes("onyx-phone-shell-v98"), "the phone shell cache moves with the new screens");
assert(html.includes('data-more="car"') && html.includes(">רכב בקליק<") && /data-more="simulators"[\s\S]*data-more="car"[\s\S]*data-more="notice"/.test(html) && js.includes('key === "car"') && js.includes('sourceFlow: "carInsuranceClick"') && js.includes("deferCustomerUntilAgentSetup: true") && js.includes("הוגשה לחיתום") && js.includes("waiting_elementary") && js.includes("continueFromStep: 5") && !js.slice(js.indexOf("/* GI-CAR-UI-START */"), js.indexOf("/* GI-CAR-UI-END */")).includes('from("customers").upsert'), "car click opens the elementary wizard and submits a referral without a customer file");
assert(js.includes('data-add="exist"') && js.includes("קובץ הר ביטוח") && js.includes("function offerParseHar") && js.includes("importedFromHarBituach") && js.includes("loadSheetLib") && html.includes('id="offerHarFile"'), "an existing policy can be typed or filled from a Har Bituach file");
assert(js.includes('simLogoHtml(policy.company, "offerLogo")') && css.includes(".offerLogo"), "a new policy row shows the company logo");
assert(js.includes('data-k="payerChoice"') && js.includes("המבוטח משלם") && js.includes("משלם אחר") && js.includes('data-k="paymentMethod"') && js.includes("הוראת קבע") && !js.includes('offerChips("payerChoice"'), "payer and payment are dropdowns");
assert(js.includes("function offerAmountParts") && js.includes('data-amount="1"'), "new policy amounts show a comma and a trailing zero");
assert(!js.includes("מספר סוכן בחברה") && !js.includes("מספר סוכן · ") && !js.includes("function offerAgentNumberError"), "the offer steps do not ask for an agent number");
assert(js.includes("function offerPriceDraft") && js.includes("quotes.quote") && js.includes("המחיר לפי הסימולטור"), "a new policy price comes from the company simulator");
const signOutFn = js.slice(js.indexOf("async function signOut"), js.indexOf("async function assurance"));
assert(html.includes('id="btnFace"') && html.includes('id="faceStage"') && html.includes("אישור כניסה ביומטרית") && html.includes('class="faceCam"') && js.includes("/functions/v1/gi-face-auth") && js.includes("face-api@1.7.15") && js.includes("desktopSecret") && js.includes("onyx-phone-face") && js.includes("מזהה פנים") && js.includes("faceStage--quiet") && js.includes('showFaceStage("enroll")') && js.includes('showFaceStage("login")') && js.includes("הפנים זוהו") && !js.includes("face-auth.html") && css.includes(".faceStage--quiet") && css.includes(".faceStage__ring--hit") && css.includes(".faceCam") && signOutFn.includes("clearStoredProfile") && !signOutFn.includes("FACE_KEY"), "biometric login opens the camera on screen, enrollment still shows it, and the enrollment stays after logout");
assert(js.includes("function faceDistance") && js.includes("function facePickPair") && js.includes("function faceSeparate") && js.includes("function faceSignal") && js.includes('facingMode: { ideal: "user" }') && js.includes("FACE_PASS_KEY") && js.includes("gap >= 0.016") && js.includes("gap > 0.55") && js.includes("const target = 0.022") && js.includes("החזיקו את הפנים ישר מול המסך ונסו שוב.") && !js.includes("הזיזו מעט את הראש") && !js.includes("dist >= 0.02") && js.includes('faceStageText("הפנים זוהו. נכנסים…")') && !js.includes('faceStageText("הפנים זוהו")') && !css.includes("opacity: 0.02"), "biometric login sends a still face inside the server window and enters only after approval");
assert(/function copyReviewLink\(row, button\) \{[\s\S]{0,900}new ClipboardItem/.test(js), "the customer link is copied inside the same tap");
const reviewPage = fs.readFileSync(path.join(root, "phone/review.html"), "utf8");
assert(reviewPage.includes("תהליך בדיקת תיק הביטוח שלך") && reviewPage.includes("התיק הביטוחי שלך כעת בבדיקה") && reviewPage.includes("פוליסות קיימות שלא מבטלים") && reviewPage.includes("עוד קצת וחוזרים אליך עם תוצאות הבדיקה") && reviewPage.includes("הבדיקה מוכנה. הישאר זמין, בקרוב הסוכן מתקשר להמשך תהליך.") && reviewPage.includes("onyx_review_open") && reviewPage.includes("מספר טלפון") && reviewPage.includes("justify-content: center") && /\.card\s*\{[^}]*color:\s*var\(--ink\)/.test(reviewPage) && reviewPage.includes("Asia/Jerusalem") && js.includes("function reviewPhoneKey") && js.includes('from("onyx_review_links")') && js.includes('patch.stage = stage') && js.includes("REVIEW_RANK") && !reviewPage.includes("תעודת זהות") && !reviewPage.includes("האם אושפזת"), "the customer page asks for the lead phone on a centered navy screen and hides the health answers");
assert(fs.readFileSync(path.join(root, "supabase/functions/gi-sign/index.ts"), "utf8").includes("onyx_review_links") && fs.readFileSync(path.join(root, "supabase/functions/gi-sign/index.ts"), "utf8").includes("isReviewToken") && !fs.readFileSync(path.join(root, "supabase/functions/gi-sign/index.ts"), "utf8").includes("gemelinvest.github.io"), "a review code is served by the existing short-link card");
const reviewSql = fs.readFileSync(path.join(root, "supabase-onyx-review.sql"), "utf8");
const reviewMirror = reviewSql.slice(reviewSql.indexOf("function public.onyx_review_mirror_card"));
assert(reviewMirror.includes("security definer") && reviewMirror.includes("a0e00000-0000-4000-8000-0000000000e1") && reviewMirror.includes("slot = 'review'") && reviewMirror.includes("review.html?c=") && reviewMirror.includes("signer_id") && !reviewMirror.includes("id_number") && !reviewMirror.includes("snapshot") && reviewSql.includes("revoke all on function public.onyx_review_mirror_card() from public, anon, authenticated"), "a review code redirects through the live short host without the id number");
assert(/item\("documents", "מסמכים"\)\s*\+\s*'<button type="button" data-portal="1"><span>אזור אישי ללקוח<\/span>'/.test(js) && html.includes('id="portalSheet"') && html.includes('id="portalApprove"') && html.includes("אישור יצירת לינק") && js.includes('from("onyx_customer_portals")') && js.includes("function portalIdentity") && js.includes("האזור האישי פתוח") && js.includes('host !== "127.0.0.1" && host !== "localhost"'), "the customer menu opens a personal area under documents, and the agent approves the link");
assert(html.includes('id="portalClose"') && js.includes("סגירת האזור האישי") && js.includes("enabled: false") && js.includes("function closePortal"), "the agent can close the customer's personal area");
assert(html.includes('id="portalSend"') && js.includes("שלח לינק לאזור אישי ללקוח") && js.includes('const PORTAL_SHARE = "https://gi-go.rainy-reference.workers.dev/"') && js.includes("function portalLabel") && js.includes("function sendPortalLink") && js.includes('const REVIEW_SHARE = "https://gi-go.rainy-reference.workers.dev/"') && !js.includes("onyx.sms"), "the agent sends a personal-area link on the host that actually opens");
const portalCard = fs.readFileSync(path.join(root, "phone/portal-og.jpg"));
assert(js.includes("function portalShareFile") && js.includes('fetch("./portal-og.jpg")') && js.includes('new File([blob], "onyx-portal.jpg"') && js.includes("files: [file]") && sw.includes("./portal-og.jpg") && portalCard[0] === 0xff && portalCard[1] === 0xd8 && portalCard.length > 8000 && portalCard.length < 250000, "a personal-area WhatsApp send puts the card image above the link");
const portalPage = fs.readFileSync(path.join(root, "phone/portal.html"), "utf8");
assert(portalPage.includes("האזור האישי") && portalPage.includes("תעודת זהות") && portalPage.includes(">טלפון<") && portalPage.includes("תאריך לידה") && portalPage.includes("הביטוחים שלך") && portalPage.includes("התשלום החודשי") && portalPage.includes("ביטולים שבוצעו") && portalPage.includes("פוליסות קודמות") && portalPage.includes("טופס התאמת צרכים") && portalPage.includes("מכתבי ביטול") && portalPage.includes("מסמכים בתיק") && portalPage.includes("gi-portal-code") && portalPage.includes("קוד חד־פעמי") && portalPage.includes("אישור הקוד") && !portalPage.includes('id="birth"') && portalPage.includes("מסמך חתום") && portalPage.includes("Asia/Jerusalem") && portalPage.includes("הפרטים לא תואמים את התיק") && !portalPage.includes("healthDeclaration") && !portalPage.includes("cardNumber"), "the personal area asks for id and phone, then a one-time email code, and still opens the needs form");
const portalFn = fs.readFileSync(path.join(root, "supabase/functions/gi-portal-code/index.ts"), "utf8");
const portalYml = fs.readFileSync(path.join(root, ".github/workflows/deploy-portal-code.yml"), "utf8");
assert(portalFn.includes("onyx_customer_portal_open") && portalFn.includes("onyx_customer_portal_doc") && portalFn.includes("HMAC") && portalFn.includes("GMAIL_APP_PASSWORD") && portalFn.includes("onyx-portal-codes") && portalFn.includes("function maskEmail") && !portalFn.includes("console.log"), "the one-time code is emailed by the edge function and stored as an HMAC");
assert(portalYml.includes("gi-portal-code") && portalYml.includes("branches: [main]") && portalYml.includes("--no-verify-jwt"), "the code function deploys only from main");
assert(js.includes("הלקוח נכנס עם תעודת זהות וטלפון, ואז עם הקוד שנשלח למייל") && js.includes("לכניסה יש להזין תעודת זהות וטלפון, ואז את הקוד שנשלח למייל") && !js.includes("הלקוח נכנס עם תעודת זהות, טלפון ותאריך לידה") && !js.includes("לכניסה יש להזין תעודת זהות, טלפון ותאריך לידה"), "the agent describes entry as id and phone, then the email code");
assert(["phoenix", "menora", "hachshara", "migdal", "ayalon", "clal"].every((name) => portalPage.includes("./logos/" + name + ".png")) && portalPage.includes('class="polLogo"') && portalPage.includes("function companyMark"), "a personal-area policy row shows the company logo");
const portalSql = fs.readFileSync(path.join(root, "supabase-onyx-customer-portal.sql"), "utf8");
const portalOpenFn = portalSql.slice(portalSql.indexOf("function public.onyx_customer_portal_open"), portalSql.indexOf("function public.onyx_portal_inline_file"));
assert(portalSql.includes("onyx_customer_portal_open") && portalSql.includes("onyx_customer_portal_doc") && portalSql.includes("security definer") && portalSql.includes("grant execute on function public.onyx_customer_portal_open(text, text, text, text) to anon, authenticated") && portalSql.includes("grant execute on function public.onyx_customer_portal_doc(text, text, text, text, text) to anon, authenticated") && portalSql.includes("revoke all on function public.onyx_portal_gate(text, text, text, text) from public, anon, authenticated") && portalSql.includes("revoke all on table public.onyx_customer_portals from anon, public") && portalSql.includes("portal.html?c=") && portalSql.includes("slot = 'portal'") && portalSql.includes("טופס התאמת צרכים") && portalSql.includes("מכתב ביטול") && portalSql.includes("pdf_base64") && portalSql.includes("customer_sign_signed") && !portalOpenFn.includes("dataUrl") && !portalSql.includes("cardNumber") && !portalSql.includes("healthDeclaration"), "the personal area opens a needs form or a signed file without returning the raw record");
assert(portalSql.includes("from public.customers c") && portalSql.includes("c.payload") && portalSql.includes("function public.onyx_portal_array") && portalSql.includes("revoke all on function public.onyx_portal_array(jsonb) from public, anon, authenticated") && !/select id, full_name, id_number, phone, payload/.test(portalSql) && !/jsonb_typeof\([^)]*\) <> 'array' or jsonb_array_length/.test(portalSql), "a personal-area login reads the customer file even when a list is missing");
const portalStart = js.indexOf("/* GI-PORTAL-START */");
const portalEnd = js.indexOf("/* GI-PORTAL-END */");
const portalBox = { String, Array };
vm.runInNewContext(js.slice(portalStart, portalEnd), portalBox);
const portalWho = portalBox.portalIdentity({
  id_number: "012345678",
  phone: "050-123-4567",
  payload: { primary: { birthDate: "12.04.1990", idNumber: "012345678" }, insureds: [] }
});
assert(portalWho.id === "12345678" && portalWho.phone === "501234567" && portalWho.birth === "19900412", "a file with an id, a phone, and a birth date can open a personal area");
assert(portalBox.portalIdentity({ phone: "0501234567", payload: {} }).birth === "", "a file without a birth date is not approved");
const carStart = js.indexOf("/* GI-CAR-START */");
const carEnd = js.indexOf("/* GI-CAR-END */");
const carBox = { String, Array, Number, Date, Object };
vm.runInNewContext(js.slice(carStart, carEnd), carBox);
assert(carBox.carIsraeliIdOk("123456782") && !carBox.carIsraeliIdOk("123456789") && !carBox.carIsraeliIdOk("12345678"), "a car click accepts a 9-digit Israeli id");
const carPerson = carBox.carBlank();
carBox.carPrefill(carPerson, {
  full_name: "דנה לוי",
  id_number: "123456782",
  phone: "0501234567",
  city: "חיפה",
  payload: { primary: { firstName: "דנה", lastName: "לוי", gender: "נקבה", birthDate: "12.04.1990", idIssueDate: "2010-05-01", licenseIssueDate: "2010", phone: "0501234567", street: "הרצל", houseNumber: "10", city: "חיפה", zip: "6100000" } }
});
assert(carPerson.gender === "female" && carPerson.birthDate === "1990-04-12" && carBox.carStepError(carPerson, "personal") === "", "a found customer fills the personal step");
const carVehicle = carBox.carBlank();
carVehicle.licensePlate = "1234567";
assert(carBox.carStepError(carVehicle, "vehicle").indexOf("לשלוף") >= 0, "a plate cannot continue before the government lookup settles");
const applied = carBox.carApplyGov(carVehicle, { source: "active", records: [{ mispar_rechev: "1234567", tozeret_nm: "טויוטה", kinuy_mishari: "קורולה", shnat_yitzur: 2020, degem_cd: "88" }] }, "1234567");
carVehicle.vehicleLien = { status: "none" };
assert(applied.found && carVehicle.leviYitzhakModel.indexOf("טויוטה") >= 0 && carVehicle.vehicleModelCode === "88" && carBox.carStepError(carVehicle, "vehicle") === "", "a fetched vehicle card is stored for the elementary team");
const blocked = carBox.carBlank();
blocked.elementaryInsuranceHistory = { claimsCount: "4" };
assert(carBox.carStepError(blocked, "history").indexOf("לא ניתן לבטח") >= 0, "more than three claims stops the car wizard");
assert(carBox.carPendingReferral([{ status: "pending", idNumber: "012345678" }], "12345678") && !carBox.carPendingReferral([{ status: "done", idNumber: "123456782" }], "123456782"), "a second car click is blocked while a referral is still pending");

const matchStart = js.indexOf("/* GI-FACE-MATCH-START */");
const matchEnd = js.indexOf("/* GI-FACE-MATCH-END */");
const matchBox = { Math, Number, Array, isFinite };
vm.runInNewContext(js.slice(matchStart, matchEnd), matchBox);
function faceVec(x, y) {
  const out = [];
  for (let i = 0; i < 128; i += 1) out.push(0);
  out[0] = x;
  out[1] = y;
  return out;
}
const stillA = { descriptor: faceVec(1, 0), score: 0.9, t: 1, box: { x: 0, y: 0, width: 100, height: 120 } };
const stillB = { descriptor: faceVec(1, 0), score: 0.8, t: 1, box: { x: 0, y: 0, width: 100, height: 120 } };
assert(matchBox.facePickPair([stillA, stillB]) === null, "two reads of the same frame are not a second scan");
const held = { descriptor: faceVec(1, 0), score: 0.86, t: 1.3, box: { x: 0, y: 0, width: 100, height: 120 } };
const heldPair = matchBox.facePickPair([stillA, held]);
const heldGap = heldPair ? matchBox.faceDistance(heldPair[0], heldPair[1]) : 0;
assert(Array.isArray(heldPair) && heldPair.length === 2 && heldGap >= 0.016 && heldGap <= 0.03, "a straight face held still is separated into the server window");
const shiftOnly = { descriptor: faceVec(1, 0.005), score: 0.7, t: 1.3, box: { x: 12, y: 0, width: 100, height: 120 } };
const shiftPair = matchBox.facePickPair([stillA, shiftOnly]);
const shiftGap = shiftPair ? matchBox.faceDistance(shiftPair[0], shiftPair[1]) : 0;
assert(Array.isArray(shiftPair) && shiftGap >= 0.016 && shiftGap <= 0.55, "a tiny jitter below the old gate is still submitted");
const moved = { descriptor: faceVec(1, 0.03), score: 0.7, t: 1.3, box: { x: 12, y: 0, width: 100, height: 120 } };
const pair = matchBox.facePickPair([stillA, moved]);
const movedGap = pair ? matchBox.faceDistance(pair[0], pair[1]) : 0;
assert(Array.isArray(pair) && pair.length === 2 && pair[0].length === 128 && movedGap >= 0.016 && movedGap <= 0.55, "a live head move the server accepts is recognized");
const stranger = { descriptor: faceVec(0, 1), score: 0.95, t: 2, box: { x: 40, y: 0, width: 100, height: 120 } };
assert(matchBox.facePickPair([stillA, stranger]) === null, "a different face is not accepted");

const chatFns = js.slice(js.indexOf("function trim(value)"), js.indexOf("function roleKey(role)"))
  + js.slice(js.indexOf("function chatMatchesQuery"), js.indexOf("function chatListedUsers"));
const chatBox = { String };
vm.runInNewContext(chatFns, chatBox);
assert(chatBox.chatMatchesQuery({ name: "דנה כהן", role: "נציג", username: "dana" }, "") === true, "an empty user search keeps every person");
assert(chatBox.chatMatchesQuery({ name: "דנה כהן", role: "נציג", username: "dana" }, "דנה") === true, "user search matches the name");
assert(chatBox.chatMatchesQuery({ name: "דנה כהן", role: "נציג", username: "dana" }, "יוסי") === false, "user search hides a different name");
assert(chatBox.chatMatchesQuery({ name: "דנה כהן", role: "נציג", username: "dana" }, "dana") === true, "user search matches the username");

const badgeSrc = js.slice(js.indexOf("function readLeadBadgeIds"), js.indexOf("function paintLeadBadge"));
const badgeMem = {};
const badgeBox = {
  JSON, Set, Array, String,
  localStorage: {
    getItem(key) { return Object.prototype.hasOwnProperty.call(badgeMem, key) ? badgeMem[key] : null; },
    setItem(key, value) { badgeMem[key] = String(value); }
  }
};
vm.runInNewContext(badgeSrc, badgeBox);
assert(badgeBox.readLeadBadgeIds() === null, "the lead count starts empty until a new lead arrives");
assert(badgeBox.leadBadgeNote("lead-1", false).size === 1, "one new lead shows as one");
assert(badgeBox.leadBadgeNote("lead-2", false).size === 2, "several new leads add up on the tab");
assert(badgeBox.leadBadgeNote("lead-3", true).size === 2, "a lead that arrives while the screen is open is not counted");
badgeBox.writeLeadBadgeIds(new Set());
assert(badgeBox.readLeadBadgeIds().size === 0, "opening the leads screen clears the count");

const keyBox = { Math, Number };
vm.runInNewContext(js.slice(js.indexOf("function keyboardOverlap"), js.indexOf("function fitFrame")), keyBox);
assert(keyBox.keyboardOverlap(844, 844, 0) === 0, "a closed keyboard leaves the chat field in place");
assert(keyBox.keyboardOverlap(844, 500, 0) === 344, "an open keyboard reports the covered strip");
assert(keyBox.keyboardOverlap(844, 520, 20) === 304, "the keyboard inset ignores the part already shifted");

if (failed) {
  console.error("\n" + failed + " failed");
  process.exit(1);
}
console.log("\nall passed");
