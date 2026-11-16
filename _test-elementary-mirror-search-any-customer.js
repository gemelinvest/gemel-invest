/* שיקוף אלמנטרי מוצא כל לקוח לפי החיפוש, גם אם התיק שייך לנציג אחר.
   רשימת הלקוחות, טעינת הסשן ומדיניות הטבלה לא נפתחות.
   הרצה: node _test-elementary-mirror-search-any-customer.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-elementary-mirror-search.sql"), "utf8");
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

function extractFunction(src, signature){
  const at = src.indexOf(signature);
  if(at < 0) return "";
  const open = at + signature.length - 1;
  if(src[open] !== "{") return "";
  let depth = 0;
  for(let i = open; i < src.length; i += 1){
    const ch = src[i];
    if(ch === "{") depth += 1;
    else if(ch === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(at, i + 1);
    }
  }
  return "";
}

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-elementary-mirror-search-any-customer.js")]).status === 0, "node --check this test");

console.log("\n2) המסכים האחרים נשארים סגורים");
const scopeFn = extractFunction(app, "function getServerListAgentScopeFilter(){");
const visibleSrc = extractFunction(app, "function customerVisibleToCurrentUser(rec){");
assert(!!scopeFn && !scopeFn.includes("isElementary"), "טעינת הרשימה לפי נציג לא נפתחת לאלמנטרי");
assert(visibleSrc.includes("isElementaryPoolCustomerRecord(rec)"), "נראות אלמנטרי נשארת דרך מאגר האלמנטרי");
assert(visibleSrc.includes("return customerOwnedByCurrentAgent(rec);"), "לקוח שאינו במאגר נשאר לפי בעלות");
assert(app.includes("visible = all.filter((rec) => this.customerHasElementaryProducts(rec));"), "מסך הלקוחות של אלמנטרי נשאר לפי מוצר");
const opsSearch = extractFunction(app, "async _runOpsAgentServerSearch(query, seq){");
assert(opsSearch.includes("skipAgentScope: true") && !opsSearch.includes("searchElementaryMirrorCustomers"), "חיפוש שיקוף התפעול לא השתנה");
assert(!/create\s+policy/i.test(sql), "קובץ ה-SQL לא מוסיף מדיניות על הטבלה");
assert(sql.includes("'{mirrorFlow}'") && !sql.includes("full_name ="), "השמירה בשרת נוגעת רק בזרימת השיקוף");

console.log("\n3) לקוח של נציג אחר עולה בחיפוש השיקוף ולא בשאר המערכת");
const safeTrim = (v) => String(v == null ? "" : v).trim();
const candidateSrc = extractFunction(app, "_isElementaryMirrorSearchCandidate(rec){");
const poolSrc = extractFunction(app, "function isElementaryPoolCustomerRecord(rec){");
const archiveSrc = extractFunction(app, "function isServerArchivedCustomerRecord(c){");
assert(!!candidateSrc && !!visibleSrc && !!poolSrc && !!archiveSrc, "פונקציות השער נמצאו");
const api = new Function(
  "safeTrim",
  "Auth",
  [
    "function customerOwnedByCurrentAgent(){ return false; }",
    "function customerVisibleToTeamManager(){ return false; }",
    archiveSrc,
    poolSrc,
    visibleSrc,
    "function " + candidateSrc.trim(),
    "return { customerVisibleToCurrentUser, isElementaryPoolCustomerRecord, _isElementaryMirrorSearchCandidate };"
  ].join("\n")
)(safeTrim, {
  current: { id: "elem_1", role: "elementary", name: "עדן" },
  canViewAllCustomers(){ return false; },
  isElementary(){ return true; },
  isTeamManager(){ return false; }
});

const foreignHealth = {
  id: "cust_ilan_health",
  fullName: "יוסי כהן",
  idNumber: "123456782",
  phone: "0509999999",
  agentId: "agent_ilan",
  agentRole: "agent",
  agentName: "אילן איילין",
  status: "חדש",
  payload: { flowType: "health", newPolicies: [{ id: 1 }] }
};
const foreignElementary = {
  id: "cust_ilan_car",
  fullName: "נועה לוי",
  agentId: "agent_ilan",
  agentRole: "agent",
  status: "חדש",
  payload: { flowType: "elementary", elementaryProduct: "vehicle" }
};
assert(api._isElementaryMirrorSearchCandidate(foreignHealth) === true, "תיק בריאות של נציג אחר עולה בשיקוף");
assert(api.customerVisibleToCurrentUser(foreignHealth) === false, "אותו תיק לא נפתח בשאר המסכים");
assert(api.isElementaryPoolCustomerRecord(foreignHealth) === false, "תיק בריאות אינו מאגר אלמנטרי");
assert(api._isElementaryMirrorSearchCandidate(foreignElementary) === true, "תיק אלמנטרי של נציג אחר נשאר בשיקוף");
assert(api.customerVisibleToCurrentUser(foreignElementary) === true, "מאגר האלמנטרי נשאר גלוי כמו קודם");
assert(api._isElementaryMirrorSearchCandidate({ id: "cust_arch", status: "archived", payload: { flowType: "health" } }) === false, "תיק גנוז לא עולה");
assert(api._isElementaryMirrorSearchCandidate({ id: "", fullName: "בלי מזהה" }) === false, "רשומה בלי מזהה לא עולה");

console.log("\n4) החיפוש והשמירה נשארים במסך השיקוף");
const searchFn = extractFunction(app, "async search(options = {}){");
assert(searchFn.includes("Storage.searchElementaryMirrorCustomers(q, 40)"), "שיקוף אלמנטרי קורא לחיפוש הפתוח");
assert(searchFn.includes("Storage.searchCustomers(q, 40, { skipAgentScope: true, includePayload: true, matchDigits: true })"), "אם הפונקציה חסרה נשארת הנפילה הקודמת");
const visibleAt = searchFn.indexOf("customerVisibleToCurrentUser(rec)");
const ingestAt = searchFn.indexOf("ensureCustomerInActiveList(rec)");
assert(visibleAt > 0 && ingestAt > visibleAt, "תיק זר לא נכנס לרשימת הסשן");
assert((app.split("searchElementaryMirrorCustomers").length - 1) === 3, "החיפוש הפתוח מוגדר ונקרא רק מכאן");
assert(app.includes("saveElementaryMirrorFlow"), "שמירת תיק זר כותבת רק את זרימת השיקוף");
assert(html.includes("giElemMirrorAll=1"), "מטמון app.js עודכן");
assert(sw.includes("elem-mirror-all-v1"), "מטמון ה-service worker עודכן");

async function runDatabase(){
  let PGlite;
  try {
    ({ PGlite } = require("/tmp/gi-pglite/node_modules/@electric-sql/pglite"));
  } catch(_e) {
    console.log("\n5) database fixture skipped (pglite not installed)");
    return;
  }
  console.log("\n5) database fixture");
  const db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema if not exists auth;
    create function auth.uid() returns uuid language sql stable as $$
      select '11111111-1111-1111-1111-111111111111'::uuid
    $$;
    create function auth.jwt() returns jsonb language sql stable as $$
      select '{"app_metadata":{"agent_id":"elem_1","role":"elementary"}}'::jsonb
    $$;
    create table public.agents (
      id text primary key,
      name text,
      username text,
      role text,
      active boolean,
      auth_user_id uuid,
      team_manager_id text
    );
    insert into public.agents(id, name, username, role, active, auth_user_id) values
      ('elem_1', 'עדן', 'eden', 'elementary', true, '11111111-1111-1111-1111-111111111111'),
      ('agent_ilan', 'אילן', 'ilan', 'agent', true, '22222222-2222-2222-2222-222222222222');
    create table public.customers (
      id text primary key,
      status text,
      full_name text,
      id_number text,
      phone text,
      email text,
      city text,
      agent_name text,
      agent_id text,
      agent_role text,
      is_archived boolean,
      payload jsonb,
      created_at timestamptz,
      updated_at timestamptz
    );
    insert into public.customers(
      id, status, full_name, id_number, phone, agent_name, agent_id, agent_role, is_archived, payload, updated_at
    ) values (
      'cust_ilan_health', 'חדש', 'יוסי כהן', '123456782', '0509999999', 'אילן', 'agent_ilan', 'agent', false,
      '{"flowType":"health","mirrorFlow":{"elementaryReport":{"note":"קודם"}}}'::jsonb,
      '2026-11-01T00:00:00Z'
    );
    alter table public.customers enable row level security;
    alter table public.customers force row level security;
    create policy customers_select_own_shadow on public.customers
      for select to authenticated
      using (agent_id = 'elem_1');
  `);
  await db.exec(sql);
  const found = await db.query(`
    select id, full_name, agent_id, agent_role
    from public.gi_elementary_mirror_search_customers('123456782', 40)
  `);
  assert(found.rows.length === 1 && found.rows[0].id === "cust_ilan_health", "יוזר אלמנטרי מוצא תיק בריאות של אילן");
  assert(found.rows[0].agent_id === "agent_ilan", "השיוך לנציג נשאר של אילן");
  const byPhone = await db.query(`
    select id from public.gi_elementary_mirror_search_customers('050-999-9999', 40)
  `);
  assert(byPhone.rows.length === 1 && byPhone.rows[0].id === "cust_ilan_health", "טלפון עם מקפים מוצא את אותו תיק");
  const tooShort = await db.query(`
    select id from public.gi_elementary_mirror_search_customers('י', 40)
  `);
  assert(tooShort.rows.length === 0, "חיפוש קצר מדי לא מחזיר לקוחות");

  await db.exec(`
    create or replace function auth.uid() returns uuid language sql stable as $$
      select '22222222-2222-2222-2222-222222222222'::uuid
    $$;
    create or replace function auth.jwt() returns jsonb language sql stable as $$
      select '{"app_metadata":{"agent_id":"agent_ilan","role":"agent"}}'::jsonb
    $$;
  `);
  const denied = await db.query(`
    select id from public.gi_elementary_mirror_search_customers('123456782', 40)
  `);
  assert(denied.rows.length === 0, "נציג מכירות לא מקבל את החיפוש הפתוח");

  await db.exec(`
    create or replace function auth.uid() returns uuid language sql stable as $$
      select '11111111-1111-1111-1111-111111111111'::uuid
    $$;
    create or replace function auth.jwt() returns jsonb language sql stable as $$
      select '{"app_metadata":{"agent_id":"elem_1","role":"elementary"}}'::jsonb
    $$;
  `);
  const saved = await db.query(`
    select public.gi_elementary_mirror_save_flow(
      'cust_ilan_health',
      '{"elementaryReport":{"note":"שיקוף"},"callSession":{"active":true}}'::jsonb
    ) as ok
  `);
  assert(saved.rows[0].ok === true, "שמירת השיקוף מתקבלת");
  const after = await db.query(`
    select full_name, agent_id, agent_role, phone, payload::text as payload
    from public.customers where id = 'cust_ilan_health'
  `);
  const row = after.rows[0];
  assert(row.full_name === "יוסי כהן" && row.agent_id === "agent_ilan" && row.agent_role === "agent" && row.phone === "0509999999", "שם, טלפון ושיוך לא נדרסו");
  const payload = JSON.parse(row.payload);
  assert(payload.flowType === "health", "סוג התיק לא השתנה");
  assert(payload.mirrorFlow.elementaryReport.note === "שיקוף", "הדוח החדש נכתב");
  assert(payload.mirrorFlow.callSession.active === true, "מצב השיחה נכתב בזרימה");

  await db.exec("set role anon");
  let blocked = "";
  try { await db.query("select public.gi_elementary_mirror_search_customers('123456782', 40)"); }
  catch(err) { blocked = String(err && err.message || err); }
  await db.exec("reset role");
  assert(/permission denied/i.test(blocked), "מפתח ציבורי לא יכול לקרוא לחיפוש");
  await db.close();
}

runDatabase().then(() => {
  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
