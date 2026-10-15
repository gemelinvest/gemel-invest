/* GI-NET-STABLE 2026-10-15
   פרמיה חודשית נטו = מכירות אשף אחרי הנחה, לא ייבוא פרודוקציה.
   npol_prod_ / productionImport לא נספרים גם אם _addedAt זז.
   פוליסת אשף חדשה על תיק קיים כן נספרת.
   overlay נציג מסונן מתקן כלפי מטה ולא קופץ למעלה.
   נוסחת האשף (לפני הנחה) לא זזה.
   הרצה: node _test-net-premium-stable-sales.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20261007-lead-dup-v1";
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

function extractObjectMethod(src, methodName){
  const needle = "\n    " + methodName + "(";
  const start = src.indexOf(needle);
  if(start < 0) return "";
  let i = start + needle.length;
  let depthParen = 1;
  while(i < src.length && depthParen > 0){
    const ch = src[i];
    if(ch === "(") depthParen += 1;
    else if(ch === ")") depthParen -= 1;
    i += 1;
  }
  const brace = src.indexOf("{", i);
  if(brace < 0) return "";
  let depth = 0;
  for(let j = brace; j < src.length; j += 1){
    const ch = src[j];
    if(ch === "{") depth += 1;
    else if(ch === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, j + 1).trim();
    }
  }
  return "";
}

function extractFunction(src, fnName){
  const needle = "  function " + fnName + "(";
  const start = src.indexOf(needle);
  if(start < 0) return "";
  let i = start + needle.length;
  let depthParen = 1;
  while(i < src.length && depthParen > 0){
    const ch = src[i];
    if(ch === "(") depthParen += 1;
    else if(ch === ")") depthParen -= 1;
    i += 1;
  }
  const brace = src.indexOf("{", i);
  let depth = 0;
  for(let i = brace; i < src.length; i += 1){
    const ch = src[i];
    if(ch === "{") depth += 1;
    else if(ch === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, i + 1).trim();
    }
  }
  return "";
}

const app = read("app.js");
const wizard = read("gi-wizard.js");
const html = read("index.html");
const sw = read("service-worker.js");
const sql = read("supabase-gi-net-premium-stable.sql");
const sqlPrem = read("supabase-gi-policy-premium-after-discount.sql");
const auditSql = read("docs/sql-drafts/audit-agent-month-net.sql");

console.log("1) syntax + cache + האשף לא זז");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-net-premium-stable-sales.js")]).status === 0, "node --check this test");
assert(html.includes("app.js?v=" + TAG), "index.html שומר את תג ה-build");
assert(html.includes("giNetStable=1"), "index.html טוען מחדש את תיקון הנטו");
assert(sw.includes(TAG), "service-worker שומר את תג ה-build");
assert(sw.includes("net-stable-v1"), "service-worker מנקה מטמון לתיקון הנטו");
assert(wizard.includes("return this.getPolicyPremiumBeforeDiscount(policy);"), "אשף AfterDiscount נשאר לפני הנחה");
assert(sqlPrem.includes("GI-MONTH-NET-CARD"), "נוסחת אחרי הנחה ב-SQL לא הוסרה");
assert(sqlPrem.includes("monthlyAfterDiscount"), "סימולטור אחרי הנחה נשאר");

console.log("\n2) SQL — ייבוא תמיד backfill + סינון agent_id");
assert(sql.includes("gi_is_production_backfill"), "SQL מחליף backfill");
assert(sql.includes("LIKE 'npol_prod_%'"), "npol_prod_ תמיד ייבוא");
assert(sql.includes("productionImport"), "productionImport תמיד ייבוא");
assert(sql.includes("coalesce(jsonb_typeof(p->'productionImport'), '') = 'object'"), "בלי productionImport החוזר הוא false לא NULL");
assert(!sql.includes("left(p->>'_addedAt', 10) = left(p#>>'{productionImport,importedAt}'"), "אין חריג יום-שונה לייבוא");
assert(sql.includes("gi_dashboard_agent_in_scope"), "סינון נציג משותף");
assert(sql.includes("p_agent_id = ANY (p_agent_ids)"), "כשיש id — רק id");
assert(sql.includes("btrim(coalesce(p_agent_id, '')) = ''"), "שם רק כשאין agent_id");
assert(sql.includes("gi_dashboard_sale_stamp"), "פירוט לפי אותה חותמת מכירה");
assert(sql.includes("gi_policy_premium"), "סכום אחרי הנחה כמו הכרטיס");
assert(auditSql.includes("mismatch"), "יש שאילת ביקורת לכל נציג");
assert(auditSql.includes("gi_dashboard_net_premium"), "הביקורת משווה ל-RPC של הכרטיס");

console.log("\n3) JS — ייבוא לא נספר, מכירת אשף כן");
const ctx = {
  console, Date, Number, String, Object, Array, Math, JSON, Set, Map, Intl,
  safeTrim: (v) => String(v ?? "").trim(),
  nowISO: () => "2026-10-14T12:33:25.000Z",
  resolveCompanyLogoKey: (v) => String(v || ""),
  CustomersUI: {
    resolveCustomerSectorFromType(type){
      const t = String(type || "");
      if(/ריסק|משכנת|חיים|כושר/.test(t)) return "סיכונים";
      if(/בריאות|מחלות|סרטן|מדיקר/.test(t)) return "בריאות";
      return "";
    },
    asMoneyNumber(v){
      const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
      return Number.isFinite(n) ? n : 0;
    }
  }
};
ctx.CustomersUI.isProductionBackfillPolicy = function(p){
  return sandboxBackfill(p);
};

const backfillSrc = extractObjectMethod(app, "isProductionBackfillPolicy");
assert(!!backfillSrc, "חולץ isProductionBackfillPolicy");
assert(backfillSrc.includes('indexOf("npol_prod_") === 0'), "npol_prod_ תמיד backfill");
assert(backfillSrc.includes("productionImport"), "productionImport תמיד backfill");
assert(!backfillSrc.includes("addedDay !== importedDay"), "הוסר חריג יום-שונה");

const sandboxBackfill = (() => {
  const box = { safeTrim: ctx.safeTrim };
  vm.runInNewContext(
    "this.isProductionBackfillPolicy = function" + backfillSrc.slice("isProductionBackfillPolicy".length) + ";",
    box
  );
  return (p) => box.isProductionBackfillPolicy(p);
})();
ctx.CustomersUI.isProductionBackfillPolicy = sandboxBackfill;

assert(sandboxBackfill({
  id: "npol_prod_120404728_ab12",
  _addedAt: "2026-10-14T12:00:00.000Z",
  productionImport: { importedAt: "2026-08-09T10:00:00.000Z" }
}) === true, "npol_prod_ עם _addedAt ביום אחר עדיין ייבוא");
assert(sandboxBackfill({
  id: "npol_14e8ebf260c49",
  type: "בריאות",
  premiumMonthly: "124.53"
}) === false, "פוליסת אשף רגילה אינה ייבוא");
assert(sandboxBackfill({
  id: "npol_00b6701de2785",
  productionImport: { importedAt: "2026-08-09T10:00:00.000Z" }
}) === true, "סמן productionImport מספיק גם בלי npol_prod_");

const src = [
  extractFunction(app, "getNewPoliciesFromCustomerPayload"),
  extractFunction(app, "getCustomerRawNewPolicies"),
  extractFunction(app, "stampPoliciesSubmittedAtFinish"),
  "var DashboardUI = {",
  extractObjectMethod(app, "_roundSaleMoney") + ",",
  extractObjectMethod(app, "_saleMoney") + ",",
  extractObjectMethod(app, "toLocalDateKey") + ",",
  extractObjectMethod(app, "toIsraelDateKey") + ",",
  extractObjectMethod(app, "_isMedicareWizardSale") + ",",
  extractObjectMethod(app, "_enteredSalePremium") + ",",
  extractObjectMethod(app, "_dashboardSaleStamp") + ",",
  extractObjectMethod(app, "wizardSaleAfterDiscount") + ",",
  extractObjectMethod(app, "_isDashboardWizardSale") + ",",
  extractObjectMethod(app, "_isHealthOrRiskWizardSale") + ",",
  extractObjectMethod(app, "_eachDashboardWizardSale") + ",",
  extractObjectMethod(app, "isWithinRange") + ",",
  extractObjectMethod(app, "newEmptyAgg") + ",",
  extractObjectMethod(app, "_bumpAggCompany") + ",",
  extractObjectMethod(app, "accumulateCustomerIntoAgg") + ",",
  extractObjectMethod(app, "_shouldApplyServerNetOverlay"),
  "};",
  "this.DashboardUI = DashboardUI;",
  "this.stampPoliciesSubmittedAtFinish = stampPoliciesSubmittedAtFinish;"
].join("\n");
vm.runInNewContext(src, ctx);
const dash = ctx.DashboardUI;

const monthRange = {
  start: new Date("2026-10-01T00:00:00+03:00"),
  end: new Date("2026-10-16T00:00:00+03:00")
};

function sumRec(rec){
  const agg = dash.newEmptyAgg();
  dash.accumulateCustomerIntoAgg(rec, agg, monthRange);
  return {
    net: Math.round((Number(agg.netPremium) || 0) * 100) / 100,
    sold: Number(agg.soldPolicies) || 0
  };
}

const ilanWizard = {
  id: "cust_1a0f7351613_81a5cb",
  createdAt: "2026-10-01T11:24:06.000Z",
  payload: {
    createdAt: "2026-10-01T11:24:06.000Z",
    newPolicies: [{
      id: "npol_4dd175fa4433d",
      type: "בריאות",
      company: "מגדל",
      premiumMonthly: "338.79",
      premiumAfterDiscountValue: 292.68,
      simDiscountPerInsured: { ins1: { monthlyAfterDiscount: 292.68 } },
      _addedAt: "2026-10-01T11:24:06.000Z"
    }]
  }
};
assert(sumRec(ilanWizard).net === 292.68, "מכירת אשף של אילן נספרת אחרי הנחה");
assert(sumRec(ilanWizard).sold === 1, "פוליסת אשף אחת");

const noaExtra = {
  id: "cust_19fef92a44e_3913e9",
  createdAt: "2026-08-11T10:00:00.000Z",
  payload: {
    newPolicies: [
      {
        id: "npol_7f56e9199377a",
        type: "בריאות",
        premiumMonthly: "129",
        _addedAt: "2026-08-11T10:00:00.000Z"
      },
      {
        id: "npol_fca32ecddbf4f",
        type: "בריאות",
        company: "הפניקס",
        premiumMonthly: "155.66",
        simDiscountPerInsured: { ins1: { monthlyAfterDiscount: 124.53 } },
        _addedAt: "2026-10-04T10:04:52.000Z"
      },
      {
        id: "npol_14e8ebf260c49",
        type: "מחלות קשות",
        company: "הפניקס",
        premiumMonthly: "27.81",
        simDiscountPerInsured: { ins1: { monthlyAfterDiscount: 20.86 } },
        _addedAt: "2026-10-04T10:07:37.000Z"
      }
    ]
  }
};
const noa = sumRec(noaExtra);
assert(noa.sold === 2, "מכירה נוספת על תיק קיים — רק פוליסות אוקטובר");
assert(noa.net === 145.39, "נועה אוקטובר 124.53+20.86");

const importGraduated = {
  id: "cust_imp_old",
  createdAt: "2026-08-09T08:00:00.000Z",
  payload: {
    newPolicies: [{
      id: "npol_prod_999_ab",
      type: "בריאות",
      premiumMonthly: "4800",
      productionImport: { importedAt: "2026-08-09T08:00:00.000Z" },
      _addedAt: "2026-10-14T12:00:00.000Z"
    }]
  }
};
assert(sumRec(importGraduated).net === 0, "ייבוא ש_addedAt שלו זז לא נכנס לכרטיס");
assert(sumRec(importGraduated).sold === 0, "ייבוא לא נספר כפוליסה");

const finishPayload = {
  newPolicies: [
    {
      id: "npol_prod_kept",
      type: "בריאות",
      premiumMonthly: "200",
      productionImport: { importedAt: "2026-08-09T08:00:00.000Z" }
    },
    { id: "npol_brand_new", type: "ריסק", premiumMonthly: "80" }
  ]
};
ctx.stampPoliciesSubmittedAtFinish(finishPayload, { newPolicies: [] }, "2026-10-14T12:33:25.000Z");
assert(!finishPayload.newPolicies[0]._addedAt, "סיום הקמה לא ממציא חותמת לייבוא");
assert(finishPayload.newPolicies[1]._addedAt === "2026-10-14T12:33:25.000Z", "פוליסת אשף חדשה כן נחתמת");

console.log("\n4) overlay — בלי קפיצה למעלה, עם תיקון כלפי מטה");
const decide = (opts) => dash._shouldApplyServerNetOverlay(opts);
assert(decide({
  localNet: 5430.91, serverNet: 544.58, missingCustomers: 0,
  localReady: true, localHasNet: true, agentSelf: true, scoped: true
}) === true, "אילן: מקומי 5430 יורד ל-544 המסונן");
assert(decide({
  localNet: 544.58, serverNet: 180000, missingCustomers: 0,
  localReady: true, localHasNet: true, agentSelf: true, scoped: true
}) === false, "נציג מוכן לא קופץ לסכום ארגוני/גדול");
assert(decide({
  localNet: 0, serverNet: 180000, missingCustomers: 0,
  localReady: true, localHasNet: false, agentSelf: true, scoped: false
}) === false, "בלי סינון נציג לא נצבע סכום של כולם");
assert(decide({
  localNet: 8000, serverNet: 5000, missingCustomers: 12,
  localReady: false, localHasNet: true
}) === false, "מנהל בטעינה: לא דורסים מקומי גבוה ב-RPC נמוך");
assert(app.includes("overlay._agentSelfNet === true && overlay._scopedNet === true"), "חישוב מקומי מנופח לא מחליף overlay מסונן");

assert(dash.wizardSaleAfterDiscount({
  premiumMonthly: "95.83",
  premiumAfterDiscountValue: 95.83,
  simDiscountPerInsured: { ins1: { monthlyAfterDiscount: 28.75 } }
}) === 28.75, "נוסחת אחרי הנחה של הכרטיס לא השתנתה");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
