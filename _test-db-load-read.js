/* בדיקת עומס המסד — שאילתת קריאה בלבד.
   הרצה: node _test-db-load-read.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const SQL_FILE = "supabase-gi-db-load-read.sql";
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
  .join("\n");
const withoutTemp = executable
  .replace(/create\s+temporary\s+table\s+gi_load_check_tmp\s*\([^;]*\)\s*;/i, "")
  .replace(/insert\s+into\s+gi_load_check_tmp\b/gi, "select");

console.log("1) הקובץ לא משנה את המסד");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-db-load-read.js")]).status === 0, "node --check this test");
assert(!/\b(update|delete|alter|drop|grant|revoke|truncate|notify|comment\s+on)\b/i.test(executable), "אין עדכון, מחיקה או שינוי הרשאה");
assert(!/\binsert\s+into\s+(?!gi_load_check_tmp\b)/i.test(executable), "כתיבה רק לטבלה הזמנית");
assert(!/\bcreate\s+(?!temporary\s+table\s+gi_load_check_tmp\b)/i.test(executable), "יצירה רק של הטבלה הזמנית");
assert(!/\b(customers|proposals|campaign_leads|payload)\b/i.test(executable), "אין קריאה לטבלאות הלקוחות");
assert(!/\bdo\s+\$\$[\s\S]*\b(update|delete|alter|drop|grant|revoke)\b/i.test(withoutTemp), "בלוק הקריאה לא משנה אובייקט קבוע");
assert(/pg_stat_activity/.test(sql) && /pg_stat_statements/.test(sql), "יש חיבורים חיים ושאילתות שנרשמו");
assert(/gi_daily_report/.test(sql) && /pg_column_size\(data_rows\)/.test(sql), "אורך הדוח נמדד בלי להחזיר תאים");
assert(/statement_timeout/.test(sql) && /lock_timeout/.test(sql), "לשאילתה יש תקרת זמן קצרה");

function psqlArgs(db, extra) {
  const args = ["-d", db, "-v", "ON_ERROR_STOP=1"].concat(extra || []);
  const direct = spawnSync("psql", ["-d", "postgres", "-c", "select 1"], { encoding: "utf8" });
  if (direct.status === 0) return { cmd: "psql", args: args };
  return { cmd: "sudo", args: ["-u", "postgres", "psql"].concat(args) };
}

function psqlFile(db) {
  const run = psqlArgs(db, ["-q", "-f", path.join(ROOT, SQL_FILE)]);
  return spawnSync(run.cmd, run.args, { encoding: "utf8" });
}

function psqlCommand(db, statement) {
  const run = psqlArgs(db, ["-c", statement]);
  return spawnSync(run.cmd, run.args, { encoding: "utf8" });
}

console.log("\n2) הדוח על מסד בדיקה");
if (psqlCommand("postgres", "select 1").status !== 0) {
  assert(false, "psql מקומי זמין להרצת הבדיקה");
} else {
  const db = "gi_db_load_read_test";
  psqlCommand("postgres", "drop database if exists " + db);
  const created = psqlCommand("postgres", "create database " + db);
  assert(created.status === 0, "נוצר מסד בדיקה");
  const setup = psqlCommand(db, `
    create table public.gi_daily_report (
      id text primary key,
      data_rows jsonb
    );
    create table public.gi_cancellations_report (
      id text primary key,
      sheets jsonb
    );
    insert into public.gi_daily_report(id, data_rows)
    values ('active', '[{"agent":"בדיקה","cells":["א","ב"]}]'::jsonb);
    insert into public.gi_cancellations_report(id, sheets)
    values ('active', '[{"sheet_name":"בדיקה"}]'::jsonb);
  `);
  assert(setup.status === 0, "נוצרו שורות דוח לדוגמה");

  const before = psqlCommand(db, "select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public'");
  const ran = psqlFile(db);
  if (ran.status !== 0) console.error(ran.stderr || ran.stdout);
  assert(ran.status === 0, "הקובץ רץ בלי שגיאה");
  assert(/database/.test(ran.stdout) && /connections/.test(ran.stdout), "יש סיכום מסד וחיבורים");
  assert(/top_statements/.test(ran.stdout), "יש דוח שאילתות שנרשמו");
  assert(/report_size/.test(ran.stdout) && /cancel_size/.test(ran.stdout), "יש אורך לדוח המכירות ולדוח הביטולים");
  assert(/active \| bytes /.test(ran.stdout), "אורך הדוח הפעיל חזר בלי תאי הדוח");
  assert(!/בדיקה/.test(ran.stdout), "תוכן השורה לדוגמה לא חזר");

  const after = psqlCommand(db, "select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public'");
  assert(before.stdout === after.stdout, "לא נוסף אובייקט קבוע בסכמה public");
  psqlCommand("postgres", "drop database if exists " + db);
}

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
