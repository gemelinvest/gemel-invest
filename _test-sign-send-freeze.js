/* Ops send-for-signature must not freeze Chrome.
   Promise.all of html2canvas/pdf-lib starved the main thread; collectSendParts
   yields between documents so the overlay can paint.
   Run: node _test-sign-send-freeze.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
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
  const b = src.indexOf(end, a);
  if(a < 0 || b < 0) return "";
  return src.slice(a, b);
}

function busy(ms){
  const end = Date.now() + ms;
  while(Date.now() < end){}
}

function waitImmediate(){
  return new Promise((resolve) => setImmediate(resolve));
}

function watchLoop(){
  const gaps = [];
  let last = Date.now();
  let stop = false;
  function tick(){
    if(stop) return;
    const now = Date.now();
    gaps.push(now - last);
    last = now;
    setImmediate(tick);
  }
  setImmediate(tick);
  return {
    finish(){
      stop = true;
      return gaps.reduce((m, n) => n > m ? n : m, 0);
    }
  };
}

const signJs = fs.readFileSync(path.join(ROOT, "gi-sign.js"), "utf8");
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

console.log("1) source: sequential send with a real yield");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-sign.js")]).status === 0, "node --check gi-sign.js");
assert(signJs.includes("async function collectSendParts") && signJs.includes("await bytesForSendItem(rec, list[i])"), "המסמכים נבנים אחד אחרי השני");
assert(!signJs.includes("Promise.all(list.map((item) => bytesForSendItem"), "אין Promise.all על כל הטפסים ביחד");
assert(signJs.includes("scheduler.yield") && signJs.includes("setTimeout(paint, 0)"), "הדפדפן מקבל שליטה בין שלבים");
assert(signJs.includes("function holdSendProgress") && signJs.includes("מכין מסמך "), "מסך ההמתנה מתעדכן לפי מסמך");
assert(signJs.includes("base64ToBytesIdle") && signJs.includes("useObjectStreams: false"), "פענוח ואיחוד לא חוסמים ברצף אחד");
assert(app.includes("_mcPrefetchArrivalSign") && app.includes("_mcArrivalKindCache") && app.includes("summaryFormBytesForSend"), "פרמיה, נספח וטפסים שמורים לא נבנים מחדש");
assert(html.includes("gi-sign.js?v=20261002-sign-v34") && html.includes("&giSign=24"), "קבצי השליחה נטענים מחדש");
const formsSend = signJs.slice(signJs.indexOf("async function openFormsSend"), signJs.indexOf("async function syncCustomer"));
assert(formsSend.indexOf("bytesToBase64Idle") < formsSend.indexOf("decorateSigners(prepared") && !formsSend.includes("decoratedJob"), "כרטיס הוואטסאפ לא רץ במקביל להמרת ה-PDF");

const yieldSrc = sliceBetween(signJs, "function yieldPaint()", "async function openSend");
const holdSrc = sliceBetween(signJs, "function holdSendProgress", "function yieldPaint");
const collectSrc = sliceBetween(signJs, "async function collectSendParts", "async function openFormsSend");
assert(!!yieldSrc && !!holdSrc && !!collectSrc, "חולצו yieldPaint, holdSendProgress, collectSendParts");

const DOC_MS = 80;
const DOCS = 5;
const overlayNotes = [];
const starts = [];
const sandbox = {
  console,
  setTimeout,
  Date,
  Promise,
  scheduler: undefined,
  document: {
    getElementById(){
      return {
        querySelector(){
          return {
            set textContent(v){ overlayNotes.push(String(v)); },
            get textContent(){ return overlayNotes[overlayNotes.length - 1] || ""; }
          };
        }
      };
    }
  },
  async bytesForSendItem(_rec, item){
    starts.push(Date.now());
    await Promise.resolve();
    busy(DOC_MS);
    return new Uint8Array([item.id]);
  }
};
vm.runInNewContext(holdSrc + "\n" + yieldSrc + "\n" + collectSrc + "\nthis.collectSendParts = collectSendParts;", sandbox);

(async () => {
  const list = Array.from({ length: DOCS }, (_, i) => ({ id: i + 1 }));

  console.log("\n2) runtime: Promise.all starves the loop, collectSendParts does not");
  starts.length = 0;
  await waitImmediate();
  const oldWatch = watchLoop();
  await waitImmediate();
  await Promise.all(list.map((item) => sandbox.bytesForSendItem({}, item)));
  await waitImmediate();
  const oldGap = oldWatch.finish();
  const oldStarts = starts.map((t) => t - starts[0]);

  await new Promise((resolve) => setTimeout(resolve, 30));

  starts.length = 0;
  overlayNotes.length = 0;
  await waitImmediate();
  const newWatch = watchLoop();
  await waitImmediate();
  await sandbox.collectSendParts({}, list);
  await waitImmediate();
  const newGap = newWatch.finish();
  const newStarts = starts.map((t) => t - starts[0]);

  assert(oldStarts.every((n) => n < 10), "הנתיב הישן מתחיל את כל המסמכים יחד");
  assert(oldGap >= DOC_MS * (DOCS - 1) * 0.75, "הנתיב הישן חוסם את הלולאה (~" + oldGap + "ms)");
  assert(newStarts.slice(1).every((n, i) => n >= (i + 1) * (DOC_MS - 15)), "הנתיב החדש מתחיל מסמך רק אחרי הקודם");
  assert(newGap < DOC_MS * 1.8, "הנתיב החדש משחרר את הלולאה אחרי מסמך אחד (~" + newGap + "ms)");
  assert(overlayNotes.length === DOCS && overlayNotes[0].indexOf("מכין מסמך 1") >= 0 && overlayNotes[4].indexOf("מכין מסמך 5") >= 0, "ההודעה מתקדמת מסמך-מסמך");

  console.log("\n" + (failed ? "FAILED " + failed : "OK") + "  passed=" + passed + " failed=" + failed);
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  assert(false, "runtime freeze check failed: " + (err && err.message));
  console.log("\n" + (failed ? "FAILED " + failed : "OK") + "  passed=" + passed + " failed=" + failed);
  process.exit(1);
});
