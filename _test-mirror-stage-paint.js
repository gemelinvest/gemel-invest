/* שיקוף: עדכון מקומי בלי לבנות מחדש את כל המסך.
   הרצה: node _test-mirror-stage-paint.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");

const ROOT = __dirname;
const APP_TAG = "20261001-ho-pledge-totals-v1";
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
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

function extractMethod(src, name){
  let start = src.indexOf("    async " + name + "(");
  if(start < 0) start = src.indexOf("    " + name + "(");
  if(start < 0) return "";
  let i = src.indexOf("{", start);
  if(i < 0) return "";
  let depth = 0;
  for(; i < src.length; i++){
    const ch = src[i];
    if(ch === "{") depth += 1;
    else if(ch === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, i + 1);
    }
  }
  return "";
}

function asFunction(src){
  const trimmed = src.trim();
  return "function " + trimmed;
}

console.log("1) חוזה בקוד");
const zipSrc = extractMethod(app, "_mirrorBroadcastVerifyZip");
assert(zipSrc.includes("if(safeTrim(zip.value)) return;"), "מיקוד לא דורס כרטיס שכבר מולא");
const heirs = extractMethod(app, "_onBenefLegalHeirsToggle");
assert(heirs.includes("_mcReplaceOpenBenefCard"), "יורשים חוקיים מחליפים רק את הכרטיס");
assert(!heirs.includes("_renderBeneficiariesBody(rec);") || heirs.indexOf("_mcReplaceOpenBenefCard") < heirs.indexOf("_renderBeneficiariesBody"), "בנייה מחדש של מוטבים רק אם אין כרטיס");
const confirm = extractMethod(app, "_onBenefConfirmToggle");
assert(confirm.includes('if(el.matches && el.matches("input[type=\'checkbox\']")) return;'), "אישור מוטבים לא בונה את המסך");
assert(fs.readFileSync(path.join(ROOT, "index.html"), "utf8").includes("app.js?v=" + APP_TAG), "תג מטמון");

(async () => {
  const browser = await puppeteer.launch({
    executablePath: "/usr/local/bin/google-chrome",
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage"]
  });
  try{
    const page = await browser.newPage();
    await page.setContent(`<!doctype html><body>
      <div id="verify">
        <section data-mc-insured-card="a" data-mc-insured-role="primary"><input id="primaryZip" data-mc-verify-field="zip" value="11111"></section>
        <section data-mc-insured-card="b" data-mc-insured-role="adult"><input id="spouseZip" data-mc-verify-field="zip" value="22222"></section>
        <section data-mc-insured-card="c" data-mc-insured-role="adult"><input id="childZip" data-mc-verify-field="zip" value=""></section>
      </div>
      <div id="cancel">
        <p id="keepScroll">נוסח</p>
        <article data-mc-cancelq-policy="p1"><input data-mc-cancelq-reason value="ישן"></article>
        <article data-mc-cancelq-policy="p2"><input data-mc-cancelq-reason value="שכן"></article>
        <section class="mcCancelQIfNot"><span id="ifnot">ישן</span></section>
      </div>
      <div id="benef">
        <article data-mc-benef-policy="r1">
          <input id="name" data-mc-benef-field="firstName" value="דנה">
          <input id="ok" type="checkbox" data-mc-benef-confirm>
          <button type="button" id="heirs" data-mc-benef-legal-heirs>יורשים</button>
        </article>
        <article data-mc-benef-policy="r2"><input id="otherName" value="משה"></article>
      </div>
    </body>`, { waitUntil: "domcontentloaded" });

    const painted = await page.evaluate((zipCode, rowCode, patchCode, ifNotCode, confirmCode, heirsCode) => {
      window.safeTrim = (v) => (v == null ? "" : String(v).trim());
      window.escapeHtml = (v) => String(v == null ? "" : v)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      const zip = eval("(" + zipCode + ")");
      const row = eval("(" + rowCode + ")");
      const patch = eval("(" + patchCode + ")");
      const patchIf = eval("(" + ifNotCode + ")");
      const confirmFn = eval("(" + confirmCode + ")");
      const heirsFn = eval("(" + heirsCode + ")");
      const ui = {
        els: {
          verifyBody: document.getElementById("verify"),
          stepCancelQBody: document.getElementById("cancel"),
          stepBenefBody: document.getElementById("benef")
        },
        _mirrorBroadcastVerifyZip: zip,
        _mcCancelQRowHtml: row,
        _mcPatchCancelQRow: patch,
        _mcPatchCancelQIfNot: patchIf,
        _onBenefConfirmToggle: confirmFn,
        _onBenefLegalHeirsToggle: heirsFn,
        fullCancel: 0,
        fullBenef: 0,
        replaced: 0,
        _renderCancelQuestionnaireBody(){ this.fullCancel += 1; },
        _renderBeneficiariesBody(){ this.fullBenef += 1; },
        _mcReplaceOpenBenefCard(){ this.replaced += 1; return true; },
        _collectCancelQuestionnairePolicies(){
          return [{ policyId: "p1", insuredName: "יעל", company: "כלל", product: "ריסק" }];
        },
        _mirrorGetCancelQStore(){ return { policies: {} }; },
        _mirrorGetCancelExecOptions(){ return [{ value: "agent", label: "באמצעות הנציג" }]; },
        _mcCancelQStatusOptions(){ return [{ value: "full", label: "ביטול מלא" }, { value: "partial", label: "ביטול חלקי" }]; },
        _mcCancelQEffective(){ return { confirmed: "yes", executionMethod: "agent", reason: "מהמאגר", status: "partial" }; },
        _renderCancelQIfNotBlock(){ return `<section class="mcCancelQIfNot"><span id="ifnot">עודכן</span></section>`; },
        _getFreshCustomerRecord(){ return { id: "c1" }; },
        _benefTargetIdsFromCard(card){
          const id = card && card.getAttribute("data-mc-benef-policy");
          return id ? [id] : [];
        },
        _mirrorGetBenefStore(){
          if(!this._store) this._store = { policies: { r1: { confirmed: false, legalHeirs: false } } };
          return this._store;
        },
        _findRiskPolicyById(){
          return { policyId: "r1", mode: "risk_benef", policy: {} };
        }
      };
      ui._mirrorBroadcastVerifyZip(document.getElementById("primaryZip"));
      const spouseBefore = document.getElementById("spouseZip").value;
      const childAfter = document.getElementById("childZip").value;
      document.getElementById("spouseZip").value = "33333";
      ui._mirrorBroadcastVerifyZip(document.getElementById("spouseZip"));
      const childUntouched = document.getElementById("childZip").value;
      const primaryUntouched = document.getElementById("primaryZip").value;
      ui._mcPatchCancelQRow({ id: "c1" }, "p1");
      ui._mcPatchCancelQIfNot({ id: "c1" });
      const reasons = Array.from(document.querySelectorAll("[data-mc-cancelq-reason]")).map((el) => el.value);
      const scrollText = document.getElementById("keepScroll").textContent;
      const ifnot = document.getElementById("ifnot").textContent;
      const box = document.getElementById("ok");
      box.checked = true;
      ui._onBenefConfirmToggle(box);
      const nameAfterConfirm = document.getElementById("name").value;
      const otherAfterConfirm = document.getElementById("otherName").value;
      const confirmed = ui._store.policies.r1.confirmed;
      ui._onBenefLegalHeirsToggle(document.getElementById("heirs"));
      return {
        spouseBefore,
        childAfter,
        childUntouched,
        primaryUntouched,
        reasons,
        scrollText,
        ifnot,
        fullCancel: ui.fullCancel,
        confirmed,
        legalHeirs: ui._store.policies.r1.legalHeirs,
        nameAfterConfirm,
        otherAfterConfirm,
        fullBenef: ui.fullBenef,
        replaced: ui.replaced
      };
    }, asFunction(zipSrc), asFunction(extractMethod(app, "_mcCancelQRowHtml")), asFunction(extractMethod(app, "_mcPatchCancelQRow")), asFunction(extractMethod(app, "_mcPatchCancelQIfNot")), asFunction(extractMethod(app, "_onBenefConfirmToggle")), asFunction(extractMethod(app, "_onBenefLegalHeirsToggle")));

    console.log("\n2) התנהגות במסך");
    assert(painted.spouseBefore === "22222", "מיקוד קיים של מבוטח אחר נשאר");
    assert(painted.childAfter === "11111", "מיקוד ריק מקבל את המיקוד של הראשי");
    assert(painted.childUntouched === "11111" && painted.primaryUntouched === "11111", "הקלדה אצל מבוטח אחר לא דורסת את השאר");
    assert(painted.reasons[0] === "מהמאגר", "שורת הביטול שנלחצה מתעדכנת");
    assert(painted.reasons[1] === "שכן", "שורת ביטול אחרת לא נבנית מחדש");
    assert(painted.scrollText === "נוסח", "נוסח שאלון הביטול נשאר במקום");
    assert(painted.ifnot === "עודכן", "סעיף במידה ולא מתעדכן לבד");
    assert(painted.fullCancel === 0, "שאלון הביטול לא נבנה מחדש כולו");
    assert(painted.confirmed === true, "אישור מוטב נשמר");
    assert(painted.nameAfterConfirm === "דנה", "שדה מוטב נשאר אחרי האישור");
    assert(painted.otherAfterConfirm === "משה", "כרטיס מוטב אחר נשאר");
    assert(painted.fullBenef === 0, "אישור ויורשים לא בונים את כל מסך המוטבים");
    assert(painted.legalHeirs === true && painted.replaced === 1, "יורשים חוקיים מחליפים את הכרטיס הפתוח");
  } finally {
    await browser.close();
  }
  if(failed){
    console.error("\nFAILED " + failed + " / " + (passed + failed));
    process.exit(1);
  }
  console.log("\nOK " + passed + " checks");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
