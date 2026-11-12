#!/usr/bin/env node
/* Apply the operations mirror-call customer policies.
   Needs SUPABASE_ACCESS_TOKEN. Safe to run again. */
import fs from "node:fs";
import path from "node:path";

const REF = process.env.SUPABASE_PROJECT_REF || "vhvlkerectggovfihjgm";
const token = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

function statements(){
  const sql = fs.readFileSync(path.join(root, "supabase-gi-ops-mirror-customer-access.sql"), "utf8").replace(/\r\n/g, "\n");
  return sql
    .split("\n-- @statement\n")
    .map((part) => part
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
      .trim())
    .filter(Boolean);
}

async function applySql(){
  if(!token) throw new Error("SUPABASE_ACCESS_TOKEN is empty");
  const url = "https://api.supabase.com/v1/projects/" + REF + "/database/query";
  const queries = statements();
  if(queries.length < 8) throw new Error("expected the role helper, the roster check, and the three policies");
  for(const query of queries){
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query })
    });
    const text = await res.text();
    if(!res.ok) throw new Error("SQL " + res.status + " " + query.slice(0, 80) + " :: " + text.slice(0, 400));
    console.log("SQL ok:", query.slice(0, 72).replace(/\s+/g, " "));
  }
}

if(process.argv.includes("--print")){
  statements().forEach((query, i) => console.log(String(i + 1) + ". " + query.slice(0, 120).replace(/\s+/g, " ")));
} else {
  await applySql();
  console.log("OK ops mirror customer access");
}
