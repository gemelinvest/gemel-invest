/* GI-CF-INSUREDS-DOSSIER 2026-08-26
   Customer-file "מבוטחים בתיק" shows personal details from wizard data.
   Display-only: no writes, no wizard/policy logic changes.
   Run: node _test-insureds-tab-personal-dossier.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260906-cancel-forms-v1";
const WIZARD_TAG = "20260906-cancel-forms-v1";
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

function safeTrim(v){ return String(v == null ? "" : v).trim(); }
function escapeHtml(s){
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function extractBlock(src, needle){
  const start = src.indexOf(needle);
  if(start < 0) return "";
  const brace = src.indexOf("{", start);
  if(brace < 0) return "";
  let depth = 0;
  for(let i = brace; i < src.length; i++){
    if(src[i] === "{") depth++;
    else if(src[i] === "}"){
      depth--;
      if(depth === 0) return src.slice(brace, i + 1);
    }
  }
  return "";
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "app.css"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
const wiz = fs.readFileSync(path.join(ROOT, "gi-wizard.js"), "utf8");

const fileStart = app.indexOf("const CustomersUI = {");
const fileEnd = app.indexOf("const ArchiveCustomerUI = {");
assert(fileStart > 0 && fileEnd > fileStart, "CustomersUI block found");
const fileBlock = fileStart > 0 && fileEnd > fileStart ? app.slice(fileStart, fileEnd) : "";

const tabStart = fileBlock.indexOf("/* GI-CF-INSUREDS-DOSSIER 2026-08-26");
const tabEnd = fileBlock.indexOf("renderOpsSection(rec){");
const tabBlock = tabStart >= 0 && tabEnd > tabStart ? fileBlock.slice(tabStart, tabEnd) : "";

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "app.js syntax");
assert(html.includes("app.js?v=" + APP_TAG), "index app.js cache");
assert(html.includes("app.css?v=" + APP_TAG), "index app.css cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");
assert(app.includes('GI_WIZARD_JS_VERSION = "' + WIZARD_TAG + '"'), "wizard version unchanged");
assert(wiz.includes('GI_WIZARD_BUILD = "' + WIZARD_TAG + '"'), "wizard build unchanged");

console.log("\n2) tab is a personal dossier, not policy accordion");
assert(fileBlock.includes("renderInsuredsTab(rec)"), "renderInsuredsTab remains");
assert(fileBlock.includes("tab('personal', 'מבוטחים בתיק'"), "personal tab label remains");
assert(tabBlock.includes("buildInsuredDossierView"), "dossier view builder");
assert(tabBlock.includes("data-cf-ins-pick"), "name click picker");
assert(tabBlock.includes("בחירת מבוטח"), "people rail title");
assert(tabBlock.includes("קופת חולים"), "shows HMO");
assert(tabBlock.includes("עישון"), "shows smoking");
assert(tabBlock.includes("מגורים ויצירת קשר"), "shows address/contact");
assert(!tabBlock.includes("לחצו על שם מלא"), "rail hint text removed");
assert(!tabBlock.includes("תצוגה בלבד"), "sheet note text removed");
assert(!tabBlock.includes("policyCoversInsuredForDisplay"), "tab no longer reads policy coverage");
assert(!tabBlock.includes("getInsuredDisplayPremium"), "tab no longer reads policy premium");
assert(!tabBlock.includes("cfInsuredTab__policy"), "old policy rows removed from tab");
assert(!tabBlock.includes("סה״כ פרמיה למבוטח"), "premium total removed from tab");
assert(!tabBlock.includes("onclick="), "no inline onclick");

console.log("\n3) CSS split layout");
assert(css.includes("GI-CF-INSUREDS-DOSSIER"), "dossier CSS marker");
assert(css.includes(".cfInsDossier{"), "dossier grid");
assert(css.includes("grid-template-columns: 280px minmax(0, 1fr)"), "rail + sheet columns");
assert(css.includes(".cfInsDossier__person.is-on"), "selected person style");
assert(!css.includes(".cfInsuredTab{"), "old accordion CSS removed");

console.log("\n4) system logic untouched");
assert(fileBlock.includes("collectPolicies(rec)"), "collectPolicies remains");
assert(fileBlock.includes("renderMedicalInfo(rec)"), "health tab renderer remains");
assert(fileBlock.includes("policyCoversInsuredForDisplay(policy, insured, idx)"), "policy display helper still exists outside this tab");
assert(wiz.includes("ins.data.smokingStatus = val"), "wizard still writes smokingStatus");
assert(wiz.includes("data-bind=\"occupation\""), "wizard occupation bind remains");
assert(fileBlock.includes("queueFollowupDocumentsSync(rec)"), "followup sync remains");

console.log("\n5) behavioural harness — read-only mapping");
const host = { _insuredsTabSelectedId: "" };
function attach(name, sig){
  const needle = name + sig + "{";
  const block = extractBlock(tabBlock, needle) || extractBlock(fileBlock, needle);
  assert(!!block, "extracted " + name);
  const fn = Function("safeTrim", "escapeHtml", `"use strict"; return function ${name}${sig}${block};`);
  host[name] = fn(safeTrim, escapeHtml);
}
attach("_pickInsuredDisplayValue", "(layers, keys)");
attach("_insuredDossierRole", "(ins, idx)");
attach("_insuredDossierFullName", "(ins)");
attach("buildInsuredDossierView", "(ins, rec, idx)");
attach("_renderDossierFields", "(rows)");
attach("renderInsuredsTab", "(rec)");

const rec = {
  phone: "0509999999",
  email: "file@example.com",
  payload: {
    primary: { clinic: "כללית" },
    insureds: [
      {
        id: "ins_1",
        type: "primary",
        label: "דוד",
        data: {
          firstName: "דוד",
          lastName: "כהן",
          idNumber: "123456789",
          birthDate: "15.03.1985",
          gender: "male",
          maritalStatus: "נשוי/אה",
          occupation: "נהג",
          clinic: "מכבי",
          shaban: "כן",
          smokingStatus: "yes",
          smokingType: "סיגריות",
          smokingAmount: "10",
          city: "חולון",
          street: "הרצל",
          houseNumber: "12",
          zip: "5821000",
          phone: "0501234567",
          email: "david@example.com",
          heightCm: "178",
          weightKg: "82"
        }
      },
      {
        id: "ins_2",
        type: "spouse",
        label: "מיכל",
        data: {
          firstName: "מיכל",
          lastName: "כהן",
          gender: "נקבה",
          smokingStatus: "no",
          clinic: "מאוחדת"
        }
      }
    ],
    newPolicies: [{ company: "מגדל", product: "ריסק", premiumMonthly: "200", insuredId: "ins_1" }]
  }
};

const primaryView = host.buildInsuredDossierView(rec.payload.insureds[0], rec, 0);
assert(primaryView.fullName === "דוד כהן", "primary full name from first+last");
assert(primaryView.role === "מבוטח ראשי", "primary role");
assert(primaryView.clinic === "מכבי", "clinic from insured data, not payload.primary fallback");
assert(primaryView.smoking.indexOf("כן") === 0, "smoking yes");
assert(primaryView.smoking.includes("סיגריות"), "smoking type");
assert(primaryView.smoking.includes("10 ליום"), "smoking amount");
assert(primaryView.fields.identity.find((r) => r[0] === "מין")[1] === "זכר", "maps male → זכר");
assert(primaryView.fields.contact.find((r) => r[0] === "עיר")[1] === "חולון", "city");
assert(primaryView.fields.contact.find((r) => r[0] === "טלפון נייד")[1] === "0501234567", "phone from ins.data");

const spouseView = host.buildInsuredDossierView(rec.payload.insureds[1], rec, 1);
assert(spouseView.fullName === "מיכל כהן", "spouse full name");
assert(spouseView.role === "בת/בן זוג", "spouse role");
assert(spouseView.clinic === "מאוחדת", "spouse clinic");
assert(spouseView.smoking === "לא", "spouse not smoking");
assert(spouseView.fields.contact.find((r) => r[0] === "טלפון נייד")[1] === "", "spouse does not inherit rec.phone");

const recCopy = JSON.parse(JSON.stringify(rec));
host.buildInsuredDossierView(rec.payload.insureds[0], rec, 0);
assert(JSON.stringify(rec) === JSON.stringify(recCopy), "builder does not mutate the customer record");

const html1 = host.renderInsuredsTab(rec);
assert(html1.includes("דוד כהן"), "rail shows primary name");
assert(html1.includes("מיכל כהן"), "rail shows spouse name");
assert(html1.includes("data-cf-ins-pick=\"ins_1\""), "picker uses insured id");
assert(html1.includes("is-on"), "selected person marked");
assert(html1.includes("מכבי"), "selected sheet shows HMO");
assert(html1.includes("הרצל"), "selected sheet shows street");
assert(!html1.includes("ריסק"), "policies are not listed in this tab");
assert(!html1.includes("200"), "premium is not shown in this tab");

host._insuredsTabSelectedId = "ins_2";
const html2 = host.renderInsuredsTab(rec);
assert(html2.includes("מיכל כהן"), "click target still listed");
assert(html2.includes("מאוחדת"), "clicking spouse shows her HMO");
assert(!html2.includes("הרצל"), "spouse sheet does not show primary street");
assert(JSON.stringify(rec) === JSON.stringify(recCopy), "selection does not mutate the customer record");

const emptyHtml = host.renderInsuredsTab({ payload: { insureds: [] } });
assert(emptyHtml.includes("אין מבוטחים בתיק"), "empty state remains");

console.log("\n-----");
console.log("passed=" + passed + " failed=" + failed);
process.exit(failed ? 1 : 0);
