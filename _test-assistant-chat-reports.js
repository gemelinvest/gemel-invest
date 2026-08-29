/* GI-ASSISTANT — chat open/select/draft/send/close + sales/cancellations reports.
   Run: node _test-assistant-chat-reports.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const vm = require("vm");

const ROOT = __dirname;
const TAG = "20260829-assistant-open-file-fix-v1";
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

const asstTs = read("gi-assistant.ts");
const asstJs = read("gi-assistant.js");
const app = read("app.js");
const html = read("index.html");
const phoneHtml = read("assistant.html");
const sw = read("service-worker.js");
const edgeEngine = read("supabase/functions/gi-assistant-engine/index.ts");

console.log("1) cache + syntax + allowlists");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-assistant.js")]).status === 0, "node --check gi-assistant.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("gi-assistant.js?v=" + TAG), "index gi-assistant cache");
assert(html.includes("app.js?v=" + TAG), "index app cache");
assert(phoneHtml.includes("gi-assistant.js?v=" + TAG), "phone cache");
assert(sw.includes("gi-v12-" + TAG), "sw cache");
assert(asstTs.includes('"open_chat"') && asstTs.includes('"chat_send"'), "client UI_COMMANDS chat");
assert(asstTs.includes('"open_sales_report"') && asstTs.includes('"open_daily_sales"'), "client UI_COMMANDS reports");
assert(edgeEngine.includes('"open_chat"') && edgeEngine.includes('"chat_set_draft"'), "engine allowlist chat");
assert(edgeEngine.includes('"open_cancellations_report"') && edgeEngine.includes('"open_daily_sales"'), "engine allowlist reports");
assert(app.includes("openChat()") && app.includes("selectChatUserByName"), "app chat bridge");
assert(app.includes("openSalesReport()") && app.includes("openDailySalesReport"), "app reports bridge");
assert(app.includes("ChatUI.openWindow") && app.includes("ChatUI.closeWindow"), "bridge uses ChatUI");
assert(app.includes('DailyReportUI.openFromHub("daily")') && app.includes('DailyReportUI.openFromHub("cancellations")'), "hub reports via DailyReportUI");
assert(app.includes("setDailySalesReportDateKey"), "daily sales date via DashboardUI");
assert(!/create table/i.test(app), "no schema change in app.js");

function elStub(){
  return {
    id: "", innerHTML: "", className: "", hidden: false, style: {}, value: "",
    appendChild(){ return this; }, addEventListener(){},
    querySelector(){ return this; }, querySelectorAll(){ return []; },
    setAttribute(){}, getAttribute(){ return ""; }, removeAttribute(){},
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    focus(){}, closest(){ return null; }, click(){}
  };
}

function loadApi(page){
  const sandbox = {
    window: {
      location: { href: "https://crm.example/gemel-invest/index.html" },
      localStorage: { getItem(){ return null; }, setItem(){} },
      addEventListener(){}, setInterval(){ return 0; }, clearInterval(){},
      speechSynthesis: { getVoices(){ return []; }, speak(){}, cancel(){}, addEventListener(){} },
      GiAssistant: null
    },
    document: {
      readyState: "complete",
      body: Object.assign(elStub(), { getAttribute(name){ return name === "data-gi-asst-page" ? page : ""; } }),
      getElementById(){ return null; },
      addEventListener(){},
      createElement(){ return elStub(); },
      querySelector(){ return elStub(); }
    },
    URL,
    Date,
    SpeechSynthesisUtterance: function(){ this.lang = ""; this.rate = 1; this.pitch = 1; this.volume = 1; }
  };
  sandbox.window.document = sandbox.document;
  sandbox.window.URL = URL;
  sandbox.window.location = sandbox.window.location;
  sandbox.URLSearchParams = URLSearchParams;
  sandbox.navigator = { userAgent: page === "phone" ? "iPhone" : "Mozilla/5.0" };
  vm.runInNewContext(asstJs, sandbox);
  return sandbox.window.GiAssistant;
}

const api = loadApi("");

console.log("\n2) chat parse + instant commands");
assert(api.parseLocalCommand("פתח את הצאט").tool === "open_chat", "פתח את הצאט");
assert(api.parseLocalCommand("תיכנסי לצאט").tool === "open_chat", "תיכנסי לצאט → open_chat");
assert(api.parseLocalCommand("סגור את הצאט").tool === "close_chat", "סגור את הצאט");
assert(api.parseLocalCommand("שלח הודעה").tool === "chat_send", "שלח הודעה");
const draft = api.parseLocalCommand("כתוב שלום מה נשמע");
assert(draft && draft.tool === "chat_set_draft" && draft.args.text === "שלום מה נשמע", "כתוב → draft text");
assert(api.parseLocalCommand("תרשום בבקשה תשלח לי קובץ").tool === "chat_set_draft", "תרשום");
const pick = api.parseLocalCommand("פתח שיחה עם אוריה סומך");
assert(pick && pick.tool === "chat_select_user" && /אוריה/.test(pick.args.name), "פתח שיחה עם שם");
assert(api.commandFromLocalTool("open_chat", {}).type === "open_chat", "instant open_chat");
assert(api.commandFromLocalTool("close_chat", {}).type === "close_chat", "instant close_chat");
assert(api.commandFromLocalTool("chat_send", {}).type === "chat_send", "instant chat_send");
assert(api.commandFromLocalTool("chat_set_draft", { text: "היי" }).text === "היי", "instant draft keeps text");
assert(api.commandFromLocalTool("chat_select_user", { name: "דני" }).name === "דני", "instant select keeps name");

console.log("\n3) reports parse + dates");
assert(api.parseLocalCommand("כנס לדוח ביטולים").tool === "open_cancellations_report", "כנס לדוח ביטולים");
assert(api.parseLocalCommand("כנס לדוח מכירות").tool === "open_sales_report", "כנס לדוח מכירות");
const day = api.parseLocalCommand("תעבור לדוח מכירות של 23 לאוגוסט ותראה לי מה נמכר");
assert(day && day.tool === "open_daily_sales", "דוח מכירות עם תאריך → daily sales");
assert(day.args.date === "2026-08-23" || day.args.date === (new Date().getFullYear() + "-08-23"), "תאריך 23 לאוגוסט → ISO");
assert(api.commandFromLocalTool("open_sales_report", {}).type === "open_sales_report", "instant sales hub");
assert(api.commandFromLocalTool("open_cancellations_report", {}).type === "open_cancellations_report", "instant cancellations");
assert(api.commandFromLocalTool("open_daily_sales", { date: "2026-08-23" }).date === "2026-08-23", "instant daily sales date");
assert(typeof api.extractSpokenReportDate === "function", "extractSpokenReportDate exported");
assert(api.extractSpokenReportDate("של 23 לאוגוסט").endsWith("-08-23"), "extractSpokenReportDate hebrew month");

console.log("\n4) engine sanitize fields");
assert(edgeEngine.includes('type === "chat_select_user"') && edgeEngine.includes("src.name"), "engine sanitizes chat name");
assert(edgeEngine.includes('type === "chat_set_draft"') && edgeEngine.includes("src.text"), "engine sanitizes draft text");
assert(edgeEngine.includes("open_daily_sales") && edgeEngine.includes("src.date"), "engine sanitizes daily sales date");

console.log("\n" + (failed ? "FAILED " + failed : "OK") + "  passed=" + passed + " failed=" + failed);
process.exit(failed ? 1 : 0);
