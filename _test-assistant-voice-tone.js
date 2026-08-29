/* GI-ASSISTANT — local Hebrew female TTS tone, no vendor.
   Run: node _test-assistant-voice-tone.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const vm = require("vm");

const ROOT = __dirname;
const TAG = "20260829-assistant-ops-access-v1";
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
const theme = read("theme.css");
const css = read("app.css");
const app = read("app.js");
const html = read("index.html");
const sw = read("service-worker.js");

console.log("1) cache + no vendor + no system logic");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-assistant.js")]).status === 0, "node --check gi-assistant.js");
assert(html.includes("gi-assistant.js?v=" + TAG), "index cache");
assert(sw.includes("gi-v12-" + TAG), "sw cache");
assert(!asstTs.includes("OPENAI_API_KEY") && !asstJs.includes("OPENAI_API_KEY"), "no API key in client");
assert(!/elevenlabs|azure\.cognitiveservices|google.*texttospeech|api\.openai\.com\/v1\/audio/i.test(asstTs), "no paid TTS vendor");
assert(!theme.includes("giAsst__") && !css.includes("giAsst__hits"), "global CSS untouched");
assert(/canAccessSimulators\(\)\{\s*return this\.isAdmin\(\) \|\| this\.isManager\(\);/.test(app), "simulator UI gate unchanged");
assert(!asstTs.includes("ת״ז"), "client module has no geresh id label");

function elStub(){
  return {
    id: "", innerHTML: "", className: "", hidden: false,
    appendChild(){ return this; }, addEventListener(){},
    querySelector(){ return this; }, querySelectorAll(){ return []; },
    setAttribute(){}, getAttribute(){ return ""; }, removeAttribute(){},
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    focus(){}
  };
}

const sandbox = {
  window: {
    location: { href: "https://crm.example/gemel-invest/index.html" },
    localStorage: { getItem(){ return null; }, setItem(){} },
    addEventListener(){},
    setInterval(){ return 0; },
    clearInterval(){},
    speechSynthesis: { getVoices(){ return []; }, speak(){}, cancel(){}, addEventListener(){} },
    GiAssistant: null
  },
  document: {
    readyState: "complete",
    body: Object.assign(elStub(), { getAttribute(){ return ""; } }),
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
vm.runInNewContext(asstJs, sandbox);
const api = sandbox.window.GiAssistant;

console.log("\n2) prefer feminine Hebrew voice, never a paid vendor");
assert(typeof api.pickHebrewVoice === "function" && typeof api.scoreHebrewVoice === "function", "voice helpers exported");
const male = { name: "Microsoft Asaf - Hebrew (Israel)", lang: "he-IL", localService: true };
const female = { name: "Microsoft Hila Online (Natural) - Hebrew (Israel)", lang: "he-IL", localService: false };
const english = { name: "Google US English", lang: "en-US" };
assert(api.scoreHebrewVoice(female) > api.scoreHebrewVoice(male), "Hila scores above Asaf");
assert(api.scoreHebrewVoice(male) > api.scoreHebrewVoice(english), "Hebrew male still beats English");
assert(api.pickHebrewVoice([male, female, english]).name.indexOf("Hila") >= 0, "picks Hila from a mixed list");
assert(api.pickHebrewVoice([english]) === null, "no English fallback");
assert(api.pickHebrewVoice([male]).name.indexOf("Asaf") >= 0, "uses the only Hebrew voice if it is male");

console.log("\n3) spoken Hebrew is feminine and numbers are words");
assert(typeof api.prepareSpeechText === "function" && typeof api.numberToHebrew === "function", "speech text helpers exported");
assert(api.numberToHebrew(2, "m") === "שני", "2 masculine construct");
assert(api.numberToHebrew(2, "f") === "שתי", "2 feminine construct");
assert(api.numberToHebrew(12, "f") === "שתים עשרה", "12 feminine");
assert(api.numberToHebrew(245, "m") === "מאתיים וארבעים וחמישה", "245 masculine");
assert(api.numberToHebrew(200000, "m") === "מאתיים אלף", "200000 spoken");
const spoken = api.prepareSpeechText("הפרמיה 120 שקלים");
assert(spoken.indexOf("מאה ועשרים") >= 0, "120 becomes Hebrew words");
assert(spoken.indexOf("120") < 0, "raw 120 is not spoken");
assert(/[.!?]$/.test(spoken), "spoken line ends with punctuation");
assert(api.prepareSpeechText("סכום ₪").indexOf("שקלים") >= 0, "₪ becomes שקלים");

const utter = { lang: "", rate: 1, pitch: 1, volume: 1, voice: null };
api.applyVoiceTone(utter, female);
assert(utter.lang === "he-IL", "utterance language is he-IL");
assert(utter.rate <= 0.95, "slower than default");
assert(utter.pitch >= 1.08, "slightly higher pitch");
const maleUtter = { lang: "", rate: 1, pitch: 1, volume: 1, voice: null };
api.applyVoiceTone(maleUtter, male);
assert(maleUtter.pitch > utter.pitch, "male OS voice gets a higher pitch to sound less masculine");

console.log("\n4) replies stay feminine Hebrew, tools unchanged");
assert(api.replyFromTool("find_customer_by_id", { instant: true, ok: true }) === "פותחת את התיק.", "instant open is feminine");
assert(api.replyFromTool("search_customer", { customers: [{}, {}] }).indexOf("מצאתי שני לקוחות") >= 0, "two customers spoken in Hebrew");
assert(api.replyFromTool("get_tasks", { tasks: [{}, {}, {}] }).indexOf("שלוש משימות") >= 0, "three tasks feminine");
assert(api.replyFromTool("get_insurance_price", { monthlyPremium: 87 }).indexOf("שמונים ושבעה שקלים") >= 0, "premium spoken as words");
assert(api.replyFromTool("go_view", { ok: true }) === "עברתי למסך שביקשת.", "go_view feminine");
assert(api.replyFromTool("create_proposal", { ok: true }).indexOf("אשף") >= 0, "wizard wrap reply unchanged in meaning");
assert(api.parseLocalCommand("פתח תיק של רחל").tool === "find_customer_by_id", "open-file router still works");
assert(api.parseLocalCommand("תעברי לשלב הבא").tool === "wizard_next", "wizard next router still works");
assert(api.parseLocalCommand("מחיר מנורה ריסק").tool === "get_insurance_price", "quote wrap still works");
assert(api.commandFromLocalTool("go_view", { view: "contacts" }).type === "go_view", "instant UI mapper untouched");

console.log("\n" + (failed ? "FAILED " + failed : "OK") + "  passed=" + passed + " failed=" + failed);
process.exit(failed ? 1 : 0);
