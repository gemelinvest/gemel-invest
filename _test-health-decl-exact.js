/* GI-HEALTH-DECL-EXACT
   A yes marks only its own PDF row, a follow-up opens its own topic,
   and a person who is not on the policy is left off that document.
   This file only reads source and builds drafts in memory.
   Run: node _test-health-decl-exact.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

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

function loadHelper(){
  const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
  const start = app.indexOf("const GI_OFFICIAL_FORM_FILL = {");
  const end = app.indexOf("try { window.GI_OFFICIAL_FORM_FILL = GI_OFFICIAL_FORM_FILL; }", start);
  assert(start > 0 && end > start, "GI_OFFICIAL_FORM_FILL block found");
  const ctx = { window: {}, console };
  vm.runInNewContext(app.slice(start, end) + "\nthis.GI_OFFICIAL_FORM_FILL = GI_OFFICIAL_FORM_FILL;", ctx);
  return ctx.GI_OFFICIAL_FORM_FILL;
}

function loadForm(file, globalName, helper){
  const src = fs.readFileSync(path.join(ROOT, file), "utf8");
  const sandbox = { window: { GI_OFFICIAL_FORM_FILL: helper }, console };
  sandbox.globalThis = sandbox.window;
  vm.runInNewContext(src, sandbox, { filename: file });
  return sandbox.window[globalName];
}

function lineOf(src, key){
  const at = src.indexOf(key);
  if(at < 0) return "";
  const nl = src.indexOf("\n", at);
  return src.slice(at, nl < 0 ? src.length : nl);
}

const wiz = fs.readFileSync(path.join(ROOT, "gi-wizard.js"), "utf8");
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");

console.log("1) follow-up topic matches the question");
{
  const healthStart = wiz.indexOf("getMagdalHealthSchema(){");
  const healthEnd = wiz.indexOf("buildMagdalFollowupFields(nos", healthStart);
  const healthFn = wiz.slice(healthStart, healthEnd);
  assert(healthFn.includes("return this.buildMagdalFollowupFields(nums, extra)"), "Migdal health numbered questions use the official follow-up map");
  assert(healthFn.includes("this.getMagdalQuestionnaireMap()"), "Migdal health labels use the official map");
  assert(!healthFn.includes("questionnaireFields[String(num)]"), "Migdal health no longer reads the private catalog");
  assert(wiz.includes("title:'נכות / גמלה'"), "official Migdal 23 is disability");
  assert(wiz.includes("title:'מחלות נפש / הפרעות נפשיות'"), "official Migdal 13 is mental health");
  assert(lineOf(wiz, "q('magdal_full__disability'").includes("['23']"), "disability question cites 23");
  assert(lineOf(wiz, "q('magdal_full__mental'").includes("['13']"), "mental question cites 13");

  const smoking = lineOf(wiz, "key:'menora__smoking'");
  assert(smoking.includes("f([],") && !smoking.includes("f(['2']"), "Menora health smoking does not open the drugs questionnaire");
  assert(lineOf(wiz, "key:'menora_crit__smoking'").includes("f([],"), "Menora critical smoking does not open the drugs questionnaire");
  assert(lineOf(wiz, "key:`${keyPrefix}__smoking`").includes("f([],"), "Menora cancer smoking does not open the drugs questionnaire");
  assert(lineOf(wiz, "key:'menora__drugs'").includes("f(['2']"), "Menora drugs question still opens questionnaire 2");

  assert(lineOf(wiz, "key:'ayalon_risk__joints'").includes("f(['21'])") && !lineOf(wiz, "key:'ayalon_risk__joints'").includes("f(['21','1'])"), "Ayalon risk joints open rheumatology only");
  assert(lineOf(wiz, "key:'ayalon_mort__joints'").includes("f(['21'])") && !lineOf(wiz, "key:'ayalon_mort__joints'").includes("f(['21','1'])"), "Ayalon mortgage joints open rheumatology only");
  const b11 = lineOf(wiz, "key:'hachshara_risk_f__b11'");
  assert(b11.includes("f(['18','19','24'])") && !b11.includes("'17'"), "Hachshara arthritis does not open the lungs questionnaire");
  assert(lineOf(wiz, "key:'hachshara__respiratory'").includes("f(['17'])"), "Hachshara lungs question still opens questionnaire 17");
}

console.log("\n2) each PDF row is filled only by its own question");
{
  const mgq = lineOf(app, '{ field: "MGQ19"');
  assert(mgq.includes("magdal_riskx__endocrine") && mgq.includes("magdal_full__endocrine"), "MGQ19 stays the endocrine row");
  assert(!mgq.includes("magdal_risk2m__diabetes"), "short diabetes does not mark the endocrine row");
  const healthSchema = wiz.slice(wiz.indexOf("getHachsharaHealthSchema(){"), wiz.indexOf("getHachsharaHealthSchema(){") + 2200);
  assert(healthSchema.indexOf("hachshara__smoking") >= 0 && healthSchema.indexOf("hachshara__smoking") < healthSchema.indexOf("hachshara__hospitalization"), "Hachshara health asks smoking before hospitalization");
  assert(wiz.includes("פירוט שנשמר קודם"), "saved follow-up text from an older field key stays visible");
  assert(wiz.includes("menora_mort__smoking") && wiz.includes("keepFull"), "Menora mortgage keeps the printed rows unless older answers exist");

  const H = loadHelper();
  const cap = {};
  H.applyMappedHealthYesNo({ __giCapture: cap }, {
    map: "migdal_life",
    primaryId: "p1",
    responses: {
      magdal_full__heart: { p1: { answer: "yes" } },
      magdal_full__endocrine: { p1: { answer: "no" } },
      magdal_risk2m__diabetes: { p1: { answer: "yes" } }
    }
  });
  assert(cap.MGQ16 === "1", "heart yes marks MGQ16");
  assert(cap.MGQ19 === "2", "endocrine no marks MGQ19 and short diabetes does not flip it");
  assert(cap.MGQ10 == null && cap.MGQ12 == null, "heart yes does not mark a different row");
  const diabetesOnly = {};
  H.applyMappedHealthYesNo({ __giCapture: diabetesOnly }, {
    map: "migdal_life",
    primaryId: "p1",
    responses: { magdal_risk2m__diabetes: { p1: { answer: "yes" } } }
  });
  assert(diabetesOnly.MGQ19 == null, "short diabetes alone does not mark MGQ19");
}

console.log("\n3) a document includes only the insured on that policy");
{
  const H = loadHelper();
  const primary = { id: "p1", type: "primary" };
  const spouse = { id: "s1", type: "spouse" };
  const child = { id: "c1", type: "child" };
  const onlyPrimary = H.limitInsuredsToPolicies([{ insuredIds: ["p1"] }], primary, spouse, [child]);
  assert(onlyPrimary.primary && onlyPrimary.primary.id === "p1", "covered primary stays");
  assert(onlyPrimary.spouse == null && onlyPrimary.children.length === 0, "spouse and child not on the policy are left off");
  const onlySpouse = H.limitInsuredsToPolicies([{ insuredId: "s1" }], primary, spouse, [child]);
  assert(onlySpouse.primary && onlySpouse.primary.id === "s1" && onlySpouse.spouse == null, "a spouse-only policy becomes that document's insured");
  const both = H.limitInsuredsToPolicies([{ insuredIds: ["p1", "s1"] }], primary, spouse, [child]);
  assert(both.primary.id === "p1" && both.spouse.id === "s1" && both.children.length === 0, "both insureds on the policy stay, in order");
  const legacy = H.limitInsuredsToPolicies([{}], primary, spouse, [child]);
  assert(legacy.spouse && legacy.spouse.id === "s1" && legacy.children.length === 1, "a policy without stored ids keeps the current insured list");

  const Form = loadForm("gi-migdal-life-form.js", "MigdalLifeForm", H);
  const payload = {
    primary: { firstName: "דוד", lastName: "כהן", idNumber: "123456789" },
    insureds: [
      { id: "p1", type: "primary", label: "מבוטח ראשי", data: { firstName: "דוד", lastName: "כהן", idNumber: "123456789" } },
      { id: "s1", type: "spouse", label: "בת זוג", data: { firstName: "מיכל", lastName: "כהן", idNumber: "987654321" } }
    ],
    newPolicies: [{ company: "מגדל", type: "ריסק", sumInsured: "500000", insuredIds: ["p1"] }]
  };
  const draft = Form.buildDraft({ id: "cust_exact", payload });
  assert(draft.primary && draft.primary.firstName === "דוד", "risk form keeps the insured on the policy");
  assert(!draft.spouse && !draft.spouseId, "risk form does not include the other customer");
  const open = Form.buildDraft({
    id: "cust_exact",
    payload: Object.assign({}, payload, {
      newPolicies: [{ company: "מגדל", type: "ריסק", sumInsured: "500000" }]
    })
  });
  assert(open.spouse && open.spouse.firstName === "מיכל", "a risk form without insured ids still includes the spouse");
}

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
