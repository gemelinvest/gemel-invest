/* פתיחה ראשונה של תיק לקוח לא נשארת בלי פוליסות.
   הרצה: node _test-customer-file-first-open.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const app = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
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

function sliceFunction(src, startToken){
  const start = src.indexOf(startToken);
  if(start < 0) return "";
  let i = startToken.endsWith("{")
    ? start + startToken.length - 1
    : src.indexOf("{", start);
  if(i < 0) return "";
  let depth = 0;
  for(; i < src.length; i += 1){
    const ch = src[i];
    if(ch === "{") depth += 1;
    else if(ch === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, i + 1);
    }
  }
  return "";
}

function asFunction(src, name){
  if(!src) return "";
  if(src.startsWith("function ") || src.startsWith("async function ")) return src;
  if(src.startsWith("async ")) return "async function " + src.slice("async ".length);
  return "function " + src;
}

const protectedSrc = sliceFunction(app, "function getTeamManagerProtectedPayloadIds(){");
const sessionSrc = sliceFunction(app, "function sessionKeepsPayloadLru(){");
const trimSrc = sliceFunction(app, "function trimTeamManagerCustomerPayloadLru(stateLike){");
const hasContentSrc = sliceFunction(app, "payloadHasPolicyOrInsuredContent(payload){");
const ensureSrc = sliceFunction(app, "async ensureRecordPayload(stateKey, id, options = {}){");
const openSrc = sliceFunction(app, "async _openByIdAfterPayload(id, opts={}){");

assert(!!protectedSrc && !!trimSrc && !!ensureSrc && !!openSrc && !!hasContentSrc, "הפונקציות הרלוונטיות נמצאות");

const context = vm.createContext({
  console,
  TEAM_MANAGER_PAYLOAD_LRU_CAP: 80,
  CUSTOMER_LIGHT_COLUMNS: "id",
  PROPOSAL_LIGHT_COLUMNS: "id",
  SUPABASE_TABLES: { customers: "customers", proposals: "proposals" },
  CustomersUI: { _openingCustomerId: "", currentId: null, els: { wrap: { classList: { contains(){ return false; } } } }, invalidatePolicyCollectCache(){} },
  CustomerEditUI: {},
  MirrorCallUI: {},
  ElementaryMirrorUI: {},
  Storage: {},
  State: { data: { customers: [] } },
  safeTrim(value){
    return String(value == null ? "" : value).trim();
  },
  normalizeCustomerRecord(rec){
    return Object.assign({}, rec);
  },
  normalizeProposalRecord(rec){
    return Object.assign({}, rec);
  }
});
context.Storage.payloadHasPolicyOrInsuredContent = vm.runInContext(
  "(" + asFunction(hasContentSrc, "payloadHasPolicyOrInsuredContent") + ")",
  context
);
vm.runInContext(
  [protectedSrc, sessionSrc, trimSrc, asFunction(ensureSrc), asFunction(openSrc)].join("\n"),
  context
);

function fatCustomer(id, stamp){
  return {
    id,
    updatedAt: stamp,
    payload: { newPolicies: [{ id: "pol-" + id, type: "בריאות" }] }
  };
}

console.log("1) LRU לא מוחק תיק שסימון הפתיחה שלו כבר דולק");
const customers = [];
for(let i = 0; i < 80; i += 1){
  customers.push(fatCustomer("keep-" + i, "2024-06-" + String((i % 28) + 1).padStart(2, "0") + "T12:00:00.000Z"));
}
const opening = fatCustomer("open-me", "2020-01-01T00:00:00.000Z");
customers.push(opening);
context.CustomersUI._openingCustomerId = "open-me";
context.CustomersUI.currentId = null;
context.Storage.isLargeCustomersSession = () => true;
context.Storage.isTeamManagerLightSession = () => false;
const trimmed = context.trimTeamManagerCustomerPayloadLru({ customers });
const keptOpening = trimmed.customers.find((row) => row.id === "open-me");
assert(context.Storage.payloadHasPolicyOrInsuredContent(keptOpening && keptOpening.payload), "הפוליסות של התיק שנפתח נשארות אחרי ה-LRU");

console.log("\n2) הורדת התיק נכתבת על האובייקט החי אם הרשימה החליפה אותו באמצע");
const original = { id: "open-me", fullName: "לקוח", payload: {} };
const live = { id: "open-me", fullName: "לקוח", payload: {} };
context.State.data.customers = [original];
context.CustomersUI._openingCustomerId = "";
const storage = {
  payloadIsEmpty(rec){
    return !context.Storage.payloadHasPolicyOrInsuredContent(rec && rec.payload);
  },
  async loadSingleRow(){
    context.State.data.customers[0] = live;
    return {
      ok: true,
      data: { id: "open-me", payload: { newPolicies: [{ id: "p1", type: "בריאות" }], insureds: [{ id: "i1" }] } }
    };
  },
  mapCustomerRow(row){
    return row;
  },
  mapProposalRow(row){
    return row;
  }
};
context.ensureRecordPayload.call(storage, "customers", "open-me").then((res) => {
  assert(context.State.data.customers[0] === live, "הרשימה מצביעה על האובייקט שהחליף את הישן");
  assert(context.Storage.payloadHasPolicyOrInsuredContent(live.payload), "הפוליסות יושבות על האובייקט החי");
  assert(res && res.record === live, "הפונקציה מחזירה את האובייקט החי");
  assert(!context.Storage.payloadHasPolicyOrInsuredContent(original.payload), "האובייקט שנזרק לא מקבל את הפוליסות במקום החי");

  console.log("\n3) הציור מעתיק פוליסות אם byId עדיין מצביע על עותק ריק");
  const emptyLive = { id: "open-me", fullName: "לקוח", payload: {} };
  const loaded = { id: "open-me", fullName: "לקוח", payload: { newPolicies: [{ id: "p9", type: "ריסק" }] } };
  const ui = {
    els: { wrap: { classList: { contains(){ return true; } } } },
    byId(){ return emptyLive; },
    _showFileLoading(){},
    _showFileLoadError(){},
    painted: null,
    _openByIdResolved(rec){ this.painted = rec; }
  };
  context.Storage.ensureRecordPayload = async () => ({ ok: true, record: loaded });
  return context._openByIdAfterPayload.call(ui, "open-me", {}).then(() => {
    assert(ui.painted === emptyLive, "הציור נשאר על הרשומה שהמסך מחזיק");
    assert(context.Storage.payloadHasPolicyOrInsuredContent(emptyLive.payload), "לרשומה שהמסך מחזיק יש פוליסות לפני הציור");
    console.log("\n" + passed + " passed, " + failed + " failed");
    process.exit(failed ? 1 : 0);
  });
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
