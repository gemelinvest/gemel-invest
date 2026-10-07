/* כניסה, אימות, ומסכי פאנל המנהלים קיימים ועובדים כדף אפליקציה. */
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = __dirname;
const html = fs.readFileSync(path.join(root, "manager-app.html"), "utf8");
const js = fs.readFileSync(path.join(root, "manager-app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "manager-app.css"), "utf8");

assert(html.includes('data-view="login"'), "מסך כניסה");
assert(html.includes('data-view="mfa"'), "מסך אימות");
assert(html.includes('data-view="app"'), "מסך הפאנל");
assert(html.includes("assets/onyx-crm-logo.png"), "לוגו במסך הכניסה");
assert(js.includes('user: "manager"') && js.includes('pass: "demo1234"') && js.includes('code: "482913"'), "פרטי הדגמה");
assert(js.includes("שם משתמש או סיסמה שגויים"), "שגיאת סיסמה");
assert(js.includes("הקוד שגוי"), "שגיאת קוד");
assert(js.includes("לידים שנסגרו היום"), "לידים שנסגרו");
assert(js.includes("פירוט מכירות"), "פירוט מכירות");
assert(js.includes("נמכר היום"), "נמכר היום");
assert(css.includes("100dvh"), "מסך מלא בטלפון");
assert(css.includes("safe-area-inset-bottom"), "התאמה לאייפון");

console.log("manager app ok");
