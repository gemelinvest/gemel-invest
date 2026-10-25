/* GI-OPS-SUMMARY-PDF-WORKER 2026-10-13
   מסמך התאמה ודוח פרמיה: צילום ה-PNG נשאר על המסך,
   ו-addImage רץ ב-worker כדי שהסימון לשליחה לא יינעל.
   הרצה: node _test-arrival-pdf-worker.js
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

function sliceBetween(src, start, end){
  const a = src.indexOf(start);
  const b = src.indexOf(end, a + start.length);
  if(a < 0 || b < 0) return "";
  return src.slice(a, b);
}

const arrival = fs.readFileSync(path.join(ROOT, "gi-arrival-docs.js"), "utf8");
const worker = fs.readFileSync(path.join(ROOT, "gi-pdf-image-worker.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-arrival-docs.js")]).status === 0, "node --check gi-arrival-docs.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-pdf-image-worker.js")]).status === 0, "node --check gi-pdf-image-worker.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");

console.log("\n2) capture stays on the page, addImage does not");
const capture = sliceBetween(arrival, "async htmlToPdfBytes(html, options = {}){", "async hatamaSignPdf(draft){");
assert(capture.includes("scale: 3"), "html2canvas stays at scale 3");
assert(capture.includes('toBlob((file) => resolve(file), "image/png")'), "pages are still sharp PNG");
assert(capture.includes('toDataURL("image/png")'), "png fallback keeps the original text");
assert(capture.includes("composeArrivalPdf(pdfPages)"), "the PDF is composed after the capture");
assert(!capture.includes("addImage"), "htmlToPdfBytes does not embed the PNG on the page thread");
assert(!capture.includes("new JsPdfCtor"), "htmlToPdfBytes does not build the PDF object on the page thread");
assert(capture.includes("A4_PT_W") && capture.includes("A4_PT_H"), "page slice still uses the A4 point size");

console.log("\n3) worker embeds the same PNG, with the pinned jsPDF");
assert(worker.includes('pdf.addImage(bytes, "PNG", 0, 0, pw, drawH)'), "worker stores a sharp PNG");
assert(worker.includes('format: "a4"') && worker.includes("compress: true"), "worker keeps A4 and compression");
assert(!worker.includes("html2canvas"), "worker does not touch the DOM capture");
assert(!worker.includes("importScripts"), "worker does not load the CDN without SRI");
assert(worker.includes("(0, eval)(String(source || \"\"))"), "worker runs the SRI-checked jsPDF source");
assert(arrival.includes("integrity: JSPDF_SRI"), "page verifies jsPDF before the worker starts");
assert(arrival.includes('credentials: "omit"') && arrival.includes('mode: "cors"'), "jsPDF fetch is CORS so integrity can run");
const sri = html.match(/jspdf@2\.5\.1\/dist\/jspdf\.umd\.min\.js": "(sha384-[^"]+)"/);
assert(sri && arrival.includes('const JSPDF_SRI = "' + sri[1] + '"'), "arrival docs pin the same jsPDF hash");
assert(arrival.includes("composeArrivalPdfOnMain") && arrival.includes('pdf.addImage(img, "PNG"'), "if the worker cannot start, the PNG is still embedded");
assert(arrival.indexOf("await ensurePdfImageWorker()") < arrival.indexOf("return composeArrivalPdfOnMain(pages)"), "a failed worker start is the only main-thread embed");

console.log("\n4) cache bust so the summary screen loads this path");
assert(app.includes('GI_ARRIVAL_DOCS_HREF = "./gi-arrival-docs.js?v=20261007-lead-dup-v1&giSign=5&giPremiaEach=1&giPdfWorker=1&giMcPlan=1"'), "arrival docs href changed");
assert(arrival.includes('const PDF_IMAGE_WORKER_HREF = "./gi-pdf-image-worker.js?v=20261013-pdf-worker-v1"'), "worker script is versioned");
assert(arrival.includes("new Worker(new URL(PDF_IMAGE_WORKER_HREF, global.location.href))"), "worker is loaded from the page origin");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
