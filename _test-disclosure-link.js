/* לינק גילוי נאות: רק החברה והמוצר מהפוליסה המוצעת.
   הרצה: node _test-disclosure-link.js
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
  }else{
    failed += 1;
    console.error("  FAIL  " + msg);
  }
}

console.log("1) syntax");
["gi-disclosure-pdf-data.js", "gi-disclosure-pdfs.js", "app.js"].forEach((name) => {
  const res = spawnSync(process.execPath, ["--check", path.join(ROOT, name)]);
  assert(res.status === 0, "node --check " + name);
});

const sandbox = { window: {}, console };
sandbox.globalThis = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, "gi-disclosure-pdf-data.js"), "utf8"), sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, "gi-disclosure-pdfs.js"), "utf8").replace("typeof window !== \"undefined\" ? window : globalThis", "window"), sandbox);
const api = sandbox.window.GiDisclosurePdfs;

function ids(result){
  return (result.docs || []).map((doc) => doc.id).sort();
}

console.log("\n2) חברה ומוצר, בלי שאר הספרייה");
const ayalonMeds = api.pick({ company: "איילון", keys: ["meds"], covers: ["תרופות מחוץ לסל"], blob: "תרופות" });
assert(ids(ayalonMeds).join(",") === "ayalon/meds", "איילון תרופות הוא רק קובץ התרופות");
assert(ayalonMeds.docs[0].file.indexOf("disclosure-pdfs/ayalon/") === 0, "הקובץ מתיקיית איילון");
assert(fs.existsSync(path.join(ROOT, ayalonMeds.docs[0].file)), "קובץ התרופות של איילון קיים");

const phoenixMeds = api.pick({ company: "הפניקס", keys: ["meds"], covers: ["תרופות"], blob: "תרופות" });
assert(ids(phoenixMeds).join(",") === "phoenix/meds", "הפניקס תרופות לא נלקח מאיילון");
assert(phoenixMeds.docs[0].file !== ayalonMeds.docs[0].file, "שתי חברות לא חולקות את אותו קובץ תרופות");

const onlyTransplant = api.pick({ company: "איילון", keys: ["transplants"], covers: ["השתלות וטיפולים מיוחדים מחוץ לישראל"], blob: "" });
assert(ids(onlyTransplant).join(",") === "ayalon/transplants", "השתלות לא מושכת את ניתוחי החו\"ל למרות המילה מחוץ");

console.log("\n3) חיים: ריסק 1 מול ריסק 5, ומשכנתא לפי חברה");
const risk1 = api.pick({ company: "מנורה", keys: ["risk"], covers: [], blob: "ריסק 1" });
assert(ids(risk1).join(",") === "menora/risk", "ריסק 1 של מנורה");
const risk5 = api.pick({ company: "מנורה", keys: ["risk"], covers: [], blob: "ריסק 5 עד גיל 80" });
assert(ids(risk5).join(",") === "menora/risk15", "ריסק 5 של מנורה הוא הקובץ ריסק 15");
const phoenixFamily = api.pick({ company: "הפניקס", keys: ["family_income"], covers: [], blob: "הכנסה למשפחה" });
assert(ids(phoenixFamily).join(",") === "phoenix/family_income", "הכנסה למשפחה של הפניקס");
const clalMortgage = api.pick({ company: "כלל", keys: ["mortgage"], covers: [], blob: "שוהם משכנתא" });
assert(ids(clalMortgage).join(",") === "clal/mortgage", "משכנתא של כלל היא שוהם");
const migdalDisability = api.pick({ company: "מגדל", keys: ["mortgage"], covers: [], blob: "משכנתא לאדם עם מוגבלות" });
assert(ids(migdalDisability).join(",") === "migdal/mortgage_disability", "מגדל עם מוגבלות הוא הקובץ הנפרד");
const ayalonFuture = api.pick({ company: "איילון", keys: [], covers: [], blob: "דרור לעתיד" });
assert(ids(ayalonFuture).join(",") === "ayalon/risk_future", "דרור לעתיד נבחר לפי שם המוצר");

console.log("\n4) כמה פוליסות, בלי כפילות ובלי מוצר שלא נבחר");
const selected = api.select([
  { company: "איילון", type: "בריאות", covers: ["תרופות", "השתלות"] },
  { company: "איילון", type: "בריאות", covers: ["תרופות"] },
  { company: "מגדל", type: "ריסק", name: "אור 1" }
], {
  company: (policy) => policy.company,
  health: (policy) => policy.type === "בריאות",
  covers: (policy) => policy.covers || [],
  keysForCover: (_company, cover) => cover === "תרופות" ? ["meds"] : cover === "השתלות" ? ["transplants"] : [],
  keysForPolicy: (policy) => policy.type === "ריסק" ? ["risk"] : [],
  blob: (policy) => [policy.type, policy.name].filter(Boolean).join(" "),
  label: (policy) => policy.type
});
assert(ids(selected).join(",") === ["ayalon/meds", "ayalon/transplants", "migdal/risk"].sort().join(","), "שתי חברות ושני מוצרים, תרופות פעם אחת");
assert(!ids(selected).some((id) => id.indexOf("menora/") === 0 || id.indexOf("phoenix/") === 0), "חברה שלא בהצעה לא נכנסת");

const missing = api.select([
  { company: "הכשרה", type: "בריאות", covers: ["מוצר שלא קיים"] }
], {
  company: (policy) => policy.company,
  health: () => true,
  covers: (policy) => policy.covers,
  keysForCover: () => [],
  keysForPolicy: () => [],
  blob: () => "",
  label: () => "בריאות"
});
assert(missing.docs.length === 0, "בלי התאמה אין קובץ");
assert(missing.missing[0] === "הכשרה · מוצר שלא קיים", "המוצר החסר מדווח עם החברה");

console.log("\n5) חיבור במסך השיקוף");
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const sql = fs.readFileSync(path.join(ROOT, "supabase-onyx-disclosure-link.sql"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "disclosure.html"), "utf8");
assert(app.includes('data-mc-disc-link-copy') && app.includes("_mcCopyDisclosureLink"), "הלחצן מעתיק לינק");
assert(app.includes("GiDisclosurePdfs") && app.includes("keysForCover") && app.includes("getDisclosureKeysForPolicy"), "הבחירה עוברת דרך זיהוי הגילוי הקיים");
assert(app.includes("_mirrorGetNewPoliciesRaw(rec)"), "רק פוליסות מוצעות");
assert(app.includes("הלקוח פתח את הגילוי") && app.includes("onyx_disclosure_link_status"), "הנציג רואה אישור קריאה");
assert(sql.includes("onyx_disclosure_link_open") && sql.includes("grant execute on function public.onyx_disclosure_link_open(text, text) to anon, authenticated"), "פתיחה ציבורית נרשמת");
assert(sql.includes("revoke all on table public.onyx_disclosure_links from anon, public, authenticated"), "הטבלה לא חשופה");
assert(html.includes("onyx_disclosure_link_open") && html.includes("disclosure-pdfs/"), "עמוד הלקוח פותח רק קבצי גילוי");
assert(fs.readFileSync(path.join(ROOT, "index.html"), "utf8").includes("gi-disclosure-pdfs.js"), "הקטלוג נטען עם המערכת");

console.log("\n6) לינק קצר, כרטיס, והודעה מתוך המערכת");
const copyStart = app.indexOf("async _mcCopyDisclosureLink()");
const copyEnd = app.indexOf("_mcStopDisclosureLinkWatch()", copyStart);
const copyFn = app.slice(copyStart, copyEnd);
assert(copyStart > 0 && copyFn.length > 100, "פונקציית ההעתקה נמצאה");
assert(!copyFn.includes("alert(") && copyFn.includes("_mcShowDisclosureNotice"), "ההודעה מוצגת מהמערכת");
assert(app.includes('https://gi-go.rainy-reference.workers.dev/" + encodeURIComponent(token)') && !app.includes("disclosure.html?t="), "הלינק הוא הדומיין הקצר בלי רשימת המסמכים");
assert(app.includes('/^1[a-z0-9]{8}$/.test(safeTrim(store.token))'), "לינק ישן וארוך מוחלף בטוקן קצר");
assert(app.includes('let out = "1"') && app.includes("abcdefghijkmnopqrstuvwxyz23456789"), "הטוקן קצר ומתאים לדומיין");
assert(sql.includes("^1[a-z0-9]{8}$"), "השרת מקבל את הטוקן הקצר");
assert(html.includes('property="og:title" content="גילוי נאות"') && html.includes("disclosure-og.jpg"), "לעמוד יש כותרת ותמונת תצוגה");
const card = fs.readFileSync(path.join(ROOT, "disclosure-og.jpg"));
assert(card[0] === 0xff && card[1] === 0xd8 && card[2] === 0xff && card.length > 10000, "תמונת התצוגה היא JPEG");
const edge = fs.readFileSync(path.join(ROOT, "supabase/functions/gi-sign/index.ts"), "utf8");
assert(edge.includes("function isDisclosureToken") && edge.includes('const cardTitle = "גילוי נאות"') && edge.includes("OG_DISCLOSURE_CARD_JPEG_B64") && edge.includes("DISCLOSURE_PAGE"), "כרטיס הוואטסאפ של גילוי נאות");
assert(fs.readFileSync(path.join(ROOT, "supabase/functions/gi-sign/og-disclosure-card.ts"), "utf8").includes("https://gemelinvest.github.io/gemel-invest/disclosure.html?t="), "הלינק הקצר נפתח לעמוד הגילוי");
assert(edge.includes('const cardTitle = portal ? "אזור אישי" : "&#8203;"') && !edge.includes("og:description"), "כרטיס האזור האישי נשאר כמו שהיה");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
