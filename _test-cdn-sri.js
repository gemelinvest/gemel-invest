/**
 * CDN scripts on the public pages use the same SHA-384 pins as the main app.
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const read = (name) => fs.readFileSync(path.join(ROOT, name), "utf8");
let failed = 0;
function assert(cond, label) {
  if (cond) {
    console.log("OK " + label);
    return;
  }
  failed += 1;
  console.error("FAIL " + label);
}

const PDF = "sha384-/1qUCSGwTur9vjf/z9lmu/eCUYbpOTgSjmpbMQZ1/CtX2v/WcAIKqRv+U1DUCG6e";
const VIEWER = "sha384-ZuImm/ns71yCMJQSQESLFPxGZR61tFA8qajCJT7lue8oOitdT0BSFpb2s50Mfopn";
const CSS = "sha384-AsorB5/Nsf7XYGtSnLoB8c3OBWAx5UALYr8xEpCTVHxyQBTSi45f7lrS/3Dw7STW";
const SUPA = "sha384-Rj26LVGvoeRVR6+mwQmFfcR3QOBEwT+ZmuCWpuiqeTzJpCs0ER4ITAWGb4Hiy3Ok";
const PHONE_SUPA = "sha384-YieCqqg9gQufX7+5HcFvCEg/n3KUEdl8/Jb+A6J0npf1mB740VayvwKjTrtCeUoy";
const XLSX = "sha384-vtjasyidUo0kW94K5MXDXntzOJpQgBKXmE7e2Ga4LG0skTTLeBi97eFAXsqewJjw";
const PDF_LIB = "sha384-weMABwrltA6jWR8DDe9Jp5blk+tZQh7ugpCsF3JwSA53WZM9/14PjS5LAJNHNjAI";
const FONTKIT = "sha384-5W++++NSJ41PZSHU/+AHVXujWMaH22BAXyo+Le5vS6ZQaz/H5T++HtlFLCqD0wb2";

const disclosure = read("disclosure.html");
const signPage = read("s.html");
const viewer = read("gi-pdf-form-viewer.html");
const signJs = read("gi-sign-page.js");
const customerJs = read("gi-customer-sign.js");
const phoneHtml = read("phone/index.html");
const reviewHtml = read("phone/review.html");
const phoneJs = read("phone/phone.js");
const index = read("index.html");

assert(disclosure.includes(PDF) && disclosure.includes(SUPA), "disclosure pins pdf.js and supabase");
assert(signPage.includes(CSS), "the sign page pins the viewer stylesheet");
assert(viewer.includes(PDF) && viewer.includes(VIEWER) && viewer.includes(CSS), "the form viewer pins its three files");
assert(signJs.includes(PDF) && signJs.includes(VIEWER) && signJs.includes("s.integrity"), "the sign script pins both libraries");
assert(customerJs.includes(PDF) && customerJs.includes(VIEWER) && customerJs.includes(CSS), "customer signing pins the viewer files");
assert(phoneHtml.includes(PHONE_SUPA) && reviewHtml.includes(PHONE_SUPA), "the phone pages pin their supabase build");
assert(phoneJs.includes(PDF) && phoneJs.includes(XLSX) && phoneJs.includes(PDF_LIB) && phoneJs.includes(FONTKIT), "the phone app pins its document libraries");
assert(index.includes(VIEWER), "the main catalog records the viewer hash");
assert(disclosure.includes("object-src 'none'") && viewer.includes("object-src 'none'"), "the public document pages keep the same base policy");

["gi-sign-page.js", "gi-customer-sign.js", "phone/phone.js"].forEach((file) => {
  const check = spawnSync(process.execPath, ["--check", path.join(ROOT, file)], { encoding: "utf8" });
  assert(check.status === 0, "node --check " + file);
});

if (failed) {
  console.error(failed + " CDN integrity check(s) failed");
  process.exit(1);
}
console.log("OK CDN integrity checks passed");
