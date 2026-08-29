/* GI-ASSISTANT P10 — wrap existing CRM search / customer / tasks.
   Run: node _test-assistant-crm.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const vm = require("vm");

const ROOT = __dirname;
const TAG = "20260829-assistant-open-v1";
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

const app = read("app.js");
const theme = read("theme.css");
const css = read("app.css");
const asstTs = read("gi-assistant.ts");
const asstJs = read("gi-assistant.js");
const asstCss = read("gi-assistant.css");
const edge = read("supabase/functions/gi-assistant-tools/index.ts");
const html = read("index.html");
const phone = read("assistant.html");
const sw = read("service-worker.js");

console.log("1) files + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-assistant.js")]).status === 0, "node --check gi-assistant.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("gi-assistant.js?v=" + TAG), "index cache");
assert(html.includes("app.js?v=" + TAG), "index app cache");
assert(phone.includes("gi-assistant.js?v=" + TAG), "phone cache");
assert(sw.includes("gi-v12-" + TAG), "sw cache");

console.log("\n2) wraps existing CRM functions, does not duplicate them");
assert(app.includes("function toAssistantSafeCard"), "safe card helper");
assert(app.includes("Storage.searchCustomers(query, 20)"), "search wraps Storage.searchCustomers");
assert(app.includes("customerVisibleToCurrentUser(rec)"), "search/find still use existing visibility");
assert(app.includes("findCustomerByIdNumber(id)"), "find by ת״ז wraps existing finder");
assert(app.includes("findCustomerRecordById(id)"), "find by id wraps existing record lookup");
assert(app.includes("ReminderUI.upsertReminder(row)"), "create task wraps ReminderUI.upsertReminder");
assert(app.includes("ReminderUI.markDone"), "done wraps ReminderUI.markDone");
assert(app.includes("ReminderUI.reminders"), "list tasks reads ReminderUI.reminders");
assert(app.includes("CustomersUI.openByIdWithLoader"), "open still uses existing customer file");
assert(app.includes("openCustomerByQuery") && app.includes("findVisibleCustomerBySpokenQuery"), "spoken open customer finds a visible local record first");
assert(!/create table/i.test(app), "app.js still has no schema change");
assert(!edge.includes("computeMenora") && !asstTs.includes("computeMenora"), "no duplicated rate tables");

console.log("\n3) safe cards omit PII");
const cardFn = app.slice(app.indexOf("function toAssistantSafeCard"), app.indexOf("try {", app.indexOf("function toAssistantSafeCard")));
assert(cardFn.includes("full_name") && cardFn.includes("city") && cardFn.includes("agent_name"), "card has display fields");
assert(!cardFn.includes("idNumber") && !cardFn.includes("id_number") && !cardFn.includes("phone") && !cardFn.includes("email"), "card omits ת״ז / phone / email");
assert(asstTs.includes("applyCrmWraps") && asstTs.includes("allowed"), "client intersects local hits with server-allowed IDs");
assert(edge.includes("safeCustomer") && !/safeCustomer[\s\S]{0,200}id_number/.test(edge), "server card still omits ת״ז");

console.log("\n4) write path uses existing ReminderUI after server confirm");
assert(edge.includes('type: "upsert_reminder"'), "create_task returns upsert_reminder");
assert(edge.includes('type: "mark_task_done"'), "update_task returns mark_task_done");
assert(asstTs.includes('type === "upsert_reminder"'), "client handles upsert_reminder");
assert(asstTs.includes('type === "mark_task_done"'), "client handles mark_task_done");
assert(edge.includes("WRITE_TOOLS") && edge.includes("needs_confirmation"), "writes still require confirmation");

console.log("\n5) scoped hits UI, theme untouched");
assert(asstTs.includes("giAsstHits") && asstTs.includes("paintHits"), "hits panel");
assert(asstCss.includes(".giAsst__hits") && asstCss.includes(".giAsst__hit"), "scoped hits CSS");
assert(!theme.includes("giAsst__"), "theme.css untouched");
assert(!css.includes("giAsst__hits"), "app.css untouched");

console.log("\n6) compiled intersect + no PII in painted cards");
function elStub(){
  return {
    id: "", innerHTML: "", className: "", hidden: false,
    appendChild(){ return this; }, addEventListener(){},
    querySelector(){ return elStub(); }, querySelectorAll(){ return []; },
    setAttribute(){}, getAttribute(){ return ""; }, removeAttribute(){},
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    closest(){ return null; },
    focus(){}
  };
}
const hitsBox = Object.assign(elStub(), { id: "giAsstHits", innerHTML: "" });
const sandbox = {
  window: {
    location: { href: "https://crm.example/gemel-invest/index.html" },
    localStorage: { getItem(){ return null; }, setItem(){} },
    addEventListener(){},
    setInterval(){ return 0; },
    clearInterval(){},
    GiAssistant: null,
    __GI_ASSISTANT_BRIDGE__: {
      searchCustomers: async () => [
        { id: "a", full_name: "אלון כהן", city: "חיפה", idNumber: "should-not-leak" },
        { id: "blocked", full_name: "לא מורשה", city: "תל אביב" }
      ],
      findCustomerById: (id) => id === "a" ? { id: "a", full_name: "אלון כהן", city: "חיפה" } : null,
      listTasks: () => [{ id: "t1", type: "callback", details: "חזרה", remind_at: "2026-08-29", customer_name: "אלון" }],
      refreshReminders(){ return Promise.resolve(); }
    }
  },
  document: {
    readyState: "complete",
    body: Object.assign(elStub(), { getAttribute(){ return ""; } }),
    getElementById(id){ return id === "giAsstHits" ? hitsBox : null; },
    addEventListener(){},
    createElement(){ return elStub(); },
    querySelector(){ return elStub(); }
  },
  URL,
  Date
};
sandbox.window.document = sandbox.document;
sandbox.window.URL = URL;
vm.runInNewContext(asstJs, sandbox);
const api = sandbox.window.GiAssistant;
assert(!!api && typeof api.applyCrmWraps === "function", "compiled applyCrmWraps");
(async () => {
  const search = { ok: true, customers: [{ id: "a", full_name: "שרת", city: "חיפה" }] };
  await api.applyCrmWraps("search_customer", { query: "אלון" }, search);
  assert(Array.isArray(search.customers) && search.customers.length === 1 && search.customers[0].id === "a", "intersect drops IDs the server did not allow");
  assert(!JSON.stringify(search.customers).includes("should-not-leak"), "local ת״ז does not enter tool payload");
  assert(hitsBox.innerHTML.includes("אלון כהן") && hitsBox.innerHTML.includes("data-customer-id=\"a\""), "paints clickable customer hit");
  assert(!hitsBox.innerHTML.includes("should-not-leak") && !hitsBox.innerHTML.includes("לא מורשה"), "hit card has no ת״ז and no blocked row");

  const find = { ok: true, customer: { id: "a", full_name: "שרת" } };
  await api.applyCrmWraps("find_customer_by_id", { customerId: "a" }, find);
  assert(find.customer && find.customer.full_name === "אלון כהן", "find prefers the wrapped local card when IDs match");

  const tasks = { ok: true, tasks: [{ id: "t1", type: "callback", details: "חזרה", remind_at: "2026-08-29", customer_name: "אלון" }] };
  await api.applyCrmWraps("get_tasks", {}, tasks);
  assert(Array.isArray(tasks.tasks) && tasks.tasks[0].id === "t1", "tasks intersect with ReminderUI list");
  assert(!JSON.stringify(tasks.tasks[0]).includes("id_number"), "task payload has no ת״ז");

  console.log("\n" + (failed ? "FAILED " + failed : "OK") + "  passed=" + passed + " failed=" + failed);
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
