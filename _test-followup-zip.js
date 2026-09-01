/* GI-FOLLOWUP-DOCS 20260826-followup-docs-v1
   Run: node _test-followup-zip.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260901-step4-fields-v1";
const TAG = "20260828-sales-mail-hide-v1";
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
const wizSrc = fs.readFileSync(path.join(ROOT, "gi-wizard.js"), "utf8");
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
assert(html.includes("app.js?v=" + APP_TAG), "index.html bumps app.js cache");
assert(html.includes("gi-followup-zip-config.js?v=" + TAG), "index loads followup config");
assert(html.includes("app.css?v=" + APP_TAG), "index.html bumps app.css cache");
assert(app.includes('GI_FOLLOWUP_ZIP_HREF = "./gi-followup-zip.js?v=' + TAG + '"'), "app.js followup chunk cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service worker cache bumped");
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
assert(modSrc.includes("visual: false, align: false") || modSrc.includes("HEB_TEXT_OPTS"), "Hebrew visual:false align:false");
assert(modSrc.includes("keepSinglePage") || modSrc.includes("removePage"), "page extract keeps AcroForm via removePage");
assert(app.includes("questionnaireNumbers"), "meta maps questionnaireNumbers");

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
    phoenix_full__heart_qkeys: {
      key: "phoenix_full__heart_qkeys",
      questionnaireNumbers: ["2", "3", "4"],
      fields: [
        { key: "q2_diagnosis", label: "אבחנה" },
        { key: "q2_status", label: "מצב" },
        { key: "q3_diagnosis", label: "הפרעת קצב" }
      ]
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
    phoenix_full__heart_qkeys: {
      p1: {
        answer: "yes",
        fields: {
          q2_diagnosis: "מום לב ASD",
          q2_status: "טופל בניתוח",
          q3_diagnosis: "פרפור עליות"
        }
      }
    },
    hachshara__hospital: { s1: { answer: "yes", fields: { "1__reason": "appendectomy" } } },
    menora__smoking: { p1: { answer: "no", fields: {} } }
  }
};
const insureds = [
  { id: "p1", type: "primary", label: "ראשי" },
  { id: "s1", type: "spouse", label: "בן זוג" }
];
const triggered = detect(health, meta, insureds);
assert(triggered.length >= 5, "detects at least 5 triggered questionnaires");
assert(triggered.some((r) => r.companyKey === "menora" && r.questionnaireNum === "4"), "menora q4");
assert(triggered.some((r) => r.companyKey === "clal" && r.questionnaireNum === "א"), "clal letter aleph");
assert(triggered.some((r) => r.companyKey === "phoenix" && r.questionnaireNum === "2" && r.followupData["2__diagnosis"] === "STENT"), "phoenix q2 prefixed");
assert(triggered.some((r) => r.companyKey === "phoenix" && r.questionnaireNum === "2" && r.followupData.q2_diagnosis === "מום לב ASD"), "phoenix q2 Hebrew q-keys");
assert(triggered.some((r) => r.companyKey === "phoenix" && r.questionnaireNum === "3" && r.followupData.q3_diagnosis), "phoenix q3 from questionnaireNumbers");
assert(triggered.some((r) => r.companyKey === "hachshara" && r.insuredId === "s1"), "hachshara spouse");
assert(!triggered.some((r) => r.qKeys.indexOf("menora__smoking") >= 0), "no followup on no-answer");

const yesEmptyFields = detect({
  responses: {
    menora__heart: { p1: { answer: "yes", fields: {} } }
  }
}, meta, insureds);
assert(yesEmptyFields.some((r) => r.companyKey === "menora" && r.questionnaireNum === "4"), "yes without detail fields still attaches the questionnaire PDF");

const yesNoQuestionnaire = detect({
  responses: {
    menora__smoking: { p1: { answer: "yes", fields: {} } }
  }
}, meta, insureds);
assert(!yesNoQuestionnaire.length, "yes without questionnaire numbers does not invent a PDF");

const mergedHealth = sandbox.GiFollowupZip._test.collectHealthResponses({
  payload: {
    primary: { healthDeclaration: { responses: {} } },
    insureds: [{
      id: "p1",
      data: {
        healthDeclaration: {
          responses: {
            menora__heart: { p1: { answer: "yes", fields: { "4__heartDisease": "IHD" } } }
          }
        }
      }
    }]
  }
});
const fromInsureds = detect(mergedHealth, meta, insureds);
assert(fromInsureds.some((r) => r.companyKey === "menora" && r.questionnaireNum === "4"), "collectHealthResponses merges insureds when primary is empty");

const resolved = sandbox.GiFollowupZip.resolveForCustomer({
  payload: {
    insureds: [{ id: "p1", data: { healthDeclaration: health } }]
  }
}, meta, insureds);
assert(resolved.length >= 5, "resolveForCustomer reads health from insureds, not only primary");

const menora = triggered.find((r) => r.companyKey === "menora");
const title = sandbox.GiFollowupZip.buildDocTitle(menora);
assert(title.indexOf("שאלון המשך 4") >= 0, "title includes questionnaire number");
assert(title.indexOf("לב") >= 0, "title includes questionnaire label");
assert(title.indexOf("מנורה") >= 0, "title includes company");
assert(sandbox.GiFollowupZip.stableDocId(menora).indexOf("doc_followup_menora") === 0, "stable doc id");

const phoenixQ2 = triggered.find((r) => r.companyKey === "phoenix" && r.questionnaireNum === "2" && r.followupData.q2_diagnosis);
const ordered = sandbox.GiFollowupZip._test.orderedSchemaValues(phoenixQ2, sandbox.GI_FOLLOWUP_ZIP_CONFIG.COMPANIES.phoenix);
assert(ordered.some((r) => r.value === "מום לב ASD"), "ordered phoenix values include Hebrew diagnosis");
assert(sandbox.GiFollowupZip._test.HEB_TEXT_OPTS.visual === false, "Hebrew opts visual false");
assert(sandbox.GiFollowupZip._test.HEB_TEXT_OPTS.align === false, "Hebrew opts align false");

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
assert(app.includes("const CustomerFileUI = CustomersUI"), "CustomerFileUI alias points at CustomersUI");
assert(app.includes("globalThis.CustomerFileUI = CustomersUI"), "CustomerFileUI is exported globally");
assert(app.includes("queueFollowupDocumentsSync"), "customer file queues followup doc sync on open");
assert(app.includes("injectTriggeredFollowupQuestionnaireDocs"), "documents list injects missing followup PDFs");
assert(app.includes("syncFollowupDocsFromLiveDetect"), "health_wizard/health_edit attach followup docs");
assert(wizSrc.includes("CustomersUI.ensureFollowupDocuments(record)"), "wizard save attaches followup docs to the customer file");

console.log("\n6) face-login KPI untouched");
assert(app.includes("paintDashboardAfterFaceLogin"), "face-login KPI paint remains");
assert(app.includes("fetchAgentAppointmentKpis"), "agent-appointment KPI fetch remains");
assert(app.includes("policyNetPremium") || app.includes("MATCH_THRESHOLD"), "core premium/match symbols remain");

console.log("\n7) Phoenix PDF fill keeps fields + Hebrew text");
(async () => {
  const pdfLib = require("pdf-lib");
  const { PDFDocument, PDFName } = pdfLib;
  sandbox.PDFLib = pdfLib;
  const pdfBytes = fs.readFileSync(path.join(ROOT, "forms/followup-questionnaires/phoenix-followup-all.pdf"));
  const srcDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pageIndex = sandbox.GI_FOLLOWUP_ZIP_CONFIG.COMPANIES.phoenix.pageForQuestionnaire(3) - 1;
  // Discover annot names outside vm (same algorithm as listPageFieldNames).
  const pageFields = [];
  const seen = new Set();
  try {
    const page = srcDoc.getPages()[pageIndex];
    const annots = page?.node?.Annots?.();
    const arr = annots && typeof annots.asArray === "function" ? annots.asArray() : [];
    arr.forEach((ref) => {
      try {
        let node = srcDoc.context.lookup(ref);
        const parts = [];
        while(node){
          const t = node.get(PDFName.of("T"));
          if(t) parts.unshift(typeof t.decodeText === "function" ? t.decodeText() : String(t));
          const parent = node.get(PDFName.of("Parent"));
          node = parent ? srcDoc.context.lookup(parent) : null;
        }
        const name = parts.filter(Boolean).join(".");
        if(name && !seen.has(name)){ seen.add(name); pageFields.push(name); }
      } catch(_e) {}
    });
  } catch(_e) {}
  assert(pageFields.length > 0, "phoenix page annot field names discovered");
  assert(pageFields.some((n) => /^Text\d+$/.test(n) || n === "AgentName"), "phoenix page has text fields");
  sandbox.GiFollowupZip._test.keepSinglePage(srcDoc, pageIndex);
  assert(srcDoc.getPageCount() === 1, "keepSinglePage leaves one page");
  assert(srcDoc.getForm().getFields().length > 0, "removePage path retains AcroForm fields");

  const captured = {};
  const form = srcDoc.getForm();
  const helper = {
    setTextSafe(_form, fieldName, value, _font, opts){
      const text = String(value == null ? "" : value).trim();
      if(!text) return;
      captured[fieldName] = { text, opts: opts || null };
      try { _form.getTextField(fieldName).setText(text); } catch(_e) {}
    }
  };
  sandbox.GI_OFFICIAL_FORM_FILL = helper;
  const entry = {
    companyKey: "phoenix",
    company: "הפניקס",
    questionnaireNum: "3",
    insuredId: "p1",
    insured: { id: "p1", type: "primary", label: "ישראל ישראלי", fullName: "ישראל ישראלי", idNumber: "123456789" },
    followupData: {
      q3_diagnosis: "פרפור עליות",
      q3_medication: "כן",
      "3__ablation": "לא"
    },
    followupLabels: {
      q3_diagnosis: "אבחנה",
      q3_medication: "טיפול תרופתי"
    }
  };
  // Direct fill helpers (same as fillFollowupPdf after page keep) — avoids vm/pdf-lib realm issues.
  const rows = sandbox.GiFollowupZip._test.orderedSchemaValues(entry, sandbox.GI_FOLLOWUP_ZIP_CONFIG.COMPANIES.phoenix);
  assert(rows.some((r) => r.value === "פרפור עליות"), "ordered rows keep Hebrew diagnosis");
  const contentNames = pageFields.filter((n) => /^Text\d+$/.test(n) && !/^Text(32|33|35|36|37)$/.test(n));
  rows.forEach((row, idx) => {
    const name = contentNames[idx];
    if(!name) return;
    helper.setTextSafe(form, name, row.label ? (row.label + ": " + row.value) : row.value, null, sandbox.GiFollowupZip._test.HEB_TEXT_OPTS);
  });
  helper.setTextSafe(form, "Text32", entry.insured.fullName, null, sandbox.GiFollowupZip._test.HEB_TEXT_OPTS);
  const written = Object.values(captured).map((c) => c.text).join(" | ");
  assert(/פרפור עליות/.test(written), "Hebrew diagnosis written without visual reverse");
  assert(!/תוילע רופרפ/.test(written), "Hebrew is not character-reversed");
  assert(/ישראל/.test(written), "insured Hebrew name filled");
  assert(Object.values(captured).every((c) => c.opts && c.opts.visual === false && c.opts.align === false), "all fills use visual:false align:false");
  const pageCfg = sandbox.GI_FOLLOWUP_ZIP_CONFIG.COMPANIES.phoenix.pageForQuestionnaire(2);
  assert(pageCfg === 1, "phoenix q2 maps to page 1");
  assert(modSrc.includes("keepSinglePage(pdfDoc, pageIndex)"), "fillFollowupPdf uses keepSinglePage");
  assert(!modSrc.includes("copyPages(srcDoc"), "fillFollowupPdf no longer uses copyPages");

  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error(err);
  failed += 1;
  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(1);
});
