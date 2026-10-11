/* GI-OPS 2026-10-10 — מסך פלזמה חי למוקד שירות ותפעול
   הרצה: node _test-plasma-wall.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
let failed = 0;
let passed = 0;

function assert(cond, msg) {
  if (cond) {
    passed += 1;
    console.log("  PASS  " + msg);
  } else {
    failed += 1;
    console.error("  FAIL  " + msg);
  }
}

function read(name) {
  return fs.readFileSync(path.join(ROOT, name), "utf8");
}

const html = read("plasma.html");
const css = read("plasma.css");
const js = read("plasma.js");
const sw = read("service-worker.js");

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "plasma.js")]).status === 0, "node --check plasma.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-plasma-wall.js")]).status === 0, "node --check this test");

console.log("\n2) כותרות לפי האישור");
assert(html.includes("מוקד שירות ותפעול"), "כותרת מוקד שירות ותפעול");
assert(html.includes("מי הדוגמן/נית היום בסוכנות") && html.includes('id="modelCard"') && html.includes('id="modelCaption"') && !html.includes('id="kpiCalls"'), "כרטיס הדוגמן במקום כעת בשיחה");
assert(html.includes("לקוחות בשיחה כעת"), "לקוחות בשיחה כעת");
assert(html.includes("שיקופים שבוצעו"), "שיקופים שבוצעו");
assert(html.includes('id="kpiDone"'), "מונה שיקופים שהושלמו");
assert(!html.includes("זמן המתנה ממוצע"), "אין כרטיס זמן המתנה ממוצע");
assert(html.includes("פרמיה שעברה להפקה") && html.includes('id="kpiProduction"'), "פרמיה שעברה להפקה");
assert(!html.includes("נציגים במשמרת") && !html.includes('id="kpiAgents"'), "כרטיס נציגים במשמרת ירד");
assert(html.includes("היקף פרמיה ממתינה לשיקוף") && html.includes('id="kpiScope"'), "היקף פרמיה ממתינה לשיקוף");
assert(!html.includes("מצטיין יומי") && !html.includes('id="kpiStar"'), "מצטיין יומי ירד");
assert(html.includes("לקוחות ממתינים בתור"), "טבלת ממתינים");
assert(html.includes("לקוחות בשיחה כעת"), "לקוחות בשיחה כעת");
assert(html.includes("שלב בשיחה"), "שלב בשיחה");
assert(html.includes("הבא בתור לשיקוף") && !html.includes("הלקוח הבא בתור"), "הבא בתור לשיקוף");
assert(html.includes("נכנס תיק חדש לשיקוף"), "קפיצת תיק חדש");
assert(!html.includes('id="greet"') && !html.includes("top__greet"), "אין ברכת יום למעלה");

console.log("\n3) נתונים חיים, לא הדגמה");
assert(js.includes("vhvlkerectggovfihjgm.supabase.co"), "חיבור למערכת");
assert(js.includes("function waitingMirrorTotal") && js.includes("issuedToProductionAt") && !js.includes("gi_daily_sales_by_agent"), "היקף הפרמיה הממתינה לשיקוף במקום מצטיין יומי");
assert(js.includes("issuedToProductionAt") && js.includes("function productionTotal"), "פרמיה שעברה להפקה מתיקים שהועברו");
assert(!js.includes("gi_agent_live") && !js.includes("kpiAgents"), "מונה הנציגים במשמרת ירד");
assert(js.includes("submittedToOpsAt"), "תור שיקוף אמיתי");
assert(js.includes("waitingMirrorAt"), "זמן המתנה מחותמת הכניסה לתור");
assert(js.includes("POP_MS = 5000"), "התיקייה נשארת 5 שניות");
assert(js.includes("popQueue"), "תיקים נכנסים אחד אחרי השני");
assert(!js.includes("דוד כהן") && !js.includes("נועה לוי"), "אין שמות הדגמה");
assert(js.includes("setInterval(pull, POLL_MS)") && js.includes("POLL_MS = 8000"), "עדכון אוטומטי בלי רענון");
assert(!html.includes("cdn.jsdelivr.net") && js.includes("/rest/v1/") && js.includes("gi_verify_agent_login") && js.includes("/auth/v1/token?grant_type=refresh_token"), "הכניסה בטלוויזיה בלי ספרייה חיצונית");
assert(!js.includes("לא נטענה הכניסה למערכת") && !js.includes("createClient"), "אין הודעת ספרייה חסרה ואין תלות בחלון supabase");
const loginSrc = js.slice(js.indexOf("async function login"), js.indexOf("async function sessionAlive"));
assert(loginSrc.indexOf("clearSession()") >= 0 && loginSrc.indexOf("clearSession()") < loginSrc.indexOf("findAgent("), "כניסה מוחקת אסימון שפג לפני הבדיקה");
assert(js.includes('restGet("agents", { select: "id,name,username,role,active" }, true)') && /restRpc\("gi_verify_agent_login"[\s\S]{0,220}, true\)/.test(loginSrc), "בדיקת המשתמש בלי האסימון הישן");
assert(js.includes("הכניסה הקודמת פגה. נסו שוב.") && js.includes("jwt expired"), "אסימון שפג לא נשאר באנגלית על המסך");

console.log("\n4) עיצוב מסך");
assert(css.includes("--navy:#3870ED"), "כחול תפריט הצד");
assert(!css.includes("#0d4c86") && !html.includes("#0c447c"), "אין כחול כהה ישן");
assert(js.includes("1920") && js.includes("1080"), "קנבס טלוויזיה");
assert(js.includes("translate(") && css.includes("transform-origin:0 0"), "המסך ממורכז בחלון ולא נחתך");
assert(js.includes("function viewSize") && js.includes("!(s > 0)") && js.includes("function armFit") && css.includes("height:100vh") && css.includes("top:0") && css.includes("left:0"), "טלוויזיה בלי מידת חלון לא מקבלת מסך ריק");
assert(js.includes("dropAppWorker") && sw.includes("plasma\\.html") && sw.includes("if (plasmaNav) throw _e;"), "מסך הפלזמה לא מוחלף במערכת כשהטלוויזיה נכשלת בטעינה");
assert(css.includes("@keyframes page"), "דפי התיקייה מדפדפים");
assert(css.includes("@keyframes soon"), "הבהוב למתקרב למועד");
assert(html.includes("logo-login-clean.png"), "לוגו המערכת");
assert(!html.includes('id="clockHour"') && !html.includes('id="clockMin"') && !html.includes('id="clockSec"') && !html.includes('id="dateLine"'), "אין שעון ותאריך למעלה");
const secCss = css.slice(css.indexOf(".floorClock__sec{"), css.indexOf(".floorClock__date{"));
assert(html.includes('class="colon"') && css.includes(".floorClock__hm .colon{ color:#5c6b7e; }") && secCss.includes("color:#5c6b7e") && !secCss.includes("var(--blue)"), "הנקודתיים והשניות אפורות");
const dateCss = css.slice(css.indexOf(".floorClock__date{"), css.indexOf("}", css.indexOf(".floorClock__date{")));
assert(dateCss.includes("color:var(--blue)") && !dateCss.includes("#5c6b7e"), "תאריך השעון בכחול של ענן מזג האוויר");
assert(js.includes("premiumAfterDiscountValue"), "פרמיית פוליסות מוצעות");
assert(js.includes("payload->newPolicies"), "שליפת פוליסות מוצעות");
assert(js.includes('origin || "") === "existing"'), "פוליסות קיימות לא נספרות");
var body = html.slice(html.indexOf('class="body"'));
assert(body.indexOf("לקוחות בשיחה כעת") >= 0 && body.indexOf("לקוחות בשיחה כעת") < body.indexOf("לקוחות ממתינים בתור"), "שיחות בטבלה הגדולה והתור ברצועה");
assert(html.includes("פרמיה") && html.includes("מועד שיחה"), "עמודות תור: פרמיה ומועד");
assert(html.includes('id="radioAudio"') && !html.includes('id="radioMenu"') && !html.includes('id="radioBox"'), "המוזיקה מתנגנת בלי פאנל על המסך");
assert(js.includes("glzwizzlv.bynetcdn.com/glglz_mp3"), "שידור גלגל״צ");
assert(js.includes("glglz_hits_mp3") && js.includes("glglz_med_mp3") && js.includes("glglz_rock_mp3") && js.includes("glglz_alt_mp3"), "ערוצי מוזיקה בלי שדרן");
assert(js.includes("stream-reggae") && js.includes("stream-blues") && js.includes("stream-beat"), "רגאיי בלוז וביט");
assert(js.includes("glglz_classicil_mp3") && js.includes("90s_mobile_mp3") && js.includes("top40_mobile_mp3") && js.includes('id: "israeli"') && js.includes('id: "foreign"') && js.includes('id: "pop"') && js.includes('name: "ישראלי"') && js.includes('name: "לועזי"') && js.includes('name: "פופ"'), "ישראלי לועזי ופופ מוזיקה בלבד");
assert(js.includes("live.ecast.co.il/stream/mizrahit") && js.includes('id: "mizrahi"') && js.includes('name: "מזרחית"') && js.includes('group: "music"'), "מזרחית מוזיקה בלבד בלי שדרן");
assert(js.includes("var FETCH_MS = 12000") && js.includes("function fetchBound") && js.includes("AbortController") && js.includes("הזמן המוקצב לבקשה נגמר"), "בקשה תקועה לא עוצרת את העדכון");
assert(js.includes("function showGate") && js.includes("function sessionEnded") && js.includes("var screenOn = false") && js.includes("if (watchStarted) return;"), "כניסה שפגה חוזרת לשער בלי לכפול את הסבב");
assert(!js.includes("radiohaifa") && !js.includes("/glz_mp3") && !js.includes("99fm") && !js.includes("Radio2000"), "אין חדשות ואין שדרנים מלבד גלגל״צ");
assert(js.includes('group: "music"') && js.includes("מוזיקה בלבד"), "קבוצת מוזיקה בלבד");
assert(js.includes("gi_plasma_radio"), "הערוץ בפלזמה משותף");
assert(!js.includes("spotify") && !js.includes("spotify.com"), "בלי ספוטיפיי");
var top = html.slice(html.indexOf('<header class="top">'), html.indexOf('class="kpis"'));
assert(top.indexOf("logo-login-clean.png") < top.indexOf("מוקד שירות ותפעול"), "הלוגו נשאר והכותרת בקצה");
assert(!top.includes("top__clock") && !top.includes('id="greet"'), "הכותרת בלי שעון ובלי ברכה");
assert(top.indexOf('class="top__title"') > top.indexOf("top__brand"), "מוקד שירות ותפעול בפינה הימנית");
assert(top.indexOf("<h1>") < top.indexOf('id="fsSlot"'), "מקום האייקון צמוד לכותרת");
assert(css.includes(".top h1{") && css.includes("font-size:52px") && css.includes("font-weight:900") && css.includes("letter-spacing:0.045em") && !css.includes(".top h1::after{"), "כותרת המוקד גדולה בלי קו מתחת");
const titleMark = html.slice(html.indexOf('class="top__title"'), html.indexOf('class="kpis"'));
assert(titleMark.indexOf("top__mark") >= 0 && titleMark.indexOf("top__mark") < titleMark.indexOf("<h1>") && css.includes(".top__mark{"), "לוגו גלגל ומסמכים מימין לכותרת");
assert(html.includes('id="fsBtn"') && html.includes('class="fsBtn"') && html.includes("giPlasmaFullscreen") && html.includes("onclick=\"return giPlasmaFullscreen(event)\""), "אייקון מסך מלא לחיץ בעמוד עצמו");
assert(html.indexOf('id="fsBtn"') > html.indexOf('id="radioAudio"'), "לחצן המסך מחוץ לקנבס המוקטן");
assert(!html.includes("preventDefault"), "הלחיצה לא מבטלת את פתיחת המסך המלא");
assert(!html.includes('id="fsLabel"') && !html.includes(">מסך מלא<") && !html.includes(">יציאה<"), "בלי כפתור מגושם ובלי טקסט על האייקון");
assert(html.includes("requestFullscreen") && html.includes("exitFullscreen"), "מסך מלא נפתח מהלחיצה");
assert(css.includes(".fsBtn *{ pointer-events:none; }"), "לחיצה על האייקון מגיעה ללחצן");
assert(css.includes("z-index:10000") && css.includes("position:fixed"), "הלחצן צף מעל המסך המוקטן");
assert(js.includes("function placeFs"), "האייקון מיושר לכותרת אחרי ההקטנה");
assert(!html.includes("תורים ממתינים") && !html.includes('id="lanes"'), "תורים ממתינים ירדו");
var side = html.slice(html.indexOf('class="side"'), html.indexOf('class="foot"'));
assert(side.indexOf('id="nextBox"') >= 0 && side.indexOf('id="nextBox"') < side.indexOf("לקוחות ממתינים בתור"), "הלקוח הבא בתור מעל הממתינים");
assert(html.includes('id="floorHour"') && html.includes('id="floorMin"') && html.includes('id="floorSec"') && html.includes('id="floorDate"'), "שעון גדול ותאריך בתחתית");
assert(js.includes('var radioId = "hits"') && js.includes("radioStationStamp") && js.includes("station_updated_at"), "רענון נפתח על להיטים, והערוץ משתנה רק אחרי החלפה");
assert(js.includes("radioSetVolume") && !js.includes("radioPublish") && !js.includes("radioLoadSaved") && !js.includes(".upsert("), "העוצמה מהמערכת, והמסך לא מחזיר ערוץ");
assert(js.includes("radioPullShared(false); }, 2000)"), "הפלזמה קוראת ערוץ ועוצמה כל שתי שניות");
assert(css.includes("--call-cols:") && css.includes("font-size:30px") && css.includes("font-size:28px") && css.includes("font-size:22px"), "טבלת השיחות גדולה והעמודות משותפות");
const theadCss = css.slice(css.indexOf(".thead{"), css.indexOf(".tbody"));
assert(theadCss.includes("font-size:30px") && theadCss.includes("color:var(--navy)") && theadCss.includes("font-weight:800") && !theadCss.includes("var(--muted)"), "כותרות העמודות גדולות ובצבע הכותרת");
assert(css.includes(".tableCard > .band,") && css.includes(".side .band{"), "כותרות הצד באותו גודל כמו לקוחות בשיחה כעת");
assert((html.match(/class="band__ico"/g) || []).length === 3 && css.includes(".band__ico") && css.includes("justify-content:flex-start"), "אייקון נושא בצד ימין של כל כותרת");
const tickerHtml = html.slice(html.indexOf('class="tickerCol"'), html.indexOf("</footer>"));
assert(html.includes("מבזקים") && html.includes("ticker__label") && !html.includes("המערכת פעילה") && !html.includes("ticker__live") && !html.includes(">מבזק<"), "מבזקים בלי נקודה ובלי המערכת פעילה");
assert(tickerHtml.indexOf('class="ticker"') >= 0 && tickerHtml.indexOf('class="ticker"') < tickerHtml.indexOf("ticker__label"), "כותרת המבזקים מחוברת לחלון");
assert(js.includes("שלום מחלקת שירות ותפעול. בשעה טובה התחדשנו במערכת חדשה. שיהיה בהצלחה :)"), "המבזק מציג רק את משפט הברכה");
assert(!js.includes("בשיחת שיקוף עם") && !js.includes("מזל טוב התחדשנו"), "המבזק בלי שיחות שיקוף");
assert(css.includes("animation:tick 60s") && css.includes("translateX(-50%)") && css.includes("translateX(0)") && !css.includes("100cqi") && css.includes("linear-gradient(to left, #c81e1e 0%, #c81e1e 12%, #ffffff 24%, #ffffff 100%)"), "המבזק רץ לאט והאדום נגמר ללבן בתחילת החלון");
const brandAt = css.indexOf(".top__brand img{");
const brandImg = css.slice(brandAt, css.indexOf("}", brandAt));
assert(brandImg.includes("height:68px") && brandImg.includes("background:transparent") && !brandImg.includes("background:#fff"), "הלוגו יושב על הכחול בלי לוח לבן");
assert(html.includes("נציג מטפל") && html.includes('class="colCall"') && css.includes(".thead > .colCall{ text-align:center; }") && css.includes("justify-content:center"), "נציג מטפל, והטלפון והטיימר מתחת לבשיחה");
assert(css.includes("min-height:2.6em"), "מספרי הכרטיסים באותו גובה");
assert(js.includes("trim(next.seller)") && css.includes("backdrop-filter:blur(10px)") && css.includes(".next__name{") && css.includes("color:#fff"), "הלקוח הבא בזכוכית כחולה עם שם המגיש");
assert(js.includes('class="tickDot"') && css.includes(".tickDot{") && css.includes("#ff4d4d") && css.includes("width:22px") && css.includes("height:22px") && !js.includes(">·<"), "הנקודה האדומה במבזק גדולה");
assert(js.includes('class="talk"') && js.includes("talk__hand") && css.includes("@keyframes talkWave") && css.includes("@keyframes talkHand"), "בשיחה יש אנימציית שפופרת עם לקוח");
const kpiNum = css.slice(css.indexOf(".kpi b{"), css.indexOf(".kpi > div > span{"));
const kpiLabel = css.slice(css.indexOf(".kpi > div > span{"), css.indexOf(".kpi--model{"));
assert(css.includes("min-height:200px") && kpiNum.includes("font-size:70px") && kpiLabel.includes("font-size:31px") && kpiLabel.includes("min-height:2.6em") && kpiLabel.includes("order:-1") && css.includes("justify-content:center"), "הכרטיסים גדולים יותר והמספרים באותו גובה");
const floorCard = html.slice(html.indexOf('class="floorClock"'), html.indexOf('id="filePop"'));
assert(floorCard.indexOf("floorClock__face") >= 0 && floorCard.indexOf("floorClock__face") < floorCard.indexOf('class="floorWx"'), "השעון משמאל למזג האוויר");
assert(html.includes('id="wxTemp"') && html.includes('id="wxIcon"') && html.includes("floorWx") && css.includes(".floorWx{") && css.includes("direction:ltr"), "מזג האוויר מימין לשעון");
assert(css.includes("border-right:3px solid #5c6b7e") && css.includes("gap:28px") && css.includes("padding-left:26px"), "התחזית רחוקה מקו ההפרדה והטמפרטורה רחוקה מהענן");
assert(js.includes("https://get.geojs.io/v1/ip/geo.json") && js.includes("https://api.open-meteo.com/v1/forecast") && js.includes("temperature_2m,weather_code,is_day") && js.includes("timezone=Asia%2FJerusalem"), "התחזית חיה לפי מיקום המסך");
assert(!js.includes("תל אביב") && !js.includes("31.90") && !js.includes("32.0853") && js.includes('temp.textContent = "—"'), "בלי מיקום לא ממציאים עיר או טמפרטורה");
assert(js.includes("startWeather") && js.includes("15 * 60 * 1000") && !js.slice(js.indexOf("function pull("), js.indexOf("function watch(")).includes("pullWeather"), "מזג האוויר לא נמשך עם סבב הלקוחות");
assert(js.includes('restGet("gi_plasma_model"') && js.includes("var MODEL_MS = 10 * 60 * 1000") && js.includes("model.html?t=") && js.includes("cap.textContent = line") && css.includes(".modelCaption{") && css.includes("font-weight:800"), "תמונה ומשפט מהמערכת לעשר דקות");
const modelHtml = read("model.html");
const modelJs = read("model.js");
assert(modelHtml.includes('id="line"') && modelJs.includes(">אישור</button>") && modelJs.includes("gi_publish_plasma_model") && modelJs.includes("getUserMedia") && modelJs.includes("p_caption") && !modelJs.includes("service_role"), "הטלפון מצלם, רושם משפט, ומאשר");
const modelStart = js.indexOf("var MODEL_MS");
const modelEnd = js.indexOf("function modelPageUrl");
const modelBox = {};
vm.createContext(modelBox);
vm.runInContext("function trim(value){ return String(value == null ? '' : value).trim(); }\n" + js.slice(modelStart, modelEnd) + "\nthis.modelLive = modelLive;", modelBox);
const shotAt = Date.parse("2026-10-11T21:00:00.000Z");
assert(modelBox.modelLive({ image: "data:image/jpeg;base64,aaa", caption: "יום יפה", approved_at: "2026-10-11T21:00:00.000Z" }, shotAt + 60000) === true, "תמונה שאושרה מוצגת");
assert(modelBox.modelLive({ image: "data:image/jpeg;base64,aaa", caption: "יום יפה", approved_at: "2026-10-11T21:00:00.000Z" }, shotAt + 10 * 60 * 1000 + 1000) === false, "אחרי עשר דקות התמונה יורדת");
assert(modelBox.modelLive({ image: "", caption: "יום יפה", approved_at: "2026-10-11T21:00:00.000Z" }, shotAt) === false, "בלי תמונה נשאר קוד הסריקה");
const qrcode = require("./plasma-qr.js");
const sampleQr = qrcode(0, "M");
sampleQr.addData("https://gemelinvest.github.io/gemel-invest/model.html?t=0123456789abcdef0123456789abcdef");
sampleQr.make();
assert(sampleQr.getModuleCount() >= 21 && sampleQr.isDark(0, 0), "קוד הסריקה נוצר מהכתובת של הטלפון");
const iconCss = css.slice(css.indexOf(".kpi__icon{"), css.indexOf(".kpi b{"));
assert(!iconCss.includes("50%") && iconCss.includes(".kpi__icon .ico{ width:74px; height:74px;") && iconCss.includes("background:transparent"), "אייקוני הכרטיסים גדולים ובלי עיגול");
assert(css.includes(".waithead{") && css.includes(".wrow{") && css.includes(".wwhen{") && css.includes(".waits .empty{"), "טקסט התור הממתין הוגדל");
assert(js.includes("mirrorSummaryAt") && js.includes("דוח תיקוני הצעה") && js.includes("ביטוחים קיימים"), "שלב השיחה נלקח מהמסך הפתוח");
assert(!js.includes("kpiWait"), "מונה ההמתנה הממוצע ירד");

const app = read("app.js");
const summaryOpen = app.slice(app.indexOf("openMirrorSummaryReport(rec){"), app.indexOf("closeMirrorSummaryReport(){"));
assert(summaryOpen.includes("_stampMirrorSummaryReached"), "סיים שיקוף חותם שהלקוח הגיע לדוח התיקונים");
assert(app.includes("store.mirrorSummaryAt = now"), "חותמת השיקוף שנפתח נשמרת בתיק");
const stopAt = app.indexOf("stopCall(){");
const stopBody = app.slice(stopAt, stopAt + 1600);
assert(!stopBody.includes("mirrorSummaryAt"), "סיים שיחה לא נספר כשיקוף שהושלם");
assert(app.includes("store.needsSubPhase = nextSub") && app.includes("store.flowStepKey = nextKey"), "מסך המשנה נשמר עם שלב השיחה");

const stageSrc = js.slice(js.indexOf("function trim(value)"), js.indexOf("function signStage"));
const stageBox = { trim: null, stageText: null, SCREEN: null };
vm.createContext(stageBox);
vm.runInContext(stageSrc + "\nthis.trim = trim; this.stageText = stageText;", stageBox);
assert(stageBox.stageText({ uiPhase: "idle", stepLabel: "הצגה עצמית" }) === "הצגה עצמית", "פתיחה נשארת הצגה עצמית");
assert(stageBox.stageText({ uiPhase: "personalVerify", stepLabel: "הצגה עצמית" }) === "פרטי מבוטח/ים", "שלב תקוע לא גובר על המסך הפתוח");
assert(stageBox.stageText({ uiPhase: "step2", needsSub: "existing", stepLabel: "בירור והתאמת צרכים" }) === "ביטוחים קיימים", "מסך משנה מדויק");
assert(stageBox.stageText({ uiPhase: "step2", stepKey: "offer", stepLabel: "הצגה עצמית" }) === "פוליסות מוצעות", "מפתח המסך מדויק");
assert(stageBox.stageText({ uiPhase: "mirrorSummaryReport", stepLabel: "סיכום והצהרות" }) === "דוח תיקוני הצעה", "דוח התיקונים הוא סיום השיקוף");
assert(stageBox.stageText({ uiPhase: "idle", stepKey: "disclosure", stepLabel: "גילוי נאות" }) === "הצגה עצמית", "שלב ישן לא נשאר כשהמסך הוא הצגה עצמית");
assert(stageBox.stageText({ uiPhase: "step2", needsSub: "reasons", stepLabel: "בירור והתאמת צרכים" }) === "שיקולי המלצה", "שיקולי המלצה לא נשארים על בירור צרכים");
assert(stageBox.stageText({ uiPhase: "disclosure", stepLabel: "בירור והתאמת צרכים" }) === "גילוי נאות", "גילוי נאות הוא המסך הפתוח");
assert(stageBox.stageText({ uiPhase: "futureCancel", stepLabel: "בירור והתאמת צרכים" }) === "שינוי או ביטול בעתיד", "שינוי או ביטול בעתיד הוא המסך הפתוח");
assert(stageBox.stageText({ uiPhase: "step2", needsSub: "consent", stepKey: "offer", stepLabel: "בירור והתאמת צרכים" }) === "פוליסות מוצעות", "מפתח המסך גובר על שם השלב הרחב");
assert(stageBox.stageText({ uiPhase: "step2", needsSub: "consent", stepKey: "consent", stepLabel: "בירור והתאמת צרכים" }) === "הסכמת הר הביטוח", "מסך הסכמת הר נקרא בשם המסך");

const index = read("index.html");
const radioBar = app.slice(app.indexOf("const PlasmaRadioBar"), app.indexOf("// /PlasmaRadioBar"));
assert(index.includes('id="btnPlasmaRadio"') && index.includes('id="plasmaRadioMenu"') && index.includes('aria-label="מוזיקה"') && index.includes(">מוזיקה</span>") && index.includes('d="M9 17.5V6l9-2v11.5"') && !index.includes(">רדיו</span>"), "לחצן מוזיקה עם תו בטופ בר");
assert(radioBar.includes("isOps?.()") && radioBar.includes("isOpsAgent?.()"), "הלחצן רק למנהל תפעול ולנציג תפעול");
assert(radioBar.includes("gi_plasma_radio?id=eq.wall") && radioBar.includes("return=representation") && radioBar.includes("gi-open-agent-session") && radioBar.includes("גלגל״צ") && radioBar.includes("להיטים חמים") && !radioBar.includes("רדיו חיפה"), "מהטופ בר מחליפים את הערוץ בפלזמה ונשמר בשרת");
assert(!radioBar.includes("Storage.getClient") && !radioBar.includes("safeTrim("), "השמירה לא קוראת לפונקציות שמחוץ לטווח");
assert(radioBar.includes('current: "hits"') && radioBar.includes("setVolume") && radioBar.includes("station_updated_at") && radioBar.includes("data-vol"), "ברירת מחדל להיטים, והנמכה והגברה מהטופ בר");
assert(radioBar.includes('id: "israeli"') && radioBar.includes('name: "ישראלי"') && radioBar.includes('name: "לועזי"') && radioBar.includes('name: "פופ"') && radioBar.includes('id: "foreign"') && radioBar.includes('id: "pop"'), "תפריט התפעול כולל ישראלי לועזי ופופ");
assert(radioBar.includes('id: "mizrahi"') && radioBar.includes('name: "מזרחית"'), "תפריט התפעול כולל מזרחית");
const chooseBody = radioBar.slice(radioBar.indexOf("async choose"), radioBar.indexOf("async setVolume"));
const volumeBody = radioBar.slice(radioBar.indexOf("async setVolume"), radioBar.indexOf("bind()"));
assert(chooseBody.includes("station_updated_at") && !chooseBody.includes("volume:"), "החלפת ערוץ לא דורסת את העוצמה");
assert(volumeBody.includes("volume:") && !volumeBody.includes("station_id") && !volumeBody.includes("station_updated_at"), "הנמכה לא מחליפה ערוץ");
const appCss = read("app.css");
assert(appCss.includes("max-width:280px !important") && appCss.includes("white-space:nowrap") && radioBar.includes("placeMenu"), "תפריט הרדיו נפתח ברוחב מלא עם הווליום");

const radioStart = js.indexOf("var STATIONS = ");
const radioEnd = js.indexOf("async function radioPullShared");
const radioCtx = {
  trim: function (value) { return String(value == null ? "" : value).trim(); },
  $: function () { return null; },
  esc: function (value) { return String(value == null ? "" : value); },
  radioId: "hits",
  radioOn: true,
  radioPlaying: false,
  radioDown: false,
  radioVolume: 35,
  radioStationStamp: null
};
vm.createContext(radioCtx);
vm.runInContext(js.slice(radioStart, radioEnd) + "\nthis.radioApplyShared = radioApplyShared;", radioCtx);
radioCtx.radioApplyShared({ station_id: "glglz", volume: 20, station_updated_at: "2026-10-10T08:00:00.000Z" }, false);
assert(radioCtx.radioId === "hits" && radioCtx.radioVolume === 20, "רענון נשאר על להיטים ומחיל עוצמה");
radioCtx.radioApplyShared({ station_id: "glglz", volume: 50, station_updated_at: "2026-10-10T08:00:00.000Z" }, false);
assert(radioCtx.radioId === "hits" && radioCtx.radioVolume === 50, "שינוי עוצמה לא מחזיר לגלגל״צ");
radioCtx.radioApplyShared({ station_id: "rock", volume: 50, station_updated_at: "2026-10-10T09:00:00.000Z" }, false);
assert(radioCtx.radioId === "rock" && radioCtx.radioVolume === 50, "החלפת ערוץ מהמערכת מתנגנת");
radioCtx.radioStationStamp = null;
radioCtx.radioId = "hits";
radioCtx.radioApplyShared({ station_id: "med", volume: 40, station_updated_at: "2099-01-01T00:00:00.000Z" }, false);
assert(radioCtx.radioId === "med" && radioCtx.radioVolume === 40, "לחיצה על תחנה אחרי הפתיחה מחליפה גם בקריאה הראשונה");
radioCtx.radioApplyShared({ station_id: "pop", volume: 40, station_updated_at: "2099-01-01T01:00:00.000Z" }, false);
assert(radioCtx.radioId === "pop", "תחנת הפופ מהתפריט מתנגנת");
radioCtx.radioApplyShared({ station_id: "israeli", volume: 40, station_updated_at: "2099-01-01T02:00:00.000Z" }, false);
assert(radioCtx.radioId === "israeli", "התחנה הישראלית מהתפריט מתנגנת");
radioCtx.radioApplyShared({ station_id: "foreign", volume: 40, station_updated_at: "2099-01-01T03:00:00.000Z" }, false);
assert(radioCtx.radioId === "foreign", "התחנה הלועזית מהתפריט מתנגנת");
radioCtx.radioApplyShared({ station_id: "mizrahi", volume: 40, station_updated_at: "2099-01-01T04:00:00.000Z" }, false);
assert(radioCtx.radioId === "mizrahi", "התחנה המזרחית מהתפריט מתנגנת");

const moneyStart = js.indexOf("function policyAmount");
const moneyEnd = js.indexOf("function moneyText");
const moneyBox = { trim: function (value) { return String(value == null ? "" : value).trim(); } };
vm.createContext(moneyBox);
vm.runInContext(js.slice(moneyStart, moneyEnd) + "\nthis.productionTotal = productionTotal;", moneyBox);
assert(moneyBox.waitingMirrorTotal([
  { waiting: true, health: true, premium: { sum: 100, any: true } },
  { waiting: true, health: true, summaryAt: "2026-10-10", premium: { sum: 80, any: true } },
  { waiting: false, health: true, premium: { sum: 50, any: true } },
  { waiting: true, health: false, premium: { sum: 40, any: true } },
  { waiting: true, health: true, issuedAt: "x", premium: { sum: 30, any: true } },
  { waiting: true, health: true, premium: { sum: 20, any: true } }
]) === 120, "היקף פרמיה ממתינה לשיקוף רק תיקים שהוגשו ועדיין לא שוקפו");
assert(moneyBox.productionTotal([
  { issuedAt: "2026-10-10T10:00:00.000Z", policies: [{ premiumAfterDiscountValue: 120 }, { origin: "existing", premium: 999 }, { premium: "30" }] },
  { issuedAt: "", policies: [{ premium: 500 }] },
  { issuedAt: "2026-10-10T11:00:00.000Z", opPolicies: [{ monthlyPremium: 50 }] }
]) === 200, "פרמיה שעברה להפקה סוכמת רק תיקים שהועברו, בלי פוליסות קיימות");

const wxStart = js.indexOf("function wxKind");
const wxEnd = js.indexOf("function paintWeather");
const wxBox = {};
vm.createContext(wxBox);
vm.runInContext(js.slice(wxStart, wxEnd) + "\nthis.wxKind = wxKind; this.wxLabel = wxLabel; this.wxSvg = wxSvg;", wxBox);
assert(wxBox.wxKind(0, 0) === "clear-night" && wxBox.wxLabel("clear-night") === "בהיר", "לילה בהיר מקבל ירח");
assert(wxBox.wxKind(0, 1) === "clear-day" && wxBox.wxKind(2, 1) === "partly-day", "יום בהיר ומעונן חלקית");
assert(wxBox.wxKind(3, 0) === "cloud" && wxBox.wxKind(45, 1) === "fog", "מעונן וערפל");
assert(wxBox.wxKind(61, 1) === "rain" && wxBox.wxKind(73, 0) === "snow" && wxBox.wxKind(95, 1) === "storm", "גשם שלג וסופה לפי הקוד החי");
assert(wxBox.wxLabel("rain") === "גשם" && wxBox.wxLabel("snow") === "שלג" && wxBox.wxLabel("storm") === "סופת רעמים", "המצב בעברית");
assert(wxBox.wxSvg("clear-day") !== wxBox.wxSvg("clear-night") && wxBox.wxSvg("rain") !== wxBox.wxSvg("snow") && wxBox.wxSvg("storm").includes("<svg") && !wxBox.wxSvg("rain").includes("🌧"), "אייקון קו נקי לפי המצב, בלי אימוג'י");
assert(wxBox.wxSvg("rain").includes("wx--rain") && wxBox.wxSvg("rain").includes("wx__drop") && !wxBox.wxSvg("cloud").includes("wx__drop") && !wxBox.wxSvg("snow").includes("wx--rain") && css.includes("@keyframes wxRain") && css.includes("translateY(8px)"), "גשם יורד באנימציה ורק כשהתחזית גשם");

const classStart = js.indexOf("function israelWallToMs");
const classEnd = js.indexOf("function markNearest");
const classBox = {};
vm.createContext(classBox);
vm.runInContext("function trim(value){ return String(value == null ? '' : value).trim(); } var SOON_MS = 600000; var CALL_MAX_MS = 28800000;\n" + js.slice(classStart, classEnd) + "\nthis.classify = classify;", classBox);
const arrivedAt = Date.parse("2026-10-11T12:00:00.000Z");
const waitingRow = classBox.classify({ id: "n1", full_name: "נועה", agent_name: "דנה", submitted: "2026-10-11T11:00:00.000Z", result: "", callActive: false }, arrivedAt);
assert(waitingRow.waiting === true && waitingRow.seller === "דנה" && !waitingRow.call, "תיק שנמסר לתפעול בלי שיחה ובלי תוצאה ממתין");
const callingRow = classBox.classify({ id: "n2", full_name: "יונתן", submitted: "2026-10-11T11:00:00.000Z", callActive: "true", startedAt: "2026-10-11T11:30:00.000Z", finishedAt: "", timerHidden: false }, arrivedAt);
assert(callingRow.waiting === false && !!callingRow.call, "שיחה פתוחה לא נכנסת לתור");
const finishedRow = classBox.classify({ id: "n3", submitted: "2026-10-11T11:00:00.000Z", result: "issued" }, arrivedAt);
assert(finishedRow.waiting === false, "תיק עם תוצאה לא ממתין");
const unsentRow = classBox.classify({ id: "n4", full_name: "רותם", submitted: "" }, arrivedAt);
assert(unsentRow.waiting === false, "בלי מסירה לתפעול הלקוח לא נכנס למסך");

const arriveStart = js.indexOf("function noteArrivals");
const arriveEnd = js.indexOf("function doneToday");
const arriveBox = {};
vm.createContext(arriveBox);
vm.runInContext("var seenFiles = null; var popQueue = []; function pumpPop(){}\n" + js.slice(arriveStart, arriveEnd) + "\nthis.take = function (rows) { noteArrivals(rows); return popQueue.map(function (row) { return row.id; }); };", arriveBox);
assert(arriveBox.take([{ id: "a", submitted: "2026-10-11T10:00:00.000Z" }]).length === 0, "הקריאה הראשונה אחרי הכניסה לא מקפיצה תיק שכבר היה");
assert(arriveBox.take([
  { id: "a", submitted: "2026-10-11T10:00:00.000Z" },
  { id: "b", submitted: "2026-10-11T10:05:00.000Z" }
]).join(",") === "b", "תיק חדש אחרי מסירה לתפעול נכנס לחלון");
assert(arriveBox.take([
  { id: "a", submitted: "2026-10-11T10:00:00.000Z" },
  { id: "b", submitted: "2026-10-11T10:05:00.000Z" },
  { id: "c", submitted: "" }
]).join(",") === "b", "אותו תיק לא קופץ שוב, ובלי מועד מסירה אין תיק");

if (failed) {
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed);
