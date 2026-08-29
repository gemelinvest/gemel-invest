/* GI-ASSISTANT — return-to-fill, smoking, house#, dates, phone command path.
   Run: node _test-assistant-phone-fields.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const vm = require("vm");

const ROOT = __dirname;
const TAG = "20260829-assistant-chat-reports-v1";
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
const edgeEngine = read("supabase/functions/gi-assistant-engine/index.ts");

console.log("1) cache + syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-assistant.js")]).status === 0, "node --check gi-assistant.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("gi-assistant.js?v=" + TAG), "index gi-assistant cache");
assert(html.includes("gi-assistant.css?v=" + TAG), "index css cache");
assert(html.includes("app.js?v=" + TAG), "index app cache");
assert(phoneHtml.includes("gi-assistant.js?v=" + TAG), "phone cache");
assert(sw.includes("gi-v12-" + TAG), "sw cache");
assert(asstJs.includes("gi-assistant.ts") && (asstJs.includes("generated from") || asstJs.includes("Compiled from")), "compiled banner");

console.log("\n2) return-to-fill / dismiss validation modal");
function elStub(){
  return {
    id: "", innerHTML: "", className: "", hidden: false, style: {},
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

const desk = loadApi("");
const phone = loadApi("phone");

assert(desk.parseLocalCommand("תחזור למילוי").tool === "dismiss_validation_modal", "תחזור למילוי");
assert(desk.parseLocalCommand("הבנתי אחזור למילוי").tool === "dismiss_validation_modal", "הבנתי אחזור למילוי");
assert(desk.parseLocalCommand("סגור את החלון").tool === "dismiss_validation_modal", "סגור את החלון");
assert(desk.commandFromLocalTool("dismiss_validation_modal", {}).type === "dismiss_validation_modal", "instant dismiss command");
assert(app.includes("dismissValidationModal") && app.includes("giValModal__closeBtn"), "app bridge clicks closeBtn");
assert(app.includes('getElementById("giStep1ValidationModal")'), "bridge targets step1 validation modal");
assert(edgeEngine.includes("dismiss_validation_modal"), "engine allows dismiss command on bus");
assert(asstTs.includes('"dismiss_validation_modal"'), "client UI_COMMANDS includes dismiss");

console.log("\n3) smoking via voice");
const noSmoke = desk.parseLocalCommand("לא מעשן");
assert(noSmoke.tool === "fill_wizard" && noSmoke.args.smoker === false, "לא מעשן");
const yesSmoke = desk.parseLocalCommand("כן מעשן");
assert(yesSmoke.tool === "fill_wizard" && yesSmoke.args.smoker === true, "כן מעשן");
const cig = desk.parseLocalCommand("סיגריות");
assert(cig.tool === "fill_wizard" && cig.args.smokingType === "סיגריות" && cig.args.smoker === true, "type סיגריות marks smoker");
const amount = desk.parseLocalCommand("כמות 20");
assert(amount.tool === "fill_wizard" && amount.args.smokingAmount === "20", "כמות 20");
assert(desk.parseLocalCommand("20 ליום").args.smokingAmount === "20", "20 ליום");
assert(desk.parseLocalCommand("נרגילה").args.smokingType === "נרגילה", "נרגילה type");
assert(desk.parseLocalCommand("סיגריה אלקטרונית").args.smokingType === "סיגריה אלקטרונית", "e-cig type");
assert(app.includes("fields.smokingType") && app.includes("fields.smokingAmount"), "fillWizard maps smoking fields");

console.log("\n4) house number + dates");
assert(desk.parseLocalCommand("מספר בית 12").args.houseNumber === "12", "מספר בית 12");
assert(desk.parseLocalCommand("מס בית 7").args.houseNumber === "7", "מס בית 7");
assert(typeof desk.normalizeWizardDate === "function", "normalizeWizardDate exported");
assert(desk.normalizeWizardDate("15 3 1990") === "15/03/1990", "space date → DD/MM/YYYY");
assert(desk.normalizeWizardDate("15 במרץ 1990") === "15/03/1990", "Hebrew month date");
assert(desk.normalizeWizardDate("15031990") === "15/03/1990", "8-digit date");
assert(desk.normalizeWizardDate("טקסט 01/02/1990") === "01/02/1990", "strips STT טקסט");
assert(desk.parseLocalCommand("תאריך לידה 15 3 1990").args.birthDate === "15/03/1990", "birthDate formatted");
assert(desk.parseLocalCommand("תאריך לידה 15 במרץ 1990").args.birthDate === "15/03/1990", "birthDate Hebrew month");
assert(desk.parseLocalCommand("תאריך הנפקה 01/02/2010").args.idIssueDate === "01/02/2010", "idIssueDate kept/formatted");

console.log("\n5) phone reliability path");
assert(phone.preferredVoiceGender() === "male", "phone masculine TTS");
assert(desk.preferredVoiceGender() === "female", "desktop feminine TTS kept");
assert(phone.replyFromTool("fill_wizard", { ok: true }) === "בוצע.", "phone short fill ack");
assert(phone.replyFromTool("dismiss_validation_modal", { ok: true }) === "חוזרים למילוי.", "phone dismiss short ack");
assert(phone.replyFromTool("go_view", { ok: false, dispatchFailed: true }).indexOf("למחשב") >= 0, "phone reports dispatch fail");
assert(typeof phone.speechHoldMs === "function", "speechHoldMs exported");
assert(phone.speechHoldMs("בוצע.") < desk.speechHoldMs("בוצע."), "phone releases mic faster than desktop");
assert(phone.speechHoldMs("בוצע.") <= 1200, "phone ack hold is short");
assert(asstTs.includes("bindPhoneVisibility") && asstTs.includes("visibilitychange"), "phone pauses STT when hidden");
assert(asstTs.includes("lastUtteranceKey") && asstTs.includes("1200"), "phone dedupes duplicate finals");
assert(asstTs.includes("dispatchFailed") && asstTs.includes("return true"), "dispatch returns success to caller");
assert(asstTs.includes("attempt < 3") && asstTs.includes('action: "dispatch"'), "phone dispatch retries kept");
assert(asstCss.includes("giAsstPhonePage .giAsst__talkForm"), "phone sticky typed fallback");
assert(phone.parseLocalCommand("מספר בית 12").tool === "fill_wizard", "phone fill house still works");
assert(phone.commandFromLocalTool("fill_wizard", { houseNumber: "12" }).type === "fill_wizard", "phone maps fill to bus");
assert(phone.commandFromLocalTool("dismiss_validation_modal", {}).type === "dismiss_validation_modal", "phone maps dismiss to bus");

console.log("\n6) desktop session UX not regressed");
assert(asstTs.includes("!isPhonePage()) hideOverlay()"), "desktop still closes overlay on voice start");
assert(asstTs.includes("is-live") && asstTs.includes("endLiveConversation"), "live session controls kept");
assert(desk.parseLocalCommand("המשך לשלב הבא").tool === "wizard_next", "wizard next kept");
assert(desk.parseLocalCommand("עבור להצעות").args.view === "proposals", "go_view proposals kept");

console.log("\n" + (failed ? "FAILED " + failed : "OK") + "  passed=" + passed + " failed=" + failed);
process.exit(failed ? 1 : 0);
