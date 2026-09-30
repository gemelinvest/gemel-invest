const fs = require("fs");
const assert = require("assert");
const app = fs.readFileSync("app.js", "utf8");
const health = fs.readFileSync("gi-phoenix-health-form.js", "utf8");

function sliceBetween(src, start, end){
  const a = src.indexOf(start);
  assert(a >= 0, "missing " + start);
  const b = src.indexOf(end, a + start.length);
  assert(b > a, "missing " + end);
  return src.slice(a, b);
}

const qualify = sliceBetween(app, "qualifiesForPhoenixHealthForm(payload, rec){", "isPhoenixCiPolicy(policy){");
const checks = sliceBetween(app, "_mcJoinFormTypeForPolicy(p, rec){", "_mcFollowupTopicTitle(entry){");
const inject = sliceBetween(app, "const hasPhxCi =", "const gapJoinDocs =");

assert(qualify.includes("if(this.isPhoenixCiPolicy(p)) return true;"), "מחלות קשות של הפניקס נכנסות לטופס הבריאות המשותף");
assert(qualify.indexOf("isPhoenixCiPolicy(p)") < qualify.indexOf("return /בריאות/"), "מחלות קשות נבדקות לפני סינון בריאות בלבד");
assert(qualify.includes("isPhoenixRiskMortgagePolicy"), "ריסק ומשכנתא לא עוברים לטופס הבריאות");
assert(inject.includes("!this.qualifiesForPhoenixHealthForm(payload, rec)"), "הטופס השטוח לא נפתח כשיש את הטופס המשותף");
assert(inject.includes("doc_phoenix_ci_form"), "זיהוי הטופס הישן נשאר לקבצים שכבר נשמרו");
assert(health.includes("docs.isPhoenixCiPolicy(policy)) return true"), "מילוי טופס הבריאות כולל פוליסת מחלות קשות");
assert(health.includes('TEMPLATE_FILE: "phoenix-health-join.pdf"') || health.includes("phoenix-health-join.pdf"), "נפתח קובץ הבריאות העריך");
assert(!health.includes("phoenix-ci-join.pdf"), "טופס הבריאות לא מחליף את עצמו בקובץ השטוח");

const healthAt = checks.indexOf("qualifiesForPhoenixHealthForm");
const ciAt = checks.indexOf("qualifiesForPhoenixCiForm");
const lifeAt = checks.indexOf("qualifiesForPhoenixLifeShortForm");
assert(healthAt >= 0 && ciAt > healthAt, "בשיקוף נבחר קודם טופס הבריאות המשותף");
assert(lifeAt >= 0 && lifeAt < healthAt, "ריסק חיים מקוצר נשאר בטופס שלו");
assert(checks.includes("qualifiesForMenoraCiForm"), "מחלות קשות של מנורה לא הוחלפו");
assert(checks.includes("qualifiesForHachsharaCiForm"), "מחלות קשות של הכשרה לא הוחלפו");
assert(app.includes("טופס מקורי — בריאות · הפניקס"), "שם טופס הבריאות נשאר");

console.log("phoenix shared health+ci ok");
