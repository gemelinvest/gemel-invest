/* ממצא 5 — שאילתת קריאה בלבד לפני קיבוע search_path.
   הרצה: node _test-search-path-inventory.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const SQL_FILE = "supabase-gi-search-path-inventory.sql";
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
const executable = sql
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n")
  .replace(/'(?:''|[^'])*'/g, "''");

console.log("1) הקובץ רק קורא");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-search-path-inventory.js")]).status === 0, "node --check this test");
assert(!/\b(insert|update|delete|alter|drop|create|grant|revoke|truncate|notify|comment\s+on)\b/i.test(executable), "אין פקודה שמשנה את המסד");
assert(!/\bdo\s+\$\$/i.test(executable), "אין בלוק שמבצע שינוי");
assert(/schema_acl/.test(sql) && /missing_search_path/.test(sql) && /login_and_portal/.test(sql) && /create_grants/.test(sql), "יש ארבעה דוחות");
assert(/gi_verify_agent_login/.test(sql) && /onyx_customer_portal_open/.test(sql) && /ingest_landing_lead/.test(sql), "כניסה ופורטל מסומנים בנפרד");
assert(/search_path=%/.test(sql) && /uses_extension/.test(sql), "הדוח מזהה נתיב חסר וקריאה להרחבה");

function psqlArgs(db, extra) {
  const args = ["-d", db, "-v", "ON_ERROR_STOP=1"].concat(extra || []);
  const direct = spawnSync("psql", ["-d", "postgres", "-c", "select 1"], { encoding: "utf8" });
  if (direct.status === 0) return { cmd: "psql", args: args };
  return { cmd: "sudo", args: ["-u", "postgres", "psql"].concat(args) };
}

function psql(db, sqlText) {
  const run = psqlArgs(db, ["-q", "-A", "-t", "-F", "|"]);
  return spawnSync(run.cmd, run.args, { input: sqlText, encoding: "utf8" });
}

function psqlCommand(db, statement) {
  const run = psqlArgs(db, ["-c", statement]);
  return spawnSync(run.cmd, run.args, { encoding: "utf8" });
}

console.log("\n2) הדוח על מסד בדיקה");
if (psqlCommand("postgres", "select 1").status !== 0) {
  assert(false, "psql מקומי זמין להרצת הבדיקה");
} else {
  const db = "gi_search_path_inventory_test";
  psqlCommand("postgres", "drop database if exists " + db);
  const created = psqlCommand("postgres", "create database " + db);
  assert(created.status === 0, "נוצר מסד בדיקה");

  const setup = psql(db, `
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then
        create role anon nologin;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then
        create role authenticated nologin;
      end if;
    end $$;
    create function public.gi_fixture_plain()
    returns int language sql security definer
    as $$ select 1 $$;
    create function public.gi_fixture_ext()
    returns int language plpgsql security definer
    as $$ begin
      perform 'crypt(gen_salt(';
      return 1;
    end $$;
    create function public.gi_fixture_safe()
    returns int language sql security definer set search_path to public
    as $$ select 1 $$;
    create function public.gi_verify_agent_login(p_pin text)
    returns int language sql security definer
    as $$ select 1 $$;
    revoke all on function public.gi_fixture_plain() from public;
    grant execute on function public.gi_fixture_plain() to anon, authenticated;
    grant create on schema public to anon;
  `);
  assert(setup.status === 0, "נתוני הבדיקה הותקנו\n" + (setup.stderr || ""));

  const report = psql(db, sql);
  const out = report.stdout || "";
  assert(report.status === 0, "שאילתת הקריאה רצה\n" + (report.stderr || ""));
  assert(out.includes("gi_fixture_plain") && out.includes("gi_fixture_ext"), "פונקציה בלי נתיב מופיעה");
  assert(!out.includes("gi_fixture_safe"), "פונקציה עם נתיב לא נכנסת לדוח החסרים");
  assert(/gi_fixture_ext\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|t\|/.test(out.replace(/\s+/g, "")), "קריאה להרחבה מסומנת");
  assert(out.includes("gi_verify_agent_login"), "פונקציית כניסה בלי נתיב מסומנת");
  assert(/create_grants\|public\|anon\|CREATE/.test(out.replace(/\s+/g, "")), "הרשאת יצירה של anon נראית");

  const after = psql(db, `
    select count(*) from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'gi_fixture%'
      and exists (
        select 1 from unnest(coalesce(p.proconfig, array[]::text[])) cfg
        where cfg like 'search_path=%'
      );
  `);
  assert((after.stdout || "").trim() === "1", "השאילתה לא קבעה נתיב לאף פונקציה");

  psqlCommand("postgres", "drop database if exists " + db + " with (force)");
}

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
