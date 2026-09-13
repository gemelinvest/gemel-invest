const fs = require("fs");
const src = fs.readFileSync("app.js", "utf8");
const sql = fs.readFileSync("supabase-gi-hide-agent-pins.sql", "utf8");
const checks = [
  [/AGENT_PUBLIC_COLUMNS\s*=\s*"id,name,username,role,active,created_at,updated_at,birth_date,monthly_sales_target,email,team_manager_id,auth_user_id"/, "public columns constant"],
  [/select:\s*AGENT_PUBLIC_COLUMNS|loadTableRows\(\s*SUPABASE_TABLES\.agents\s*,\s*AGENT_PUBLIC_COLUMNS\s*\)/, "uses public columns"],
  [/source:\s*"server_unavailable"/, "fail closed without pin"],
  [/do not persist pins into app_meta\.agentsShadow/, "no shadow pin write"],
  [/ignore legacy pins from agentsShadow/, "ignore shadow pin"],
  [/השאר ריק כדי לא לשנות/, "blank pin keeps existing"],
  [/revoke select on table public\.agents from anon, authenticated/i, "sql revoke table select"],
  [/grant select \(\s*id, name, username, role, active/i, "sql grant columns without pin"],
];
let failed = 0;
for (const [re, label] of checks) {
  const hay = /sql /.test(label) || /revoke|grant/.test(label) ? sql + "\n" + src : src;
  if (!re.test(hay)) {
    console.error("FAIL", label);
    failed += 1;
  } else {
    console.log("OK", label);
  }
}
const bareAgentsLoads = (src.match(/loadTableRows\(\s*SUPABASE_TABLES\.agents\s*\)/g) || []).length;
if (bareAgentsLoads) {
  console.error("FAIL bare agents load without columns:", bareAgentsLoads);
  failed += 1;
} else {
  console.log("OK no bare agents loads");
}
if (failed) process.exit(1);
console.log("all checks passed");
