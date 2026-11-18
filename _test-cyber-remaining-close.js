/**
 * The remaining cyber close revokes the public key from three openings.
 * Login, settings, notices, the firewall log, and the phone photo stay.
 *
 * Run: node _test-cyber-remaining-close.js
 */
"use strict";

const fs = require("fs");
const path = require("path");

const root = __dirname;
const archiveSql = fs.readFileSync(path.join(root, "supabase-gi-cyber-remaining-close.sql"), "utf8");
const supportSql = fs.readFileSync(path.join(root, "supabase-gi-cyber-support-session.sql"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
let failed = 0;

function assert(cond, msg){
  if(cond) console.log("  PASS  " + msg);
  else {
    failed += 1;
    console.error("  FAIL  " + msg);
  }
}

console.log("1) the files close only the three public-key openings");
assert(Buffer.byteLength(archiveSql) < 7800 && Buffer.byteLength(supportSql) < 7800, "each file fits in the SQL editor");
assert(archiveSql.includes("revoke all on function public.gi_write_meter_report() from public, anon"), "the public key cannot read the write-rate report");
assert(archiveSql.includes("gi_jwt_is_manager()"), "the write-rate report requires a manager");
assert(archiveSql.includes("revoke all on table public.gi_production_reports from anon"), "the public key cannot read the production archive");
assert(archiveSql.includes("for select to authenticated using (true)"), "a signed-in session can still read the archive");
assert(supportSql.includes("if auth.uid() is null then"), "a support token requires a session");
assert(supportSql.includes("revoke all on function public.gi_rs_mint_actor_token(text, text) from public, anon"), "the public key cannot mint a support token");
assert(!/gi_verify_agent_login|gi_login_roster|gi_app_settings|gi_waf_ingest_event|gi_publish_plasma_model/.test(archiveSql + supportSql), "login, settings, the firewall, and the phone photo are not in these files");
assert(!/delete\s+from\s+public\.customers|drop\s+table\s+public\.customers/i.test(archiveSql + supportSql), "customer rows are not deleted");
assert(app.includes("gi_production_reports"), "the screen still writes the production archive");
assert(app.includes('rpc("gi_rs_mint_actor_token"') || fs.readFileSync(path.join(root, "gi-remote-support.js"), "utf8").includes("gi_rs_mint_actor_token"), "support still mints from the signed-in screen");

async function runDatabase(){
  let PGlite;
  try {
    ({ PGlite } = require("/tmp/gi-pglite/node_modules/@electric-sql/pglite"));
  } catch(_e) {
    console.log("\n2) database fixture skipped (pglite not installed)");
    return;
  }
  console.log("\n2) database fixture");
  const db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema if not exists auth;
    create function auth.uid() returns uuid language sql stable as $$
      select '11111111-1111-4111-8111-111111111111'::uuid
    $$;
    create function public.gi_jwt_is_manager() returns boolean language sql stable as $$ select true $$;
    create table public.gi_write_meter (
      event_type text, ip text, agent_id text, agent_name text, count int, bucket timestamptz
    );
    insert into public.gi_write_meter values ('UPDATE', '1.2.3.4', 'ag-1', 'Agent', 3, now());
    create function public.gi_write_meter_report()
    returns table (event_type text, ip text, agent_id text, agent_name text, peak_per_minute int, total_events int, first_seen timestamptz, last_seen timestamptz)
    language sql security definer set search_path = public as $$ select event_type, ip, agent_id, agent_name, count, count, bucket, bucket from public.gi_write_meter $$;
    grant execute on function public.gi_write_meter_report() to anon, authenticated;
    create table public.gi_production_reports (
      id text primary key, company text, imported_at timestamptz, imported_by text,
      file_names jsonb, policy_count int, customer_count int
    );
    create table public.gi_production_report_rows (
      report_id text, customer_id text, policies jsonb, primary key (report_id, customer_id)
    );
    insert into public.gi_production_reports(id, company) values ('r1', 'מגדל');
    insert into public.gi_production_report_rows(report_id, customer_id, policies) values ('r1', 'c1', '[]'::jsonb);
    alter table public.gi_production_reports enable row level security;
    alter table public.gi_production_report_rows enable row level security;
    create policy gi_production_reports_read on public.gi_production_reports for select using (true);
    create policy gi_production_reports_insert on public.gi_production_reports for insert with check (true);
    create policy gi_production_report_rows_read on public.gi_production_report_rows for select using (true);
    create policy gi_production_report_rows_insert on public.gi_production_report_rows for insert with check (true);
    grant select, insert on public.gi_production_reports to anon, authenticated;
    grant select, insert on public.gi_production_report_rows to anon, authenticated;
    create table public.agents (
      id text primary key, active boolean, username text, name text, pin text, role text
    );
    insert into public.agents(id, active, username, name, pin, role) values ('ag-1', true, 'agent', 'Agent', '1234', 'agent');
    create table public.gi_remote_support_actor_tokens (
      id uuid primary key default gen_random_uuid(),
      agent_user_id text not null,
      token_hash text not null unique,
      expires_at timestamptz not null,
      revoked_at timestamptz
    );
    create function public.gi_rs_new_secret() returns text language sql as $$ select 'secret-token' $$;
    create function public.gi_rs_hash_token(p text) returns text language sql as $$ select p $$;
    create function public.gi_rs_role_is_support_admin(p_role text, p_name text) returns boolean language sql as $$ select false $$;
    create function public.gi_rs_mint_actor_token(p_agent_id text, p_pin text) returns jsonb
      language sql security definer as $$ select '{"ok":true}'::jsonb $$;
    create function public.gi_rs_revoke_actor_token(p_token text) returns jsonb language sql as $$ select '{"ok":true}'::jsonb $$;
    create function public.gi_rs_list(p_token text) returns jsonb language sql as $$ select '{"ok":true}'::jsonb $$;
    create function public.gi_rs_action(p_token text, p_action text, p_session uuid, p_body jsonb) returns jsonb
      language sql as $$ select '{"ok":true}'::jsonb $$;
    grant execute on function public.gi_rs_mint_actor_token(text, text) to anon, authenticated;
    grant execute on function public.gi_rs_revoke_actor_token(text) to anon, authenticated;
    grant execute on function public.gi_rs_list(text) to anon, authenticated;
    grant execute on function public.gi_rs_action(text, text, uuid, jsonb) to anon, authenticated;
  `);
  const before = await db.query("select count(*)::int as n from public.gi_production_reports");
  const first = await db.exec(archiveSql);
  const second = await db.exec(supportSql);
  const report = (first[first.length - 1].rows || []).concat(second[second.length - 1].rows || []);
  const bySection = Object.fromEntries(report.map((row) => [row.section, row.detail]));
  const after = await db.query("select count(*)::int as n from public.gi_production_reports");
  assert(bySection.write_meter === "manager_only" && bySection.write_meter_anon === "no", "the write-rate report is manager only");
  assert(bySection.production_archive === "signed_in" && bySection.production_anon === "no", "the archive is signed-in only");
  assert(bySection.production_rows_changed === "no" && after.rows[0].n === before.rows[0].n, "archive rows stay");
  assert(bySection.remote_support === "signed_in" && bySection.remote_support_anon === "no", "support tokens require a session");
  assert(bySection.login === "unchanged", "login is left unchanged");
  assert(report.some((row) => row.section === "answer" && row.detail === "archive_closed"), "the archive file reports itself closed");
  assert(report.some((row) => row.section === "answer" && row.detail === "support_closed"), "the support file reports itself closed");
  const priv = await db.query(`
    select
      has_function_privilege('anon', 'public.gi_write_meter_report()', 'execute') as meter,
      has_table_privilege('anon', 'public.gi_production_reports', 'select') as archive,
      has_function_privilege('anon', 'public.gi_rs_mint_actor_token(text, text)', 'execute') as mint
  `);
  assert(priv.rows[0].meter === false && priv.rows[0].archive === false && priv.rows[0].mint === false, "the public key is refused on all three");
  await db.exec("create or replace function public.gi_jwt_is_manager() returns boolean language sql stable as $$ select false $$");
  const hidden = await db.query("select count(*)::int as n from public.gi_write_meter_report()");
  assert(hidden.rows[0].n === 0, "a non-manager sees no write-rate rows");
  await db.exec("create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$");
  let missing = "";
  try {
    await db.query("select public.gi_rs_mint_actor_token('ag-1', '')");
  } catch(err) {
    missing = String(err && err.message || err);
  }
  const minted = missing
    ? null
    : await db.query("select public.gi_rs_mint_actor_token('ag-1', '') as result");
  const body = missing || JSON.stringify(minted && minted.rows[0].result);
  assert(String(body).includes("NO_SESSION"), "a missing session cannot mint a support token");
  await db.close();
}

runDatabase().then(() => {
  if(failed){
    console.error("\nFAILED " + failed);
    process.exit(1);
  }
  console.log("\nOK");
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
