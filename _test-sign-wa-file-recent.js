/* לינק מקוצר + כרטיס וואטסאפ, תייק לתיק, רקע כותרת, ענפים בלקוחות אחרונים.
   Run: node _test-sign-wa-file-recent.js
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

function read(name){
  return fs.readFileSync(path.join(ROOT, name), "utf8");
}

const app = read("app.js");
const html = read("index.html");
const js = read("gi-customer-sign.js");
const css = read("gi-customer-sign.css");
const sign = read("gi-sign.js");
const sw = read("service-worker.js");
const fn = read("supabase/functions/gi-sign/index.ts");
const theme = read("theme.css");

console.log("1) syntax");
["gi-customer-sign.js", "gi-sign.js", "gi-whatsapp-sign.js", "app.js"].forEach((name) => {
  assert(spawnSync(process.execPath, ["--check", path.join(ROOT, name)]).status === 0, "node --check " + name);
});

console.log("\n2) one share path for WhatsApp — short host or card, with customer name");
assert(sign.includes("function asShareHref") && sign.includes("asShareHref,"), "asShareHref is the public lock");
assert(sign.includes("shareSignHref,") && sign.includes("ownSignHref,") && sign.includes("ogPngForSigner,"), "GiSign exposes the share helpers");
assert((sign.match(/asShareHref\(shortList/g) || []).length === 2, "ops and forms both store the share href");
assert((sign.match(/!asShareHref\(row\.href\)/g) || []).length === 2, "ops and forms reject a CRM origin link");
assert(js.includes("async function shareHref") && js.includes("function asShareHref") && js.includes("function cardSignHref"), "customer-sign uses the shared helpers");
assert(!js.includes("function signHref") && !js.includes('url.origin + dir + "s/"'), "customer-sign no longer builds the CRM /s/ URL");
assert(js.includes("ogPngForSigner") && js.includes("ogPng: ogPng") && js.includes("openHref: open"), "create_upload gets the card image and open page");
assert(fn.includes("async function createUpload") && fn.includes("open_href: trim(body.openHref") && fn.includes("og_png: trim(body.ogPng"), "server stores the card on upload");
assert(sign.includes('SHARE_ORIGIN = "https://gi-go.rainy-reference.workers.dev"'), "short host stays the designated origin");
assert(!js.includes("github.io") && !sign.includes("github.io"), "github.io is not a share URL");
assert(html.includes("gi-sign.js?v=20261005-sign-survey-v1"), "gi-sign cache tag unchanged");

console.log("\n3) filed PDF lands in מסמכי לקוח");
const fileFn = app.slice(app.indexOf("async fileSignedCustomerUpload"), app.indexOf("canSendCancelSign"));
assert(fileFn.includes("ensureRecordPayload") && fileFn.includes("force: true"), "filing hydrates the full customer payload first");
assert(fileFn.includes("uploadBlob") && fileFn.includes("if(!up || up.ok !== true) return false"), "PDF is uploaded before persist");
assert(fileFn.includes("persistCustomerPayloadRecord") && js.includes("if(!filed)"), "toast waits for a real save");
assert(fileFn.includes("_openRefreshSig") && fileFn.includes("refreshOpenCustomerPreservingState"), "open file refreshes the documents tab");

console.log("\n4) header gradient");
assert(css.includes("linear-gradient(270deg") && css.includes("--sideA") && css.includes("#d8e8ff") && css.includes("#ffffff"), "header is sidebar blue fading to white");

console.log("\n5) recent customers never keep an empty sector/premium row");
assert(app.includes("recentCustomerMissingFacts") && app.includes("_recentPayloadHydrated"), "missing facts trigger a hydrate");
assert(app.includes('ensureRecordPayload("customers", id, { force: true })'), "stub-with-primary still loads payload");
assert(!app.includes("sameIds && nextFilled <= curFilled"), "same ids with more facts still replace the table");
assert(theme.includes("overflow: visible !important") && theme.includes("#view-dashboard .bankRecent .lcCustomers__sectorCell"), "sector tags are not clipped");

console.log("\n6) cache tags");
assert(html.includes("gi-customer-sign.js?v=20261005-cust-sign-v10"), "customer-sign js cache");
assert(html.includes("gi-customer-sign.css?v=20261005-cust-sign-v8"), "customer-sign css cache");
assert(html.includes("app.js?v=20261002-360-sums-health-v1&giSign=29"), "app.js health tag stays");
assert(sw.includes("20261002-360-sums-health-v1"), "service-worker health substring stays");
assert(sw.includes("cust-sign-v10"), "service-worker bumped for this screen");

console.log("\n7) runtime: CRM origin is never a WhatsApp share href");
const SHARE_ORIGIN = "https://gi-go.rainy-reference.workers.dev";
function trim(v){ return String(v == null ? "" : v).trim(); }
function shareOrigin(){ return trim(SHARE_ORIGIN).replace(/\/+$/, ""); }
function asShareHref(raw){
  const href = trim(raw);
  if(!href) return "";
  try {
    const url = new URL(href);
    if(/\/card\/[A-Za-z0-9]{6,16}\/?$/.test(url.pathname)) return href;
    if(url.origin === shareOrigin() && /\/[A-Za-z0-9]{6,16}\/?$/.test(url.pathname)) return href;
  } catch(_e) {
    if(href.indexOf("/card/") >= 0) return href;
  }
  return "";
}
assert(asShareHref("https://gi-go.rainy-reference.workers.dev/Ab12Cd34").endsWith("/Ab12Cd34"), "short host is accepted");
assert(asShareHref("https://example.supabase.co/functions/v1/gi-sign/card/Ab12Cd34").indexOf("/card/") >= 0, "card URL is accepted");
assert(!asShareHref("https://gemelinvest.github.io/gemel-invest/s/Ab12Cd34"), "github.io /s/ is rejected");
assert(!asShareHref("https://gemelinvest.github.io/gemel-invest/s.html?t=Ab12Cd34"), "CRM s.html is rejected");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
