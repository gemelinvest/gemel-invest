/* GI-OPS 2026-10-12 — PDF שנשמר בלחיצת שמירה בשלב הצהרת בריאות
   לא נדרס בסוף השיחה / דוח תיקוני הצעה, גם אם הנתונים בתיק השתנו.
   הרצה: node _test-ops-keep-agent-saved-pdf.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20261007-lead-dup-v1";
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

function read(name){
  return fs.readFileSync(path.join(ROOT, name), "utf8");
}

function extractMethod(src, name){
  let start = src.indexOf("    async " + name + "(");
  if(start < 0) start = src.indexOf("    " + name + "(");
  if(start < 0) return "";
  let i = src.indexOf("{", start);
  let depth = 0;
  for(; i < src.length; i++){
    if(src[i] === "{") depth += 1;
    else if(src[i] === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, i + 1);
    }
  }
  return "";
}

const app = read("app.js");
const html = read("index.html");
const sw = read("service-worker.js");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("&giHealthKeep=1"), "index.html app.js נטען מחדש אחרי תיקון שמירת הנציג");
assert(sw.includes("health-keep-v1"), "service-worker cache לשמירת PDF הנציג");
assert(extractMethod(app, "_mcMountOriginalForm").includes("giHealthKeep=1"), "צופה הטופס נטען מחדש");

console.log("\n2) שמירת נציג גוברת על מילוי אוטומטי ועל קאש");
const keepFn = extractMethod(app, "_mcShouldKeepAgentSavedPdf");
const matFn = extractMethod(app, "_mcMaterializeEditedForms");
const hydrateFn = extractMethod(app, "_mcHydrateFilledFormsFromCache");
const writeFn = extractMethod(app, "_mcWriteAgentSavedPdf");
const upsertFn = extractMethod(app, "_mcUpsertFilledFormDoc");
const openJoin = extractMethod(app, "_mcOpenJoinFormFromRail");
const openFollow = extractMethod(app, "_mcOpenFollowupFromRail");
const instant = extractMethod(app, "_mcInstantSummaryPdf");
const buildFn = extractMethod(app, "_mcBuildSummaryFormBytes");
const joinSign = extractMethod(app, "_mcOriginalJoinSignBytes");
const followSign = extractMethod(app, "_mcOriginalFollowupSignBytes");
assert(keepFn.includes("mirrorAgentSaved !== true"), "שמירת נציג מזוהה לפי הסימון בתיק");
assert(keepFn.includes('dataUrl.indexOf("data:") === 0'), "בלי קובץ שמור אין נעילה");
assert(matFn.includes("if(this._mcShouldKeepAgentSavedPdf(savedJoin)) return"), "סיום שיחה לא דורס טופס הצעה ששמר הנציג");
assert(matFn.includes("if(this._mcShouldKeepAgentSavedPdf(savedFollow)) return"), "סיום שיחה לא דורס שאלון ששמר הנציג");
assert(!matFn.includes("_mcSavedFillKeyMatches"), "שינוי בתיק אחרי שמירה לא פותח מילוי מחדש");
assert(hydrateFn.includes("if(this._mcShouldKeepAgentSavedPdf(saved)) return"), "קאש לא דורס טופס ששמר הנציג");
assert(hydrateFn.includes("if(this._mcShouldKeepAgentSavedPdf(savedFollow)) return"), "קאש לא דורס שאלון ששמר הנציג");
assert(writeFn.includes("_mcWritingAgentSavedPdf = true"), "לחיצת שמירה מורשית לדרוס את הקובץ של עצמה");
assert(writeFn.includes("_mcStoreFormBytes"), "לחיצת שמירה מעדכנת גם את הקאש");
assert(upsertFn.includes("keepAgent"), "מילוי אוטומטי לא מחליף dataUrl של שמירת נציג");

function orderOk(src, savedNeedle, cacheNeedle, msg){
  const savedAt = src.indexOf(savedNeedle);
  const cacheAt = src.indexOf(cacheNeedle);
  assert(savedAt >= 0 && cacheAt > savedAt, msg);
}

orderOk(openJoin, "_mcAgentSavedPdfBytes(rec, type)", "_mcCachedFormBytes(type, joinKey)", "פתיחה מהמסילה קוראת קודם את PDF הנציג ולא את הקאש");
orderOk(instant, "_mcAgentSavedPdfBytes(rec, type)", "_mcCachedFormBytes(type, joinKey)", "פתיחה מדוח התיקונים קוראת קודם את PDF הנציג");
orderOk(buildFn, "_mcAgentSavedPdfBytes(rec, type)", "_mcCachedFormBytes(type, this._mcJoinCacheKey", "בניית PDF לדוח לא מחזירה קאש ישן במקום שמירת הנציג");
orderOk(joinSign, "_mcAgentSavedPdfBytes(rec, type)", "_mcCachedFormBytes(type, joinKey)", "שליחה לחתימה קוראת קודם את PDF הנציג");
assert(openFollow.indexOf("_mcAgentSavedPdfBytes") >= 0 && openFollow.indexOf("_mcAgentSavedPdfBytes") < openFollow.indexOf("if(cachedFollow)"), "שאלון שמור נפתח לפני הקאש");
assert(!openFollow.includes("&& !hasAnswers"), "תשובות בהצהרה לא זורקות שמירת שאלון");
assert(followSign.indexOf("if(saved && saved.length)") < followSign.indexOf("fillFollowupPdf"), "שאלון שמור נשלח כמו שהוא");

console.log("\n3) מילוי אוטומטי לא מחליף PDF שנשמר בלחיצה");
const upsertStart = app.indexOf("_mcUpsertFilledFormDoc(rec, type, dataUrl, fileName, name, idSuffix, fillKey){");
const upsertEnd = app.indexOf("_mcEnsureJoinFormEdits(rec){", upsertStart);
assert(upsertStart > 0 && upsertEnd > upsertStart, "upsert נמצא לבדיקת התנהגות");
const sandbox = { console };
vm.runInNewContext(`
  function safeTrim(v){ return String(v == null ? "" : v).trim(); }
  function nowISO(){ return "2026-10-12T12:00:00.000Z"; }
  const Auth = { current: { name: "סוכן" } };
  const ui = {
    _mcCanonicalJoinDocId(type){
      return "doc_" + String(type || "").replace(/[^a-z0-9_:-]+/gi, "_");
    },
    _mcJoinCacheKey(){ return "join:later-rec"; },
    ${app.slice(upsertStart, upsertEnd)}
  };
  this.ui = ui;
`, sandbox);

const rec = { payload: { customerDocuments: [] } };
sandbox.ui._mcWritingAgentSavedPdf = true;
sandbox.ui._mcUpsertFilledFormDoc(rec, "migdal_life_form", "data:application/pdf;base64,AGENTMARKS", "migdal_life_form.pdf", "טופס מקורי — ריסק חיים · מגדל");
sandbox.ui._mcWritingAgentSavedPdf = false;
rec.payload.customerDocuments[0].mirrorAgentSaved = true;
sandbox.ui._mcUpsertFilledFormDoc(rec, "migdal_life_form", "data:application/pdf;base64,TEMPLATEFILL", "migdal_life_form.pdf", "טופס מקורי — ריסק חיים · מגדל", undefined, "join:later-rec");
const kept = rec.payload.customerDocuments[0];
assert(kept && kept.dataUrl === "data:application/pdf;base64,AGENTMARKS", "מילוי מחדש בסוף השיחה לא מוחק סימוני נציג");
assert(kept && kept.mirrorAgentSaved === true, "סימון השמירה נשאר על המסמך");
assert(rec.payload.customerDocuments.length === 1, "אין כפילות אחרי ניסיון דריסה");

sandbox.ui._mcWritingAgentSavedPdf = true;
sandbox.ui._mcUpsertFilledFormDoc(rec, "migdal_life_form", "data:application/pdf;base64,AGENTMARKS2", "migdal_life_form.pdf", "טופס מקורי — ריסק חיים · מגדל");
sandbox.ui._mcWritingAgentSavedPdf = false;
const rewritten = rec.payload.customerDocuments[0];
assert(rewritten && rewritten.dataUrl === "data:application/pdf;base64,AGENTMARKS2", "לחיצת שמירה חדשה כן מחליפה את הקובץ");

console.log("\n4) דוח תיקוני הצעה מציג שמירת נציג");
assert(app.includes("סימוני הנציג בטופס"), "הדוח מציג שורה על סימונים שנשמרו בטופס");
assert(app.includes("נשמרו בלחיצת שמירה"), "השורה בדוח מציינת שמירה ידנית");
assert(app.includes("doc?.mirrorAgentSaved !== true"), "השורה נשענת על המסמך שנשמר בתיק");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
