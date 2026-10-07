#!/usr/bin/env node
/* Put back anon read/write on the tables the RLS cutover closed.
   Needs SUPABASE_ACCESS_TOKEN. Safe to run more than once. */
import fs from "node:fs";
import path from "node:path";

const REF = process.env.SUPABASE_PROJECT_REF || "vhvlkerectggovfihjgm";
const token = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

function statements(){
  const raw = fs.readFileSync(path.join(root, "supabase-gi-restore-anon-access.sql"), "utf8");
  const body = raw.split("\n").filter((line) => !line.trim().startsWith("--")).join("\n");
  return body.split(";").map((part) => part.trim()).filter(Boolean);
}

async function applySql(){
  if(!token) throw new Error("SUPABASE_ACCESS_TOKEN is empty");
  const url = "https://api.supabase.com/v1/projects/" + REF + "/database/query";
  for(const query of statements()){
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query })
    });
    const text = await res.text();
    if(!res.ok){
      throw new Error("SQL " + res.status + " " + query.slice(0, 80) + " :: " + text.slice(0, 400));
    }
    console.log("SQL ok:", query.slice(0, 72).replace(/\s+/g, " "));
  }
}

if(process.argv.includes("--print")){
  statements().forEach((query, i) => console.log(String(i + 1) + ". " + query.replace(/\s+/g, " ")));
}else{
  await applySql();
  console.log("OK restore anon access");
}
