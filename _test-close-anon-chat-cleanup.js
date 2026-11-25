/* ממצא 4 — סגירת הרצה אנונימית של gi_chat_cleanup.
   בודק את חוזה הקובץ, ומריץ אותו על Postgres מקומי עם ה-ACL מהדוח.
   הרצה: node _test-close-anon-chat-cleanup.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const SQL_FILE = "supabase-gi-chat-cleanup-revoke-anon.sql";
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

const sql = read(SQL_FILE);
const app = read("app.js");
const phone = read("phone/phone.js");
const executable = sql.split("\n").filter((line) => !line.trim().startsWith("--")).join("\n");

console.log("1) החוזה של קובץ ההרשאות ומסלול הצ'אט");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-close-anon-chat-cleanup.js")]).status === 0, "node --check this test");
assert(!/create\s+or\s+replace\s+function/i.test(executable), "אין החלפת גוף פונקציה");
assert(!/\bdrop\s+function\b/i.test(executable), "אין מחיקת פונקציה");
assert(!/\balter\s+function\b/i.test(executable), "אין שינוי גוף או search_path");
assert(!/\b(policy|enable\s+row\s+level|storage\.|auth\.)\b/i.test(executable), "אין RLS, אחסון או סכמת auth");
assert(/grant execute on function %s to authenticated/i.test(sql), "משאיר authenticated");
assert(/grant execute on function %s to service_role/i.test(sql), "נותן service_role במפורש");
assert(/revoke execute on function %s from public/i.test(sql), "מוריד PUBLIC");
assert(/revoke execute on function %s from anon/i.test(sql), "מוריד anon");
assert(/fn_count <> 1/.test(sql), "עוצר אם יש יותר מעותק אחד");
assert(/authenticated cannot execute/.test(sql), "עוצר אם לנציג מחובר אין הרצה לפני השינוי");
assert(/anon still has EXECUTE/.test(sql), "מוודא שאנונימי נסגר");
assert(/authenticated lost EXECUTE/.test(sql), "מוודא שנציג מחובר לא איבד הרצה");
assert(sql.includes("gi_chat_cleanup") && !/gi_verify_agent_login|gi_login_roster|gi_daily_sales_by_agent/.test(sql), "רק פונקציית ניקוי הצ'אט");
assert(app.includes('cleanupRpc: "gi_chat_cleanup"') && app.includes("async cleanupExpiredData()") && app.includes("await this.client.rpc(SUPABASE_CHAT.cleanupRpc)") && app.includes("from(SUPABASE_CHAT.messagesTable).delete()"), "המחשב ממשיך לקרוא לאותה פונקציה ובולע כשל");
assert(phone.includes('await sb.rpc("gi_chat_cleanup")') && phone.includes("try { await sb.rpc(\"gi_chat_cleanup\"); } catch (_err) {}"), "הטלפון ממשיך לקרוא לאותה פונקציה בתוך try/catch");

function psqlArgs(db, extra) {
  const args = ["-d", db, "-v", "ON_ERROR_STOP=1"].concat(extra || []);
  const direct = spawnSync("psql", ["-d", "postgres", "-c", "select 1"], { encoding: "utf8" });
  if (direct.status === 0) return { cmd: "psql", args: args };
  return { cmd: "sudo", args: ["-u", "postgres", "psql"].concat(args) };
}

function psql(db, sqlText, tuples) {
  const run = psqlArgs(db, tuples ? ["-q", "-A", "-t", "-F", "|"] : ["-q"]);
  return spawnSync(run.cmd, run.args, { input: sqlText, encoding: "utf8" });
}

function psqlCommand(db, statement) {
  const run = psqlArgs(db, ["-c", statement]);
  return spawnSync(run.cmd, run.args, { encoding: "utf8" });
}

function canUsePostgres() {
  return psqlCommand("postgres", "select 1").status === 0;
}

console.log("\n2) הרצה על ACL כמו בדוח");
if (!canUsePostgres()) {
  assert(false, "psql מקומי זמין להרצת הבדיקה");
} else {
  const db = "gi_chat_acl_test";
  psqlCommand("postgres", "drop database if exists " + db);
  const created = psqlCommand("postgres", "create database " + db);
  assert(created.status === 0, "נוצר מסד בדיקה");

  const setup = `
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then
        create role anon nologin;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then
        create role authenticated nologin;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then
        create role service_role nologin;
      end if;
    end $$;
    create function public.gi_chat_cleanup()
    returns integer
    language sql
    security definer
    set search_path to public
    as $$ select 7 $$;
    revoke all on function public.gi_chat_cleanup() from public;
    grant execute on function public.gi_chat_cleanup() to postgres, anon, authenticated;
  `;
  const ready = psql(db, setup);
  assert(ready.status === 0, "הפונקציה וה-ACL מהדוח הותקנו\n" + (ready.stderr || ""));

  const applied = psql(db, sql);
  assert(applied.status === 0, "קובץ התיקון רץ\n" + (applied.stderr || ""));
  assert(/closed anonymous execute/.test(applied.stderr || ""), "הבלוק דיווח שהאנונימי נסגר");

  const proof = psql(db, `
    select has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_exec,
           has_function_privilege('service_role', p.oid, 'EXECUTE') as service_exec,
           exists (
             select 1 from aclexplode(p.proacl) a
             where a.grantee = 0 and a.privilege_type = 'EXECUTE'
           ) as public_exec,
           p.prosrc as body
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'gi_chat_cleanup';
  `, true);
  const row = (proof.stdout || "").trim();
  assert(proof.status === 0 && /f\|t\|t\|f\|/.test(row.replace(/\s+/g, "")), "anon סגור, authenticated ו-service_role פתוחים, PUBLIC סגור: " + row);
  assert(row.includes("select 7"), "גוף הפונקציה לא הוחלף");

  const asAnon = psql(db, `
    set role anon;
    select public.gi_chat_cleanup();
  `);
  assert(asAnon.status !== 0 && /permission denied/i.test(asAnon.stderr || ""), "קריאה בלי סשן נדחית");

  const asAgent = psql(db, `
    set role authenticated;
    select public.gi_chat_cleanup();
  `);
  assert(asAgent.status === 0 && /7/.test(asAgent.stdout || ""), "קריאה עם סשן מחזירה את אותה תוצאה");

  const again = psql(db, sql);
  assert(again.status === 0, "הרצה שנייה לא שוברת את המצב");

  const overload = psql(db, `
    create function public.gi_chat_cleanup(p_keep interval)
    returns int language sql as $$ select 1 $$;
  `);
  assert(overload.status === 0, "עותק שני הותקן לצורך בדיקת העצירה");
  const stopped = psql(db, sql);
  assert(stopped.status !== 0 && /found 2/.test(stopped.stderr || ""), "שני עותקים עוצרים את התיקון");
  const stillClosed = psql(db, `
    select has_function_privilege('anon', p.oid, 'EXECUTE')
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'gi_chat_cleanup'
      and pg_get_function_identity_arguments(p.oid) = '';
  `, true);
  assert(/^\s*f\s*$/m.test(stillClosed.stdout || ""), "כישלון הבדיקה לא פותח מחדש את האנונימי");

  psqlCommand("postgres", "drop database if exists " + db + " with (force)");
}

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
