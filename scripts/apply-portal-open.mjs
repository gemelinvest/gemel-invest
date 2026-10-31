#!/usr/bin/env node
/* Install the personal-area helpers and the open function.
   onyx_portal_array was missing, so a correct code stopped before the file opened.
   Needs SUPABASE_ACCESS_TOKEN. Safe to run again. */
import fs from "node:fs";
import path from "node:path";

const REF = process.env.SUPABASE_PROJECT_REF || "vhvlkerectggovfihjgm";
const token = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

function extract(sql, name) {
  const marker = "create or replace function public." + name;
  const start = sql.indexOf(marker);
  if (start < 0) throw new Error("missing " + name);
  const end = sql.indexOf("\n$$;", start);
  if (end < 0) throw new Error("end " + name);
  return sql.slice(start, end + "\n$$;".length).trim();
}

function statements() {
  const sql = fs.readFileSync(path.join(root, "supabase-onyx-customer-portal.sql"), "utf8").replace(/\r\n/g, "\n");
  const queries = [
    "onyx_portal_array",
    "onyx_portal_gate",
    "onyx_customer_portal_open"
  ].map((name) => extract(sql, name));
  queries.push("revoke all on function public.onyx_portal_array(jsonb) from public, anon, authenticated");
  queries.push("revoke all on function public.onyx_portal_gate(text, text, text, text) from public, anon, authenticated");
  queries.push("revoke all on function public.onyx_customer_portal_open(text, text, text, text) from public");
  queries.push("grant execute on function public.onyx_customer_portal_open(text, text, text, text) to anon, authenticated, service_role");
  queries.push([
    "do $grant$",
    "declare",
    "  owner name;",
    "begin",
    "  for owner in",
    "    select distinct pg_get_userbyid(proowner)",
    "    from pg_proc",
    "    where proname in ('onyx_customer_portal_open', 'onyx_portal_gate', 'onyx_customer_portal_doc')",
    "  loop",
    "    execute format('grant execute on function public.onyx_portal_array(jsonb) to %I', owner);",
    "    execute format('grant execute on function public.onyx_portal_id(text) to %I', owner);",
    "    execute format('grant execute on function public.onyx_portal_phone(text) to %I', owner);",
    "    execute format('grant execute on function public.onyx_portal_birth(text) to %I', owner);",
    "    execute format('grant execute on function public.onyx_portal_amount(jsonb) to %I', owner);",
    "    execute format('grant execute on function public.onyx_portal_premium(jsonb) to %I', owner);",
    "    execute format('grant execute on function public.onyx_portal_doc_title(jsonb) to %I', owner);",
    "    execute format('grant execute on function public.onyx_portal_doc_signed(jsonb, jsonb) to %I', owner);",
    "  end loop;",
    "end",
    "$grant$;"
  ].join("\n"));
  return queries;
}

async function applySql() {
  if (!token) throw new Error("SUPABASE_ACCESS_TOKEN is empty");
  const url = "https://api.supabase.com/v1/projects/" + REF + "/database/query";
  for (const query of statements()) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query })
    });
    const text = await res.text();
    if (!res.ok) throw new Error("SQL " + res.status + " " + query.slice(0, 80) + " :: " + text.slice(0, 400));
    console.log("SQL ok:", query.slice(0, 72).replace(/\s+/g, " "));
  }
}

if (process.argv.includes("--print")) {
  statements().forEach((query, i) => console.log(String(i + 1) + ". " + query.slice(0, 120).replace(/\s+/g, " ")));
} else {
  await applySql();
  console.log("OK personal area open");
}
