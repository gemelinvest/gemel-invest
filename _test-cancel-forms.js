/* GI-CANCEL-FORMS 2026-09-06
   Original company cancellation forms in customer documents for full/partial cancel.
   Health & life only. Fills completed customer-file fields on the original PDF.
   Run: node _test-cancel-forms.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260906-cancel-forms-v3";
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

function loadModule(){
  const src = fs.readFileSync(path.join(ROOT, "gi-cancel-forms.js"), "utf8");
  const sandbox = {
    console,
    location: { href: "https://example.com/app", pathname: "/" }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(src, sandbox, { filename: "gi-cancel-forms.js" });
  return sandbox.GiCancelForms;
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
const form = fs.readFileSync(path.join(ROOT, "gi-cancel-forms.js"), "utf8");
const G = loadModule();

console.log("1) syntax + files");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-cancel-forms.js")]).status === 0, "node --check gi-cancel-forms.js");
[
  "migdal-cancel.pdf",
  "phoenix-health-cancel.pdf",
  "phoenix-cancel.pdf",
  "hachshara-cancel.pdf",
  "ayalon-cancel.pdf",
  "ayalon-life-cancel.pdf",
  "clal-cancel.pdf",
  "clal-life-couple-cancel.pdf",
  "harel-health-cancel.pdf",
  "harel-life-cancel.pdf",
  "menora-cancel.pdf",
  "menora-mortgage-cancel.pdf"
].forEach((file) => {
  const p = path.join(ROOT, "forms", "cancel", file);
  assert(fs.existsSync(p) && fs.statSync(p).size > 10000, "original PDF exists: " + file);
});

console.log("\n2) cache + wiring");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache");
assert(sw.includes("gi-v12-" + TAG), "service worker cache");
assert(app.includes('GI_CANCEL_FORMS_HREF = "./gi-cancel-forms.js?v=' + TAG + '"'), "cancel forms chunk href");
assert(app.includes("ensureGiCancelFormsLoaded"), "lazy loader exists");
assert(app.includes('companyCancelForm: "company_cancel_form"'), "document type registered");
assert(app.includes("groupCancelledPolicies"), "groups cancelled policies by insured+template");
assert(app.includes("injectDocs") || app.includes("injectCancelFormDocs"), "injects cancel docs into customer file");
assert(app.includes("persistCancelFormCleanup"), "persists cleanup of duplicate cancel forms");
assert(app.includes("listCancelledExistingPolicies"), "lists cancelled existing policies");
assert(app.includes("data-open-cancel-form-doc"), "documents tab has open button");
assert(app.includes("openCompanyCancelForm"), "customer file opens the cancel form");
assert(app.includes("טופס ביטול מקורי"), "document title is live");
assert(!form.includes("ביטול דירה"), "does not use elementary home cancel forms");
assert(!form.includes("שלמה"), "does not map Shlomo elementary form");

console.log("\n3) company + product routing");
assert(G.pickTemplateId({ company: "כלל", type: "ריסק" }) === "clal", "Clal risk → כלל cancel form");
assert(G.pickTemplateId({ company: "כלל", type: "ריסק", insuredMode: "couple" }) === "clal_couple", "Clal couple risk → couple cancel form");
assert(G.pickTemplateId({ company: "כלל", type: "בריאות" }) === "clal", "Clal health → כלל cancel form");
assert(G.pickTemplateId({ company: "הראל", type: "בריאות" }) === "harel_health", "Harel health form");
assert(G.pickTemplateId({ company: "הראל", type: "ריסק" }) === "harel_life", "Harel life form");
assert(G.pickTemplateId({ company: "איילון", type: "ריסק" }) === "ayalon_life", "Ayalon life form");
assert(G.pickTemplateId({ company: "איילון", type: "בריאות" }) === "ayalon", "Ayalon health form");
assert(G.pickTemplateId({ company: "הפניקס", type: "בריאות" }) === "phoenix_health", "Phoenix family health form");
assert(G.pickTemplateId({ company: "הפניקס", type: "ריסק" }) === "phoenix", "Phoenix life/risk form");
assert(G.pickTemplateId({ company: "הכשרה", type: "בריאות" }) === "hachshara", "Hachshara form");
assert(G.pickTemplateId({ company: "מגדל", type: "ריסק" }) === "migdal", "Migdal form");
assert(G.pickTemplateId({ company: "מנורה", type: "בריאות" }) === "menora", "Menora health/life form");
assert(G.pickTemplateId({ company: "מנורה", type: "ריסק משכנתא" }) === "menora_mortgage", "Menora mortgage life form");
assert(G.pickTemplateId({ company: "שלמה", type: "רכב" }) === "", "elementary Shlomo has no health/life template");
assert(G.canonicalCompany("כלל חברה לביטוח") === "כלל", "canonical Clal");
assert(G.canonicalCompany("הפניקס ביטוח") === "הפניקס", "canonical Phoenix");

console.log("\n4) inject only full / partial cancel, fill policy number");
const payload = {
  insureds: [{
    id: "ins1",
    label: "ישראל ישראלי",
    data: {
      firstName: "ישראל",
      lastName: "ישראלי",
      idNumber: "123456782",
      phone: "0501234567",
      email: "israel@example.com",
      city: "תל אביב",
      street: "דיזנגוף",
      houseNumber: "50",
      zip: "6433201",
      existingPolicies: [
        { id: "pol_full", company: "כלל", type: "ריסק", policyNumber: "123456789" },
        { id: "pol_part", company: "הראל", type: "בריאות", policyNumber: "555111" },
        { id: "pol_keep", company: "מגדל", type: "ריסק", policyNumber: "999" },
        { id: "pol_car", company: "שלמה", type: "רכב", policyNumber: "CAR-1" }
      ],
      cancellations: {
        pol_full: { status: "full" },
        pol_part: { status: "partial_health" },
        pol_keep: { status: "nochange_client" },
        pol_car: { status: "full" }
      }
    }
  }]
};
const listed = G.listCancelledPolicies(payload);
assert(listed.length === 2, "only full + partial health/life policies (got " + listed.length + ")");
assert(listed.some((row) => row.policyNumber === "123456789" && row.templateId === "clal"), "Clal full cancel listed");
assert(listed.some((row) => row.policyNumber === "555111" && row.templateId === "harel_health"), "Harel partial cancel listed");
assert(!listed.some((row) => row.policyNumber === "999"), "no-change policy is not listed");
assert(!listed.some((row) => row.policyNumber === "CAR-1"), "elementary cancel is not listed");

const clalDoc = G.createDoc(listed.find((row) => row.policyNumber === "123456789"));
assert(clalDoc.type === "company_cancel_form", "created doc type");
assert(clalDoc.id === "doc_cancel_ins1_clal", "stable grouped doc id uses template");
assert(/טופס ביטול מקורי/.test(clalDoc.name) && /כלל/.test(clalDoc.name), "doc title has company");
assert(clalDoc.policyNumber === "123456789", "doc stores policy number");

const draft = G.buildDraft({ payload }, clalDoc);
assert(draft.policyNumber === "123456789", "draft has policy number");
assert(draft.person.fullName === "ישראל ישראלי", "draft picks person name");
assert(draft.person.idNumber === "123456782", "draft picks person id");
const plan = G.overlayPlan(draft);
const texts = plan.map((op) => op.text);
assert(texts.includes("123456789"), "overlay fills policy number");
assert(texts.includes("ישראל ישראלי"), "overlay fills full name");
assert(texts.includes("123456782"), "overlay fills id number");
assert(texts.includes("israel@example.com"), "overlay fills email when present");
assert(plan.every((op) => op.x > 0 && op.y > 0 && op.maxW > 0), "every overlay sits in a cell");
assert(plan.some((op) => op.key === "policyNumber" && op.y > 400), "full cancel policy number uses the full-cancel table");

const emptyPayload = {
  insureds: [{
    id: "ins1",
    data: {
      existingPolicies: [{ id: "pol_full", company: "כלל", type: "ריסק", policyNumber: "123456789" }],
      cancellations: { pol_full: { status: "full" } }
    }
  }]
};
const emptyDraft = G.buildDraft({ payload: emptyPayload }, G.createDoc(G.listCancelledPolicies(emptyPayload)[0]));
const emptyPlan = G.overlayPlan(emptyDraft);
assert(emptyPlan.every((op) => String(op.text || "").trim()), "empty customer fields are skipped");
assert(emptyPlan.some((op) => op.text === "123456789"), "policy number still fills when that value exists");
assert(!emptyPlan.some((op) => op.key === "fullName" || op.key === "idNumber" || op.key === "email"), "does not invent name/id/email");

const partialDraft = G.buildDraft({ payload }, G.createDoc(listed.find((row) => row.policyNumber === "555111")));
assert(partialDraft.isPartial === true, "partial cancel uses partial slot");
const partialPlan = G.overlayPlan(partialDraft);
assert(partialPlan.some((op) => op.text === "555111"), "partial overlay still fills policy number");
assert(partialPlan.some((op) => op.key === "policyNumber" && op.y < 400), "partial policy number uses the nespachim table");

console.log("\n5) group same company+template onto one form");
const groupedPayload = {
  insureds: [{
    id: "ins1",
    label: "ישראל ישראלי",
    data: {
      firstName: "ישראל",
      lastName: "ישראלי",
      idNumber: "123456782",
      existingPolicies: [
        { id: "pol_a", company: "כלל", type: "ריסק", policyNumber: "111111111" },
        { id: "pol_b", company: "כלל", type: "בריאות", policyNumber: "222222222" },
        { id: "pol_c", company: "הראל", type: "בריאות", policyNumber: "333333333" },
        { id: "pol_d", company: "הראל", type: "ריסק", policyNumber: "444444444" },
        { id: "pol_car", company: "שלמה", type: "רכב", policyNumber: "CAR-9" }
      ],
      cancellations: {
        pol_a: { status: "full" },
        pol_b: { status: "full" },
        pol_c: { status: "full" },
        pol_d: { status: "full" },
        pol_car: { status: "full" }
      }
    }
  }]
};
const grouped = G.groupCancelledPolicies(groupedPayload);
assert(grouped.length === 3, "Clal together; Harel health+life stay separate (got " + grouped.length + ")");
const clalGroup = grouped.find((g) => g.templateId === "clal");
assert(clalGroup && clalGroup.policies.length === 2, "two Clal policies share one form");
assert(grouped.some((g) => g.templateId === "harel_health" && g.policies.length === 1), "Harel health stays its own form");
assert(grouped.some((g) => g.templateId === "harel_life" && g.policies.length === 1), "Harel life stays its own form");
assert(!grouped.some((g) => (g.policies || []).some((row) => row.policyNumber === "CAR-9" || row.templateId === "")), "elementary still excluded from groups");

const clalGroupedDoc = G.createDoc(clalGroup);
assert(clalGroupedDoc.id === "doc_cancel_ins1_clal", "grouped Clal id");
assert(clalGroupedDoc.policyNumbers && clalGroupedDoc.policyNumbers.length === 2, "stores both policy numbers");
assert(/111111111/.test(clalGroupedDoc.policyNumber) && /222222222/.test(clalGroupedDoc.policyNumber), "joined policy numbers on the doc");
assert(/2 פוליסות|111111111/.test(clalGroupedDoc.name), "title mentions the policies");

const groupedDraft = G.buildDraft({ payload: groupedPayload }, clalGroupedDoc);
assert(groupedDraft.policies.length === 2, "draft carries both policies");
const groupedPlan = G.overlayPlan(groupedDraft);
const groupedPolicyOps = groupedPlan.filter((op) => String(op.key).indexOf("policyNumber") === 0);
assert(groupedPolicyOps.some((op) => op.text === "111111111"), "first Clal policy number on row 1");
assert(groupedPolicyOps.some((op) => op.text === "222222222"), "second Clal policy number on row 2");
assert(groupedPolicyOps.length >= 2, "policy numbers are separate overlay cells");
const ys = groupedPolicyOps.map((op) => op.y).sort((a, b) => b - a);
assert(ys[0] !== ys[1], "policy numbers sit on different table rows");

const leftoverList = [
  { id: "doc_keep", type: "health_ops", name: "דוח" },
  { id: "doc_cancel_ins1_pol_a", type: "company_cancel_form", templateId: "clal" },
  { id: "doc_cancel_ins1_pol_b", type: "company_cancel_form", templateId: "clal" }
];
const leftoverPayload = {
  ...groupedPayload,
  customerDocuments: leftoverList.slice()
};
const injected = G.injectDocs(leftoverList, leftoverPayload, { uploadedAt: "2026-09-06T00:00:00.000Z" });
assert(injected.removedExtra === true, "inject reports leftover per-policy cancel docs");
const cancelDocs = leftoverList.filter((d) => d.type === "company_cancel_form");
assert(cancelDocs.length === 3, "one grouped doc per live template after inject (got " + cancelDocs.length + ")");
assert(cancelDocs.some((d) => d.id === "doc_cancel_ins1_clal"), "legacy Clal docs replaced by grouped id");
assert(!cancelDocs.some((d) => d.id === "doc_cancel_ins1_pol_a" || d.id === "doc_cancel_ins1_pol_b"), "per-policy Clal leftovers removed");
assert(leftoverList.some((d) => d.id === "doc_keep"), "non-cancel docs stay");
assert(G.isLiveGroupedDoc({ id: "doc_cancel_ins1_clal", type: "company_cancel_form" }, groupedPayload), "grouped id is live");
assert(!G.isLiveGroupedDoc({ id: "doc_cancel_ins1_pol_a", type: "company_cancel_form" }, groupedPayload), "legacy per-policy id is not live");

const emptyPersonDraft = G.buildDraft({ payload: emptyPayload }, G.createDoc(G.groupCancelledPolicies(emptyPayload)[0]));
const emptyPersonPlan = G.overlayPlan(emptyPersonDraft);
assert(!emptyPersonPlan.some((op) => op.key === "fullName" || op.key === "idNumber" || op.key === "email"), "grouped fill still skips empty person fields");

const mixedPayload = {
  insureds: [{
    id: "ins1",
    data: {
      firstName: "ישראל",
      lastName: "ישראלי",
      existingPolicies: [
        { id: "pol_full2", company: "כלל", type: "ריסק", policyNumber: "AAA111" },
        { id: "pol_part2", company: "כלל", type: "בריאות", policyNumber: "BBB222" }
      ],
      cancellations: {
        pol_full2: { status: "full" },
        pol_part2: { status: "partial_health", partialCovers: ["תרופות"] }
      }
    }
  }]
};
const mixedGroup = G.groupCancelledPolicies(mixedPayload)[0];
assert(mixedGroup.policies.length === 2, "full+partial same Clal template still one form");
const mixedDraft = G.buildDraft({ payload: mixedPayload }, G.createDoc(mixedGroup));
assert(mixedDraft.isMixed === true, "mixed full+partial flagged");
const mixedPlan = G.overlayPlan(mixedDraft);
assert(mixedPlan.some((op) => op.text === "AAA111" && op.y > 400), "mixed group fills full-cancel table");
assert(mixedPlan.some((op) => op.text === "BBB222" && op.y < 400), "mixed group also fills partial table");
assert(mixedPlan.some((op) => op.text === "תרופות"), "partial covers fill for the partial policy");

const ayalonLifePayload = {
  insureds: [{
    id: "ins1",
    data: {
      existingPolicies: [
        { id: "pol_l1", company: "איילון", type: "ריסק", policyNumber: "AY1" },
        { id: "pol_l2", company: "איילון", type: "ריסק", policyNumber: "AY2" }
      ],
      cancellations: { pol_l1: { status: "full" }, pol_l2: { status: "full" } }
    }
  }]
};
const ayalonGroups = G.groupCancelledPolicies(ayalonLifePayload);
assert(ayalonGroups.length === 1 && ayalonGroups[0].templateId === "ayalon_life", "Ayalon life policies share the letter form");
const ayalonPlan = G.overlayPlan(G.buildDraft({ payload: ayalonLifePayload }, G.createDoc(ayalonGroups[0])));
assert(ayalonPlan.some((op) => op.text === "AY1 · AY2" || op.text === "AY2 · AY1"), "letter-style form joins policy numbers on one line");

const staleList = [
  { id: "keep-doc", type: "health_ops" },
  { id: "doc_cancel_ins1_clal", type: "company_cancel_form" }
];
const stalePayload = { insureds: [], customerDocuments: staleList.slice() };
const staleInject = G.injectDocs(staleList, stalePayload);
assert(staleInject.removedExtra === true, "inject strips cancel docs when no live cancellations remain");
assert(!staleList.some((d) => d.type === "company_cancel_form"), "no cancel docs left after revert");
assert(staleList.some((d) => d.id === "keep-doc"), "other docs survive empty-live cleanup");

console.log("\n6) fill engine shape");
assert(form.includes("fillOriginalTemplate"), "PDF fill exists");
assert(form.includes("forms/cancel/"), "loads original templates from forms/cancel");
assert(form.includes("overlayPlan"), "overlay plan exists");
assert(form.includes("policyNumber"), "fills policy number");
assert(form.includes("pickPerson"), "fills person from customer file");
assert(!form.includes("applyOfficialHealthAndNames"), "does not fill join-form health fields");

console.log("\n" + (failed ? "FAILED " + failed : "OK") + "  passed=" + passed + " failed=" + failed);
process.exit(failed ? 1 : 0);
