/* אשף בריאות: מיקוד ניתן לעריכה, מיקוד דואר ישראל, מפה, הצהרת בריאות, סרגל כמו אלמנטרי, שמירת מבוטחים.
   הרצה: node _test-health-wizard-agreed-fixes.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

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

function between(src, start, end){
  const a = src.indexOf(start);
  const b = end ? src.indexOf(end, a + start.length) : -1;
  if(a < 0) return "";
  return src.slice(a, b > a ? b : a + 4000);
}

const wizard = fs.readFileSync(path.join(ROOT, "gi-wizard.js"), "utf8");
const theme = fs.readFileSync(path.join(ROOT, "theme.css"), "utf8");
const appCss = fs.readFileSync(path.join(ROOT, "app.css"), "utf8");
const config = fs.readFileSync(path.join(ROOT, "supabase/config.toml"), "utf8");
const fn = fs.readFileSync(path.join(ROOT, "supabase/functions/gi-zip/index.ts"), "utf8");

console.log("1) syntax and frozen cache tag");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(wizard.includes('const GI_WIZARD_BUILD = "20261007-lead-dup-v1"'), "wizard build tag stays");

console.log("\n2) zip field");
const zipField = between(wizard, 'class="field lcZipField"', "getStep1");
assert(zipField.includes(">מיקוד אוטומטי<"), "label stays");
assert(zipField.includes('data-bind="zip"') && zipField.includes('data-zip="zip"'), "zip is a saved field");
assert(!zipField.includes("readonly"), "zip can be edited");
assert(!wizard.includes("המערכת תנסה למשוך מיקוד אוטומטי לפי עיר, רחוב ומספר בית."), "help line is gone");
assert(zipField.includes('data-zip-map="1"'), "map button sits next to the zip");
assert(zipField.includes("צפייה בכתובת"), "map button label");

console.log("\n3) Israel Post lookup, no guessed code");
const schedule = between(wizard, "scheduleZipLookup(ins, opts){", "lookupZipNominatim(");
assert(schedule.includes("lookupZipIsraelPost"), "lookup goes through the postal proxy");
assert(!schedule.includes("lookupZipNominatim"), "stored zip does not come from Nominatim");
assert(schedule.includes("if(!city || !street || !house)"), "house number is required");
assert(schedule.includes("_zipManual[ins.id] === key"), "a typed zip is not overwritten");
assert(schedule.includes("this._zipGen[ins.id] !== gen"), "a late answer does not overwrite a newer edit");
assert(schedule.includes("fromInput"), "typing the address asks again");
assert(schedule.includes("if(zip){"), "a returned code is what gets stored");
assert(schedule.includes("delete this._zipLastKey[ins.id]"), "a miss does not keep the address locked");
assert(wizard.includes("functions/v1/gi-zip"), "client calls gi-zip");
assert(!wizard.includes("5ccb5b137e7444d885be752eda7f767a"), "postal key stays on the server");
assert(fn.includes("pickExact") && fn.includes("SearchZip-Lang"), "function matches a name and asks for the house");
assert(config.includes("[functions.gi-zip]") && config.includes("verify_jwt = false"), "function is callable without a user JWT");

console.log("\n4) health declaration and the road");
const canJump = between(wizard, "canJumpToWizardStep(targetStep){", "_makeElementaryInsuredTemplate(");
assert(canJump.includes("st === 7) return true"), "health declaration opens directly");
assert(wizard.includes("validateNeedsMainConsideration()"), "finish and next still require the main consideration");
const renderSteps = between(wizard, "renderSteps(){", "renderTabs()");
assert(renderSteps.includes("if(this.isElementaryFlow())"), "elementary progress path stays first");
assert(renderSteps.includes("lcElementaryRoad"), "health stepper uses the road");
assert(!renderSteps.includes("lcElementaryRoad__car"), "health stepper has no car");
assert(wizard.includes("renderElementaryProgress(){") && wizard.slice(wizard.indexOf("renderElementaryProgress(){"), wizard.indexOf("renderElementaryProgress(){") + 1200).includes("lcElementaryRoad__car"), "elementary road still has its car");
assert(renderSteps.includes("lcWizard__stepper--road"), "health stepper marks the road layout");
assert(appCss.includes(".lcWizard__stepper--road .lcWizard__progressBar{ display: none; }"), "the old thin bar is hidden on the road");

console.log("\n5) insured people stay");
const addIns = between(wizard, "addInsured(type){", "removeInsured(");
assert(addIns.includes("flushActiveInsuredFromDom()"), "adding a person first keeps what is on screen");
assert(wizard.includes("_sessionInsuredsMissingFrom(clonedInsureds)"), "a loaded customer file keeps people who exist only in this session");
const sync = between(wizard, "_syncPrimaryStep1FromDom(){", "_capturePrimarySessionDataForExistingOffer");
assert(sync.includes("active !== primary") && sync.includes("_syncBoundFieldsInto(active)"), "the visible person is saved onto that person");
assert(wizard.includes("getDraftPayload"), "draft payload helper stays");

console.log("\n6) missing-fields dialog uses the system layer");
assert(theme.includes("GI-STEP1-VAL"), "dialog marker stays");
const step1Css = between(theme, "GI-STEP1-VAL", "Choice tiles");
assert(!step1Css.includes("340px"), "compact width override is gone");
assert(theme.includes("#giStep1ValidationModal .giValModal__dot"), "dot rule is scoped to this dialog");

function norm(v){
  return String(v || "").trim().replace(/[\s\-־'"״׳.()]/g, "");
}
function pickExact(rows, query){
  const want = norm(query);
  const names = (row) => [norm(row && row.n), norm(row && row.syn)].filter(Boolean);
  const exact = rows.filter((row) => names(row).some((name) => name === want));
  if(exact.length === 1) return exact[0];
  if(exact.length > 1) return null;
  const prefix = rows.filter((row) => names(row).some((name) => name.startsWith(want) || want.startsWith(name)));
  return prefix.length === 1 ? prefix[0] : null;
}

function ilGet(apiPath, params){
  const url = new URL("https://apimftprd.israelpost.co.il/mypost-zip/" + apiPath);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return fetch(url, {
    headers: {
      Accept: "application/json",
      "Ocp-Apim-Subscription-Key": "5ccb5b137e7444d885be752eda7f767a"
    }
  }).then(async (res) => {
    if(!res.ok) throw new Error("http " + res.status);
    const body = await res.json();
    if(!body || body.ReturnCode !== 0) throw new Error("return " + (body && body.ReturnCode));
    return body.Result;
  });
}

async function expectZip(city, street, house, expected){
  const cities = await ilGet("getcities-lang", { CityStartsWith: city, Lang: "he" });
  const cityRow = pickExact(Array.isArray(cities) ? cities : [], city);
  const streets = cityRow && cityRow.id
    ? await ilGet("GetStreets-lang", { CityID: String(cityRow.id), SearchMode: "ID-StartsWith", StartsWith: street, Lang: "he" })
    : [];
  const streetRow = pickExact(Array.isArray(streets) ? streets : [], street);
  const found = streetRow && streetRow.id
    ? await ilGet("SearchZip-Lang", {
      CityID: String(cityRow.id),
      StreetID: String(streetRow.id),
      House: house,
      Entry: "",
      Lang: "he",
      ByMaanimID: "true"
    })
    : null;
  const zip = String(found && found.zip || "").replace(/[^0-9]/g, "");
  assert(zip === expected, city + " " + street + " " + house + " → " + expected + " (got " + (zip || "empty") + ")");
}

(async () => {
  console.log("\n7) known Israel Post addresses");
  try{
    await expectZip("תל אביב", "דיזנגוף", "100", "6439612");
    await expectZip("תל אביב", "דיזנגוף", "50", "6433222");
    await expectZip("תל אביב", "דיזנגוף", "1", "6428101");
    await expectZip("ירושלים", "יפו", "1", "9414101");
    await expectZip("חיפה", "הרצל", "1", "3350205");
  }catch(err){
    failed += 1;
    console.error("  FAIL  live postal check: " + (err && err.message ? err.message : err));
  }
  if(failed){
    console.error("\nFAILED " + failed + " / passed " + passed);
    process.exit(1);
  }
  console.log("\nOK " + passed + " assertions");
})();
