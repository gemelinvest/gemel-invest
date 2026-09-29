/* Cross-company yes transfer + official Migdal health fields.
   Run: node _test-health-cross-company.js
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
  const ctx = { window: {}, console };
  vm.runInNewContext(app.slice(start, end) + "\nthis.GI_OFFICIAL_FORM_FILL = GI_OFFICIAL_FORM_FILL;", ctx);
  return ctx.GI_OFFICIAL_FORM_FILL;
}

const H = loadHelper();
const yes = (key, fields) => ({ [key]: { p1: { answer: "yes", fields: fields || {} } } });

console.log("1) cigarette threshold");
{
  const ten = yes("phoenix_full__smoking", { amount: "10" });
  const thirty = yes("phoenix_full__smoking", { amount: "30 סיגריות" });
  const fifty = yes("phoenix_full__smoking", { amount: "50" });
  assert(H.healthAnswer(ten, "clal_risk_smoking_21_40", "p1") === "", "10 cigarettes does not mark 21–40");
  assert(H.healthAnswer(ten, "clal_risk_smoking_40_plus", "p1") === "", "10 cigarettes does not mark 40+");
  assert(H.healthAnswer(thirty, "clal_risk_smoking_21_40", "p1") === "yes", "30 cigarettes marks 21–40");
  assert(H.healthAnswer(thirty, "clal_risk_smoking_40_plus", "p1") === "", "30 cigarettes does not mark 40+");
  assert(H.healthAnswer(fifty, "clal_risk_smoking_40_plus", "p1") === "yes", "50 cigarettes marks 40+");
  assert(H.healthAnswer(fifty, "clal_risk_smoking_21_40", "p1") === "", "50 cigarettes does not mark 21–40");
  assert(H.healthAnswer(thirty, "menora__smoking", "p1") === "yes", "same 2-year smoking question still transfers");
}

console.log("\n2) alcohol rehab is not two drinks");
{
  const drinks = yes("phoenix_full__alcohol", { details: "3 כוסות ביום" });
  assert(H.healthAnswer(drinks, "clal_risk_alcohol_rehab", "p1") === "", "two drinks does not mark rehab");
  assert(H.healthAnswer(drinks, "magdal_full__alcohol", "p1") === "yes", "two drinks marks the same alcohol question");
  assert(H.healthAnswer(drinks, "clal_alcohol", "p1") === "yes", "Clal health alcohol uses the same threshold");
}

console.log("\n3) one Phoenix yes splits by diagnosis");
{
  const pressure = yes("phoenix_full__heart", { diagnosis: "יתר לחץ דם" });
  const anemia = yes("phoenix_full__heart", { diagnosis: "אנמיה" });
  const bare = yes("phoenix_full__heart");
  assert(H.healthAnswer(pressure, "clal_risk_heart", "p1") === "yes", "blood pressure marks Clal heart");
  assert(H.healthAnswer(pressure, "clal_risk_blood", "p1") === "", "blood pressure does not mark Clal blood");
  assert(H.healthAnswer(anemia, "clal_risk_blood", "p1") === "yes", "anemia marks Clal blood");
  assert(H.healthAnswer(anemia, "clal_risk_heart", "p1") === "", "anemia does not mark Clal heart");
  assert(H.healthAnswer(bare, "clal_risk_heart", "p1") === "", "heart yes without diagnosis stays empty");
  assert(H.healthAnswer(bare, "clal_risk_blood", "p1") === "", "blood stays empty without diagnosis");
  const disc = yes("phoenix_full__musculoskeletal", { diagnosis: "פריצת דיסק" });
  const lupus = yes("phoenix_full__musculoskeletal", { diagnosis: "לופוס" });
  assert(H.healthAnswer(disc, "clal_risk_musculoskeletal", "p1") === "yes", "disc marks skeleton");
  assert(H.healthAnswer(disc, "clal_risk_rheumatic", "p1") === "", "disc does not mark rheumatology");
  assert(H.healthAnswer(lupus, "clal_risk_rheumatic", "p1") === "yes", "lupus marks rheumatology");
  assert(H.healthAnswer(lupus, "clal_risk_musculoskeletal", "p1") === "", "lupus does not mark skeleton");
  const stay = yes("phoenix_full__hospitalization", { details: "אשפוז לפני שנתיים" });
  const future = yes("phoenix_full__hospitalization", { details: "הומלץ ניתוח" });
  const graft = yes("phoenix_full__hospitalization", { details: "השתלת כליה" });
  assert(H.healthAnswer(stay, "clal_risk_hospital_surgery", "p1") === "yes", "hospitalization marks the past-surgery question");
  assert(H.healthAnswer(stay, "clal_risk_future_surgery", "p1") === "", "past stay does not mark future surgery");
  assert(H.healthAnswer(future, "clal_risk_future_surgery", "p1") === "yes", "recommendation marks future surgery");
  assert(H.healthAnswer(future, "clal_risk_hospital_surgery", "p1") === "", "recommendation does not mark past hospitalization");
  assert(H.healthAnswer(graft, "cancer__transplant", "p1") === "yes", "transplant detail marks the transplant question");
  assert(H.healthAnswer(graft, "clal_risk_hospital_surgery", "p1") === "", "transplant alone does not mark hospitalization");
}

console.log("\n4) equivalent Migdal answers still fill Menora");
{
  const responses = {
    magdal_full__heart: { p1: { answer: "yes" } },
    magdal_full__cancer: { p1: { answer: "yes" } },
    magdal_full__smoking_now: { p1: { answer: "yes" } },
    magdal_full__alcohol: { p1: { answer: "no" } },
    magdal_full__neuro: { p1: { answer: "no" } }
  };
  assert(H.healthAnswer(responses, "menora_risk__heart", "p1") === "yes" || H.healthAnswer(responses, "menora__heart", "p1") === "yes", "Migdal heart still reaches a heart question");
  assert(H.healthAnswer(responses, "menora__heart", "p1") === "yes", "Migdal heart → Menora heart");
  assert(H.healthAnswer(responses, "menora__malignant_tumors", "p1") === "yes", "Migdal cancer → Menora tumors");
  assert(H.healthAnswer(responses, "menora__smoking", "p1") === "yes", "Migdal smoking now → Menora smoking");
  assert(H.healthAnswer(responses, "menora__alcohol", "p1") === "no", "Migdal alcohol no → Menora alcohol no");
  assert(H.healthAnswer(responses, "clal_risk_neuro", "p1") === "no", "equivalent neuro no fills Clal risk");
  assert(H.healthAnswer(responses, "clal_risk_heart", "p1") === "yes", "Migdal heart fills Clal risk heart without a blood split");
}

console.log("\n5) official Migdal health fields");
{
  const rows = H.migdalHealthRows();
  assert(rows[0].smoke === true, "current smoking uses IsSmoking");
  assert(rows[1].field === "MGQ2" && rows[1].keys[0] === "magdal_full__smoking_past", "MGQ2 is past smoking");
  assert(rows[2].field === "MGQ3", "MGQ3 is alcohol");
  assert(rows[15].field === "MGQ16", "MGQ16 is heart");
  assert(rows[rows.length - 1].field === "MGQ24", "MGQ24 is ADL");
  const cap = {};
  H.applyMappedHealthYesNo({ __giCapture: cap }, {
    map: "migdal_health",
    primaryId: "p1",
    responses: {
      magdal_full__smoking_now: { p1: { answer: "yes", fields: { amount: "12" } } },
      magdal_full__alcohol: { p1: { answer: "no" } },
      magdal_full__heart: { p1: { answer: "yes" } },
      phoenix_full__neuro: { p1: { answer: "yes" } }
    }
  });
  assert(cap.IsSmoking === "True", "current smoking exports True");
  assert(cap.ClientSmokeNum === "12", "cigarette count is written");
  assert(cap.MGQ3 === "2", "alcohol no exports 2");
  assert(cap.MGQ16 === "1", "heart yes exports 1");
  assert(cap.MGQ10 === "1", "Phoenix neuro yes fills Migdal neuro");
  assert(!cap.HealthDecMainQ1, "old photo field names are not used");
  const gap = fs.readFileSync(path.join(ROOT, "gi-gap-join-forms.js"), "utf8");
  const spec = gap.slice(gap.indexOf('globalName: "MigdalHealthForm"'), gap.indexOf('globalName: "MenoraHealthForm"'));
  assert(!spec.includes("flatRows"), "official Migdal form is not painted on photo coordinates");
}

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
