/* חיפוש שיקוף של נציג תפעול נשען על טבלת הנציגים, לא על תפקיד ישן בטוקן.
   הרצה: node _test-ops-mirror-customer-access.js
*/
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-ops-mirror-customer-access.sql"), "utf8");
const apply = fs.readFileSync(path.join(ROOT, "scripts/apply-ops-mirror-customer-access.mjs"), "utf8");
const workflow = fs.readFileSync(path.join(ROOT, ".github/workflows/apply-ops-mirror-customer-access.yml"), "utf8");
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

function executable(src){
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
}

const code = executable(sql);
const roleFn = code.split("create or replace function public.gi_jwt_role()")[1].split("create or replace function public.gi_caller_is_ops_roster()")[0];
const rosterFn = code.split("create or replace function public.gi_caller_is_ops_roster()")[1].split("drop policy if exists gi_customers_ops_roster_select")[0];

console.log("1) התפקיד בטבלת הנציגים גובר על טוקן חלש");
assert(code.includes("create or replace function public.gi_jwt_role()"), "מחליף את gi_jwt_role");
assert(!roleFn.includes("user_metadata"), "הפונקציה לא קוראת שדה פרופיל שהמשתמש יכול לערוך");
assert(roleFn.includes("from public.agents a"), "קוראת את שורת הנציג");
assert(roleFn.includes("auth.jwt() -> 'app_metadata' ->> 'role'"), "עדיין קוראת את תפקיד הטוקן");
assert(roleFn.includes("a.auth_user_id = auth.uid()"), "מזהה את הנציג לפי חשבון הכניסה");
assert(roleFn.includes("app_metadata' ->> 'agent_id'"), "מזהה גם לפי מזהה הנציג שבטוקן");
assert(roleFn.includes("'admin', 'owner', 'manager', 'adminlite', 'מנהל'"), "טוקן של מנהל לא יורד");
assert(roleFn.includes("s.token_role not in"), "טוקן חזק לא מוחלף");
assert(roleFn.includes("'opsagent'"), "נציג תפעול מזוהה באותיות קטנות כמו שאר המדיניות");
assert(roleFn.includes("when 'ops_agent' then 'opsagent'"), "ops_agent ממופה לצורה שהמדיניות בודקת");
assert(roleFn.includes("when 'נציג תפעול' then 'opsagent'"), "תפקיד בעברית ממופה לנציג תפעול");

console.log("\n2) קריאה וכתיבה של לקוח לנציג תפעול מחובר");
assert(code.includes("create or replace function public.gi_caller_is_ops_roster()"), "יש בדיקת סגל תפעול");
assert(!rosterFn.includes("user_metadata"), "בדיקת הסגל לא קוראת שדה פרופיל שהמשתמש יכול לערוך");
assert(rosterFn.includes("'opsagent'"), "הבדיקה כוללת נציג תפעול");
assert(rosterFn.includes("coalesce(a.active, true) = true"), "נציג מושבת לא נכלל");
assert(code.includes("revoke all on function public.gi_caller_is_ops_roster() from anon"), "אנונימי לא מריץ את הבדיקה");
assert(code.includes("grant execute on function public.gi_caller_is_ops_roster() to authenticated"), "רק משתמש מחובר מריץ את הבדיקה");
assert(code.includes("create policy gi_customers_ops_roster_select"), "יש מדיניות קריאה");
assert(code.includes("for select") && code.includes("to authenticated") && code.includes("using (public.gi_caller_is_ops_roster())"), "הקריאה היא למשתמש מחובר בסגל התפעול");
assert(code.includes("create policy gi_customers_ops_roster_insert"), "יש מדיניות הוספה, כדי ששמירת שיקוף תעבור");
assert(code.includes("create policy gi_customers_ops_roster_update"), "יש מדיניות עדכון");
assert(code.includes("for update") && code.includes("with check (public.gi_caller_is_ops_roster())"), "העדכון נבדק גם אחרי השינוי");
assert(!code.includes("gi_customers_ops_roster_delete"), "אין מדיניות מחיקה חדשה");
assert(!/\sto anon\b/.test(code), "אין מדיניות לאנונימי");
assert(!code.includes("drop policy gi_customers_all_authenticated") && !code.includes("drop policy customers_select_own_shadow"), "המדיניות הקיימת לא נמחקת");
assert(code.includes("operations customer policies are missing or too wide"), "הרצה שגויה נעצרת");

console.log("\n3) היישום רץ רק אחרי מיזוג ל-main");
assert(apply.includes("supabase-gi-ops-mirror-customer-access.sql"), "סקריפט היישום קורא את קובץ ה-SQL");
assert(apply.includes("SUPABASE_ACCESS_TOKEN"), "היישום דורש אסימון ניהול");
assert(apply.includes("-- @statement"), "היישום מפצל לפי הצהרות");
assert(workflow.includes("branches: [main]"), "הזרימה לא רצה על ענף פיצ'ר");
assert(workflow.includes("supabase-gi-ops-mirror-customer-access.sql"), "הזרימה עוקבת אחרי קובץ ה-SQL");
assert(workflow.includes("scripts/apply-ops-mirror-customer-access.mjs"), "הזרימה מריצה את סקריפט היישום");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
