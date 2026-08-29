/* GI-ASSISTANT — desktop live session, phone short acks, open by phone/id.
   Run: node _test-assistant-session-ux.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const vm = require("vm");

const ROOT = __dirname;
const TAG = "20260829-assistant-hide-talk-ui-v1";
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
const asstCss = read("gi-assistant.css");
const app = read("app.js");
const html = read("index.html");
const phoneHtml = read("assistant.html");
const sw = read("service-worker.js");

console.log("1) cache + syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-assistant.js")]).status === 0, "node --check gi-assistant.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("gi-assistant.js?v=" + TAG), "index gi-assistant cache");
assert(html.includes("gi-assistant.css?v=" + TAG), "index css cache");
assert(html.includes("app.js?v=" + TAG), "index app cache");
assert(phoneHtml.includes("gi-assistant.js?v=" + TAG), "phone cache");
assert(sw.includes("gi-v12-" + TAG), "sw cache");

console.log("\n2) desktop live session markers");
assert(asstTs.includes("hideOverlay()") && asstTs.includes("!isPhonePage()) hideOverlay()"), "desktop closes overlay on voice start");
assert(asstTs.includes("is-live") && asstTs.includes("syncTopbarLive"), "topbar live sync");
assert(asstCss.includes(".giAssistantBtn.is-live") && asstCss.includes("giAsstLiveMenu"), "live CSS + end menu");
assert(asstTs.includes("סיים שיחה עם העוזר"), "Hebrew end-session control");
assert(asstTs.includes("if (!isConversationLive()) void stopVoice()"), "overlay close does not kill live session");
assert(asstTs.includes("endLiveConversation"), "explicit end conversation API");
assert(asstTs.includes("canAccessPersonalAssistant"), "role gate kept");

console.log("\n3) nav / CRM / HAR parsers");
function elStub(){
  return {
    id: "", innerHTML: "", className: "", hidden: false, style: {},
    appendChild(){ return this; }, addEventListener(){},
    querySelector(){ return this; }, querySelectorAll(){ return []; },
    setAttribute(){}, getAttribute(){ return ""; }, removeAttribute(){},
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    focus(){}, closest(){ return null; }
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

const desk = loadApi("");
assert(desk.parseLocalCommand("עבור להצעות").args.view === "proposals", "go_view proposals");
assert(desk.parseLocalCommand("תפתחי את מסך ההצעות").args.view === "proposals", "open proposals screen");
const cont = desk.parseLocalCommand("המשך עריכה של דוד לוי");
assert(cont.tool === "create_proposal" && String(cont.args.query).indexOf("דוד") >= 0, "המשך עריכה → wizard/proposal wrap");
assert(desk.parseLocalCommand("המשך לשלב הבא").tool === "wizard_next", "המשך לשלב הבא still advances");
const byPhone = desk.parseLocalCommand("פתח תיק לפי טלפון 0501234567");
assert(byPhone.tool === "find_customer_by_id" && byPhone.args.query === "0501234567", "open by phone");
const byId = desk.parseLocalCommand("פתח תיק לפי תז 123456789");
assert(byId.tool === "find_customer_by_id" && byId.args.query === "123456789", "open by id number");
assert(desk.parseLocalCommand("תעלה קובץ הר הביטוח מהמחשב").tool === "open_har_import", "HAR picker from spoken upload");
assert(desk.looksLikePhone("0501234567") === true && desk.looksLikeIdNumber("123456789") === true, "id/phone helpers");
assert(app.includes("findCustomerByPhone") && app.includes("normalizePhoneValue(rec.phone)"), "bridge finds by phone");
assert(desk.commandFromLocalTool("go_view", { view: "proposals" }).type === "go_view", "proposals instant command");

console.log("\n4) phone masculine TTS + short acks");
const phone = loadApi("phone");
assert(phone.preferredVoiceGender() === "male", "phone prefers masculine voice");
assert(desk.preferredVoiceGender() === "female", "desktop keeps feminine preference");
const male = { name: "Microsoft Asaf - Hebrew (Israel)", lang: "he-IL", localService: true };
const female = { name: "Microsoft Hila Online (Natural) - Hebrew (Israel)", lang: "he-IL", localService: false };
assert(phone.scoreHebrewVoice(male, "male") > phone.scoreHebrewVoice(female, "male"), "Asaf beats Hila on phone");
assert(phone.pickHebrewVoice([male, female], "male").name.indexOf("Asaf") >= 0, "phone picks Asaf");
assert(phone.replyFromTool("go_view", { ok: true }) === "בוצע.", "phone go_view short ack");
assert(phone.replyFromTool("fill_wizard", { ok: true }) === "בוצע.", "phone fill short ack");
assert(phone.replyFromTool("create_proposal", { ok: true, instant: true }) === "בוצע.", "phone no long wizard spiel");
assert(phone.replyFromTool("open_har_import", { ok: true }).indexOf("בחרו מהמחשב") >= 0, "HAR short picker ack");
assert(phone.parseLocalCommand("עזרה").say.indexOf("פקודה קצרה") >= 0, "phone help is short");
assert(phone.parseLocalCommand("עזרה").say.indexOf("שם פרטי אוריה") < 0, "phone does not recite long wizard intro");
assert(phone.isSpokenQuestion("מה חסר בשלב") === true, "question detector");
assert(asstTs.includes("attempt < 3") && asstTs.includes('action: "dispatch"'), "phone dispatch retries");
assert(asstTs.includes("pauseLocalListening") && asstTs.includes("utteranceBusy"), "STT paused while speaking / busy");

console.log("\n" + (failed ? "FAILED " + failed : "OK") + "  passed=" + passed + " failed=" + failed);
process.exit(failed ? 1 : 0);
