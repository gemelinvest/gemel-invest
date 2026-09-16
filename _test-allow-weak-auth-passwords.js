const fs = require("fs");

const workflow = fs.readFileSync(".github/workflows/allow-weak-auth-passwords.yml", "utf8");
const script = fs.readFileSync("scripts/disable-auth-hibp.sh", "utf8");
const config = fs.readFileSync("supabase/config.toml", "utf8");

const checks = [
  [workflow, /leaked-password protection/i, "workflow mentions leaked-password protection"],
  [workflow, /scripts\/disable-auth-hibp\.sh/, "workflow runs disable script"],
  [workflow, /secrets\.SUPABASE_ACCESS_TOKEN/, "workflow uses access token secret"],
  [workflow, /vhvlkerectggovfihjgm/, "workflow targets production project"],
  [script, /password_hibp_enabled":false/, "script disables HIBP"],
  [script, /password_min_length":6/, "script keeps Auth length floor"],
  [script, /api\.supabase\.com\/v1\/projects\/\$\{PROJECT_REF\}\/config\/auth/, "script PATCHes Auth config"],
  [config, /minimum_password_length\s*=\s*6/, "config.toml records length floor"],
];

let failed = 0;
for (const [hay, re, label] of checks) {
  if (!re.test(hay)) {
    console.error("FAIL", label);
    failed += 1;
  } else {
    console.log("OK", label);
  }
}
if (failed) process.exit(1);
console.log("OK allow-weak-auth-passwords checks passed");
