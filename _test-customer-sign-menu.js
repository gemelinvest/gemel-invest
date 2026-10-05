/* מערכת החתמת לקוח בתפריט הצד, לכל משתמש.
   Run: node _test-customer-sign-menu.js
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

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const js = fs.readFileSync(path.join(ROOT, "gi-customer-sign.js"), "utf8");
const fn = fs.readFileSync(path.join(ROOT, "supabase/functions/gi-sign/index.ts"), "utf8");

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-customer-sign.js")]).status === 0, "node --check gi-customer-sign.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");

console.log("\n2) every logged-in user sees the side menu");
assert(html.includes('data-view="customerSign"'), "nav item");
assert(html.includes("מערכת החתמת לקוח"), "menu label");
assert(html.includes('id="view-customerSign"'), "view");
assert(html.includes("gi-customer-sign.js"), "script");
assert(app.includes('customerSign: "מערכת החתמת לקוח"'), "page title");
assert(app.includes('safe !== "customerSign"') , "referent can open it");
assert(app.includes('v === "customerSign"'), "referent menu keeps it");
assert(app.includes('getElementById("navCustomerSign")'), "shown for the current user");
assert(app.includes("CustomerSignUI?.open"), "view opens the screen");

console.log("\n3) upload, name, place, then a link instead of WhatsApp");
assert(js.includes("העלאת מסמך לחתימה"), "upload button");
assert(js.includes("שם למסמך"), "asks for a document name");
assert(js.includes("סיימתי להציב חתימות"), "finish placing button");
assert(js.includes("מספר טלפון לשליחה"), "asks for a phone");
assert(js.includes(">שלח<"), "send button");
assert(js.includes('action: "create_upload"'), "creates a signing packet");
assert(js.includes("הלינק לשליחה מוכן"), "shows the link");
assert(js.includes("pdf_viewer.js") && js.includes('currentScaleValue = "page-width"'), "opens the PDF with the shared viewer");
assert(js.includes("giCustSign__url"), "link is shown as text");
assert(js.includes("לא נשלחה הודעת וואטסאפ"), "does not send WhatsApp");
assert(!js.includes("wa.me") && !js.includes("whatsapp"), "no direct WhatsApp call");
assert(fn.includes('action === "create_upload"'), "server action");
assert(fn.includes("sentWhatsapp: false"), "server marks WhatsApp as not sent");
assert(fn.includes("async function requireActiveAgent"), "any active user, not only a manager");

const opens = (fn.match(/{/g) || []).length;
const closes = (fn.match(/}/g) || []).length;
assert(opens === closes, "edge function braces " + opens + " / " + closes);

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
