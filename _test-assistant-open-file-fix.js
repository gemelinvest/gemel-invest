/* GI-ASSISTANT — open customer file by name must actually open (not false בוצע).
   Run: node _test-assistant-open-file-fix.js
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
  if(cond){ passed += 1; console.log("  PASS  " + msg); }
  else { failed += 1; console.error("  FAIL  " + msg); }
}

function read(name){ return fs.readFileSync(path.join(ROOT, name), "utf8"); }

const asstTs = read("gi-assistant.ts");
const asstJs = read("gi-assistant.js");
const app = read("app.js");
const html = read("index.html");
const sw = read("service-worker.js");

console.log("1) cache + await open");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-assistant.js")]).status === 0, "node --check gi-assistant.js");
assert(html.includes("gi-assistant.js?v=" + TAG), "index cache");
assert(sw.includes("gi-v12-" + TAG), "sw cache");
assert(asstTs.includes("async function executeClientCommand"), "executeClientCommand is async");
assert(asstTs.includes("await active.openCustomerByQuery"), "awaits openCustomerByQuery result");
assert(asstTs.includes("await executeClientCommand(instant)"), "desktop awaits open result before speaking");
assert(app.includes("return { ok:true, id:") && app.includes("findVisibleCustomerBySpokenQuery"), "bridge returns ok/id on open");
assert(asstTs.includes("isOpenCustomerSpeech") && asstTs.includes("extractOpenCustomerQuery"), "open-file speech helpers");
assert(!/\/לקוח\|תיק\//.test(asstTs), "extractView no longer routes bare תיק/לקוח to customers list");

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

function loadApi(bridge){
  const sandbox = {
    window: {
      location: { href: "https://crm.example/gemel-invest/index.html" },
      localStorage: { getItem(){ return null; }, setItem(){} },
      addEventListener(){}, setInterval(){ return 0; }, clearInterval(){},
      speechSynthesis: { getVoices(){ return []; }, speak(){}, cancel(){}, addEventListener(){} },
      GiAssistant: null,
      __GI_ASSISTANT_BRIDGE__: bridge || {}
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
    SpeechSynthesisUtterance: function(){ this.lang = ""; }
  };
  sandbox.window.document = sandbox.document;
  sandbox.window.URL = URL;
  sandbox.URLSearchParams = URLSearchParams;
  sandbox.navigator = { userAgent: "Mozilla/5.0" };
  vm.runInNewContext(asstJs, sandbox);
  return sandbox.window.GiAssistant;
}

const api = loadApi({
  async openCustomerByQuery(q){
    if(String(q).indexOf("דוד") >= 0) return { ok:true, id:"cust-1", name:"דוד לוי" };
    return { ok:false };
  },
  openCustomer(id){ return { ok:true, id }; }
});

console.log("\n2) parse phrases that previously mis-routed");
assert(api.parseLocalCommand("תפתח לי את התיק של רחל").tool === "find_customer_by_id", "תפתח לי את התיק → open file");
assert(api.parseLocalCommand("תפתח לי את התיק של רחל").args.query === "רחל", "extracts רחל");
assert(api.parseLocalCommand("כנס לתיק של יוסי").tool === "find_customer_by_id", "כנס לתיק של");
assert(api.parseLocalCommand("כנס לתיק של יוסי").args.query.indexOf("יוסי") >= 0, "extracts יוסי");
assert(api.parseLocalCommand("תיק של דני").tool === "find_customer_by_id", "תיק של דני");
assert(api.parseLocalCommand("פתח תיק של דוד לוי").args.query === "דוד לוי", "פתח תיק של שם מלא");
const listCmd = api.parseLocalCommand("פתח לקוחות");
assert(listCmd && listCmd.tool === "go_view" && listCmd.args.view === "customers", "פתח לקוחות → customers list");
assert(api.commandFromLocalTool("find_customer_by_id", { query: "רחל" }).type === "open_customer", "maps to open_customer");

console.log("\n3) execute respects real open result");
(async () => {
  const ok = await api.executeClientCommand({ type: "open_customer", query: "דוד לוי" });
  const bad = await api.executeClientCommand({ type: "open_customer", query: "אין כזה" });
  assert(ok && ok.ok === true && ok.id === "cust-1", "successful open returns ok+id");
  assert(bad && bad.ok === false, "missing customer returns ok:false (no false בוצע)");
  assert(/לא מצאתי את התיק/.test(api.replyFromTool("find_customer_by_id", { ok:false, instant:true })), "failure reply");
  assert(/פותחת את התיק/.test(api.replyFromTool("find_customer_by_id", { ok:true, instant:true })), "success reply");

  console.log("\n" + (failed ? "FAILED " + failed : "OK") + "  passed=" + passed + " failed=" + failed);
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
