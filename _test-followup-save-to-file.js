/* שמירת שאלון המשך נכתבת לתיק בכל חברה, ולא נמחקת בסנכרון הבא.
   הרצה: node _test-followup-save-to-file.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
let failed = 0;
let passed = 0;
function assert(c, m){
  if(c){ passed++; console.log("  PASS  " + m); }
  else { failed++; console.error("  FAIL  " + m); }
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");

const upsertStart = app.indexOf("_mcUpsertFilledFormDoc(rec, type, dataUrl, fileName, name, idSuffix){");
const upsertEnd = app.indexOf("_mcEnsureJoinFormEdits(rec){", upsertStart);
const findStart = app.indexOf("_mcCustomerDocsList(rec){");
const findEnd = app.indexOf("_mcListSummaryFilledForms(rec){", findStart);
const createStart = app.indexOf("createFollowupQuestionnaireDoc(entry, options = {}){");
const syncEnd = app.indexOf("createFollowupQuestionnairesZipDoc(meta, options = {}){", createStart);
assert(upsertStart > 0 && upsertEnd > upsertStart, "upsert נמצא");
assert(findStart > 0 && findEnd > findStart, "איתור מסמך נמצא");
assert(createStart > 0 && syncEnd > createStart, "סנכרון שאלוני המשך נמצא");

const sandbox = { console };
vm.runInNewContext(`
  function safeTrim(v){ return String(v == null ? "" : v).trim(); }
  function nowISO(){ return "2026-09-30T12:00:00.000Z"; }
  const Auth = { current: { name: "סוכן" } };
  function stableDocId(entry){
    const co = safeTrim(entry && entry.companyKey) || "co";
    const ins = safeTrim(entry && entry.insuredId) || "ins";
    const q = safeTrim(entry && entry.questionnaireNum) || "q";
    return "doc_followup_" + co + "__" + ins + "__" + encodeURIComponent(q);
  }
  const window = {
    GiFollowupZip: {
      stableDocId,
      buildDocTitle(entry){
        return "שאלון " + safeTrim(entry && entry.questionnaireNum) + " · " + safeTrim(entry && entry.company);
      },
      roleSuffix(){ return "primary"; }
    }
  };
  const CustomerDocuments = {
    TYPES: {
      followupQuestionnaire: "followup_questionnaire",
      followupQuestionnairesZip: "followup_questionnaires_zip"
    },
    listFromPayload(payload){
      return Array.isArray(payload && payload.customerDocuments)
        ? payload.customerDocuments.filter((doc) => doc && typeof doc === "object")
        : [];
    },
    newDocId(prefix){ return prefix + "generated"; },
    getPrimaryInsuredLabel(){ return "מבוטח"; },
    sanitizeFileNamePart(value){
      return safeTrim(value).replace(/[\\\\/:*?"<>|]+/g, " ").replace(/\\s+/g, " ").trim();
    },
    ${app.slice(createStart, syncEnd)}
  };
  const ui = {
    _mcCanonicalJoinDocId(type){
      return "doc_" + String(type || "").replace(/[^a-z0-9_:-]+/gi, "_");
    },
    ${app.slice(upsertStart, upsertEnd)}
    ${app.slice(findStart, findEnd)}
  };
  this.CustomerDocuments = CustomerDocuments;
  this.ui = ui;
  this.stableDocId = stableDocId;
`, sandbox);

const companies = [
  ["phoenix", "הפניקס", "2"],
  ["menora", "מנורה", "4"],
  ["ayalon", "איילון", "11"],
  ["hachshara", "הכשרה", "א"],
  ["migdal", "מגדל", "18"],
  ["clal", "כלל", "טז"]
];

console.log("1) שמירה ראשונה בלי מסמך קודם — נכתב לתיק");
companies.forEach((row) => {
  const companyKey = row[0];
  const company = row[1];
  const q = row[2];
  const entry = { companyKey, company, questionnaireNum: q, insuredId: "ins1", insured: { id: "ins1", type: "primary" } };
  const id = sandbox.stableDocId(entry);
  const rec = { payload: { customerDocuments: [{ id: "doc_other", type: "health_ops", name: "דוח" }] } };
  const dataUrl = "data:application/pdf;base64," + companyKey + "-pdf";
  sandbox.ui._mcUpsertFilledFormDoc(rec, "followup_questionnaire", dataUrl, "שאלון.pdf", "שאלון " + q + " · " + company, id);
  const doc = sandbox.ui._mcFindSummaryFormDoc(rec, "followup_questionnaire", id);
  if(doc) doc.mirrorAgentSaved = true;
  const list = rec.payload.customerDocuments;
  assert(!!doc, company + " המסמך נמצא אחרי שמירה");
  assert(doc && doc.dataUrl === dataUrl, company + " ה-PDF נשמר על המסמך");
  assert(doc && doc.mirrorAgentSaved === true, company + " השמירה מסומנת בתיק");
  assert(list.filter((d) => d && d.type === "followup_questionnaire").length === 1, company + " שאלון אחד, בלי כפילות");
  assert(list.some((d) => d && d.id === "doc_other"), company + " מסמכים אחרים נשארים");

  sandbox.CustomerDocuments.syncFollowupQuestionnaireDocs(rec.payload, [entry]);
  const after = sandbox.ui._mcFindSummaryFormDoc(rec, "followup_questionnaire", id);
  assert(after && after.dataUrl === dataUrl, company + " סנכרון לא מוחק את הקובץ שנשמר");
  assert(after && after.mirrorAgentSaved === true, company + " סנכרון לא מוריד את סימון השמירה");
  assert(rec.payload.customerDocuments.some((d) => d && d.id === "doc_other"), company + " סנכרון לא מוחק מסמך אחר");
});

console.log("\n2) שמירה שנייה מעדכנת את אותו מסמך");
const phoenix = { companyKey: "phoenix", company: "הפניקס", questionnaireNum: "2", insuredId: "ins1", insured: { id: "ins1", type: "primary" } };
const phoenixId = sandbox.stableDocId(phoenix);
const rec2 = { payload: { customerDocuments: [] } };
sandbox.ui._mcUpsertFilledFormDoc(rec2, "followup_questionnaire", "data:application/pdf;base64,one", "a.pdf", "שאלון", phoenixId);
sandbox.ui._mcUpsertFilledFormDoc(rec2, "followup_questionnaire", "data:application/pdf;base64,two", "a.pdf", "שאלון", phoenixId);
const phoenixDocs = rec2.payload.customerDocuments.filter((d) => d.type === "followup_questionnaire");
assert(phoenixDocs.length === 1, "שתי שמירות = מסמך אחד");
assert(phoenixDocs[0] && phoenixDocs[0].dataUrl === "data:application/pdf;base64,two", "השמירה השנייה מחליפה את הקובץ");

console.log("\n3) טופס הצטרפות עדיין נכתב, ושאלון שמור שלא ברשימה לא נמחק");
const joinRec = { payload: { customerDocuments: [] } };
sandbox.ui._mcUpsertFilledFormDoc(joinRec, "phoenix_health", "data:application/pdf;base64,join", "join.pdf", "הצטרפות");
assert(joinRec.payload.customerDocuments.length === 1, "טופס הצטרפות חדש נכתב");
const orphanId = sandbox.stableDocId({ companyKey: "clal", insuredId: "ins9", questionnaireNum: "1" });
const orphanRec = { payload: { customerDocuments: [{
  id: orphanId,
  type: "followup_questionnaire",
  name: "שאלון שמור",
  dataUrl: "data:application/pdf;base64,kept",
  mirrorAgentSaved: true
}] } };
sandbox.CustomerDocuments.syncFollowupQuestionnaireDocs(orphanRec.payload, [phoenix]);
const orphan = sandbox.ui._mcFindSummaryFormDoc(orphanRec, "followup_questionnaire", orphanId);
assert(orphan && orphan.dataUrl === "data:application/pdf;base64,kept", "שאלון שכבר נשמר נשאר גם אם אינו בגל הסנכרון");

console.log(failed ? "\nFAILED " + failed : "\nOK " + passed);
process.exit(failed ? 1 : 0);
