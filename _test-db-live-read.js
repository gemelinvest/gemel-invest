/* מה רץ על המסד עכשיו — שאילתת קריאה בלבד.
   הרצה: node _test-db-live-read.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const SQL_FILE = "supabase-gi-db-live-read.sql";
let failed = 0;

function assert(cond, msg) {
  if (cond) console.log("  PASS  " + msg);
  else {
    failed += 1;
    console.error("  FAIL  " + msg);
  }
}

const sql = fs.readFileSync(path.join(ROOT, SQL_FILE), "utf8");
const executable = sql
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");
const withoutTemp = executable
  .replace(/create\s+temporary\s+table\s+gi_live_check_tmp\s*\([^;]*\)\s*;/i, "")
  .replace(/insert\s+into\s+gi_live_check_tmp\b/gi, "select");

console.log("1) הקובץ לא נוגע בנתונים");
assert(spawnSync(process.execPath, ["--check", __filename]).status === 0, "node --check this test");
assert(!/\b(update|delete|alter|drop|grant|revoke|truncate|notify|comment\s+on)\b/i.test(executable), "אין עדכון, מחיקה או שינוי הרשאה");
assert(!/\binsert\s+into\s+(?!gi_live_check_tmp\b)/i.test(executable), "כתיבה רק לטבלה הזמנית");
assert(!/\bcreate\s+(?!temporary\s+table\s+gi_live_check_tmp\b)/i.test(executable), "יצירה רק של הטבלה הזמנית");
assert(!/\bfrom\s+(public\.)?(customers|proposals|campaign_leads|gi_daily_report|gi_cancellations_report)\b/i.test(executable), "אין קריאה מטבלאות הנתונים");
assert(!/\b(payload|data_rows|sheets)\b/i.test(executable), "אין קריאה לתוכן תיק או דוח");
assert(/pg_stat_activity/.test(sql) && /pg_stat_statements/.test(sql), "נבדקים חיבורים חיים ושאילתות שנרשמו");
assert(/dashboard_net/.test(sql) && /lead_description/.test(sql) && /daily_report/.test(sql), "הסיווג מכסה את הדשבורד, תיאור הליד והדוח");
assert(/statement_timeout/.test(sql) && /lock_timeout/.test(sql), "לשאילתה יש תקרת זמן קצרה");
assert(!/\bdo\s+\$\$[\s\S]*\b(update|delete|alter|drop|grant|revoke)\b/i.test(withoutTemp), "בלוק הקריאה לא משנה אובייקט קבוע");

function psqlArgs(db, extra) {
  const args = ["-d", db, "-v", "ON_ERROR_STOP=1"].concat(extra || []);
  const direct = spawnSync("psql", ["-d", "postgres", "-c", "select 1"], { encoding: "utf8" });
  if (direct.status === 0) return { cmd: "psql", args: args };
  return { cmd: "sudo", args: ["-u", "postgres", "psql"].concat(args) };
}

function psqlCommand(db, statement) {
  const run = psqlArgs(db, ["-c", statement]);
  return spawnSync(run.cmd, run.args, { encoding: "utf8" });
}

function psqlFile(db) {
  const run = psqlArgs(db, ["-q", "-f", path.join(ROOT, SQL_FILE)]);
  return spawnSync(run.cmd, run.args, { encoding: "utf8" });
}

console.log("\n2) הרצה על מסד בדיקה עם מילה סודית בתיק");
if (psqlCommand("postgres", "select 1").status !== 0) {
  assert(false, "psql מקומי זמין להרצת הבדיקה");
} else {
  const db = "gi_db_live_read_test";
  psqlCommand("postgres", "drop database if exists " + db);
  const created = psqlCommand("postgres", "create database " + db);
  assert(created.status === 0, "נוצר מסד בדיקה");
  const setup = psqlCommand(db, `
    create table public.customers (
      id text primary key,
      payload text
    );
    insert into public.customers(id, payload) values ('1', 'סוד-בדיקה-חיה');
    create table public.campaign_leads (
      id text primary key,
      description text
    );
    insert into public.campaign_leads(id, description) values ('L1', 'סוד-ליד-חי');
  `);
  assert(setup.status === 0, "נוצרו שורות בדיקה");
  const before = psqlCommand(db, "select count(*) from pg_class where relnamespace = 'public'::regnamespace");
  const ran = psqlFile(db);
  assert(ran.status === 0, "הקובץ רץ בלי שגיאה");
  assert(!/סוד-בדיקה-חיה|סוד-ליד-חי/.test(ran.stdout), "תוכן התיק והליד לא חוזר");
  assert(/database/.test(ran.stdout) && /sessions/.test(ran.stdout) && /running/.test(ran.stdout), "חוזרים מצב המסד, החיבורים ומה שרץ");
  const after = psqlCommand(db, "select count(*) from pg_class where relnamespace = 'public'::regnamespace");
  assert(before.stdout === after.stdout, "מספר הטבלאות הקבועות לא השתנה");
  const still = psqlCommand(db, "select payload from public.customers where id = '1'");
  assert(/סוד-בדיקה-חיה/.test(still.stdout), "שורת הבדיקה נשארה במקומה");
  psqlCommand("postgres", "drop database if exists " + db);
}

if (failed) {
  console.error("\nFAILED " + failed);
  process.exit(1);
}
console.log("\nOK");
