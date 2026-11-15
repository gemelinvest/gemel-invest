#!/usr/bin/env node
/* Let the server role store the collection mailbox and read the Outlook
   app id. Does not select, print, or change a token. Safe to run again. */
const REF = process.env.SUPABASE_PROJECT_REF || "vhvlkerectggovfihjgm";
const token = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();

const queries = [
  "grant select, insert, update, delete on table public.gi_app_secrets to service_role",
  `do $$
   begin
     if to_regclass('public.gi_daily_sales_mail_account') is not null then
       execute 'grant select on table public.gi_daily_sales_mail_account to service_role';
     end if;
   end $$`,
  "notify pgrst, 'reload schema'"
];

async function applySql(){
  if(!token) throw new Error("SUPABASE_ACCESS_TOKEN is empty");
  const url = "https://api.supabase.com/v1/projects/" + REF + "/database/query";
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
    if(!res.ok){
      throw new Error("SQL " + res.status + " " + query.slice(0, 80).replace(/\s+/g, " ") + " :: " + text.slice(0, 240));
    }
    console.log("SQL ok:", query.slice(0, 72).replace(/\s+/g, " "));
  }
}

await applySql();
console.log("OK collection mail grants");
