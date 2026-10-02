/* Each approved product must open that company's own proposal PDF.
   Run: node _test-dedicated-company-forms.js

   Menora health's file on disk is the Menora 227 proposal, not Migdal 1581.
   Migdal health keeps its own file. Menora still refuses a Migdal template if one is put back.
*/
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

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

const SLUG_COMPANY = {
  menora: "מנורה",
  migdal: "מגדל",
  ayalon: "איילון",
  clal: "כלל",
  phoenix: "הפניקס",
  hachshara: "הכשרה"
};

function sha256(buf){
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function pdfFields(buf){
  return [...buf.toString("latin1").matchAll(/\/T\s*\(([^)]{1,80})\)/g)].map((m) => m[1]);
}

function companyOfSlug(slug){
  const key = String(slug || "").split("-")[0];
  return SLUG_COMPANY[key] || "";
}

function collectJoinForms(){
  const rows = [];
  const gap = fs.readFileSync(path.join(ROOT, "gi-gap-join-forms.js"), "utf8");
  const specRe = /globalName:\s*"([^"]+)"[\s\S]*?company:\s*"([^"]+)"[\s\S]*?templateBase:\s*"([^"]+)"[\s\S]*?templateFile:\s*"([^"]+)"/g;
  let m;
  while((m = specRe.exec(gap))){
    rows.push({
      module: "gi-gap-join-forms.js",
      globalName: m[1],
      company: m[2],
      templateBase: m[3],
      templateFile: m[4]
    });
  }
  fs.readdirSync(ROOT).filter((name) => /^gi-[a-z0-9-]+-form\.js$/.test(name) && name !== "gi-gap-join-forms.js").forEach((file) => {
    const src = fs.readFileSync(path.join(ROOT, file), "utf8");
    const templateFile = (src.match(/TEMPLATE_FILE:\s*"([^"]+)"/) || [])[1] || "";
    const templateBase = (src.match(/TEMPLATE_BASE:\s*"([^"]+)"/) || [])[1] || "";
    const company = (src.match(/safeTrim\((?:policy|p)\??\.company\)\s*!==\s*"([^"]+)"/) || [])[1]
      || (src.match(/safeTrim\(p\?\.company\)\s*===\s*"([^"]+)"/) || [])[1]
      || "";
    const blockRe = /folder:\s*"(forms\/[^"]+)"\s*,\s*\n\s*file:\s*"([^"]+)"/g;
    let block;
    let blocks = 0;
    while((block = blockRe.exec(src))){
      blocks += 1;
      rows.push({
        module: file,
        globalName: "",
        company: company || (file.indexOf("phoenix") >= 0 ? "הפניקס" : ""),
        templateBase: "./" + block[1],
        templateFile: block[2]
      });
    }
    if(blocks || !templateFile) return;
    rows.push({ module: file, globalName: "", company, templateBase, templateFile });
  });
  return rows;
}

function diskJoinPdfs(){
  const out = [];
  const root = path.join(ROOT, "forms");
  fs.readdirSync(root).forEach((dir) => {
    const abs = path.join(root, dir);
    if(!fs.statSync(abs).isDirectory()) return;
    fs.readdirSync(abs).forEach((file) => {
      if(file.endsWith("-join.pdf")) out.push(path.posix.join("forms", dir, file));
    });
  });
  return out.sort();
}

console.log("1) every proposal module points at its own company file");
const forms = collectJoinForms();
const onDisk = diskJoinPdfs();
assert(forms.length === onDisk.length, "every proposal PDF is wired to a module (" + forms.length + "/" + onDisk.length + ")");
const seenPath = new Set();
const byHash = new Map();
forms.forEach((row) => {
  const base = String(row.templateBase || "").replace(/^\.\//, "");
  const rel = path.posix.join(base, row.templateFile);
  const abs = path.join(ROOT, rel);
  assert(fs.existsSync(abs), rel + " exists");
  if(!fs.existsSync(abs)) return;
  const slug = rel.split("/")[1] || "";
  const expectedCompany = companyOfSlug(slug);
  assert(!!expectedCompany, rel + " lives in a known company folder");
  if(row.company){
    assert(row.company === expectedCompany, row.module + " company " + row.company + " matches folder " + slug);
  }
  assert(row.templateFile.indexOf(slug.split("-")[0]) === 0 || slug.indexOf(row.templateFile.split("-")[0]) === 0, rel + " filename belongs to its folder");
  assert(!seenPath.has(rel), rel + " is registered once");
  seenPath.add(rel);
  const buf = fs.readFileSync(abs);
  const hash = sha256(buf);
  const fields = pdfFields(buf);
  const mgq = fields.filter((name) => /^MGQ/.test(name)).length;
  if(!byHash.has(hash)) byHash.set(hash, []);
  byHash.get(hash).push({ rel, slug, mgq, bytes: buf.length });
  const menoraHealthFile = rel === "forms/menora-health/menora-health-join.pdf";
  if(menoraHealthFile){
    assert(mgq === 0, "Menora health file is not the Migdal MGQ template");
    assert(fields.indexOf("MKQ2") >= 0, "Menora health file has the 227 MKQ fields");
  } else {
    assert(mgq === 0 || slug.indexOf("migdal") === 0, rel + " keeps Migdal MGQ fields on a Migdal form only");
  }
});
onDisk.forEach((rel) => {
  assert(seenPath.has(rel), rel + " is opened by a product module");
});

console.log("\n2) no two companies share one PDF");
const gapSrc = fs.readFileSync(path.join(ROOT, "gi-gap-join-forms.js"), "utf8");
byHash.forEach((group) => {
  const slugs = [...new Set(group.map((row) => row.slug.split("-")[0]))];
  if(slugs.length === 1){
    assert(true, group.map((row) => row.rel).join(" + ") + " stays inside " + slugs[0]);
    return;
  }
  assert(false, group.map((row) => row.rel).join(" + ") + " must not be shared across companies");
});

console.log("\n3) step 10 opens Menora health through the Menora module, not Migdal");
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
assert(app.includes('[CustomerDocuments.TYPES.menoraHealthForm]: { globalName: "MenoraHealthForm"'), "document list routes menora_health_form to MenoraHealthForm");
assert(app.includes('[CustomerDocuments.TYPES.migdalHealthForm]: { globalName: "MigdalHealthForm"'), "document list routes migdal_health_form to MigdalHealthForm");
assert(app.includes('if(safeTrim(p?.company) !== "מנורה") return false;') && app.includes("qualifiesForMenoraHealthForm"), "Menora health qualifier requires company מנורה");
const menoraFn = app.slice(app.indexOf("qualifiesForMenoraHealthForm"), app.indexOf("qualifiesForAyalonLifeForm"));
const migdalFn = app.slice(app.indexOf("qualifiesForMigdalHealthForm"), app.indexOf("qualifiesForMenoraHealthForm"));
assert(menoraFn.includes('!== "מנורה"') && menoraFn.includes("/בריאות/") && !menoraFn.includes('!== "מגדל"'), "Menora health product does not qualify as Migdal");
assert(migdalFn.includes('!== "מגדל"') && migdalFn.includes("/בריאות/"), "Migdal health product qualifies only for מגדל");
assert(app.includes('menora_health_form: "טופס מקורי — בריאות · מנורה"'), "rail title for the Menora health row names מנורה");
assert(app.includes('menora_health_form: "menora_health"'), "yes/no map key for the Menora file is menora_health");

const menoraRows = app.slice(app.indexOf("menoraHealthRows(){"), app.indexOf("ayalonLifeRows(){"));
const migdalRows = app.slice(app.indexOf("migdalHealthRows(){"), app.indexOf("menoraHealthRows(){"));
assert(!/MGQ/.test(menoraRows), "Menora health answers are not written into Migdal MGQ fields");
assert(menoraRows.includes('field: "MKQ"'), "Menora health answers target MKQ fields on form 227");
assert(menoraRows.includes('"family"'), "Menora health includes the family question");
assert(migdalRows.includes('field: "MGQ2"'), "Migdal health still fills its own MGQ fields");
assert(app.includes('GI_GAP_JOIN_FORMS_HREF = "./gi-gap-join-forms.js?v=20261002-mirror-360-precall-v1"'), "gap forms script cache bumped");

const vm = require("vm");
const sandbox = { window: {}, console };
sandbox.globalThis = sandbox.window;
vm.runInNewContext(gapSrc, sandbox, { filename: "gi-gap-join-forms.js" });
const guard = sandbox.window.GI_GAP_TEMPLATE_GUARD;
const menoraPdf = fs.readFileSync(path.join(ROOT, "forms/menora-health/menora-health-join.pdf"));
const migdalPdf = fs.readFileSync(path.join(ROOT, "forms/migdal-health/migdal-health-join.pdf"));
const riskPdf = fs.readFileSync(path.join(ROOT, "forms/menora-risk/menora-risk-join.pdf"));
assert(typeof guard.isMigdalHealthTemplate === "function", "template guard is available");
assert(!guard.isMigdalHealthTemplate(menoraPdf), "Menora health bytes are the Menora file, not Migdal 1581");
assert(guard.isMigdalHealthTemplate(migdalPdf), "Migdal health bytes keep the Migdal template marker");
assert(!guard.isMigdalHealthTemplate(riskPdf), "Menora risk file is not treated as the Migdal health template");
assert(sandbox.window.MenoraHealthForm.DOC_TYPE === "menora_health_form", "Menora module identity stays menora_health_form");
assert(sandbox.window.MigdalHealthForm.DOC_TYPE === "migdal_health_form", "Migdal module identity stays migdal_health_form");
assert(sandbox.window.MenoraHealthForm.TEMPLATE_FILE === "menora-health-join.pdf", "Menora module still points at its own folder file");
assert(sandbox.window.MigdalHealthForm.TEMPLATE_FILE === "migdal-health-join.pdf", "Migdal module still points at its own folder file");

console.log("\n4) Menora 227 yes opens the matching follow-up number");
const wiz = fs.readFileSync(path.join(ROOT, "gi-wizard.js"), "utf8");
const cfg = fs.readFileSync(path.join(ROOT, "gi-followup-zip-config.js"), "utf8");
function menoraLine(key){
  const at = wiz.indexOf("key:'" + key + "'");
  return at < 0 ? "" : wiz.slice(at, at + 1600);
}
assert(menoraLine("menora__smoking").includes("f(['2']"), "smoking yes opens questionnaire 2");
assert(menoraLine("menora__alcohol").includes("f(['1']"), "alcohol yes opens questionnaire 1");
assert(menoraLine("menora__drugs").includes("f(['2']"), "drugs yes opens questionnaire 2");
assert(menoraLine("menora__heart").includes("f(['4','5']"), "heart yes opens questionnaires 4 and 5");
assert(menoraLine("menora__male").includes("f(['23']"), "prostate yes opens questionnaire 23");
assert(menoraLine("menora__family").includes("f(['26']"), "family yes opens questionnaire 26");
assert(/n >= 23 && n <= 26\) return pageOneBased\(n \+ 1/.test(cfg), "questionnaire 23 opens the next page, the prostate form");
assert(cfg.includes('"2": 2') || cfg.includes('"2":2') || /pageForQuestionnaire\(qNo\)\{\s*const n = Number\(qNo\);\s*if\(n >= 1 && n <= 22\)/.test(cfg), "Menora 1-22 stay on their own pages");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
