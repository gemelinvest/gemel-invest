/* Each approved product must open that company's own proposal PDF.
   Run: node _test-dedicated-company-forms.js

   Menora health currently fails: forms/menora-health/menora-health-join.pdf
   is the Migdal health AcroForm (MGQ / form 113/1581), byte-for-byte the
   same file as forms/migdal-health/migdal-health-join.pdf.
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
  assert(mgq === 0 || slug.indexOf("migdal") === 0, rel + " keeps Migdal MGQ fields on a Migdal form only");
});
onDisk.forEach((rel) => {
  assert(seenPath.has(rel), rel + " is opened by a product module");
});

console.log("\n2) no two companies share one PDF");
byHash.forEach((group) => {
  const slugs = [...new Set(group.map((row) => row.slug.split("-")[0]))];
  if(slugs.length === 1){
    assert(true, group.map((row) => row.rel).join(" + ") + " stays inside " + slugs[0]);
    return;
  }
  assert(false, "same bytes in different companies: " + group.map((row) => row.rel).join(" == "));
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
assert(!/MGQ/.test(menoraRows), "Menora health answers are not written into Migdal MGQ fields");

const menoraPdf = path.join(ROOT, "forms/menora-health/menora-health-join.pdf");
const migdalPdf = path.join(ROOT, "forms/migdal-health/migdal-health-join.pdf");
assert(sha256(fs.readFileSync(menoraPdf)) !== sha256(fs.readFileSync(migdalPdf)), "Menora health PDF is not a copy of the Migdal health PDF");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
