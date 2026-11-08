const fs = require("fs");

const workflow = fs.readFileSync(".github/workflows/allow-weak-auth-passwords.yml", "utf8");
const script = fs.readFileSync("scripts/disable-auth-hibp.sh", "utf8");
const config = fs.readFileSync("supabase/config.toml", "utf8");
const provision = fs.readFileSync("supabase/functions/gi-provision-agent-auth/index.ts", "utf8");

const checks = [
  [workflow, /leaked-password rejection stays off/i, "workflow keeps leaked-password rejection off"],
  [workflow, /scripts\/disable-auth-hibp\.sh/, "workflow runs the auth policy script"],
  [workflow, /secrets\.SUPABASE_ACCESS_TOKEN/, "workflow uses access token secret"],
  [workflow, /vhvlkerectggovfihjgm/, "workflow targets production project"],
  [script, /password_hibp_enabled": False/, "script keeps HIBP off"],
  [script, /password_min_length": 8/, "script sets the Auth length floor to 8"],
  [script, /abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ/, "script requires a letter"],
  [script, /0123456789/, "script requires a digit"],
  [script, /password_min_length":6/, "script does not restore the old length floor"],
  [script, /!@#/, "script does not require a symbol"],
  [script, /api\.supabase\.com\/v1\/projects\/\$\{PROJECT_REF\}\/config\/auth/, "script PATCHes Auth config"],
  [config, /minimum_password_length\s*=\s*8/, "config.toml records the length floor"],
  [config, /password_requirements\s*=\s*"letters_digits"/, "config.toml records letters and digits"],
  [provision, /return out \+ "!Aa1"/, "a generated agent password includes every class"],
  [provision, /function randomPassword\(len = 24\)/, "a generated agent password is longer than the floor"],
];

let failed = 0;
for (const [hay, re, label] of checks) {
  const ok = re.test(hay);
  const negative = label.startsWith("script does not");
  if (negative ? ok : !ok) {
    console.error("FAIL", label);
    failed += 1;
  } else {
    console.log("OK", label);
  }
}
if (failed) process.exit(1);
console.log("OK auth password floor checks passed");
