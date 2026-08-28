/* GI-HACH-FOLLOWUP-FILL 2026-08-28
   Original Hachshara follow-up questionnaires (not הצהרת בריאות):
   fill every content field in visual order, large Hebrew, agent notes in the remarks box.
   Run: node _test-hachshara-followup-fill.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260828-menora-health-decl-v1";
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
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");

console.log("1) cache + wiring — questionnaires only, not health declaration");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-followup-zip.js")]).status === 0, "gi-followup-zip.js syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-followup-zip-config.js")]).status === 0, "config syntax");
assert(html.includes("app.js?v=" + APP_TAG), "index app.js cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");
assert(html.includes("gi-followup-zip-config.js?v=" + TAG), "index loads followup config tag");
assert(app.includes('GI_FOLLOWUP_ZIP_HREF = "./gi-followup-zip.js?v=' + TAG + '"'), "app followup js href");
assert(cfgSrc.includes('fillMode: "hachshara"'), "Hachshara uses dedicated fill mode");
assert(modSrc.includes("applyHachsharaFill"), "hachshara fill helper exists");
assert(modSrc.includes("HACH_CONTENT_FONT = 13"), "content font is 13pt");
assert(modSrc.includes("HACH_KEY_SLOT"), "Q1 maps reason to PDF question 3");
assert(app.includes("opts.fontSize"), "setTextSafe honors fontSize");
assert(app.includes("enableMultiline"), "setTextSafe can enable multiline");
assert(!modSrc.includes("HealthDecMainQ"), "followup zip does not fill health-declaration checkboxes");

const sandbox = { console, PDFLib: null, JSZip: null, Auth: { current: { name: "סוכן בדיקה" } }, GI_OFFICIAL_FORM_FILL: { setTextSafe(){}, FONT_FILE: "Heebo-Bold.ttf" } };
vm.runInNewContext(cfgSrc, sandbox, { filename: "gi-followup-zip-config.js" });
vm.runInNewContext(modSrc, sandbox, { filename: "gi-followup-zip.js" });
const api = sandbox.GiFollowupZip._test;
const hachCfg = sandbox.GI_FOLLOWUP_ZIP_CONFIG.COMPANIES.hachshara;
assert(hachCfg.fillMode === "hachshara", "config fillMode is hachshara");
assert(api.isGenericNoteKey("base__followup") === true, "base__followup is a generic note key");
assert(api.isGenericNoteKey("1__reason") === false, "1__reason is not a generic note key");
assert(api.isGenericNoteKey("1__followup") === false, "1__followup stays a questionnaire field");

function installCapture(){
  const captured = {};
  sandbox.GI_OFFICIAL_FORM_FILL = {
    FONT_FILE: "Heebo-Bold.ttf",
    setTextSafe(_form, fieldName, value, _font, opts){
      const text = String(value == null ? "" : value).trim();
      if(!text) return;
      captured[fieldName] = { text, fontSize: Number(opts && opts.fontSize) || 0, multiline: !!(opts && opts.multiline) };
      try { _form.getTextField(fieldName).setText(text); } catch(_e) {}
    }
  };
  return captured;
}

const insured = {
  id: "p1",
  type: "primary",
  label: "ישראל ישראלי",
  data: { fullName: "ישראל ישראלי", firstName: "ישראל", lastName: "ישראלי", idNumber: "123456789" }
};

console.log("\n2) live PDF field placement — questionnaire 1 (אשפוזים)");
(async () => {
  const pdfLib = require("pdf-lib");
  sandbox.PDFLib = pdfLib;
  const pdfBytes = fs.readFileSync(path.join(ROOT, "forms/followup-questionnaires/hachshara-followup-all.pdf"));
  const srcDoc = await pdfLib.PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const meta = api.listPageFieldMeta(srcDoc, 0);
  assert(meta.length > 8, "page 1 has widgets (got " + meta.length + ")");
  const classified = api.classifyHachsharaFields(meta);
  const headerNames = classified.header.map((m) => m.name);
  const contentNames = classified.content.map((m) => m.name);
  assert(headerNames.indexOf("e56756") >= 0 || headerNames.indexOf("drt6yu56") >= 0, "page-1 header uses the top name/id boxes");
  assert(contentNames[0] === "Text3", "page-1 first content field is Text3 (הופנית ולא אושפזת)");
  assert(contentNames.indexOf("Text23") >= 0, "page-1 סיבת האשפוז is Text23");
  assert(contentNames.indexOf("e56756") < 0 && contentNames.indexOf("drt6yu56") < 0, "header boxes are not treated as content");
  assert(classified.footer.some((m) => m.name === "Text19" || m.name === "er67777"), "footer date/name boxes classified");

  api.keepSinglePage(srcDoc, 0);
  const form = srcDoc.getForm();
  const captured = installCapture();
  const entry = {
    companyKey: "hachshara",
    company: "הכשרה",
    questionnaireNum: "1",
    insuredId: "p1",
    insured,
    followupData: {
      "1__reason": "כאבי בטן חזקים",
      "1__date": "03/2024",
      "1__duration": "3 ימים",
      "1__tests": "CT בטן",
      "1__treatment": "עירוי נוזלים",
      "1__followup": "מעקב גסטרו כל חצי שנה",
      "base__followup": "הנציג תיעד: כאבים אחרי אוכל שומני, הומלץ תזונה"
    },
    followupLabels: {
      "1__reason": "מה הסיבה לאשפוז",
      "1__followup": "האם נדרש מעקב",
      "base__followup": "פירוט מעקב / טיפול רפואי / תרופתי"
    }
  };
  const split = api.splitHachsharaRows(entry, hachCfg);
  assert(split.specific.some((r) => r.value === "כאבי בטן חזקים"), "specific rows keep the reason");
  assert(split.notes.some((r) => /הנציג תיעד/.test(r.value)), "agent פירוט is classified as a note");
  assert(!split.specific.some((r) => /הנציג תיעד/.test(r.value)), "agent פירוט is not mixed into reason rows");

  api.applyHachsharaFill(form, entry, hachCfg, null, meta);
  const headerText = headerNames.map((n) => (captured[n] && captured[n].text) || "").join(" ");
  assert(/ישראל/.test(headerText), "insured name goes to the header (got " + headerText + ")");
  assert(!/כאבי בטן/.test(headerText), "reason does not leak into the name/id header");
  assert(captured.Text23 && captured.Text23.text === "כאבי בטן חזקים", "reason fills PDF Q3 סיבת האשפוז / Text23 (got " + JSON.stringify(captured.Text23 && captured.Text23.text) + ")");
  assert(captured.Text22 && captured.Text22.text === "03/2024", "date fills PDF Q2 / Text22");
  assert(captured.Text24 && captured.Text24.text === "3 ימים", "duration fills PDF Q4 / Text24");
  assert(captured.Text25 && captured.Text25.text === "CT בטן", "tests fill PDF Q5 / Text25");
  assert(captured.Text27 && captured.Text27.text === "עירוי נוזלים", "treatment fills PDF Q6 / Text27");
  assert(!captured.Text3 || !/כאבי בטן/.test(captured.Text3.text), "reason does not go into PDF Q1 (הופנית ולא אושפזת)");
  const allText = Object.keys(captured).filter((k) => k.indexOf("__") !== 0).map((k) => captured[k].text).join(" | ");
  assert(/הנציג תיעד/.test(allText), "agent פירוט is written onto the questionnaire");
  const noteField = Object.keys(captured).find((k) => captured[k] && /הנציג תיעד/.test(captured[k].text));
  assert(noteField === "Text1", "agent פירוט goes to PDF Q10 מעקב / Text1 (got " + noteField + ")");
  assert(captured.Text1 && /מעקב גסטרו/.test(captured.Text1.text), "Q10 also keeps the followup answer");
  assert(headerNames.indexOf(noteField) < 0, "agent פירוט is not in the header");
  assert(noteField !== "Text3" && noteField !== "Text23", "agent פירוט is not in the reason box");
  assert(captured.er67777 && /ישראל/.test(captured.er67777.text), "footer שם המועמד is the insured, not the agent");
  const contentSizes = ["Text23","Text22","Text24","Text25","Text27","Text1"].map((n) => captured[n] && captured[n].fontSize).filter((n) => n > 0);
  assert(contentSizes.length && contentSizes.every((n) => n >= 12), "content font is at least 12pt (got " + JSON.stringify(contentSizes) + ")");
  assert(Object.values(captured).some((c) => c.multiline === true), "remarks use multiline");

  console.log("\n3) questionnaire 2 — פירוט lines are content, not footer");
  const src2 = await pdfLib.PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const meta2 = api.listPageFieldMeta(src2, 1);
  const c2 = api.classifyHachsharaFields(meta2);
  const content2 = c2.content.map((m) => m.name);
  const footer2 = c2.footer.map((m) => m.name);
  assert(content2.indexOf("Text33") >= 0 && content2.indexOf("Text34") >= 0, "Q2 remarks Text33/Text34 are content");
  assert(footer2.indexOf("Text33") < 0, "Q2 remarks are not classified as footer");
  api.keepSinglePage(src2, 1);
  const captured2 = installCapture();
  api.applyHachsharaFill(src2.getForm(), {
    companyKey: "hachshara",
    questionnaireNum: "2",
    insured,
    followupData: {
      "2__defect": "ASD",
      "2__status": "סגור במעקב",
      "2__docs": "מכתב קרדיולוג",
      "base__followup": "הנציג תיעד: אין הגבלה תפקודית"
    },
    followupLabels: { "2__docs": "מסמכים", "base__followup": "פירוט מעקב / טיפול רפואי / תרופתי" }
  }, hachCfg, null, meta2);
  const q2Blob = Object.keys(captured2).map((k) => captured2[k].text).join(" | ");
  assert(/הנציג תיעד/.test(q2Blob), "Q2 agent פירוט is written");
  const q2Note = Object.keys(captured2).find((k) => /הנציג תיעד/.test(captured2[k].text));
  assert(q2Note === "Text33" || q2Note === "Text34" || q2Note === "Text25", "Q2 פירוט lands in a remarks/content box (got " + q2Note + ")");
  assert(c2.header.some((m) => captured2[m.name] && /ישראל/.test(captured2[m.name].text)), "Q2 header gets the insured name");

  console.log("\n4) questionnaire 6 — complications box gets the long פירוט");
  const src6 = await pdfLib.PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const meta6 = api.listPageFieldMeta(src6, 5);
  const c6 = api.classifyHachsharaFields(meta6);
  const last6 = c6.content[c6.content.length - 1];
  assert(last6 && last6.name === "Text2" && last6.h >= 80, "Q6 last content field is the large complications box");
  api.keepSinglePage(src6, 5);
  const captured6 = installCapture();
  api.applyHachsharaFill(src6.getForm(), {
    companyKey: "hachshara",
    questionnaireNum: "6",
    insured,
    followupData: {
      "6__type": "סוג 2",
      "6__diagnosisDate": "2018",
      "6__pills": "כן",
      "6__pillsDetails": "מטפורמין 850",
      "6__glucose": "110",
      "6__hba1c": "6.4",
      "6__complications": "אין סיבוכים",
      "base__followup": "הנציג תיעד: מאוזן אצל אנדוקרינולוג"
    },
    followupLabels: { "6__complications": "סיבוכי סוכרת", "base__followup": "פירוט מעקב / טיפול רפואי / תרופתי" }
  }, hachCfg, null, meta6);
  assert(captured6.Text22 && captured6.Text22.text === "סוג 2", "Q6 type fills first answer");
  assert(captured6.Text24 && /מטפורמין/.test(captured6.Text24.text), "Q6 pills+details share the medication box");
  assert(Object.keys(captured6).some((k) => /HbA1C/.test(captured6[k].text) && /110/.test(captured6[k].text)), "Q6 glucose and HbA1C share a box");
  assert(captured6.Text2 && /אין סיבוכים/.test(captured6.Text2.text), "Q6 complications fill the large box");
  assert(captured6.Text2 && /הנציג תיעד/.test(captured6.Text2.text), "Q6 agent פירוט appends to the complications/remarks box");

  console.log("\n" + passed + " passed, " + failed + " failed");
  if(failed) process.exit(1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
