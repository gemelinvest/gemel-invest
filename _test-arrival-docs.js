/* GI-ARRIVAL-DOCS 20260907-arrival-docs-v1
   מסמך התאמה + התפתחות פרמיה + נספח ה׳ — אחד-לאחד מול המסמכים שנשלחו.
   Run: node _test-arrival-docs.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260907-arrival-docs-v1";
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
assert(app.includes('suitabilityDoc: "suitability_document"'), "hatama type");
assert(app.includes('premiumDevelopment: "premium_development_report"'), "premia type");
assert(app.includes('nispahHarAuth: "nispah_he_har_auth"'), "nispah type");
assert(app.includes("injectArrivalDocs"), "inject helper");
assert(app.includes("downloadArrivalDoc"), "download helper");
assert(app.includes("data-download-arrival-hatama-doc"), "hatama download button");
assert(app.includes("data-download-arrival-premia-doc"), "premia download button");
assert(app.includes("data-download-arrival-nispah-doc"), "nispah download button");
assert(app.includes("GiArrivalDocs.buildDraft"), "preview uses draft");
assert(app.includes("fillNispahPdf"), "nispah PDF fill wired");
assert(app.includes("TYPES.nispahHarAuth) return true") || app.includes("TYPES.nispahHarAuth"), "nispah wants PDF preview");
assert(!modSrc.includes("Hashlama") && !modSrc.includes("גריגורי"), "no Hashlama branding in generator");
assert(fs.existsSync(path.join(ROOT, "forms/har-authorization/nispah-he.pdf")), "official nispah PDF stored");
assert(fs.existsSync(path.join(ROOT, "assets/gi-doc-cover-3d.png")), "GEMEL 3D cover asset");

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
assert(draft.newPolicies.length === 2, "new policies");
assert(draft.existing.some((row) => row.cancelled && row.policy.policyNumber === "22604365"), "cancelled migdal CI");
assert(draft.agent.agency === "GEMEL INVEST", "agency branding");

const hatama = api.renderHatamaHtml(draft);
assert(hatama.includes("מסמך התאמה"), "cover title");
assert(hatama.includes("התאמת הביטוח לצורכי המועמד לביטוח"), "cover subtitle");
assert(hatama.includes("assets/gi-doc-cover-3d.png"), "3D GEMEL cover, not Hashlama folder");
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

console.log("\n5) no invented age table without tariff");
const noEngine = loadModule({});
const draft2 = noEngine.buildDraft(sample);
const premia2 = noEngine.renderPremiaHtml(draft2);
assert(premia2.includes("כיסויים ועלויות חודשיות שנה א"), "year-1 still shown from proposal");
assert(!/גיל בשנים/.test(premia2) || draft2.tables.every((t) => t.coverRows.every((c) => !c.projection?.ok)), "no guessed age rows without engine");

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

  console.log("\n7) inject three docs");
  const list = [];
  api.injectDocs(list, sample, sample.payload, { uploadedBy: "סוכן בדיקה" });
  const types = list.map((d) => d.type);
  assert(types[0] === "suitability_document", "hatama first in documents tab");
  assert(types.indexOf("suitability_document") >= 0, "injects hatama");
  assert(types.indexOf("premium_development_report") >= 0, "injects premia");
  assert(types.indexOf("nispah_he_har_auth") >= 0, "injects nispah");
  const before = list.length;
  api.injectDocs(list, sample, sample.payload, {});
  assert(list.length === before, "does not duplicate");

  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
})();
