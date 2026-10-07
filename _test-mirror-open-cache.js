/* פתיחה בשיקוף משתמשת ב-PDF שכבר נבנה, ולא בונה מחדש רק כי חותמת הזמן השתנתה.
   הרצה: node _test-mirror-open-cache.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const app = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
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

function extractMethod(src, name){
  const needles = ["\n    async " + name + "(", "\n    " + name + "("];
  let start = -1;
  for(let i = 0; i < needles.length; i++){
    start = src.indexOf(needles[i]);
    if(start >= 0) break;
  }
  if(start < 0) return "";
  const brace = src.indexOf("{", start);
  let depth = 0;
  for(let i = brace; i < src.length; i++){
    if(src[i] === "{") depth += 1;
    else if(src[i] === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, i + 1);
    }
  }
  return "";
}

const key = extractMethod(app, "_mcHatamaCacheKey");
const bind = extractMethod(app, "_mcBindSummaryFilledForms");
const openHold = bind.indexOf('giOpsHoldNote(true, act === "download"');
assert(key && !key.includes("updatedAt"), "חותמת שמירה ברקע לא מבטלת PDF שכבר נבנה");
assert(bind.includes("_mcInstantSummaryPdf") && openHold > bind.indexOf("_mcInstantSummaryPdf"), "פתיחה של קובץ שמור לא מחכה למסך ההכנה");
assert(html.includes("app.js?v=20261007-lead-dup-v1&giSign=29"), "app.js נטען מחדש");

let builds = 0;
const sandbox = {
  Uint8Array,
  Promise,
  Object,
  Array,
  setTimeout,
  Error,
  String,
  Boolean,
  Number,
  window: {
    GiArrivalDocs: {
      buildDraft(row){ return { id: row.id }; },
      async hatamaSignPdf(){
        builds += 1;
        return { bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]), cells: [{ slot: "self", page: 0 }] };
      }
    }
  },
  ensureGiArrivalDocsLoaded(){ return Promise.resolve(); },
  safeTrim(v){ return String(v == null ? "" : v).trim(); }
};
const ui = vm.runInNewContext(`
  const ui = {
    _mcHatamaCache: null,
    _mcHatamaJob: null,
    _mcArrivalKindCache: null,
    _mcArrivalKindJobs: null,
    ${extractMethod(app, "_mcCopyPdfBytes")},
    ${extractMethod(app, "_mcHatamaCacheKey")},
    ${extractMethod(app, "_mcCopyHatamaCells")},
    ${extractMethod(app, "_mcHatamaCached")},
    ${extractMethod(app, "_mcArrivalKindCached")},
    ${extractMethod(app, "_mcPutArrivalKindCache")},
    ${extractMethod(app, "_mcPrefetchHatamaSign")},
    ${extractMethod(app, "_mcPrefetchArrivalSign")},
    ${extractMethod(app, "_mcInstantSummaryPdf")}
  };
  ui
`, sandbox);

const rec = {
  id: "c1",
  updatedAt: "2026-10-04T08:00:00.000Z",
  payload: {
    primary: { fullName: "אבראהים ספא", idNumber: "123" },
    operational: { newPolicies: [{ id: "p1", company: "מגדל", premium: "100" }] },
    insureds: [{}]
  }
};

ui._mcPrefetchHatamaSign(rec).then((made) => {
  assert(builds === 1 && made.bytes[0] === 0x25, "הבנייה הראשונה שומרת PDF");
  rec.updatedAt = "2026-10-04T09:00:00.000Z";
  const instant = ui._mcInstantSummaryPdf(rec, { kind: "hatama", name: "מסמך התאמה" });
  assert(instant && instant[0] === 0x25 && builds === 1, "פתיחה אחרי שמירת רקע לא בונה שוב");
  rec.payload.primary.fullName = "שם אחר";
  const stale = ui._mcInstantSummaryPdf(rec, { kind: "hatama" });
  assert(!stale, "שינוי בפרטי המסמך לא פותח את העותק הישן");
  console.log(failed ? ("FAILED " + failed) : ("OK " + passed));
  process.exit(failed ? 1 : 0);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
