/* רגרסיה: שליחת ביטול כלל מתיק לקוח — הרשאות, זכאות, מילוי PDF.
   הרצה: node _test-clal-cancel-send.js */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
let failed = 0;
let passed = 0;

function assert(cond, msg){
  if(cond){
    passed += 1;
    console.log("  PASS  " + msg);
  }else{
    failed += 1;
    console.error("  FAIL  " + msg);
  }
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const formJs = fs.readFileSync(path.join(ROOT, "gi-clal-cancel-form.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "app.css"), "utf8");

assert(app.includes("canSendPolicyCancel"), "CustomersUI.canSendPolicyCancel exists");
assert(app.includes("renderPolicySendCancelBtn"), "renderPolicySendCancelBtn exists");
assert(app.includes("data-policy-send-cancel"), "send cancel button attribute exists");
assert(app.includes("handlePolicySendCancel"), "handlePolicySendCancel exists");
assert(app.includes("ensureClalCancelFormLoaded"), "ensureClalCancelFormLoaded exists");
assert(app.includes("createClalCancelFormDoc"), "createClalCancelFormDoc exists");
assert(app.includes('clalCancelForm: "clal_cancel_form"'), "clalCancelForm doc type exists");

assert(formJs.includes("ClalCancelForm"), "ClalCancelForm module exported");
assert(formJs.includes("canSendPolicyCancel"), "ClalCancelForm.canSendPolicyCancel exists");
assert(formJs.includes("isPolicyCancelSendEligible"), "isPolicyCancelSendEligible exists");
assert(formJs.includes("isClalInsuranceCompany"), "isClalInsuranceCompany exists");

assert(css.includes("cfFile__sendCancelBtn"), "send cancel button CSS exists");

const pdfPath = path.join(ROOT, "forms", "clal-cancel", "clal-cancel.pdf");
assert(fs.existsSync(pdfPath), "clal-cancel.pdf template exists");
assert(fs.statSync(pdfPath).size > 100000, "clal-cancel.pdf has expected size");

const vm = require("vm");
const sandbox = { globalThis: {}, window: {}, Auth: {
  isManager: () => true,
  isOps: () => false
} };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(formJs, sandbox);
const ClalCancelForm = sandbox.ClalCancelForm;
assert(!!ClalCancelForm, "ClalCancelForm loads in vm");

assert(ClalCancelForm.canSendPolicyCancel({ isManager: () => true, isOps: () => false }), "manager can send");
assert(!ClalCancelForm.canSendPolicyCancel({ isManager: () => false, isOps: () => false }), "agent cannot send");
assert(ClalCancelForm.canSendPolicyCancel({ isManager: () => false, isOps: () => true }), "ops can send");

assert(ClalCancelForm.isPolicyCancelSendEligible({ existingStatus: "full" }), "full eligible");
assert(ClalCancelForm.isPolicyCancelSendEligible({ existingStatus: "partial_health" }), "partial eligible");
assert(!ClalCancelForm.isPolicyCancelSendEligible({ existingStatus: "agent_appoint" }), "appoint not eligible");

assert(ClalCancelForm.isClalInsuranceCompany("כלל"), "כלל matches");
assert(!ClalCancelForm.isClalInsuranceCompany("מנורה"), "menora excluded");

const rec = {
  payload: {
    insureds: [{
      label: "ישראל ישראלי",
      data: {
        firstName: "ישראל",
        lastName: "ישראלי",
        idNumber: "123456789",
        phone: "0501234567",
        city: "תל אביב",
        street: "הרצל",
        houseNumber: "1",
        email: "a@b.com"
      }
    }]
  }
};
const policy = {
  id: "p1",
  company: "כלל",
  type: "בריאות",
  policyNumber: "12345",
  existingStatus: "full",
  insuredLabel: "ישראל ישראלי",
  coverageValue: "500000"
};
const meta = ClalCancelForm.buildFillMeta(rec, policy);
assert(meta.customer.fullName === "ישראל ישראלי", "meta customer name");
assert(meta.cancelMode === "full", "full cancel mode");
assert(meta.fullCancel.policyDetails.includes("12345"), "policy number in details");

(async () => {
  try {
    const pdfLib = require("pdf-lib");
    try { global.fontkit = require("@pdf-lib/fontkit"); } catch(_fk) {}
    global.PDFLib = pdfLib;
    global.GI_LOAD_LIBS = { pdfLib: async () => {} };

    const origFetch = global.fetch;
    global.fetch = async (url) => {
      const u = String(url);
      if(u.includes("clal-cancel.pdf")){
        const buf = fs.readFileSync(pdfPath);
        return { ok: true, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
      }
      if(u.includes("Heebo-Bold.ttf") || u.includes("Rubik-Regular.ttf")){
        const fontPath = path.join(ROOT, "fonts", "Heebo-Bold.ttf");
        const buf = fs.readFileSync(fontPath);
        return { ok: true, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
      }
      return origFetch ? origFetch(url) : { ok: false };
    };

    sandbox.PDFLib = pdfLib;
    sandbox.fontkit = global.fontkit;
    sandbox.GI_LOAD_LIBS = global.GI_LOAD_LIBS;
    sandbox.fetch = global.fetch;

    const filled = await ClalCancelForm.fillPdf(rec, policy);
    assert(filled.bytes && filled.bytes.length > 100000, "filled PDF bytes generated");
    const loaded = await pdfLib.PDFDocument.load(filled.bytes);
    assert(loaded.getPageCount() === 1, "filled PDF is one page");
  } catch(err){
    assert(false, "fillPdf runtime: " + (err && err.message ? err.message : err));
  }

  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
})();
