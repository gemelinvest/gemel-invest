/* GI-FOLLOWUP-DOCS 20260825-docs-multi-v1
   Run: node _test-followup-zip.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260825-docs-multi-v1";
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
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
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
assert(html.includes("app.css?v=" + TAG), "index.html bumps app.css cache");
assert(app.includes('GI_FOLLOWUP_ZIP_HREF = "./gi-followup-zip.js?v=' + TAG + '"'), "app.js followup chunk cache");
assert(sw.includes("gi-v12-" + TAG), "service worker cache bumped");
assert(app.includes('followupQuestionnaire: "followup_questionnaire"'), "per-doc type registered");
assert(app.includes("ensureFollowupDocuments"), "ensureFollowupDocuments exists");
assert(app.includes("syncFollowupQuestionnaireDocs"), "syncFollowupQuestionnaireDocs exists");
assert(app.includes("data-download-followup-doc"), "per-doc download button");
assert(app.includes("הורד נבחרים"), "multi-select download label");
assert(app.includes("data-download-selected-docs"), "download-selected attr");
assert(app.includes("data-doc-select"), "checkbox select attr");
assert(!app.includes('data-download-followup-zip type="button">הורד שאלוני המשך (ZIP)'), "global ZIP button removed from health UI");
assert(modSrc.includes('DOC_TYPE = "followup_questionnaire"'), "module DOC_TYPE is per questionnaire");
assert(modSrc.includes("packFilesIntoZip"), "packFilesIntoZip exported");
assert(modSrc.includes("buildDocTitle"), "buildDocTitle helper");

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
      questionnaireLabel: "לב",
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

const menora = triggered.find((r) => r.companyKey === "menora");
const title = sandbox.GiFollowupZip.buildDocTitle(menora);
assert(title.indexOf("שאלון המשך 4") >= 0, "title includes questionnaire number");
assert(title.indexOf("לב") >= 0, "title includes questionnaire label");
assert(title.indexOf("מנורה") >= 0, "title includes company");
assert(sandbox.GiFollowupZip.stableDocId(menora).indexOf("doc_followup_menora") === 0, "stable doc id");

console.log("\n4) zip path + selected-only pack helper");
assert(sandbox.GiFollowupZip.zipEntryPath({
  company: "מנורה",
  companyKey: "menora",
  questionnaireNum: "4",
  insured: { id: "p1", type: "primary" }
}).includes("מנורה/primary/"), "zip path includes company and role");
assert(typeof sandbox.GiFollowupZip.packFilesIntoZip === "function", "packFilesIntoZip is a function");

console.log("\n5) per-doc sync logic (CustomerDocuments helpers present)");
assert(app.includes("createFollowupQuestionnaireDoc"), "createFollowupQuestionnaireDoc");
assert(app.includes("TYPE.followupQuestionnaire") || app.includes("TYPES.followupQuestionnaire"), "uses followupQuestionnaire type");
assert(app.includes("await CustomerFileUI.ensureFollowupDocuments(rec)"), "health save ensures followup docs before persist");

console.log("\n6) face-login KPI untouched");
assert(app.includes("paintDashboardAfterFaceLogin"), "face-login KPI paint remains");
assert(app.includes("fetchAgentAppointmentKpis"), "agent-appointment KPI fetch remains");
assert(app.includes("policyNetPremium") || app.includes("MATCH_THRESHOLD"), "core premium/match symbols remain");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
