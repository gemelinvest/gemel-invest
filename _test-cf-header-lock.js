/* GI-CF-HEAD-LOCK 2026-10-14
   כותרת תיק לקוח: הערת תזמון ארוכה לא נשפכת לפס ולא שוברת לחצנים.
   הרצה: node _test-cf-header-lock.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const vm = require("vm");

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

function sliceMethod(src, startToken){
  const start = src.indexOf(startToken);
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

const app = read("app.js");
const css = read("app.css");
const html = read("index.html");
const sw = read("service-worker.js");

console.log("1) cache + syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("giCfHeadLock=1"), "cache bust לכותרת");
assert(sw.includes("cf-head-lock-v1"), "service-worker מקבל סיומת כותרת");

console.log("\n2) הערה ארוכה לא נכנסת לגוף הפס");
const paint = sliceMethod(app, "paintCustomerBar(rec)");
assert(paint.includes("GI-CF-HEAD-LOCK"), "סימון נעילת כותרת בציור הפס");
assert(paint.includes("compactNote(cur.note"), "הערה מכווצת לפני הצגה");
assert(paint.includes('setAttribute("title"'), "הערה מלאה נשמרת ב-title");
assert(!paint.includes("cfMirrorBook__note"), "פס הכותרת בלי שורת הערה");
assert(paint.includes("הלקוח מתוזמן לשיחת שיקוף"), "סטטוס התזמון נשאר");
assert(paint.includes("cfMirrorBook__when"), "תאריך/שעה נשארים בפס");

const compact = sliceMethod(app, "compactNote(note, maxLen)");
assert(compact.includes('replace(/\\s+/g, " ")'), "שורות ההערה מתכווצות לשורה אחת");

const queue = sliceMethod(app, "queueMeta(rec)");
assert(queue.includes("compactNote(cur.note, 48)"), "שורת ממתינים מקבלת הערה מקוצרת");

console.log("\n3) CSS: הפס והכותרת לא גולשים");
assert(css.includes("GI-CF-HEAD-LOCK 2026-10-14"), "סימון CSS");
assert(/\.cfMirrorBook\{[^}]*overflow:\s*hidden/.test(css), "פס התזמון חותך עודף");
assert(/\.cfMirrorBook\{[^}]*max-width:\s*min\(260px/.test(css), "רוחב פס תזמון חסום");
assert(/\.cfFile__header\{[^}]*flex-wrap:\s*nowrap/.test(css), "כותרת בלי שבירת שורה");
assert(/\.cfFile__actions\{[^}]*flex-wrap:\s*nowrap/.test(css), "לחצני הכותרת בשורה אחת");
assert(/\.cfFile__tabs\{[^}]*flex-wrap:\s*nowrap/.test(css), "טאבים בשורה אחת");
assert(/\.cfFile__idCard\{[^}]*overflow:\s*hidden/.test(css), "כרטיס זהות לא גולש");
assert(/\.cfFile__chipText\{[^}]*text-overflow:\s*ellipsis/.test(css), "צ'יפים נחתכים בנקודות");

console.log("\n4) runtime: compactNote + paint בלי הערה ב-HTML");
const sandbox = {
  document: {
    getElementById(){ return sandbox._el; }
  },
  getHeroCallTimerView(){ return { mode: "hidden" }; },
  _el: { hidden: true, innerHTML: "", attrs: {}, setAttribute(k,v){ this.attrs[k]=v; }, removeAttribute(k){ delete this.attrs[k]; } }
};
const safeTrim = (v) => String(v ?? "").trim();
const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));
vm.createContext(sandbox);
sandbox.safeTrim = safeTrim;
sandbox.escapeHtml = escapeHtml;
vm.runInContext(`
  const MirrorCallBooking = {
    ${compact},
    formatWhen(date, time){ return [date, time].filter(Boolean).join(" · "); },
    read(rec){ return { current: rec && rec.current }; },
    hasCurrent(rec){ return !!(rec && rec.current && (rec.current.date || rec.current.time)); },
    ${paint}
  };
  this.MirrorCallBooking = MirrorCallBooking;
`, sandbox);

const longNote = "מוטבים בביטוח חיים -\nמידד - בן זוגה - 25אחוז - ת\"ז 055741334\nקובי - הבן - 25אחוז";
const compactOut = sandbox.MirrorCallBooking.compactNote(longNote, 40);
assert(!compactOut.includes("\n"), "compactNote בלי שורות חדשות");
assert(compactOut.length <= 40, "compactNote חסום באורך");

sandbox.MirrorCallBooking.paintCustomerBar({
  current: { date: "2026-10-13", time: "17:00", note: longNote }
});
assert(sandbox._el.hidden === false, "פס מוצג כשיש תזמון");
assert(!sandbox._el.innerHTML.includes("מוטבים"), "הערת מוטבים לא ב-HTML של הכותרת");
assert(!sandbox._el.innerHTML.includes("055741334"), "תעודות מההערה לא ב-HTML של הכותרת");
assert(sandbox._el.innerHTML.includes("17:00"), "השעה נשארת בפס");
assert(String(sandbox._el.attrs.title || "").includes("מוטבים"), "ההערה זמינה ב-title");

sandbox.getHeroCallTimerView = function(){ return { mode: "waiting" }; };
sandbox._el.hidden = false;
sandbox._el.innerHTML = "keep";
sandbox.MirrorCallBooking.paintCustomerBar({
  current: { date: "2026-10-13", time: "17:00", note: longNote }
});
assert(sandbox._el.hidden === true, "פס התזמון מוסתר כששעון סטטוס פעיל");
assert(sandbox._el.innerHTML === "", "פס מוסתר מתרוקן");

console.log("\n" + (failed ? ("FAILED: " + failed) : ("OK — " + passed + " checks")));
process.exit(failed ? 1 : 0);
