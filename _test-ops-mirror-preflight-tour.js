/* מסכי היכרות לפני שיחת שיקוף, במקום גלילת הצ׳ק־ליסט.
   הרצה: node _test-ops-mirror-preflight-tour.js
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

function extract(src, name){
  const needle = "\n    " + name + "(";
  const start = src.indexOf(needle);
  if(start < 0) return "";
  const paren = src.indexOf("(", start);
  let parenDepth = 0;
  let i = paren;
  for(; i < src.length; i += 1){
    if(src[i] === "(") parenDepth += 1;
    else if(src[i] === ")"){
      parenDepth -= 1;
      if(parenDepth === 0){ i += 1; break; }
    }
  }
  const brace = src.indexOf("{", i);
  let depth = 0;
  for(let j = brace; j < src.length; j += 1){
    if(src[j] === "{") depth += 1;
    else if(src[j] === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, j + 1).trim();
    }
  }
  return "";
}

function escapeHtml(s){
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
function safeTrim(v){ return String(v == null ? "" : v).trim(); }

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "app.css"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");

console.log("1) syntax, cache, and the old ack stays in the markup");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=20261007-lead-dup-v1&giSign=29"), "קידומת app.js נשמרה");
assert(html.includes("&giMcTour=1"), "app.js ו-css קיבלו אסימון סיור");
assert(sw.includes("-mc-tour-v1"), "service worker מתרענן");
assert(app.includes('const BUILD = "20261007-lead-dup-v1"'), "BUILD לא הוחלף");
assert(html.includes("אני מאשר שעברתי על הצ׳ק־ליסט"), "טקסט האישור הישן נשאר ב-HTML");
assert(css.includes(".mcPreFlightModal.is-tour .mcPreFlightActions{display:none;}"), "כפתור האישור הישן מוסתר בזמן הסיור");
assert(css.includes("stroke:#2a5cf5;"), "הציור בצבע המערכת");
assert(css.includes(".mcTourWhistle{animation:none !important;}"), "תנועה מופחתת עוצרת את המשרוקית");
assert(css.includes("@keyframes mcTourStroke"), "האיור נמתח בקו");
assert(css.includes("font-size:clamp(32px, 4vw, 40px);"), "כותרות הסיור גדולות");

const brief = extract(app, "_preFlightBriefHtml");
assert(brief.includes('class="mc360"') && brief.includes("מספר פוליסה") && brief.includes("חדש ללקוח"), "תקציר 360 לא נבנה מחדש");
assert(brief.includes('this._preFlight360Slide(4, "doc", "ביטוחים לביטול"'), "שקופית הביטול נשארת בתקציר");

const paintStart = app.indexOf("_paintPreFlightChecklist(){");
const paintEnd = app.indexOf("_togglePreFlightStep(", paintStart);
const paint = app.slice(paintStart, paintEnd);
assert(paint.includes("this.selectedCustomer") && paint.includes("State.data?.customers"), "הציור עדיין קורא את הלקוח שנבחר");
assert(!paint.includes("_getFreshCustomerRecord"), "הסיור לא נפתח מתיק עורך הטפסים");
assert(paint.includes('preFlightModal.classList.add("is-tour")'), "החלון מסומן כסיור");

const resetStart = app.indexOf("_resetPreFlightChecks(){");
const resetEnd = app.indexOf("_preFlightPayload(", resetStart);
assert(app.slice(resetStart, resetEnd).includes("this._preFlightTourStage = 0"), "לקוח חדש מתחיל מהמסך הראשון");

const clickStart = app.indexOf('const tourBtn = ev.target?.closest?.("[data-mc-tour]")');
const clickEnd = app.indexOf("if(this.els.preFlightAckBtn)", clickStart);
const click = app.slice(clickStart, clickEnd);
assert(click.includes('act === "go"') && click.includes("this._acceptPreFlightChecklist()"), "המשרוקית נכנסת למסלול האישור הקיים");
assert(!click.includes("toggleCall"), "המשרוקית לא מתחילה את השיחה בעצמה");

console.log("\n2) runtime");
const names = [
  "_preFlightPaySnapshot",
  "_preFlightTourAgentFirst",
  "_preFlightTourPay",
  "_preFlightTourStages",
  "_preFlightBriefSlides",
  "_preFlightTourNewsHtml",
  "_preFlightTourDraw",
  "_preFlightTourCardSvg",
  "_preFlightTourPeopleMarks",
  "_preFlightTourNav",
  "_preFlightTourHtml"
];
let code = "";
names.forEach((name) => {
  const src = extract(app, name);
  assert(!!src, "חולץ " + name);
  if(src) code += "this." + name + " = function" + src.slice(name.length) + ";\n";
});

function briefHtml(rows){
  const sale = rows.map((row) =>
    '<tr class="mc360SaleRow"><td>' + row.company + "</td><td>" + row.product + "</td><td>" + row.who + "</td></tr>"
  ).join("");
  return '<div class="mc360">' +
    '<section class="mc360Slide"><header class="mc360Slide__head">ישן</header><div class="mc360People">' +
      '<details class="mc360Person"><summary class="mc360Person__bar"><b>ארז מאיר</b></summary></details>' +
      '<details class="mc360Person"><summary class="mc360Person__bar"><b>מיכל מאיר</b></summary></details>' +
    "</div></section>" +
    '<section class="mc360Slide"><header class="mc360Slide__head">ישן</header><table class="mc360Table"><tr><td class="mc360NumPol">45822109</td></tr></table></section>' +
    '<section class="mc360Slide"><header class="mc360Slide__head">חדש ללקוח</header><table class="mc360Table mc360Table--sale"><thead><tr><th>חברה</th><th>מוצר</th><th>מבוטח</th></tr></thead><tbody>' +
      sale + "</tbody></table></section>" +
    '<section class="mc360Slide">ביטול-לא-בסיור</section>' +
    '<section class="mc360Slide">תשלום-ישן</section>' +
    '<section class="mc360Slide"><header class="mc360Slide__head">ישן</header><section class="mcHealthYesBox">כן-מהתיק</section></section>' +
    "</div>";
}

const host = {
  escapeHtml,
  safeTrim,
  Auth: { current: { name: "אוריה כהן" } },
  _preFlightTourStage: 0,
  _rows: [
    { company: "הפניקס", product: "ריסק", who: "ארז מאיר" },
    { company: "כלל", product: "בריאות", who: "מיכל מאיר" }
  ],
  _pl: { primary: {} },
  _preFlightPayload(){ return this._pl; },
  _preFlightInsureds(){
    return [{ id: "a" }, { id: "b" }];
  },
  _mirrorFullNameFromIns(_rec, ins){ return ins.id === "a" ? "ארז מאיר" : "מיכל מאיר"; },
  _preFlightInsuredLabel(){ return "מבוטח"; },
  _preFlightBriefHtml(){ return briefHtml(this._rows); }
};
vm.runInNewContext(code, host);

const hello = host._preFlightTourHtml({});
assert(hello.includes("היי אוריה"), "פתיח עם שם פרטי של הנציג");
assert(hello.includes("בוא נכיר קצת על הלקוח"), "משפט הפתיחה");
assert(hello.includes('data-mc-tour="start"') && hello.includes("התחל"), "כפתור התחל");
assert(hello.includes("mcTourDraw"), "איור נמתח בפתיחה");
assert(!hello.includes("4580123499887766"), "מספר כרטיס לא מופיע בפתיחה");

host._preFlightTourStage = 1;
const people = host._preFlightTourHtml({});
assert(people.includes("כמה מבוטחים יהיו לנו בשיחה"), "שאלת המבוטחים");
assert(people.includes('class="mcTour__count">2<'), "המספר תואם את כמות המבוטחים");
assert((people.match(/mcTourDraw--mini/g) || []).length === 2, "אייקון לכל מבוטח");
assert((people.match(/mc360Person/g) || []).length >= 2, "לחיצה על השם פותחת את כרטיס הפרטים הקיים");

host._preFlightTourStage = 2;
const existing = host._preFlightTourHtml({});
assert(existing.includes("אז מה קיים היום"), "כותרת הקיים");
assert(existing.includes("ארז מאיר · מיכל מאיר"), "שמות המבוטחים מעל הרשימה");
assert(existing.includes("45822109"), "טבלת הקיים מהתקציר");

host._preFlightTourStage = 3;
const news = host._preFlightTourHtml({});
assert(news.includes("הפוליסות החדשות"), "כותרת הפוליסות החדשות");
assert((news.match(/mcTourGroup__name/g) || []).length === 2, "לכל מבוטח רשימה משלו");
assert(news.includes("ארז מאיר") && news.includes("מיכל מאיר") && news.includes("הפניקס") && news.includes("כלל"), "השורות נשארות עם החברה והמוצר");
assert(!news.includes("ביטול-לא-בסיור"), "שלב הביטול לא נכנס לסיור");

host._rows = [{ company: "הפניקס", product: "ריסק", who: "ארז מאיר" }];
host._preFlightTourStage = 3;
const oneNews = host._preFlightTourHtml({});
assert(!oneNews.includes("mcTourGroup"), "מבוטח אחד נשאר בטבלה המקורית");
assert(oneNews.includes("mc360Table--sale"), "הטבלה המקורית נשמרת");
host._rows = [
  { company: "הפניקס", product: "ריסק", who: "ארז מאיר" },
  { company: "כלל", product: "בריאות", who: "מיכל מאיר" }
];

host._pl = { primary: { paymentMethod: "cc", cc: { cardNumber: "4580123499887766", holderName: "ארז מאיר", exp: "12/28" }, ho: { bankName: "בנק לאומי", account: "998877" } } };
let stages = host._preFlightTourStages({});
assert(stages.indexOf("pay") === 4, "כרטיס אשראי מוסיף מסך תשלום");
host._preFlightTourStage = stages.indexOf("pay");
const cc = host._preFlightTourHtml({});
assert(cc.includes("mcTourDraw--card") && cc.includes("4580123499887766"), "הכרטיס מצויר עם המספר מהתיק");
assert(!cc.includes("בנק לאומי"), "מסך אשראי לא מצייר הוראת קבע");
assert(!/0000|1234 5678|1111/.test(cc), "אין ספרות מומצאות");

host._pl = { primary: { paymentMethod: "ho", cc: { cardNumber: "4580123499887766" }, ho: { bankName: "בנק לאומי", bankNo: "10", branch: "801", account: "998877" } } };
stages = host._preFlightTourStages({});
host._preFlightTourStage = stages.indexOf("pay");
const ho = host._preFlightTourHtml({});
assert(ho.includes("תשלום בהוראת קבע") && ho.includes("בנק לאומי") && ho.includes("998877") && ho.includes("801"), "הוראת קבע מציגה את הבנק מהתיק");
assert(!ho.includes("4580123499887766") && !ho.includes("mcTourDraw--card"), "הוראת קבע לא מציירת כרטיס ולא את מספר הכרטיס");

host._pl = { primary: { cc: { cardNumber: "4580123499887766" } } };
stages = host._preFlightTourStages({});
assert(stages.join(",") === "hello,people,existing,news,health,go", "בלי אמצעי תשלום אין מסך תשלום");
host._preFlightTourStage = stages.indexOf("health");
const health = host._preFlightTourHtml({});
assert(health.includes("בעיות רפואיות שהצהירו המבוטחים"), "כותרת ההצהרות");
assert(health.includes("כן-מהתיק"), "רק מה שכבר מסוכם כתשובת כן");
assert(!health.includes("ביטול-לא-בסיור"), "ההצהרה לא מערבת את הביטול");

host._preFlightTourStage = stages.indexOf("go");
const go = host._preFlightTourHtml({});
assert(go.includes("יאללה אפשר לצאת לשיחה") && go.includes("mcTourWhistle") && go.includes('data-mc-tour="go"'), "משרוקית היציאה");
assert(!go.includes("toggleCall()"), "מסך היציאה לא קורא להתחלת שיחה");

host.Auth.current.name = "  ";
host._preFlightTourStage = 0;
assert(host._preFlightTourHtml({}).includes("היי נציג"), "בלי שם נציג נשארת פנייה כללית");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
