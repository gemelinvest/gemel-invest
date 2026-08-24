/* GI-FOLLOWUP-ZIP 20260825
   Run: node _test-followup-zip.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260825-followup-zip-v1";
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

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const cfgSrc = fs.readFileSync(path.join(ROOT, "gi-followup-zip-config.js"), "utf8");
const modSrc = fs.readFileSync(path.join(ROOT, "gi-followup-zip.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");

console.log("1) syntax + files");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-followup-zip-config.js")]).status === 0, "node --check gi-followup-zip-config.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-followup-zip.js")]).status === 0, "node --check gi-followup-zip.js");
const pdfs = [
  "forms/followup-questionnaires/menora-followup-all.pdf",
  "forms/followup-questionnaires/phoenix-followup-all.pdf",
  "forms/followup-questionnaires/clal-followup-all.pdf",
  "forms/followup-questionnaires/hachshara-followup-all.pdf",
  "forms/followup-questionnaires/ayalon-followup-all.pdf",
  "forms/followup-questionnaires/migdal-followup-all.pdf"
];
pdfs.forEach((rel) => {
  const p = path.join(ROOT, rel);
  assert(fs.existsSync(p), "pdf exists: " + rel);
  assert(fs.statSync(p).size > 50000, "pdf not empty: " + rel);
});
assert(!fs.existsSync(path.join(ROOT, "forms/followup-questionnaires/harel-followup-all.pdf")), "harel excluded");

console.log("\n2) cache + wiring");
assert(html.includes("app.js?v=" + TAG), "index.html bumps app.js cache");
assert(html.includes("gi-followup-zip-config.js?v=" + TAG), "index loads followup config");
assert(app.includes('GI_FOLLOWUP_ZIP_HREF = "./gi-followup-zip.js?v=' + TAG + '"'), "app.js followup chunk cache");
assert(sw.includes("gi-v12-" + TAG), "service worker cache bumped");
assert(app.includes('followupQuestionnairesZip: "followup_questionnaires_zip"'), "document type registered");
assert(app.includes("downloadFollowupQuestionnairesZip"), "download helper exists");
assert(app.includes("data-download-followup-zip"), "health UI download button");
assert(app.includes("הורד שאלוני המשך"), "Hebrew download label");

console.log("\n3) detectTriggeredFollowups");
const sandbox = {
  console,
  PDFLib: null,
  JSZip: null,
  GI_OFFICIAL_FORM_FILL: { setTextSafe(){}, FONT_FILE: "Heebo-Bold.ttf" }
};
vm.runInNewContext(cfgSrc, sandbox);
vm.runInNewContext(modSrc, sandbox);
const detect = sandbox.GiFollowupZip.detectTriggeredFollowups;
const meta = {
  map: {
    menora__heart: {
      key: "menora__heart",
      questionnaireNos: ["4"],
      fields: [{ key: "4__heartDisease", label: "מחלת לב" }]
    },
    clal_drugs_cannabis: {
      key: "clal_drugs_cannabis",
      questionnaireLetter: "א",
      fields: [{ key: "clal_א_cannabisNow", label: "קנביס כיום" }]
    },
    phoenix_full__heart: {
      key: "phoenix_full__heart",
      questionnaireNos: ["2"],
      fields: [{ key: "2__diagnosis", label: "אבחנה" }]
    },
    hachshara__hospital: {
      key: "hachshara__hospital",
      questionnaireNos: ["1"],
      fields: [{ key: "1__reason", label: "סיבה" }]
    }
  }
};
const health = {
  responses: {
    menora__heart: { p1: { answer: "yes", fields: { "4__heartDisease": "IHD" } } },
    clal_drugs_cannabis: { p1: { answer: "yes", fields: { "clal_א_cannabisNow": "כן" } } },
    phoenix_full__heart: { p1: { answer: "yes", fields: { "2__diagnosis": "STENT" } } },
    hachshara__hospital: { s1: { answer: "yes", fields: { "1__reason": "appendectomy" } } },
    menora__smoking: { p1: { answer: "no", fields: {} } }
  }
};
const insureds = [
  { id: "p1", type: "primary", label: "ראשי" },
  { id: "s1", type: "spouse", label: "בן זוג" }
];
const triggered = detect(health, meta, insureds);
assert(triggered.length === 4, "detects 4 triggered questionnaires");
assert(triggered.some((r) => r.companyKey === "menora" && r.questionnaireNum === "4"), "menora q4");
assert(triggered.some((r) => r.companyKey === "clal" && r.questionnaireNum === "א"), "clal letter aleph");
assert(triggered.some((r) => r.companyKey === "phoenix" && r.questionnaireNum === "2"), "phoenix q2");
assert(triggered.some((r) => r.companyKey === "hachshara" && r.insuredId === "s1"), "hachshara spouse");
assert(!triggered.some((r) => r.qKeys.indexOf("menora__smoking") >= 0), "no followup on no-answer");

console.log("\n4) zip path naming");
assert(sandbox.GiFollowupZip.zipEntryPath({
  company: "מנורה",
  companyKey: "menora",
  questionnaireNum: "4",
  insured: { id: "p1", type: "primary" }
}).includes("מנורה/primary/"), "zip path includes company and role");

console.log("\n5) face-login KPI untouched");
assert(app.includes("paintDashboardAfterFaceLogin"), "face-login KPI paint remains");
assert(app.includes("fetchAgentAppointmentKpis"), "agent-appointment KPI fetch remains");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
