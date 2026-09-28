const fs = require("fs");
const assert = require("assert");
const app = fs.readFileSync("app.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");
const css = fs.readFileSync("app.css", "utf8");

assert(html.includes('id="mcBookModal"'), "חלון תזמון");
assert(html.includes('id="mcBookDate"') && html.includes('id="mcBookTime"') && html.includes('id="mcBookNote"'), "תאריך שעה והערה");
assert(html.includes('id="mcBookHistory"'), "היסטוריית תזמונים");
assert(html.includes('id="customerFullMirrorBook"'), "פס תזמון בתיק");
assert(app.includes("persistCustomerOpsResultLight(rec, label)"), "שמירה קלה של הלקוח בלי שיכפול כל המערכת");
assert(html.includes('id="mcBookClear"'), "הסרת תזמון");
assert(app.includes("removed: true"), "הסרה נרשמת בהיסטוריה");
assert(app.includes("history: [entry].concat(prev.history)"), "כל תזמון נשמר בהיסטוריה");
assert(app.includes("MirrorCallBooking.open(bookedId)"), "לחצן השיקוף פותח יומן");
assert(app.includes("MirrorCallBooking.open(booked.id)"), "פעולות בתיק פותחות יומן");
assert(app.includes("MirrorCallBooking.queueMeta(row.rec)"), "שורת ממתינים מציגה תזמון");
assert(app.includes('view?.mode === "live"'), "הפס נעלם כשהשיחה חיה");
assert(app.includes("הלקוח מתוזמן לשיחת שיקוף"), "הודעת התזמון בתיק");
assert(css.includes(".cfMirrorBook{"), "עיצוב הפס");
assert(!app.includes("localStorage.setItem(\"GI_MIRROR_BOOK"), "התזמון לא נשמר מקומית");

console.log("mirror call booking ok");
