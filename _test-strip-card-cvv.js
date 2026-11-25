#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");
const root = __dirname;
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const phone = fs.readFileSync(path.join(root, "phone", "phone.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");
const sql = fs.readFileSync(path.join(root, "supabase-gi-strip-card-cvv.sql"), "utf8");
let failed = 0;
function assert(cond, msg){
  if(!cond){
    failed += 1;
    console.error("FAIL", msg);
  }
}

const start = app.indexOf("function stripStoredCardSecurityCodes(");
const end = app.indexOf("function stripIssuedPolicyBlobsInPlace(");
assert(start > 0 && end > start, "the strip function sits ahead of the existing payload cleaner");
const strip = new Function(app.slice(start, end) + "\nreturn stripStoredCardSecurityCodes;")();

const customer = {
  primary: { cc: { holderName: "A", cardNumber: "0000", exp: "12/30", cvv: "999", cvc: "111" } },
  insureds: [{ data: { cc: { cardNumber: "0000", cvv2: "222", CID: "333" } } }],
  note: "cvv stays in a sentence",
  cvvNote: "keep"
};
const cleaned = strip(customer);
assert(customer.primary.cc.cvv === "999" && customer.insureds[0].data.cc.CID === "333", "the open form keeps what was typed");
assert(cleaned !== customer && cleaned.primary.cc !== customer.primary.cc, "the saved copy is separate");
assert(cleaned.primary.cc.cardNumber === "0000" && cleaned.primary.cc.exp === "12/30", "card number and expiry stay");
assert(!Object.prototype.hasOwnProperty.call(cleaned.primary.cc, "cvv"), "customer cvv is removed");
assert(!Object.prototype.hasOwnProperty.call(cleaned.primary.cc, "cvc"), "customer cvc is removed");
assert(!Object.prototype.hasOwnProperty.call(cleaned.insureds[0].data.cc, "cvv2"), "nested cvv2 is removed");
assert(!Object.prototype.hasOwnProperty.call(cleaned.insureds[0].data.cc, "CID"), "cid is removed regardless of case");
assert(cleaned.note.includes("cvv") && cleaned.cvvNote === "keep", "unrelated text and keys stay");
assert(cleaned.insureds[0].data.cc.cardNumber === "0000", "a nested card number stays");

const plain = { primary: { name: "A" }, rows: ["one"] };
assert(strip(plain) === plain && strip(plain.rows) === plain.rows, "a payload without a security code is not copied");

const proposal = { operational: { primary: { cc: { cardNumber: "0000", cvv: "999" } } } };
const cleanedProposal = strip(proposal);
assert(proposal.operational.primary.cc.cvv === "999", "the proposal on screen is left as it is");
assert(cleanedProposal.operational.primary.cc.cardNumber === "0000", "proposal card number stays");
assert(!Object.prototype.hasOwnProperty.call(cleanedProposal.operational.primary.cc, "cvv"), "proposal cvv is removed");

assert(app.includes("stripStoredCardSecurityCodes(c.payload)") && app.includes("stripStoredCardSecurityCodes(p.payload)"), "customer and proposal rows are cleaned before write");
assert(app.includes("const cleaned = stripStoredCardSecurityCodes(row.payload);"), "every storage write cleans a copy of the payload");

assert(phone.includes("function stripCardSecurityCodes("), "the phone app has the same cleaner");
assert(phone.includes("return stripCardSecurityCodes({"), "a phone offer is cleaned before it is saved");
assert((phone.match(/stripCardSecurityCodes\(/g) || []).length >= 5, "phone re-saves of an existing file are cleaned");

assert(html.includes("giNoCvv=1"), "the desktop script cache moves");
assert(sw.includes("no-cvv-v1"), "the service worker cache moves");
assert(sql.includes("update public.customers") && sql.includes("update public.proposals"), "the migration cleans both tables");
assert(sql.includes("drop function public.gi_strip_card_security_codes(jsonb);"), "the helper function is not left callable");
assert(/security invoker/i.test(sql), "the helper runs as the caller");
assert(!/grant\s+execute/i.test(sql), "the helper is not granted out");
assert(!/security definer/i.test(sql), "the helper is not security definer");

if(failed){
  console.error(failed + " failed");
  process.exit(1);
}
console.log("OK");
