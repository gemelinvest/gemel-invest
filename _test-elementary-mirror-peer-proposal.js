/* שיחת שיקוף אלמנטרי מעלה הצעה אלמנטרי של נציג אחר לפי ת״ז.
   מסך הלקוחות, מסך ההצעות וסינון הטעינה לפי נציג נשארים כפי שהיו.
   הרצה: node _test-elementary-mirror-peer-proposal.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
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

function extractFunction(src, signature){
  const at = src.indexOf(signature);
  if(at < 0) return "";
  const open = at + signature.length - 1;
  if(src[open] !== "{") return "";
  let depth = 0;
  for(let i = open; i < src.length; i += 1){
    const ch = src[i];
    if(ch === "{") depth += 1;
    else if(ch === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(at, i + 1);
    }
  }
  return "";
}

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-elementary-mirror-peer-proposal.js")]).status === 0, "node --check this test");

console.log("\n2) המסכים האחרים לא נפתחים");
const scopeFn = extractFunction(app, "function getServerListAgentScopeFilter(){");
assert(!!scopeFn && !scopeFn.includes("isElementary"), "טעינת הרשימה לפי נציג לא נפתחת לכל האלמנטרי");
const customersList = extractFunction(app, "list(){");
assert(customersList.includes("this.customerHasElementaryProducts(rec)"), "רשימת הלקוחות של אלמנטרי נשארת לפי מוצרי אלמנטרי");
const proposalRows = extractFunction(app, "buildRows(){");
assert(proposalRows.includes("canSeeAll || recordOwnedByAgent(rec, agentProfile)"), "מסך ההצעות עדיין מסנן הפניה לפי בעלות");
const opsSearch = app.includes("Storage.searchCustomers(q, 30, { skipAgentScope: true })");
assert(opsSearch, "חיפוש שיקוף התפעול נשאר בלי חיפוש הצעות");
assert(!extractFunction(app, "async _runOpsAgentServerSearch(query, seq){").includes("searchProposals"), "שיקוף התפעול לא מחפש הצעות");
assert(html.includes("giElemMirrorPeer=1"), "מטמון app.js עודכן לתיקון peer");
assert(sw.includes("elem-mirror-peer-v1"), "מטמון service worker עודכן לתיקון peer");

console.log("\n3) ת״ז של הצעת אילן עולה אצל עדן, והצעת בריאות לא");
const safeTrim = (v) => String(v == null ? "" : v).trim();
const digitsOnly = (v) => String(v == null ? "" : v).replace(/\D+/g, "");
const normalizeIdValue = (v) => digitsOnly(v).slice(0, 9);
const src = [
  extractFunction(app, "function inferProposalFlowType(payload = {}){"),
  extractFunction(app, "function proposalIsElementaryOffer(rec){"),
  extractFunction(app, "function elementaryMirrorRecordFromPeerProposal(proposal){"),
  extractFunction(app, "function elementaryMirrorPayloadDetailScore(payload){"),
  extractFunction(app, "function mergeElementaryMirrorDisplayPayload(basePayload, proposalPayload){"),
  extractFunction(app, "function elementaryProposalMatchesMirrorQuery(proposal, query){"),
  extractFunction(app, "function mergeElementaryPeerProposalsIntoMirrorHits(hits, proposals){")
].join("\n");
assert(src.includes("function proposalIsElementaryOffer"), "זיהוי הצעה אלמנטרי קיים");
assert(src.includes("mergeElementaryMirrorDisplayPayload"), "מיזוג תצוגה להצעת peer קיים");
assert(app.includes("mergeElementaryMirrorDisplayPayload(display.payload, hit.payload)"), "פתיחת שיחה מעשירה גם תיק אלמנטרי קיים");
assert(app.includes("opIns0") && app.includes("_pickElementaryData(rec){"), "קריאת שיקוף נופלת גם ל-operational.insureds");
const api = new Function(
  "safeTrim",
  "digitsOnly",
  "normalizeIdValue",
  src + "\nreturn { proposalIsElementaryOffer, elementaryMirrorRecordFromPeerProposal, elementaryMirrorPayloadDetailScore, mergeElementaryMirrorDisplayPayload, elementaryProposalMatchesMirrorQuery, mergeElementaryPeerProposalsIntoMirrorHits };"
)(safeTrim, digitsOnly, normalizeIdValue);

const ilanProposal = {
  id: "prop_ilan",
  fullName: "נועה לוי",
  idNumber: "208827261",
  phone: "0501234567",
  agentName: "אילן איילין",
  agentId: "agent_ilan",
  agentRole: "agent",
  payload: {
    flowType: "elementary",
    elementaryProduct: "vehicle",
    insureds: [{ data: { firstName: "נועה", lastName: "לוי", idNumber: "208827261", licensePlate: "12-345-67", coverageType: "מקיף" } }]
  }
};
const healthProposal = {
  id: "prop_health",
  fullName: "יוסי כהן",
  idNumber: "123456782",
  phone: "0509999999",
  agentName: "אילן איילין",
  agentId: "agent_ilan",
  agentRole: "agent",
  payload: { flowType: "health", newPolicies: [{ id: 1 }] }
};
assert(api.proposalIsElementaryOffer(ilanProposal) === true, "הצעת הרכב של אילן היא אלמנטרי");
assert(api.proposalIsElementaryOffer(healthProposal) === false, "הצעת בריאות של אילן אינה עולה בשיקוף");
assert(api.elementaryProposalMatchesMirrorQuery(ilanProposal, "208827261") === true, "ת״ז מלאה מתאימה להצעה");
assert(api.elementaryProposalMatchesMirrorQuery(healthProposal, "208827261") === false, "ת״ז אחרת לא נמשכת לחיפוש");

const edenHits = [];
const shown = api.mergeElementaryPeerProposalsIntoMirrorHits(edenHits, [ilanProposal, healthProposal]);
assert(shown.length === 1, "רק ההצעה האלמנטרית עולה");
assert(shown[0].id === "emprop_prop_ilan", "הכרטיס הוא הצעה ולא תיק לקוח חדש");
assert(shown[0].fullName === "נועה לוי", "שם הלקוח של אילן מוצג");
assert(shown[0].idNumber === "208827261", "ת״ז הלקוח של אילן מוצגת");
assert(shown[0].agentName === "אילן איילין", "נשאר מסומן כלקוח של אילן");
assert(shown[0].payload.flowType === "elementary", "הכרטיס נושא את ההצעה האלמנטרית");
assert(shown[0]._emMirrorFromProposalId === "prop_ilan", "הכרטיס מצביע על ההצעה");

const healthCustomer = {
  id: "cust_ilan_health",
  fullName: "נועה לוי",
  idNumber: "208827261",
  phone: "0501234567",
  agentName: "אילן איילין",
  agentId: "agent_ilan",
  agentRole: "agent",
  payload: { flowType: "health" }
};
const overlaid = api.mergeElementaryPeerProposalsIntoMirrorHits([healthCustomer], [ilanProposal]);
assert(overlaid.length === 1, "אין כרטיס כפול לאותה ת״ז");
assert(overlaid[0] !== healthCustomer, "תיק הלקוח השמור לא מוחלף");
assert(healthCustomer.payload.flowType === "health", "מטען תיק הבריאות לא נדרס");
assert(overlaid[0].id === "cust_ilan_health", "נשארים על תיק הלקוח הקיים");
assert(overlaid[0].payload.flowType === "elementary", "בשיקוף מוצגת ההצעה האלמנטרית");

console.log("\n4) תיק אלמנטרי חלקי מתעשר מפרטי ההצעה בלי לדרוס mirrorFlow");
const thinElementaryCustomer = {
  id: "cust_ilan_car",
  fullName: "נועה לוי",
  idNumber: "208827261",
  phone: "0501234567",
  agentName: "אילן איילין",
  agentId: "agent_ilan",
  agentRole: "elementary",
  payload: {
    flowType: "elementary",
    elementaryProduct: "vehicle",
    insureds: [{ data: { firstName: "נועה", lastName: "לוי", idNumber: "208827261" } }],
    mirrorFlow: { elementaryReport: { updatedAt: "2026-11-18T10:00:00.000Z", notes: "טיוטת עדן" } }
  }
};
const richProposal = {
  ...ilanProposal,
  payload: {
    flowType: "elementary",
    elementaryProduct: "vehicle",
    insureds: [{
      data: {
        firstName: "נועה",
        lastName: "לוי",
        idNumber: "208827261",
        licensePlate: "12-345-67",
        coverageType: "מקיף",
        birthDate: "01/01/1990",
        elementaryProductPricing: [{ productKey: "comprehensive", premium: "450" }]
      }
    }]
  }
};
assert(api.elementaryMirrorPayloadDetailScore(richProposal.payload) > api.elementaryMirrorPayloadDetailScore(thinElementaryCustomer.payload), "ההצעה עשירה מהתיק החלקי");
const enriched = api.mergeElementaryPeerProposalsIntoMirrorHits([thinElementaryCustomer], [richProposal]);
assert(enriched.length === 1, "אין כרטיס כפול לתיק אלמנטרי חלקי");
assert(enriched[0].id === "cust_ilan_car", "נשארים על תיק הלקוח האלמנטרי");
assert(enriched[0].payload.insureds[0].data.licensePlate === "12-345-67", "מספר רכב מההצעה עולה בשיקוף");
assert(enriched[0].payload.insureds[0].data.coverageType === "מקיף", "סוג כיסוי מההצעה עולה בשיקוף");
assert(enriched[0].payload.mirrorFlow.elementaryReport.notes === "טיוטת עדן", "דוח השיקוף של התיק לא נדרס");
assert(thinElementaryCustomer.payload.insureds[0].data.licensePlate == null, "אובייקט התיק השמור לא השתנה");
const kept = api.mergeElementaryMirrorDisplayPayload(
  { flowType: "elementary", insureds: [{ data: { licensePlate: "99-999-99", coverageType: "חובה", birthDate: "02/02/1991", firstName: "א", lastName: "ב", idNumber: "1", phone: "1", street: "x", city: "y", insuranceStartDate: "1", driverPolicyMode: "any", idIssueDate: "1", elementaryProductPricing: [1], elementaryGovCard: {}, elementaryPayment: {}, namedDrivers: [1], serviceContract: {} } }], elementaryPolicies: [1, 2] },
  { flowType: "elementary", insureds: [{ data: { licensePlate: "12-345-67" } }] }
);
assert(kept.insureds[0].data.licensePlate === "99-999-99", "תיק עשיר יותר לא מוחלף בהצעה דלה");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
