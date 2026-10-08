/* פתיחת שאלוני המשך מהקובץ, פרמיה מהסימולטור, ומילוי פרטי המבוטח.
   הרצה: node _test-ops-forms-open-fill.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
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

function extract(src, name){
  const needle = "\n    " + name + "(";
  const start = src.indexOf(needle);
  if(start < 0) return "";
  const paren = src.indexOf("(", start);
  let parenDepth = 0;
  let i = paren;
  for(; i < src.length; i += 1){
    if(src[i] === "(") parenDepth += 1;
    else if(src[i] === ")"){
      parenDepth -= 1;
      if(parenDepth === 0){ i += 1; break; }
    }
  }
  const brace = src.indexOf("{", i);
  let depth = 0;
  for(let j = brace; j < src.length; j += 1){
    if(src[j] === "{") depth += 1;
    else if(src[j] === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, j + 1).trim();
    }
  }
  return "";
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const zip = fs.readFileSync(path.join(ROOT, "gi-followup-zip.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "app.css"), "utf8");

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-followup-zip.js")]).status === 0, "node --check gi-followup-zip.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-followup-zip-config.js")]).status === 0, "node --check config");

console.log("\n2) הפניקס נפתח על העמוד המודפס");
const cfgSrc = fs.readFileSync(path.join(ROOT, "gi-followup-zip-config.js"), "utf8");
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(cfgSrc, sandbox);
const phoenix = sandbox.GI_FOLLOWUP_ZIP_CONFIG.COMPANIES.phoenix;
assert(phoenix.pageForQuestionnaire(3) === 11, "הפרעות קצב בעמוד 11");
assert(phoenix.pageForQuestionnaire(2) === 11, "מום לב נשאר בעמוד 11");
assert(phoenix.pageForQuestionnaire(21) === 8, "מחלות כללי בעמוד 8");
assert(phoenix.stackIds.indexOf("3") >= 0, "הפרעות קצב במחסנית");

console.log("\n3) פרמיה מהציטוט כשאין premiumMonthly");
function safeTrim(v){ return String(v == null ? "" : v).trim(); }
const names = ["_mcPolicyQuoteMonthly", "_mcQuoteCoverPremiums", "_mcHealthAddonPremiumSum", "_mcPremiumBefore", "_mcPremiumAfter", "_mcDiscountScheduleText", "_mcHealthCoverPremiumLines"];
let code = "function safeTrim(v){ return String(v == null ? '' : v).trim(); }\nconst ui = {\n";
code += "  _mcAsMoneyNumber(v){ const n = Number(String(v == null ? '' : v).replace(/[^\\d.\\-]/g, '')); return Number.isFinite(n) ? n : 0; },\n";
code += "  _mcWizardApi(){ return null; },\n";
code += "  _mcPolicyInsuredIds(p){ return Array.isArray(p.insuredIds) ? p.insuredIds : []; },\n";
code += "  _mcSimAfterTotal(p){ const raw = p.simDiscountPerInsured && p.simDiscountPerInsured.i1 && p.simDiscountPerInsured.i1.monthlyAfterDiscount; const n = Number(raw); return Number.isFinite(n) ? n : null; },\n";
code += "  _fmtMcMoney(v){ const n = Number(v); return n > 0 ? String(n) : '—'; },\n";
code += "  _mcCoverDiscountPct(){ return 0; },\n";
names.forEach((name) => {
  const src = extract(app, name);
  assert(!!src, "חולץ " + name);
  if(src) code += "  " + name + ": function" + src.slice(name.length) + ",\n";
});
code += "};\nthis.ui = ui;\n";
const host = {};
vm.runInNewContext(code, host);
const risk = {
  type: "ריסק",
  insuredIds: ["i1"],
  company: "מנורה",
  sumInsured: "9713396",
  riskSimQuotes: { i1: { monthlyPremium: 186.4, baseMonthlyPremium: 170 } },
  simDiscountPerInsured: { i1: { year1Pct: 15, years: 6, monthlyAfterDiscount: 158.44 } }
};
assert(host.ui._mcPremiumBefore(risk) === "170", "ריסק לפני הנחה מתעריף הספר בציטוט");
assert(host.ui._mcPremiumAfter(risk) === "158.44", "ריסק אחרי הנחה מ-monthlyAfterDiscount");
assert(host.ui._mcDiscountScheduleText(risk).indexOf("15%") >= 0, "הנחת הסימולטור מוצגת");
const health = {
  type: "בריאות",
  company: "מנורה",
  insuredIds: ["i1"],
  healthCovers: ["תרופות מחוץ לסל"],
  riskSimQuotes: {
    i1: {
      monthlyPremium: 220,
      covers: [{ label: "תרופות מחוץ לסל", wizardKey: "drugs", monthlyPremium: 120.5 }]
    }
  }
};
assert(host.ui._mcPremiumBefore(health) === "220", "בריאות לפני הנחה מהציטוט");
const lines = host.ui._mcHealthCoverPremiumLines({}, health);
assert(lines.some((row) => row.name === "תרופות מחוץ לסל" && row.before === 120.5), "כיסוי בריאות מציג את הפרמיה מהציטוט");

console.log("\n4) אחרי ההקראה נפתח הטופס, והשאלון מקבל את האדם");
const healthRender = extract(app, "_renderHealthDeclarationBody");
assert(healthRender.includes("כעת נעבור להצהרת הבריאות"), "ההקראה הראשונה נשארת");
const splitAt = healthRender.indexOf('mcNeedsScreen mcHealthDeclSplit">');
assert(splitAt > 0, "מסך הטפסים אחרי ההקראה");
assert(!healthRender.slice(splitAt, splitAt + 280).includes("scriptHtml"), "הנוסח לא חוזר במסך הטפסים");
assert(healthRender.includes("_mcOpenJoinFormFromRail"), "אחרי ההקראה נפתח טופס מקורי");
assert(app.includes("_mcAttachFollowupPerson(rec, entry){"), "שאלון מקבל את המבוטח מהתיק");
assert(app.includes("_mcAttachFollowupPerson(rec, row.entry)"), "פתיחת שאלון ממלאת את האדם");
assert(zip.includes('["BirthDate", idn.birth]'), "תאריך לידה נכתב כשהשדה קיים");
assert(zip.includes('["FirstName", idn.firstName || idn.fullName]'), "שם פרטי נכתב לכותרת");
assert(zip.includes('if(typeof cfg.pageForQuestionnaire === "function" && !Number(cfg.pageForQuestionnaire(qId))) return;'), "שאלון בלי עמוד לא נכנס לרשימה");
assert(css.includes(".mcStep2 .mcNeedsScreen{"), "מסך ההצעה לא ננעל לגובה שמכווץ את השורה");
assert(css.includes("repeat(auto-fit,minmax(148px,1fr))"), "שדות הכרטיס יורדים שורה ולא נמעכים");
assert(css.includes("repeat(auto-fit,minmax(140px,1fr))"), "גם במסך צר השורה לא נמעכת לשלוש עמודות");

console.log("\n5) המילוי נכתב לשדות של הקובץ עצמו");
const pdfLib = require("pdf-lib");
const fontkit = require("@pdf-lib/fontkit");
const fontBytes = fs.readFileSync("/usr/share/fonts/truetype/noto/NotoSerifHebrew-Bold.ttf");
const zipSandbox = {
  console,
  PDFLib: pdfLib,
  fontkit,
  GI_OFFICIAL_FORM_FILL: {
    FONT_FILE: "Heebo-Bold.ttf",
    setTextSafe(form, fieldName, value, font){
      const text = String(value == null ? "" : value).trim();
      if(!text) return;
      try {
        const field = form.getTextField(fieldName);
        field.setText(text);
        if(font && field.updateAppearances) field.updateAppearances(font);
      } catch(_e) {}
    }
  }
};
vm.createContext(zipSandbox);
vm.runInContext(cfgSrc, zipSandbox);
vm.runInContext(zip, zipSandbox);

function readFields(form){
  const out = {};
  form.getFields().forEach((field) => {
    try {
      const text = String(field.getText() || "").trim();
      if(text) out[field.getName()] = text;
    } catch(_e) {}
  });
  return out;
}

async function openFilled(companyKey, qNum, followupData){
  const cfg = zipSandbox.GI_FOLLOWUP_ZIP_CONFIG.COMPANIES[companyKey];
  const pageNum = cfg.pageForQuestionnaire(qNum);
  const bytes = fs.readFileSync(path.join(ROOT, cfg.combinedPdf));
  const doc = await pdfLib.PDFDocument.load(bytes, { ignoreEncryption: true });
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fontBytes);
  const pageIndex = pageNum - 1;
  zipSandbox.GiFollowupZip._test.keepSinglePage(doc, pageIndex);
  const meta = zipSandbox.GiFollowupZip._test.listPageFieldMeta(doc, 0);
  const form = doc.getForm();
  const entry = {
    companyKey,
    questionnaireNum: String(qNum),
    insured: {
      id: "p1",
      type: "primary",
      label: "סמדר ניראלי",
      data: {
        firstName: "סמדר",
        lastName: "ניראלי",
        idNumber: "203456789",
        birthDate: "1984-03-12",
        phone: "0501234567"
      }
    },
    followupData: followupData || {},
    followupLabels: { q3_diagnosis: "אבחנה" }
  };
  const headerNames = zipSandbox.GiFollowupZip._test.applyInsuredHeader(form, entry, font, meta);
  if(cfg.fillMode === "hachshara"){
    zipSandbox.GiFollowupZip._test.applyHachsharaFill(form, entry, cfg, font, meta);
  } else if(cfg.fillMode !== "clal_cq" && cfg.fillMode !== "phoenix"){
    zipSandbox.GiFollowupZip._test.applySequentialFill(form, entry, cfg, font, meta.map((m) => m.name), headerNames);
  } else if(cfg.fillMode === "phoenix"){
    zipSandbox.GiFollowupZip._test.applySequentialFill(form, entry, cfg, font, meta.map((m) => m.name), headerNames);
  }
  const saved = await doc.save({ updateFieldAppearances: false });
  const again = await pdfLib.PDFDocument.load(saved, { ignoreEncryption: true });
  return readFields(again.getForm());
}

(async () => {
  const phoenix = await openFilled("phoenix", 3, { q3_diagnosis: "פרפור עליות" });
  assert(phoenix.Text32 === "סמדר ניראלי", "הפניקס: שם המבוטח בשדה השם");
  assert(phoenix.Text33 === "203456789", "הפניקס: תעודת זהות בשדה התעודה");
  assert(phoenix.Text36 === "סמדר" && phoenix.Text37 === "ניראלי", "הפניקס: שם פרטי ושם משפחה בשורת המבוטח הראשי");
  const answerBlob = Object.keys(phoenix).filter((k) => !/^Text3[23567]$/.test(k)).map((k) => phoenix[k]).join(" | ");
  assert(answerBlob.indexOf("פרפור עליות") >= 0, "הפניקס: אבחנת השאלון נכתבת בלי לדרוס את השם");
  assert(phoenix.Text32 === "סמדר ניראלי", "הפניקס: השם נשאר אחרי מילוי התשובה");

  const menora = await openFilled("menora", 1, { "1__reason": "ניתוח" });
  assert(menora.Text1 === "ניראלי", "מנורה: שם משפחה בשדה הימני");
  assert(menora.Text2 === "סמדר", "מנורה: שם פרטי בשדה האמצעי");
  assert(menora.Text3 === "203456789", "מנורה: תעודת זהות בשדה השמאלי");

  const ayalon = await openFilled("ayalon", 2, { "2__diagnosis": "אסתמה" });
  assert(ayalon.Text4 === "203456789", "איילון: תעודת זהות");
  assert(ayalon.Text5 === "סמדר ניראלי", "איילון: שם המועמד");

  const clal = await openFilled("clal", "א", { "clal_א_cannabisNow": "כן" });
  assert(clal.InsurancedFirstName === "סמדר", "כלל: שם פרטי");
  assert(clal.InsurancedLastName === "ניראלי", "כלל: שם משפחה");
  assert(clal.PIDInsuranced === "203456789", "כלל: תעודת זהות");

  const migdal = await openFilled("migdal", 1, { "1__diagnosis": "יתר לחץ דם" });
  assert(migdal.hfg20h2gf === "סמדר ניראלי", "מגדל: שם המבוטח");
  assert(migdal.kjh54k15hj === "203456789", "מגדל: תעודת זהות");

  const hachBytes = fs.readFileSync(path.join(ROOT, "forms/followup-questionnaires/hachshara-followup-all.pdf"));
  const hachDoc = await pdfLib.PDFDocument.load(hachBytes, { ignoreEncryption: true });
  hachDoc.registerFontkit(fontkit);
  const hachFont = await hachDoc.embedFont(fontBytes);
  const hachCfg = zipSandbox.GI_FOLLOWUP_ZIP_CONFIG.COMPANIES.hachshara;
  zipSandbox.GiFollowupZip._test.keepSinglePage(hachDoc, hachCfg.pageForQuestionnaire(1) - 1);
  const hachMeta = zipSandbox.GiFollowupZip._test.listPageFieldMeta(hachDoc, 0);
  const hachForm = hachDoc.getForm();
  zipSandbox.GiFollowupZip._test.applyHachsharaFill(hachForm, {
    companyKey: "hachshara",
    questionnaireNum: "1",
    insured: { data: { firstName: "סמדר", lastName: "ניראלי", fullName: "סמדר ניראלי", idNumber: "203456789" } },
    followupData: { "1__reason": "ניתוח" },
    followupLabels: { "1__reason": "סיבה" }
  }, hachCfg, hachFont, hachMeta);
  const hachSaved = await hachDoc.save({ updateFieldAppearances: false });
  const hachAgain = await pdfLib.PDFDocument.load(hachSaved, { ignoreEncryption: true });
  const hachFields = readFields(hachAgain.getForm());
  const hachBlob = Object.keys(hachFields).map((k) => k + "=" + hachFields[k]).join(" | ");
  assert(hachBlob.indexOf("סמדר ניראלי") >= 0, "הכשרה: השם נכתב לטופס");
  assert(hachBlob.indexOf("203456789") >= 0, "הכשרה: תעודת הזהות נכתבת לטופס");

  const hidden = zipSandbox.GiFollowupZip.detectTriggeredFollowups({
    responses: {
      hachshara__endo: { p1: { answer: "yes", fields: {} } },
      ayalon__neuro: { p1: { answer: "yes", fields: {} } }
    }
  }, {
    map: {
      hachshara__endo: { questionnaireNos: ["19"] },
      ayalon__neuro: { questionnaireNos: ["1"] }
    }
  }, [{ id: "p1", label: "סמדר" }]);
  assert(!hidden.some((row) => row.companyKey === "hachshara" && row.questionnaireNum === "19"), "הכשרה 19 לא מופיע בלי עמוד");
  assert(!hidden.some((row) => row.companyKey === "ayalon" && row.questionnaireNum === "1"), "איילון 1 לא מופיע בלי עמוד");

  const shown = zipSandbox.GiFollowupZip.detectTriggeredFollowups({
    responses: { phoenix_full__rhythm: { p1: { answer: "yes", fields: { q3_diagnosis: "פרפור עליות" } } } }
  }, {
    map: { phoenix_full__rhythm: { questionnaireNos: ["3"], fields: [{ key: "q3_diagnosis", label: "אבחנה" }] } }
  }, [{ id: "p1", label: "סמדר", data: { firstName: "סמדר", lastName: "ניראלי", idNumber: "203456789" } }]);
  assert(shown.some((row) => row.questionnaireNum === "3"), "הפרעות קצב כן נכנסות לרשימה כי יש להן עמוד");

  console.log("\n6) טופס ההצעה הרשמי של הפניקס נפתח עם פרטי המבוטח");
  const appSrc = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
  const fillStart = appSrc.indexOf("const GI_OFFICIAL_FORM_FILL = {");
  const fillEnd = appSrc.indexOf("try { window.GI_OFFICIAL_FORM_FILL = GI_OFFICIAL_FORM_FILL; }", fillStart);
  const formSandbox = {
    window: { PDFLib: pdfLib, location: { href: "http://local.test/", pathname: "/" } },
    console,
    PDFLib: pdfLib,
    fontkit,
    URL,
    location: { href: "http://local.test/", pathname: "/" },
    fetch: async (url) => {
      const clean = decodeURIComponent(String(url).split("?")[0]);
      const rel = clean.replace(/^https?:\/\/[^/]+\//, "").replace(/^\.\//, "");
      const file = path.join(ROOT, rel);
      const buf = fs.readFileSync(file);
      return { ok: true, status: 200, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
    }
  };
  formSandbox.globalThis = formSandbox.window;
  formSandbox.window.fontkit = fontkit;
  formSandbox.window.fetch = formSandbox.fetch;
  vm.runInNewContext(appSrc.slice(fillStart, fillEnd) + "\nthis.GI_OFFICIAL_FORM_FILL = GI_OFFICIAL_FORM_FILL;", formSandbox);
  formSandbox.window.GI_OFFICIAL_FORM_FILL = formSandbox.GI_OFFICIAL_FORM_FILL;
  const origFetch = global.fetch;
  global.fetch = async (url) => {
    const clean = decodeURIComponent(String(url).split("?")[0]);
    const rel = clean.replace(/^https?:\/\/[^/]+\//, "");
    const file = path.join(ROOT, rel);
    const buf = fs.readFileSync(file);
    return { ok: true, status: 200, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
  };
  try {
    const formSrc = fs.readFileSync(path.join(ROOT, "gi-phoenix-health-form.js"), "utf8");
    vm.runInNewContext(formSrc, formSandbox);
    const rec = {
      firstName: "סמדר",
      lastName: "ניראלי",
      idNumber: "203456789",
      phone: "0501234567",
      payload: {
        primary: {
          id: "p1",
          firstName: "סמדר",
          lastName: "ניראלי",
          idNumber: "203456789",
          birthDate: "1984-03-12",
          phone: "0501234567",
          city: "חיפה"
        },
        newPolicies: [{ company: "הפניקס", type: "בריאות", product: "בריאות" }]
      }
    };
    const draft = formSandbox.window.PhoenixHealthForm.buildDraft(rec);
    assert(draft.primary && draft.primary.firstName === "סמדר" && draft.primary.idNumber === "203456789", "טיוטת טופס ההצעה נבנית מהתיק");
    const filled = await formSandbox.window.PhoenixHealthForm.fillOriginalTemplate(draft);
    const official = await pdfLib.PDFDocument.load(filled, { ignoreEncryption: true });
    const officialFields = readFields(official.getForm());
    assert(officialFields.FirstName === "סמדר", "טופס ההצעה: שם פרטי");
    assert(officialFields.LastName === "ניראלי", "טופס ההצעה: שם משפחה");
    assert(officialFields.PID === "203456789", "טופס ההצעה: תעודת זהות");
    assert(officialFields.FullName === "סמדר ניראלי", "טופס ההצעה: שם מלא");
  } finally {
    global.fetch = origFetch;
  }

  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error(err);
  failed += 1;
  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(1);
});
