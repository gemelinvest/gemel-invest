#!/usr/bin/env node
/* Publish cancel-form signing: create the tables, then deploy gi-sign.
   Needs SUPABASE_ACCESS_TOKEN. Safe to run more than once. */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const REF = process.env.SUPABASE_PROJECT_REF || "vhvlkerectggovfihjgm";
const token = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

function statements(){
  const raw = fs.readFileSync(path.join(root, "supabase-gi-sign.sql"), "utf8");
  const body = raw.split("\n").filter((line) => !line.trim().startsWith("--")).join("\n");
  const fromFile = body.split(";").map((part) => part.trim()).filter(Boolean);
  return fromFile.concat([
    "grant execute on function public.gi_verify_agent_login(text, text) to service_role",
    "notify pgrst, 'reload schema'"
  ]);
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

function deployFunction(){
  const bin = process.env.SUPABASE_BIN || "supabase";
  const run = spawnSync(bin, [
    "functions", "deploy", "gi-sign",
    "--project-ref", REF,
    "--no-verify-jwt"
  ], { cwd: root, stdio: "inherit", env: process.env });
  if(run.status !== 0) throw new Error("gi-sign deploy failed");
}

const sqlOnly = process.argv.includes("--sql-only");
const printOnly = process.argv.includes("--print");

if(printOnly){
  statements().forEach((query, i) => console.log(String(i + 1) + ". " + query.replace(/\s+/g, " ")));
}else{
  await applySql();
  if(!sqlOnly) deployFunction();
  console.log("OK gi-sign");
}
