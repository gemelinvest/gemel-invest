/* GI-OFFICIAL-FORMS-REGRESSION 2026-08-24
   Cross-form qualify isolation, 1:1 file pick, frozen KPI contracts.
   Run: node _test-official-forms-regression.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const vm = require("vm");

const ROOT = __dirname;
const TAG = "20260901-step4-desk-v1";
const FORM_TAG = "20260824-covers-sum-v1";
const HACH_FORM_TAG = "20260826-hach-hmo-health-v1";
const MIGDAL_FORM_TAG = "20260825-migdal-health-fill-v1";
const MENORA_FORM_TAG = "20260828-menora-health-decl-v1";
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
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
const faceJs = fs.readFileSync(path.join(ROOT, "gi-face-auth.js"), "utf8");
const apptSqlPath = path.join(ROOT, "supabase", "migrations", "20260817213000_gi_appt_kpi_statement_timeout.sql");
const apptSql = fs.existsSync(apptSqlPath) ? fs.readFileSync(apptSqlPath, "utf8") : "";

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "app.js syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "service-worker.js")]).status === 0, "service-worker.js syntax");

console.log("\n2) frozen face-login / KPI");
[
  "paintDashboardAfterFaceLogin",
  "fetchAgentAppointmentKpis",
  "loadAgentAppointmentKpis",
  "_applyAppointmentKpi",
  "_fillAppointmentFromLocalCustomers",
  "_needsAgentAppointmentKpi",
  "gi_dashboard_agent_appointment",
  "compareServerKpis",
  "loadServerKpis",
  "paintServerKpiDom",
  "policyNetPremium"
].forEach((name) => {
  assert(app.includes(name), "frozen symbol remains: " + name);
});
assert(faceJs.includes("MATCH_THRESHOLD: 0.5"), "face match threshold remains");
assert(!apptSql || apptSql.includes("statement_timeout = '30s'"), "appointment RPC timeout remains");

console.log("\n3) official forms still isolated");
assert(app.includes('OFFICIAL_JOIN_FORM_FROM_DAY: "2026-08-23"'), "date gate remains 23 Aug");
assert(app.includes("qualifiesForHachsharaCiForm"), "hachshara CI qualify");
assert(app.includes("qualifiesForHachsharaHealthForm"), "hachshara health qualify");
assert(app.includes("qualifiesForHachsharaLifeForm"), "hachshara life qualify");
assert(app.includes("qualifiesForHachsharaLifeShortForm"), "hachshara short-risk qualify");
assert(app.includes("qualifiesForMigdalLifeForm"), "migdal life qualify");
assert(app.includes("qualifiesForMigdalMortgageForm"), "migdal mortgage qualify");
assert(app.includes("qualifiesForMenoraCiForm"), "menora CI qualify");
assert(app.includes("qualifiesForMenoraMortgageForm"), "menora mortgage qualify");
assert(app.includes("qualifiesForMenoraRiskForm"), "menora risk qualify");
assert(app.includes("qualifiesForAyalonHealthForm"), "ayalon health qualify");
assert(app.includes("qualifiesForAyalonMortgageForm"), "ayalon mortgage qualify");
assert(app.includes("qualifiesForClalHealthForm"), "clal health qualify");
assert(app.includes("qualifiesForClalLifeCoupleForm"), "clal couple-risk qualify");
assert(app.includes("qualifiesForMigdalCancerForm"), "migdal cancer qualify");
assert(app.includes("qualifiesForPhoenixLifeShortForm"), "phoenix short-risk qualify");
assert(app.includes("qualifiesForPhoenixLifeFullForm"), "phoenix extended-risk qualify");
assert(app.includes("qualifiesForPhoenixHealthForm"), "phoenix health qualify");
assert(app.includes("qualifiesForPhoenixCiForm"), "phoenix CI / merape qualify");
assert(app.includes("טופס מקורי — מחלות קשות · הכשרה"), "hachshara CI title");
assert(app.includes("טופס מקורי — בריאות · הכשרה"), "hachshara health title");
assert(app.includes("טופס מקורי — ריסק חיים · הכשרה"), "hachshara life title");
assert(app.includes("טופס מקורי — ריסק חיים מקוצר עד 1,000,000 · הכשרה"), "hachshara short-risk title");
assert(app.includes("טופס מקורי — ריסק חיים · מגדל"), "migdal life title");
assert(app.includes("טופס מקורי — ריסק משכנתא · מגדל"), "migdal mortgage title");
assert(app.includes("טופס מקורי — מחלות קשות + סרטן · מנורה"), "menora CI title");
assert(app.includes("טופס מקורי — ריסק משכנתא · מנורה"), "menora mortgage title");
assert(app.includes("טופס מקורי — ריסק / חיים · מנורה"), "menora risk title");
assert(app.includes("טופס מקורי — בריאות · איילון"), "ayalon title");
assert(app.includes("טופס מקורי — ריסק משכנתא · איילון"), "ayalon mortgage title");
assert(app.includes("טופס מקורי — בריאות · כלל"), "clal title");
assert(app.includes("טופס מקורי — ריסק זוגי · כלל"), "clal couple title");
assert(app.includes("טופס מקורי — סרטן · מגדל"), "migdal cancer title");
assert(app.includes("טופס מקורי — ריסק / משכנתא עד גיל 55 · הפניקס"), "phoenix short title");
assert(app.includes("טופס מקורי — ריסק / משכנתא מעל גיל 55 / מעל 2 מיליון · הפניקס"), "phoenix full title");
assert(app.includes("טופס מקורי — בריאות · הפניקס"), "phoenix health title");
assert(app.includes("טופס מקורי — מחלות קשות / מרפא · הפניקס"), "phoenix CI title");

console.log("\n4) cache consistency");
assert(html.includes("app.js?v=" + TAG), "index tag");
assert(sw.includes("gi-v12-" + TAG), "SW tag");
[
  "gi-hachshara-ci-form.js",
  "gi-hachshara-life-form.js",
  "gi-hachshara-life-short-form.js",
  "gi-migdal-life-form.js",
  "gi-migdal-mortgage-form.js",
  "gi-menora-ci-form.js",
  "gi-menora-mortgage-form.js",
  "gi-menora-risk-form.js",
  "gi-ayalon-health-form.js",
  "gi-ayalon-mortgage-form.js",
  "gi-clal-health-form.js",
  "gi-clal-life-couple-form.js",
  "gi-migdal-cancer-form.js",
  "gi-phoenix-life-form.js",
  "gi-phoenix-health-form.js"
].forEach((file) => {
  const tag = file.indexOf("hachshara") >= 0 ? HACH_FORM_TAG
    : (file.indexOf("migdal") >= 0 ? MIGDAL_FORM_TAG
      : (file.indexOf("menora") >= 0 ? MENORA_FORM_TAG : FORM_TAG));
  assert(app.includes("./" + file + "?v=" + tag), "href " + file);
  const src = fs.readFileSync(path.join(ROOT, file), "utf8");
  assert(src.includes("Heebo-Bold.ttf"), file + " bold font");
  assert(src.includes("cc: draft.payment?.cc"), file + " passes stored card");
  const healthFill = (file === "gi-phoenix-health-form.js" || file === "gi-migdal-cancer-form.js")
    ? src.includes("applyMappedHealthYesNo")
    : (file === "gi-menora-risk-form.js"
      ? src.includes("applyMenoraMkqHealth")
      : (file === "gi-migdal-mortgage-form.js"
        ? src.includes('map: "migdal_mortgage"')
        : (file === "gi-menora-mortgage-form.js"
          ? src.includes('map: "menora_mortgage"')
          : src.includes("applyOfficialHealthAndNames"))));
  assert(healthFill, file + " fills health yes/no");
});
assert(fs.existsSync(path.join(ROOT, "gi-phoenix-ci-form.js")), "phoenix CI form file");
assert(app.includes("./gi-phoenix-ci-form.js?v=20260826-phoenix-ci-3148-v1"), "href gi-phoenix-ci-form.js");
assert(fs.existsSync(path.join(ROOT, "forms", "phoenix-ci", "phoenix-ci-join.pdf")), "phoenix CI PDF template");
const phxCiSrc = fs.readFileSync(path.join(ROOT, "gi-phoenix-ci-form.js"), "utf8");
assert(phxCiSrc.includes("Heebo-Bold.ttf"), "phoenix CI bold font");
assert(phxCiSrc.includes("cc: draft.payment?.cc"), "phoenix CI passes stored card");
assert(phxCiSrc.includes("overlayPlan"), "phoenix CI overlays flattened official PDF");
assert(phxCiSrc.includes("healthAnswer"), "phoenix CI fills health yes/no overlay");
assert(fs.existsSync(path.join(ROOT, "gi-hachshara-mortgage-form.js")), "hachshara mortgage form file");
assert(app.includes("./gi-hachshara-mortgage-form.js?v=" + HACH_FORM_TAG), "href gi-hachshara-mortgage-form.js");
assert(fs.existsSync(path.join(ROOT, "gi-hachshara-health-form.js")), "hachshara health form file");
assert(app.includes("./gi-hachshara-health-form.js?v=20260826-hach-health-form-v1"), "href gi-hachshara-health-form.js");
assert(fs.existsSync(path.join(ROOT, "forms", "hachshara-health", "hachshara-health-join.pdf")), "hachshara health PDF template");
const hachHealthSrc = fs.readFileSync(path.join(ROOT, "gi-hachshara-health-form.js"), "utf8");
assert(hachHealthSrc.includes("Heebo-Bold.ttf"), "hachshara health bold font");
assert(hachHealthSrc.includes("cc: draft.payment?.cc"), "hachshara health passes stored card");
assert(hachHealthSrc.includes('map: "health"'), "hachshara health uses dedicated 2498 map");
assert(fs.existsSync(path.join(ROOT, "fonts", "Heebo-Bold.ttf")), "bold font file");

console.log("\n5) 1:1 picker + RTL");
const start = app.indexOf("const GI_OFFICIAL_FORM_FILL = {");
const end = app.indexOf("try { window.GI_OFFICIAL_FORM_FILL = GI_OFFICIAL_FORM_FILL; }", start);
assert(start > 0 && end > start, "helper block found");
const ctx = { window: {}, console };
vm.runInNewContext(app.slice(start, end) + "\nthis.GI_OFFICIAL_FORM_FILL = GI_OFFICIAL_FORM_FILL;", ctx);
const H = ctx.GI_OFFICIAL_FORM_FILL;
const person = H.pickPerson(
  { data: { firstName: "דוד", occupation: "" } },
  [
    { firstName: "דוד", lastName: "כהן", city: "חולון", occupation: "נהג", clinic: "מכבי", maritalStatus: "", familyStatus: "נשוי" },
    { phone: "0501234567", idNumber: "123456789", email: "a@b.com" }
  ]
);
assert(person.firstName === "דוד", "keeps first name from insured");
assert(person.lastName === "כהן", "fills last name from customer file");
assert(person.city === "חולון", "fills city from customer file");
assert(person.occupation === "נהג", "fills occupation from customer file");
assert(person.clinic === "מכבי", "fills clinic alias from customer file");
assert(person.maritalStatus === "נשוי", "fills familyStatus alias");
assert(person.phone === "0501234567", "fills phone from record");
assert(person.idNumber === "123456789", "fills id from record");
assert(H.visualHebrew("כהן") === "ןהכ", "RTL reverse for PDF draw");
assert(H.visualHebrew("0501234567") === "0501234567", "phone stays LTR");

console.log("\n6) stored payment + download role");
const hoPay = H.pickPayment(
  { primary: { paymentMethod: "ho", ho: { bankName: "לאומי", branch: "12", account: "345", bankNo: "10" } } },
  { paymentMethod: "ho", ho: { bankName: "לאומי", branch: "12", account: "345", bankNo: "10" } }
);
assert(hoPay.isHo === true, "HO with stored bank is marked");
assert(hoPay.bank.name === "לאומי", "HO fills bank name");
assert(hoPay.bank.branch === "12", "HO fills branch");
assert(hoPay.bank.account === "345", "HO fills account");
const ccPay = H.pickPayment(
  { primary: { paymentMethod: "cc", ho: { bankName: "לאומי", branch: "12", account: "345" } } },
  { paymentMethod: "cc", ho: { bankName: "לאומי", branch: "12", account: "345" } }
);
assert(ccPay.method === "cc", "CC method is kept");
assert(ccPay.isHo === false, "CC does not mark HO");
assert(ccPay.bank.name === "", "CC does not dump HO bank name");
assert(ccPay.bank.account === "", "CC does not dump HO account");
const emptyHo = H.pickPayment(
  { primary: { paymentMethod: "ho", ho: {} } },
  { paymentMethod: "ho", ho: {} }
);
assert(emptyHo.isHo === false, "HO without stored bank is not invented");
const ccStored = H.pickPayment(
  { primary: { paymentMethod: "cc", cc: { holderName: "דוד כהן", holderId: "123456789", cardNumber: "4580123412341234", exp: "12/27" } } },
  { paymentMethod: "cc", cc: { holderName: "דוד כהן", holderId: "123456789", cardNumber: "4580123412341234", exp: "12/27" } }
);
assert(ccStored.hasCc === true, "CC with stored card is marked");
assert(ccStored.cc.cardNumber === "4580123412341234", "CC fills stored card number");
assert(ccStored.cc.holderName === "דוד כהן", "CC fills stored holder name");
assert(ccStored.cc.holderId === "123456789", "CC fills stored holder id");
assert(ccStored.cc.expirationDate === "12/27", "CC parses expiry");
const hoNoCc = H.pickPayment(
  { primary: { paymentMethod: "ho", ho: { bankName: "לאומי", branch: "12", account: "345" }, cc: { cardNumber: "4580123412341234" } } },
  { paymentMethod: "ho", ho: { bankName: "לאומי", branch: "12", account: "345" }, cc: { cardNumber: "4580123412341234" } }
);
assert(hoNoCc.cc.cardNumber === "", "HO does not dump stored card number");
assert(app.includes("canDownloadOfficialJoinForm"), "download gate exists");
assert(app.includes("denyOfficialJoinFormDownload"), "deny helper exists");
assert(/canDownloadOfficialJoinForm\(\)\{\s*try \{ return !!\(Auth\.isAdmin\(\) \|\| Auth\.isManager\(\)\);/.test(app), "gate is admin or manager only");
assert(!/canDownloadOfficialJoinForm\(\)\{[\s\S]{0,220}isTeamManager/.test(app), "team manager is excluded from official PDF download");

console.log("\n7) health yes/no + logical Hebrew");
ctx.window.PDFLib = { PDFName: { of(v){ return { v: String(v) }; } } };
const healthExports = {};
const present = new Set(["HealthDecMainQ2", "HealthDecMainQ3", "HealthDecBzugQ2", "HealthDecBzugQ3", "HealthDecC1Q2"]);
const mockForm = {
  getField(name){
    if(!present.has(name)) return null;
    return {
      acroField: {
        dict: {
          set(_k, val){ healthExports[name] = val && val.v; }
        }
      }
    };
  }
};
H.applyHealthYesNo(mockForm, {
  keys: ["clal_smoking", "clal_drugs_cannabis", "clal_alcohol"],
  responses: {
    clal_smoking: { p1: { answer: "yes" }, s1: { answer: "no" }, c1: { answer: "no" } },
    clal_drugs_cannabis: { p1: { answer: "no" } }
  },
  primaryId: "p1",
  spouseId: "s1",
  childIds: ["c1"]
});
assert(healthExports.HealthDecMainQ2 === "1", "primary yes exports 1");
assert(healthExports.HealthDecBzugQ2 === "2", "spouse no exports 2");
assert(healthExports.HealthDecC1Q2 === "2", "child no exports 2");
assert(healthExports.HealthDecMainQ3 === "2", "next answered question maps to next PDF Q");
assert(healthExports.HealthDecBzugQ3 == null, "unanswered spouse question is skipped");
const texts = {};
const textForm = {
  getTextField(name){
    return {
      setText(v){ texts[name] = v; },
      setFontSize(){},
      updateAppearances(){}
    };
  }
};
H.setTextSafe(textForm, "FullName", "כהן", { dummy: true }, { visual: false });
assert(texts.FullName === "כהן", "visual:false keeps logical Hebrew");
H.setTextSafe(textForm, "FullName2", "כהן", { dummy: true });
assert(texts.FullName2 === "ןהכ", "default visual reverse still used for other companies");
assert(H.HEALTH_QKEYS.clal_health[0] === "clal_smoking", "Clal keys start at smoking");
assert(H.HEALTH_QKEYS.clal_couple.length === 19, "Clal couple key list is CRQ1–19");
assert(H.HEALTH_QKEYS.migdal_cancer.length === 6, "Migdal cancer key list covers all 6 wizard questions");
assert(H.HEALTH_QKEYS.migdal_cancer[1] === "magdal_cancer__smoking", "Migdal cancer smoking key is second");
assert(H.HEALTH_QKEYS.migdal_cancer[5] === "magdal_cancer__family", "Migdal cancer family key is last");
assert(H.HEALTH_QKEYS.migdal_mortgage.length === 16, "Migdal mortgage key list is intact");
assert(H.HEALTH_QKEYS.hachshara_life_short_decl.length === 12, "Hachshara short decl zips to HealthDec Q1–Q12");
assert(H.HEALTH_QKEYS.hachshara_life_short_decl[0] === "hachshara_risk_s__q1", "short decl skips smoking onto IsSmoking");
assert(H.PHOENIX_HEALTH_ROWS.short[0].field === "Q1", "Phoenix short first radio is Q1");
assert(H.PHOENIX_HEALTH_ROWS.short[2].smoke === true, "Phoenix short smoking is named, not zipped");
assert(H.PHOENIX_HEALTH_ROWS.full[6].smoke === true, "Phoenix extended smoking is named");
const emptyStore = H.healthResponses({
  primary: { healthDeclaration: { responses: {} } },
  insureds: [{ data: { healthDeclaration: { responses: { clal_smoking: { p1: { answer: "yes" } } } } } }]
});
assert(emptyStore.clal_smoking.p1.answer === "yes", "empty primary health store falls through");
let attachThrew = false;
try {
  const attached = H.attachDraftHealth({}, { id: "p1" }, null, null);
  assert(attached.primaryId === "p1", "primary id is kept when spouse is missing");
  assert(attached.spouseId === "", "null spouse does not throw");
  assert(Array.isArray(attached.childIds) && attached.childIds.length === 0, "missing children stay empty");
} catch(_e){
  attachThrew = true;
}
assert(!attachThrew, "attachDraftHealth accepts a null spouse");

console.log("\n8) hachshara named health + editor + insured payment");
const ciRows = H.hachsharaHealthRows("ci");
assert(ciRows[0] && ciRows[0].smoke === true, "CI smoking is named onto IsSmoking");
assert(ciRows[1] && ciRows[1].q === 1 && (ciRows[1].keys || []).indexOf("hachshara_crit__hospitalization") >= 0, "CI Q1 is hospitalization");
assert(ciRows.filter((r) => r.q).length === 29, "CI has 29 health radios");
assert((ciRows.find((r) => r.q === 28)?.keys || []).indexOf("hachshara_crit__infant_1") >= 0, "CI infant_1 maps to Q28");
assert((ciRows.find((r) => r.q === 29)?.keys || []).indexOf("hachshara_crit__infant_2") >= 0, "CI infant_2 maps to Q29");
assert((ciRows.find((r) => r.q === 11)?.keys || []).indexOf("hachshara_crit__heart_disease") >= 0, "CI heart accepts legacy heart_disease key");
const healthRows = H.hachsharaHealthRows("health");
assert(healthRows[0] && healthRows[0].smoke === true, "health smoking is named onto IsSmoking");
assert(healthRows.filter((r) => r.q).length === 29, "health form has 29 declaration radios");
assert((healthRows.find((r) => r.q === 5)?.keys || []).indexOf("hachshara__breath_chest") >= 0, "health Q5 is breath_chest");
assert((healthRows.find((r) => r.q === 10)?.keys || []).indexOf("hachshara__breath_chest") < 0, "health Q10 does not steal breath_chest");
const capHealthForm = {};
H.applyMappedHealthYesNo({ __giCapture: capHealthForm }, {
  map: "health",
  responses: {
    hachshara__hospitalization: { p1: { answer: "no" } },
    hachshara__breath_chest: { p1: { answer: "yes" } }
  },
  primaryId: "p1"
});
assert(capHealthForm.HealthDecMainQ1 === "2", "health form Q1 hospitalization no");
assert(capHealthForm.HealthDecMainQ5 === "1", "health form Q5 breath_chest yes");
const fullRows = H.hachsharaHealthRows("life_full");
assert(fullRows[0] && fullRows[0].smoke === true, "full smoking is named");
assert(fullRows.filter((r) => r.q).length === 25, "full has 25 health radios");
assert((fullRows.find((r) => r.q === 21)?.keys || []).indexOf("hachshara_risk_f__b15") >= 0, "full b15 maps to Q21");
assert((fullRows.find((r) => r.q === 25)?.keys || []).indexOf("hachshara_risk_f__b19") >= 0, "full b19 maps to Q25");
assert(fullRows[7] && fullRows[7].q === 7 && (fullRows[7].keys || []).indexOf("hachshara_risk_f__b1") >= 0, "full b1 maps to Q7");
assert((fullRows[1].keys || []).indexOf("hachshara_risk_f__q1") >= 0, "full Q1 accepts legacy q1 key");
const shortRows = H.hachsharaHealthRows("life_short");
assert(shortRows[0] && shortRows[0].smoke === true, "short smoking is named");
assert(shortRows[1] && shortRows[1].q === 1 && (shortRows[1].keys || []).indexOf("hachshara_risk_s__q1") >= 0, "short Q1 is q1");
assert(shortRows.filter((r) => r.q).length === 12, "short has 12 health radios");
const cap = {};
H.applyMappedHealthYesNo({ __giCapture: cap }, {
  map: "ci",
  responses: {
    hachshara_crit__smoking: { p1: { answer: "yes" } },
    hachshara_crit__hospitalization: { p1: { answer: "no" }, s1: { answer: "yes" }, c1: { answer: "no" } }
  },
  primaryId: "p1",
  spouseId: "s1",
  childIds: ["c1"]
});
assert(cap.IsSmoking === "True", "CI smoking goes to IsSmoking");
assert(cap.HealthDecMainQ1 === "2", "CI Q1 is hospitalization no, not smoking");
assert(cap.HealthDecBzugQ1 === "1", "CI spouse Q1 from spouse answer");
assert(cap.HealthDecC1Q1 === "2", "CI child Q1 from child answer");
const capLegacy = {};
H.applyMappedHealthYesNo({ __giCapture: capLegacy }, {
  map: "life_full",
  responses: {
    hachshara_risk_f__smoking: { p1: { answer: "no" } },
    hachshara_risk_f__q1: { p1: { answer: "no" } },
    hachshara_risk_f__b11: { p1: { answer: "yes" } }
  },
  primaryId: "p1"
});
assert(capLegacy.IsSmoking === "False", "full smoking from legacy file");
assert(capLegacy.HealthDecMainQ1 === "2", "full legacy q1 fills Q1");
assert(capLegacy.HealthDecMainQ17 === "1", "full b11 fills Q17");
const capFullB19 = {};
H.applyMappedHealthYesNo({ __giCapture: capFullB19 }, {
  map: "life_full",
  responses: { hachshara_risk_f__b19: { p1: { answer: "yes" } } },
  primaryId: "p1"
});
assert(capFullB19.HealthDecMainQ25 === "1", "full b19 fills Q25");
const capCancer = {};
H.applyMappedHealthYesNo({ __giCapture: capCancer }, {
  map: "migdal_cancer",
  responses: {
    magdal_cancer__smoking: { p1: { answer: "yes" }, s1: { answer: "no" } },
    magdal_cancer__tests: { p1: { answer: "no" } },
    magdal_cancer__family: { p1: { answer: "yes" } }
  },
  primaryId: "p1",
  spouseId: "s1"
});
assert(capCancer.IsSmoking === "True", "cancer smoking goes to IsSmoking");
assert(capCancer.IsSmokingBzug === "False", "cancer spouse smoking export");
assert(capCancer.HealthDecMainQ2 === "2", "cancer tests maps to Q2");
assert(!capCancer.HealthDecMainQ6, "cancer family has no Q6 radio on PDF");
assert(capCancer.Text1 === "כן", "cancer family yes goes to Text1 detail");
const capMigdalShort = {};
H.applyMappedHealthYesNo({ __giCapture: capMigdalShort }, {
  map: "migdal_life",
  responses: {
    magdal_risk2m__hobby: { orphan_id: { answer: "no" } },
    magdal_risk2m__smoking: { orphan_id: { answer: "no" } },
    magdal_risk2m__hospital: { orphan_id: { answer: "no" } },
    magdal_risk2m__heart: { orphan_id: { answer: "yes" } }
  },
  primaryId: ""
});
assert(capMigdalShort.MGQ1 === "2", "migdal short hobby fills MGQ1 even without primaryId");
assert(capMigdalShort.IsSmoking === "False", "migdal short smoking fills IsSmoking via solo id");
assert(capMigdalShort.MGQ6 === "2", "migdal short hospital fills MGQ6");
assert(capMigdalShort.MGQ16 === "1", "migdal short heart fills MGQ16");
const capMigdalMort = {};
H.applyMappedHealthYesNo({ __giCapture: capMigdalMort }, {
  map: "migdal_mortgage",
  responses: {
    magdal_mort__smoking: { p1: { answer: "no" } },
    magdal_mort__cancer: { p1: { answer: "no" } },
    magdal_mort__hospital: { p1: { answer: "yes" } }
  },
  primaryId: "p1"
});
assert(capMigdalMort.IsSmoking === "False", "migdal mortgage smoking named");
assert(capMigdalMort.HealthDecMainQ1 === "2", "migdal mortgage cancer → Q1");
assert(capMigdalMort.HealthDecMainQ11 === "1", "migdal mortgage hospital → Q11");
const capHealthMaster = {};
H.applyMappedHealthYesNo({ __giCapture: capHealthMaster }, {
  map: "ci",
  responses: {
    hachshara__hospitalization: { p1: { answer: "yes" } },
    hachshara_crit__heart_disease: { p1: { answer: "no" } },
    hachshara_crit__heart_vessels: { p1: { answer: "yes" } }
  },
  primaryId: "p1"
});
assert(capHealthMaster.HealthDecMainQ1 === "1", "CI falls back to hachshara__ hospitalization");
assert(capHealthMaster.HealthDecMainQ11 === "1", "CI heart yes if any heart_* alias is yes");
assert(H.mapHmoExport("כללית") === "2", "Hachshara HMO כללית → radio 2");
assert(H.mapHmoExport("מכבי") === "1", "Hachshara HMO מכבי → radio 1");
assert(H.mapHmoExport("מאוחדת") === "3", "Hachshara HMO מאוחדת → radio 3");
assert(H.mapHmoExport("לאומית") === "4", "Hachshara HMO לאומית → radio 4");
assert(H.mapShabanExport("אין שב״ן") === "2", "אין שב״ן → לא");
assert(H.mapShabanExport("כללית מושלם") === "1", "שבן plan → כן");
const capHealthOnRisk = {};
H.applyMappedHealthYesNo({ __giCapture: capHealthOnRisk }, {
  map: "life_short",
  responses: {
    hachshara__hospitalization: { p1: { answer: "no" } },
    hachshara__heart: { p1: { answer: "yes" } },
    hachshara__substances: { p1: { answer: "no" } }
  },
  primaryId: "p1"
});
assert(capHealthOnRisk.HealthDecMainQ1 === "2", "risk short Q1 fills from health-master substances");
assert(capHealthOnRisk.HealthDecMainQ2 === "2", "risk short Q2 fills from health-master hospitalization");
assert(capHealthOnRisk.HealthDecMainQ4 === "1", "risk short Q4a fills from health-master heart");
const capRiskOnCi = {};
H.applyMappedHealthYesNo({ __giCapture: capRiskOnCi }, {
  map: "ci",
  responses: {
    hachshara_risk_s__q2: { p1: { answer: "no" } },
    hachshara__infant_1: { p1: { answer: "no" } }
  },
  primaryId: "p1"
});
assert(capRiskOnCi.HealthDecMainQ1 === "2", "CI Q1 fills from risk-short hospitalization");
assert(capRiskOnCi.HealthDecMainQ28 === "2", "CI infant_1 accepts health-master infant key");
const mergedHealth = H.healthResponses({
  primary: { healthDeclaration: { responses: {} } },
  insureds: [
    { data: { healthDeclaration: { responses: { hachshara__hospitalization: { p1: { answer: "no" } } } } } },
    { data: { healthDeclaration: { responses: { hachshara__heart: { p1: { answer: "yes" } } } } } }
  ]
});
assert(mergedHealth.hachshara__hospitalization.p1.answer === "no", "healthResponses merges insured[0]");
assert(mergedHealth.hachshara__heart.p1.answer === "yes", "healthResponses merges later insureds");
const insPay = H.pickPayment(
  { insureds: [{ data: { paymentMethod: "ho", ho: { bankName: "פועלים", branch: "1", account: "99" } } }] },
  {}
);
assert(insPay.isHo === true, "HO from insureds[0].data is used");
assert(insPay.bank.name === "פועלים", "HO bank name from insured layer");
assert(typeof H.listEditablePdfFields === "function", "editor lists PDF fields");
assert(typeof H.renderPdfFieldEditor === "function", "editor renderer exists");
assert(typeof H.collectPdfFieldEditor === "function", "editor collector exists");
assert(typeof H.applyPdfValues === "function", "editor applies values to PDF");
const listed = H.listEditablePdfFields({
  getFields(){
    return [
      { getName: () => "FirstName", constructor: { name: "PDFTextField" }, getOptions: () => [] },
      { getName: () => "AgentMust1", constructor: { name: "PDFSignature" } },
      { getName: () => "HealthDecMainQ1", constructor: { name: "PDFRadioGroup" }, getOptions: () => ["1", "2"] }
    ];
  }
});
assert(listed.some((f) => f.name === "FirstName"), "editor keeps data fields");
assert(!listed.some((f) => f.name === "AgentMust1"), "editor skips signature fields");
assert(listed.some((f) => f.name === "HealthDecMainQ1" && f.type === "choice"), "health radios are choice fields");
assert(app.includes("applyMappedHealthYesNo"), "named health helper is in app.js");
assert(app.includes("renderPdfFieldEditor"), "PDF editor helper is in app.js");

console.log("\n9) phoenix health form map");
const phxRows = H.phoenixHealthRows();
assert(phxRows[0] && phxRows[0].smoke === true, "Phoenix health smoking is named onto IsSmoking");
assert(phxRows[1] && phxRows[1].field === "Q2", "Phoenix health family maps to Q2");
assert(phxRows[phxRows.length - 1].field === "Q28", "Phoenix health disability maps to Q28");
assert(H.HEALTH_QKEYS.phoenix_health.length === 28, "Phoenix health wizard has 28 keys");
assert(H.HEALTH_QKEYS.phoenix_ci.length === 13, "Phoenix CI declaration 303 has 13 keys");
assert(H.HEALTH_QKEYS.phoenix_ci[0] === "phoenix_critical_illness__ci_smoking", "Phoenix CI starts at smoking 2.1");
assert(H.HEALTH_QKEYS.phoenix_ci[8] === "phoenix_critical_illness__ci_diabetes", "Phoenix CI includes diabetes 3.7");
const capPhx = {};
H.applyMappedHealthYesNo({ __giCapture: capPhx }, {
  map: "phoenix_health",
  responses: {
    phoenix_full__smoking: { p1: { answer: "no" } },
    phoenix_full__medications: { p1: { answer: "yes" } }
  },
  primaryId: "p1"
});
assert(capPhx.IsSmoking === "False", "Phoenix health smoking False export");
assert(capPhx.Q27 === "1", "Phoenix health medications yes on Q27");

console.log("\n10) stored covers + sum insured helpers");
assert(typeof H.listStoredHealthCovers === "function", "listStoredHealthCovers helper exists");
const covers = H.listStoredHealthCovers({
  healthCovers: ["ייעוץ ובדיקות"],
  covers: ["השתלות וטיפולים מיוחדים בחו\"ל"],
  selectedCovers: ["משלים שב\"ן"],
  healthCoversWithAmounts: { "מדיכלל מחלות קשות 33": "250000" }
});
assert(covers.indexOf("ייעוץ ובדיקות") >= 0, "reads healthCovers");
assert(covers.indexOf("השתלות וטיפולים מיוחדים בחו\"ל") >= 0, "reads legacy covers array");
assert(covers.indexOf("משלים שב\"ן") >= 0, "reads selectedCovers");
assert(covers.indexOf("מדיכלל מחלות קשות 33") >= 0, "reads healthCoversWithAmounts keys");
const phxCovers = H.listStoredHealthCovers({
  healthCovers: ["ייעוץ ובדיקות"],
  phoenixHealthSelected: { abroad_surgery: true, drugs: false, surgery_first_shekel: true }
}, { phoenixSelected: true });
assert(phxCovers.indexOf("abroad_surgery") >= 0, "reads phoenixHealthSelected keys");
assert(phxCovers.indexOf("drugs") < 0, "skips unchecked phoenixHealthSelected");
assert(phxCovers.indexOf("surgery_first_shekel") >= 0, "reads checked phoenixHealthSelected");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
