/* GI-ARRIVAL-DOCS 20260909-wizard-open-v1
   מסמך התאמה + התפתחות פרמיה + נספח ה׳ — אחד-לאחד מול המסמכים שנשלחו.
   Run: node _test-arrival-docs.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260909-wizard-open-v1";
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

function sliceBetween(src, startToken, endToken){
  const start = src.indexOf(startToken);
  const end = src.indexOf(endToken, start + startToken.length);
  if(start < 0 || end < 0) return "";
  return src.slice(start, end);
}

function loadModule(extra){
  const src = fs.readFileSync(path.join(ROOT, "gi-arrival-docs.js"), "utf8");
  const sandbox = Object.assign({
    console,
    location: { href: "https://example.com/app", pathname: "/" },
    Auth: { current: { name: "סוכן בדיקה", id: "a_1" } }
  }, extra || {});
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(src, sandbox, { filename: "gi-arrival-docs.js" });
  return sandbox.GiArrivalDocs;
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "app.css"), "utf8");
const cancel = fs.readFileSync(path.join(ROOT, "gi-cancel-forms.js"), "utf8");
const modSrc = fs.readFileSync(path.join(ROOT, "gi-arrival-docs.js"), "utf8");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-arrival-docs.js")]).status === 0, "node --check gi-arrival-docs.js");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + TAG), "index.html app.css cache");
assert(sw.includes("gi-v12-" + TAG), "service worker cache");
assert(app.includes('BUILD = "' + TAG + '"'), "app.js BUILD tag");
assert(app.includes('GI_ARRIVAL_DOCS_HREF = "./gi-arrival-docs.js?v=' + TAG + '"'), "arrival docs href");
assert(app.includes("ensureGiArrivalDocsLoaded"), "lazy loader exists");
assert(cancel.includes('VERSION: "' + TAG + '"'), "cancel forms VERSION bumped with app");

console.log("\n2) wiring in customer documents");
assert(app.includes('suitabilityDoc: "suitability_document"'), "hatama type kept for strip");
assert(app.includes('premiumDevelopment: "premium_development_report"'), "premia type kept for strip");
assert(app.includes('nispahHarAuth: "nispah_he_har_auth"'), "nispah type kept for strip");
assert(app.includes('arrivalPack: "customer_arrival_pack"'), "combined pack type");
assert(app.includes("injectArrivalDocs"), "inject helper");
const enrichSrc = sliceBetween(app, "enrichPayloadWithSaveDocuments(payload, context = {}){", "syncFollowupDocsFromLiveDetect(payload, options = {}){");
assert(enrichSrc.includes('kind === "health_wizard"') && enrichSrc.includes("injectArrivalDocs(payload.customerDocuments"), "wizard save persists pack");
assert(enrichSrc.includes('kind === "health_edit"') && /health_edit[\s\S]*injectArrivalDocs/.test(enrichSrc), "edit save persists pack");
assert(app.includes("downloadArrivalDoc"), "download helper");
assert(app.includes("data-download-arrival-pack-doc"), "combined download button");
assert(app.includes("GiArrivalDocs.buildDraft"), "preview uses draft");
assert(app.includes("fillNispahPdf"), "nispah PDF fill wired");
assert(app.includes("appendArrivalNispahPreview"), "combined preview appends nispah");
assert(app.includes("renderCombinedHtml") || modSrc.includes("renderCombinedHtml"), "combined HTML");
assert(modSrc.includes("embedNispahInHtml"), "html fallback embeds nispah");
assert(modSrc.includes("giArrivalNispahEmbed"), "fallback keeps nispah in the same file");
assert(!modSrc.includes("Hashlama") && !modSrc.includes("גריגורי"), "no Hashlama branding in generator");
assert(fs.existsSync(path.join(ROOT, "forms/har-authorization/nispah-he.pdf")), "official nispah PDF stored");
assert(fs.existsSync(path.join(ROOT, "assets/gi-doc-cover-docs.png")), "flat documents cover asset");
assert(!modSrc.includes("gi-doc-cover-3d.png"), "cover no longer points at 3D GEMEL logo");
assert(/\.giCoverArt\{[^}]*width:172mm/.test(modSrc), "cover art spans almost full page width");
assert(/\.giCoverArt\{[^}]*height:188mm/.test(modSrc), "cover art spans almost full page height");
assert(!/\.giCoverArt\{[^}]*width:250px/.test(modSrc), "cover art is not a small 250px logo");

console.log("\n3) legal sentences 1:1");
[
  "אם בפוליסה המוצעת ייקבעו לך החרגות לכיסוי הביטוח, אעביר לך לידיעתך ואישורך את השוואת ההחרגות בין הפוליסה המוצעת לפוליסה הקיימת.",
  "אם הפוליסה המוצעת הינה מסוג פוליסת פיצוי בלבד (ריסק,מחלות קשות,תאונות אישיות,סיעוד) ואין בכוונתך לבטל או להקטין את הכיסוי הביטוחי הקיים - לא תבוצע השוואת החרגות.",
  "הוצגה למועמד לביטוח התפתחות פרמיה.",
  "אמצעי תשלום אפשרי תשלום בכרטיס אשראי או הוראת קבע בבנק. פרטים לגבי מספר תשלומים וריביות ימסרו במידע מהותי.",
  "דע כי עליך להשיב תשובה מלאה וכנה על שאלות בעניין מהותי, ככל שלא יעשה כך יכול ותהיה השפעה על תשלום גמולי הביטוח.",
  "ידוע כי תהליך הצירוף, לרבות תהליך ההתאמה, אינו מותנה בהשארות המבוטח למשך תקופת ביטוח קצובה או שאינה קצובה.",
  "המחיר המוצג הינו מחיר חודשי לכל אורך השנה",
  "המחיר המוצג הינו בשקלים שלמים ללא אגורות",
  "דע לך כי הסכומים הקובעים הינם אלה שיוצגו לך על ידי חברת הביטוח בטפסים והמסמכים שלה",
  "אני, החתום מטה, מצהיר כי המסמך מסמך התאמה נמסר לי על ידי בעל הרישיון.",
  "חלק ב' - הכיסויים הביטוחיים המומלצים",
  "סכום הכיסוי הביטוחי (חודשי או חד-פעמי)",
  "ט.ל.ח. מיצג זה הינו להמחשה בלבד.",
  "הצהרת המועמד לביטוח על כפל פיצוי בפוליסות מסוג פיצוי בלבד",
  "כי הטבלה לעיל הוצגה בפני"
].forEach((sentence) => {
  assert(modSrc.includes(sentence), "legal: " + sentence.slice(0, 36));
});

const sample = {
  id: "c1",
  agentName: "סוכן בדיקה",
  payload: {
    flowType: "health",
    primary: {
      firstName: "מריה", lastName: "שארפמן", idNumber: "342390275",
      birthDate: "20/05/1986", gender: "נקבה", maritalStatus: "גרוש/ה",
      occupation: "יועץ כלכלי", street: "האלונים", houseNumber: "161",
      city: "נתניה", phone: "053-701-6569", clinic: "מכבי", shaban: "מכבי זהב",
      heightCm: "164", weightKg: "57", smokingStatus: "לא"
    },
    insureds: [
      { id: "p1", type: "primary", label: "מריה שארפמן", data: {
        firstName: "מריה", lastName: "שארפמן", idNumber: "342390275",
        birthDate: "20/05/1986", gender: "נקבה", occupation: "יועץ כלכלי",
        smokingStatus: "לא",
        existingPolicies: [
          { id: "ex1", company: "מגדל", type: "מחלות קשות", policyNumber: "22604365", monthlyPremium: "76" }
        ],
        cancellations: { ex1: { status: "full" } }
      } },
      { id: "c2", type: "child", label: "שמעון שארפמן", data: {
        firstName: "שמעון", lastName: "שארפמן", idNumber: "228425831",
        birthDate: "22/05/2019", gender: "זכר", smokingStatus: "לא"
      } }
    ],
    newPolicies: [
      {
        id: "n1", company: "מנורה", type: "ריסק", productName: "ביטוח חיים",
        insuredIds: ["p1"], sumInsured: "1300000",
        premiumPerInsured: { p1: "100.6" },
        simDiscountPerInsured: { p1: { optionId: "x", year1Pct: 70, schedule: [70, 70, 55, 40, 30, 20], monthlyAfterDiscount: 30.18 } }
      },
      {
        id: "n2", company: "מנורה", type: "מחלות קשות", productName: "TOP קרן אור", planName: "TOP קרן אור",
        insuredIds: ["p1"], sumInsured: "160000",
        premiumPerInsured: { p1: "87.04" },
        simDiscountPerInsured: { p1: { year1Pct: 30, years: 10, schedule: Array(10).fill(30), monthlyAfterDiscount: 60.93 } }
      }
    ]
  }
};

console.log("\n4) draft + HTML from customer file");
const quotes = [];
const api = loadModule({
  GiSimulatorQuotes: {
    quote(company, product, input){
      quotes.push({ company, product, age: input.age });
      if(input.age > 42) return { ok: false, error: "age_out_of_range" };
      return { ok: true, monthlyPremium: 100 + (Number(input.age) || 0), annualPremium: 1200 };
    }
  }
});
assert(!!api.buildDraft && !!api.renderHatamaHtml && !!api.renderPremiaHtml, "public API");
assert(api.qualifies(sample.payload, sample), "health customer qualifies");
assert(!api.qualifies({ flowType: "elementary", primary: { firstName: "א" } }, {}), "elementary skipped");

const draft = api.buildDraft(sample);
assert(draft.primary.fullName.indexOf("מריה") >= 0, "primary name from file");
assert(draft.primary.idNumber === "342390275", "primary id from file");
assert(draft.people.some((p) => p.idNumber === "228425831"), "child from file");
const child = draft.people.find((p) => p.idNumber === "228425831");
assert(child && child.occupation !== "יועץ כלכלי", "child does not inherit primary occupation");
assert(child && child.maritalStatus !== "גרוש/ה", "child does not inherit primary marital status");
assert(draft.newPolicies.length === 2, "new policies");
assert(draft.existing.some((row) => row.cancelled && row.policy.policyNumber === "22604365"), "cancelled migdal CI");
assert(draft.agent.agency === "GEMEL INVEST", "agency branding");

const hatama = api.renderHatamaHtml(draft);
assert(hatama.includes("מסמך התאמה"), "cover title");
assert(hatama.includes("התאמת הביטוח לצורכי המועמד לביטוח"), "cover subtitle");
assert(hatama.includes("assets/gi-doc-cover-docs.png"), "flat documents cover, not Hashlama folder");
assert(!hatama.includes("assets/gi-doc-cover-3d.png"), "hatama HTML does not use 3D GEMEL logo");
assert(hatama.includes("חלק ב' - הכיסויים הביטוחיים המומלצים"), "part B title");
assert(hatama.includes("להצטרף"), "join status");
assert(hatama.includes("ביטול מוצר קיים"), "cancel status");
assert(hatama.includes("הוחלט לבטל את המוצר, אחריות הביטול ע"), "cancel legal sentence");
assert(hatama.includes("22604365"), "cancelled policy number");
assert(hatama.includes("#3870ED"), "GEMEL blue");
assert(hatama.includes("הוצגה למועמד לביטוח התפתחות פרמיה."), "declaration sentence");
assert(hatama.includes("אני, החתום מטה, מצהיר כי המסמך מסמך התאמה נמסר לי על ידי בעל הרישיון."), "client declaration");
assert(!hatama.includes("גריגורי"), "does not copy Hashlama agent");

const premia = api.renderPremiaHtml(draft);
assert(premia.includes("דוח התפתחות פרמיה"), "premia title");
assert(premia.includes("כיסויים ועלויות חודשיות שנה א"), "year-1 table");
assert(premia.includes("המחיר המוצג הינו בשקלים שלמים ללא אגורות"), "whole shekel note");
assert(premia.includes("אישור המועמד לביטוח"), "candidate approval");
assert(premia.includes("התפתחות פרמיה"), "age table heading when tariff exists");
assert(premia.includes("בריאות") && premia.includes("חיים"), "health and life are separate report sections");
assert(premia.includes("הצעת מחיר והתפתחות פרמיה"), "life section title 1:1");
assert(quotes.length > 0, "age table uses simulator quote engine");
assert(premia.includes("40") && premia.includes("42"), "includes ages that the tariff returned");
assert(!/>43</.test(premia) && !/>44</.test(premia), "stops when tariff fails — no invented ages");

const combined = api.renderCombinedHtml(draft);
const bodyStart = combined.indexOf("giArrivalRoot");
const iCover = combined.indexOf("התאמת הביטוח לצורכי המועמד לביטוח", bodyStart);
const iPartB = combined.indexOf("חלק ב' - הכיסויים הביטוחיים המומלצים", bodyStart);
const iYear1 = combined.indexOf("כיסויים ועלויות חודשיות שנה א", bodyStart);
const iPremiaHeading = combined.indexOf("דוח התפתחות פרמיה", bodyStart);
assert(bodyStart >= 0 && iCover > bodyStart, "hatama cover is in the document body");
assert(iPartB > iCover, "hatama part B comes after the cover");
assert(iYear1 > iPartB && iPremiaHeading > iPartB, "premia report comes after hatama pages");
assert(combined.includes("אישור המועמד לביטוח"), "combined keeps premia approval");
assert(typeof api.embedNispahInHtml === "function", "html fallback can embed nispah");
const withNispah = api.embedNispahInHtml(combined, new Uint8Array([37, 80, 68, 70]));
assert(withNispah.indexOf("giArrivalNispahEmbed") > iYear1, "embedded nispah comes after premia");
assert(withNispah.includes("data:application/pdf;base64,"), "nispah is embedded as PDF data");

console.log("\n5) stored projection without tariff engine");
const noEngine = loadModule({});
const draft2 = noEngine.buildDraft(sample);
const premia2 = noEngine.renderPremiaHtml(draft2);
assert(premia2.includes("כיסויים ועלויות חודשיות שנה א"), "year-1 still shown from proposal");
const storedOk = (draft2.tables || []).some((t) => (t.coverRows || []).some((c) => c.projection && c.projection.ok && c.projection.source === "stored"));
assert(storedOk, "uses stored year-1 + discount schedule when engine is absent");
assert(/גיל בשנים/.test(premia2), "age table from sold premiums, not invented tariffs");
const lifeProj = (draft2.tables || []).find((t) => t.family === "life" || t.family === "mortgage")?.coverRows?.[0]?.projection;
assert(lifeProj && lifeProj.rows.length === 6, "risk stored rows match discount schedule length");
const ciProj = (draft2.tables || []).find((t) => t.family === "ci" || t.family === "cancer")?.coverRows?.[0]?.projection;
assert(ciProj && ciProj.rows.length === 10, "CI stored rows match 10-year schedule");
assert(!(draft2.tables || []).some((t) => (t.coverRows || []).some((c) => (c.projection?.rows || []).some((r) => r.age >= 50))), "does not invent ages beyond the discount schedule");

console.log("\n6) nispah fill uses official fields only");
const captured = {};
const nispahApi = loadModule({
  PDFLib: {
    PDFDocument: {
      load: async () => ({
        getForm(){
          return { __giCapture: captured, updateFieldAppearances(){} };
        },
        registerFontkit(){},
        embedFont: async () => ({}),
        save: async () => new Uint8Array([1, 2, 3])
      })
    }
  },
  GI_OFFICIAL_FORM_FILL: {
    setTextSafe(form, name, value){ captured[name] = String(value || ""); }
  },
  GI_LOAD_LIBS: { pdfLib: async () => {} },
  fetch: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })
});
(async () => {
  try {
    const bytes = await nispahApi.fillNispahPdf(draft);
    assert(bytes && bytes.length === 3, "nispah returns pdf bytes");
    assert(captured.FullName.indexOf("מריה") >= 0, "fills FullName");
    assert(captured.PID === "342390275", "fills PID");
    assert(captured.AgentName === "GEMEL INVEST" || captured.SuchnutnTypeName, "fills agent");
    assert(captured.Date, "fills Date");
    assert(!captured.ClientMust1 && !captured.AgentMust1, "does not fill signatures");
  } catch(err){
    assert(false, "nispah fill: " + err.message);
  }

  console.log("\n7) inject one combined pack");
  const list = [];
  api.injectDocs(list, sample, sample.payload, { uploadedBy: "סוכן בדיקה" });
  const types = list.map((d) => d.type);
  assert(list.length === 1, "one document in the customer file");
  assert(types[0] === "customer_arrival_pack", "pack type");
  assert(list[0].name.indexOf("מסמך התאמה") >= 0 && list[0].name.indexOf("התפתחות פרמיה") >= 0 && list[0].name.indexOf("נספח ה") >= 0, "combined name");
  list.push({ id: "old1", type: "suitability_document" }, { id: "old2", type: "premium_development_report" }, { id: "old3", type: "nispah_he_har_auth" });
  api.injectDocs(list, sample, sample.payload, {});
  assert(list.length === 1, "strips the previous three separate docs");
  assert(list[0].type === "customer_arrival_pack", "keeps the pack");
  const before = list.length;
  api.injectDocs(list, sample, sample.payload, {});
  assert(list.length === before, "does not duplicate");

  console.log("\n8) merge pdf concatenates hatama/premia then nispah");
  const pages = [];
  const mergeApi = loadModule({
    PDFLib: {
      PDFDocument: {
        async create(){
          return {
            async copyPages(src, idxs){ return idxs.map((i) => src.id + ":" + i); },
            addPage(p){ pages.push(p); },
            save: async () => new Uint8Array([9, 9])
          };
        },
        async load(bytes){
          return {
            id: bytes && bytes[0] === 1 ? "body" : "nispah",
            getPageIndices(){ return bytes && bytes[0] === 1 ? [0, 1] : [0]; }
          };
        }
      }
    }
  });
  const merged = await mergeApi.mergePdfBytes([new Uint8Array([1]), new Uint8Array([2])]);
  assert(merged && merged.length === 2, "merge returns bytes");
  assert(pages.join(",") === "body:0,body:1,nispah:0", "body pages then nispah");

  console.log("\n9) persist pack on save payload");
  function persistLikeSave(payload){
    if(!Array.isArray(payload.customerDocuments)) payload.customerDocuments = [];
    api.injectDocs(payload.customerDocuments, { payload, agentName: "סוכן בדיקה" }, payload, { uploadedBy: "סוכן בדיקה" });
    return payload;
  }
  const savePayload = {
    flowType: "health",
    primary: sample.payload.primary,
    insureds: sample.payload.insureds,
    newPolicies: sample.payload.newPolicies,
    customerDocuments: [
      { id: "ops1", type: "health_ops", name: "דוח תפעולי" },
      { id: "old1", type: "suitability_document", name: "התאמה" },
      { id: "old2", type: "premium_development_report", name: "פרמיה" },
      { id: "old3", type: "nispah_he_har_auth", name: "נספח" }
    ]
  };
  const afterWizard = persistLikeSave(JSON.parse(JSON.stringify(savePayload)));
  const wizardTypes = (afterWizard.customerDocuments || []).map((d) => d.type);
  assert(wizardTypes.filter((t) => t === "customer_arrival_pack").length === 1, "wizard save writes one pack");
  assert(wizardTypes.includes("health_ops"), "wizard save keeps other docs");
  assert(!wizardTypes.includes("suitability_document") && !wizardTypes.includes("premium_development_report") && !wizardTypes.includes("nispah_he_har_auth"), "wizard save strips the old three");

  const afterEdit = persistLikeSave(JSON.parse(JSON.stringify(savePayload)));
  const editTypes = (afterEdit.customerDocuments || []).map((d) => d.type);
  assert(editTypes.filter((t) => t === "customer_arrival_pack").length === 1, "edit save writes one pack");
  assert(editTypes.includes("health_ops"), "edit save keeps other docs");
  assert(!editTypes.includes("suitability_document") && !editTypes.includes("premium_development_report") && !editTypes.includes("nispah_he_har_auth"), "edit save strips the old three");

  console.log("\n10) faster download: cache, progress, no simulator chunk");
  const fetchSrc = sliceBetween(modSrc, "const FETCH_MEM", "function reportDocDownloadProgress");
  assert(fetchSrc.includes("FETCH_MEM"), "memory-caches nispah/font bytes");
  assert(!fetchSrc.includes('cache: "reload"') && !fetchSrc.includes("cache:\"reload\""), "does not bypass HTTP cache on nispah/font");
  assert(modSrc.includes("reportDocDownloadProgress"), "progress hook from arrival docs");
  assert(modSrc.includes("logging: false"), "html2canvas logging off");
  assert(modSrc.includes('"FAST"'), "jsPDF FAST image write");
  assert(modSrc.includes("scale: 2"), "keeps html2canvas scale 2");
  assert(modSrc.includes("0.92"), "keeps jpeg quality");
  assert(modSrc.includes("Promise.all([htmlPromise, nispahPromise])"), "html PDF and nispah run in parallel");
  const dlSrc = sliceBetween(app, "async downloadArrivalDoc(rec, kind, sourceBtn){", "async appendArrivalNispahPreview");
  assert(dlSrc.includes("showGiDocDownloadOverlay"), "download shows overlay immediately");
  assert(dlSrc.indexOf("showGiDocDownloadOverlay") < dlSrc.indexOf("await "), "overlay before first await");
  assert(!dlSrc.includes("ensureGiSimulatorJsLoaded"), "arrival download does not load simulators");
  assert(dlSrc.includes("pdfExport"), "preloads pdf export libs only");
  const prevMod = sliceBetween(app, "async ensureCustomerDocumentPreviewModule(doc){", "async fillCustomerDocumentPreviewPdf");
  assert(!prevMod.includes("ensureGiSimulatorJsLoaded"), "arrival preview does not load simulators");
  const resolveFn = sliceBetween(app, "async resolveDocumentBytes(rec, doc){", "async downloadSelectedCustomerDocuments(rec){");
  assert(!resolveFn.includes("ensureGiSimulatorJsLoaded"), "resolveDocumentBytes does not load simulators");
  const multiFn = sliceBetween(app, "async downloadSelectedCustomerDocuments(rec){", "async downloadFollowupQuestionnairesZip(rec){");
  assert(multiFn.includes("showGiDocDownloadOverlay"), "selected download shows overlay");
  const zipIdx = multiFn.indexOf("await ensureFollowupZipLoaded()");
  const loopIdx = multiFn.indexOf("for(let i = 0");
  assert(zipIdx < 0 || zipIdx > loopIdx, "followup/JSZip loaded only when a zip is needed");
  assert(multiFn.includes("files.length === 1"), "single selected file downloads without zip");
  assert(app.includes("GiDocDownloadProgress"), "global progress updater");
  assert(app.includes("נשארו "), "remaining X of Y copy");
  assert(css.includes(".cfDocDownloadOverlay"), "overlay CSS");
  assert(css.includes(".cfDocDownloadOverlay__spin"), "wait spinner CSS");

  const progressCalls = [];
  const progApi = loadModule({
    GiDocDownloadProgress(info){ progressCalls.push(info); }
  });
  progApi.htmlToPdfBytes = async function(_html, options){
    if(options && options.onPage) await options.onPage(1, 2);
    if(options && options.onPage) await options.onPage(2, 2);
    return new Uint8Array([1]);
  };
  progApi.fillNispahPdf = async function(){ return new Uint8Array([2]); };
  progApi.mergePdfBytes = async function(){ return new Uint8Array([9, 9]); };
  const progDraft = progApi.buildDraft(sample);
  await progApi.buildPackPdf(progDraft, { startedAt: Date.now() - 1200, includeDownloadStep: true });
  assert(progressCalls.length > 0, "buildPackPdf reports progress");
  assert(progressCalls.some((c) => /עמוד/.test(String(c.detail || ""))), "reports per-page progress");
  assert(progressCalls.some((c) => /נספח/.test(String(c.detail || ""))), "reports nispah step");
  const lastProg = progressCalls[progressCalls.length - 1];
  assert(lastProg && lastProg.done < lastProg.total, "does not mark complete before the actual download click");

  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
})();
