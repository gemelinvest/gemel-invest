/**
 * Contract checks for temporary write-rate metering (Track A / Step A3).
 * Additive only: never blocks a write; only counts. Self-disabling.
 * Run: node _test-write-meter.js
 */
const fs = require("fs");
const path = require("path");
const sql = fs.readFileSync(path.join(__dirname, "supabase-gi-write-meter.sql"), "utf8");

function assert(cond, msg){
  if(!cond) throw new Error(msg);
}

// Meter table private to service_role only.
assert(/create table if not exists public\.gi_write_meter/i.test(sql), "must create meter table");
assert(/revoke all on public\.gi_write_meter from anon, authenticated/i.test(sql), "meter must be private");
assert(/grant all on public\.gi_write_meter to service_role/i.test(sql), "service_role manages meter");

// Settings: enable flag + auto-expiry.
assert(sql.includes("'write_meter_enabled', 'true'"), "meter defaults ON");
assert(/write_meter_expires_at/.test(sql), "must have auto-expiry setting");
assert(/now\(\) \+ interval '7 days'/i.test(sql), "default expiry 7 days");

// Trigger never blocks the write (AFTER trigger + swallows errors).
assert(/after insert or update on public\.customers/i.test(sql), "must attach AFTER trigger");
assert(/for each row execute function public\.gi_write_meter_record/i.test(sql), "per-row trigger");
assert(/exception when others then/i.test(sql), "trigger MUST swallow own errors (never fail the write)");
assert(/null;\s*end;\s*return null/i.test(sql) || /exception when others then\s+null/i.test(sql),
  "trigger must return null on error path");

// Counts via upsert, never returns a value that alters the row.
assert(/do update set count = gi_write_meter\.count \+ 1/i.test(sql), "must upsert counter");
assert(/return null;/i.test(sql), "trigger must return null (no row alteration)");

// Auto-disable after expiry.
assert(/update public\.gi_security_settings set value = 'false'\s+where key = 'write_meter_enabled'/i.test(sql),
  "must auto-disable after expiry");

// Report function present and exposed for read.
assert(/create or replace function public\.gi_write_meter_report/i.test(sql), "must provide report function");
assert(/grant execute on function public\.gi_write_meter_report/i.test(sql), "report must be callable");

// Cleanup instructions present (so it can be fully removed later).
assert(/drop trigger if exists gi_write_meter_customers/i.test(sql), "must document trigger drop");
assert(/drop table if exists public\.gi_write_meter/i.test(sql), "must document table drop");

console.log("OK _test-write-meter.js");
