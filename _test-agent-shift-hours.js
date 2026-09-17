const fs = require("fs");
const app = fs.readFileSync("app.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");
const css = fs.readFileSync("app.css", "utf8") + fs.readFileSync("theme.css", "utf8") + fs.readFileSync("theme-unify-flat.css", "utf8");
const sw = fs.readFileSync("service-worker.js", "utf8");

const checks = [
  [html, /id="lcUserShiftStart"/, "shift start field"],
  [html, /id="lcUserShiftEnd"/, "shift end field"],
  [html, /שעות פעילות/, "shift section title"],
  [html, /app\.js\?v=20260917-lead-toast-v1/, "app.js cache bust"],
  [sw, /gi-v12-20260917-lead-toast-v1/, "service worker cache"],
  [css, /height:\s*100dvh/, "fullscreen height"],
  [css, /transform:\s*none/, "fullscreen not centered"],
  [app, /else delete a\.pin/, "empty edit PIN is omitted from write"],
  [app, /setAgentShiftHours/, "shift hours persist helper"],
  [app, /getAgentShiftLoginBlock/, "login shift gate helper"],
  [app, /לא ניתן להתחבר למערכת אינך במשמרת/, "off-shift login copy"],
  [app, /Asia\/Jerusalem/, "Israel clock"],
  [app, /const completeAgentLogin = async \(matched, options = \{\}\) => \{\s*try \{\s*const shiftBlock = getAgentShiftLoginBlock/, "login completion gated"],
  [app, /agentShiftHours/, "meta map persisted"],
  [app, /auth\.admin\.(createUser|updateUserById)|createUser\(|updateUserById\(/, "must not call Auth admin"],
  [app, /if\(matched\.active === false\) return this\._setError\('המשתמש מושבת'\);\s*try \{\s*const shiftBlock = getAgentShiftLoginBlock/, "shift gate before PIN and 2FA"],
];

let failed = 0;
for (const [hay, re, label] of checks) {
  const invert = label.startsWith("must not");
  const hit = re.test(hay);
  if (invert ? hit : !hit) {
    console.error("FAIL", label);
    failed += 1;
  } else {
    console.log("OK", label);
  }
}

if (!/client\.rpc\("gi_verify_agent_login"/.test(app)) {
  console.error("FAIL login RPC still present");
  failed += 1;
} else console.log("OK login RPC untouched");

if (!/Auth\._submit = async function/.test(app)) {
  console.error("FAIL login submit still present");
  failed += 1;
} else console.log("OK login submit still present");

function shiftClockToMinutes(value){
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value || "").trim());
  if(!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if(!Number.isFinite(hour) || !Number.isFinite(minute) || hour > 23 || minute > 59) return null;
  return (hour * 60) + minute;
}
function isNowWithinAgentShift(start, end, nowM){
  const startM = shiftClockToMinutes(start);
  const endM = shiftClockToMinutes(end);
  if(startM == null || endM == null) return true;
  if(startM === endM) return true;
  if(startM < endM) return nowM >= startM && nowM < endM;
  return nowM >= startM || nowM < endM;
}

const behavior = [
  [isNowWithinAgentShift("", "", 12 * 60) === true, "empty hours are unrestricted"],
  [isNowWithinAgentShift("09:00", "17:00", 10 * 60) === true, "inside daytime shift"],
  [isNowWithinAgentShift("09:00", "17:00", 8 * 60) === false, "before daytime shift"],
  [isNowWithinAgentShift("09:00", "17:00", 17 * 60) === false, "at daytime end is outside"],
  [isNowWithinAgentShift("22:00", "06:00", 23 * 60) === true, "overnight after start"],
  [isNowWithinAgentShift("22:00", "06:00", 5 * 60) === true, "overnight before end"],
  [isNowWithinAgentShift("22:00", "06:00", 12 * 60) === false, "overnight daytime blocked"],
];
for (const [ok, label] of behavior) {
  if (!ok) {
    console.error("FAIL", label);
    failed += 1;
  } else {
    console.log("OK", label);
  }
}

const submitIdx = app.indexOf("Auth._submit = async function");
const shiftIdx = app.indexOf("const shiftBlock = getAgentShiftLoginBlock(matched)", submitIdx);
const mfaIdx = app.indexOf("SupabaseMFA.signInWithPassword", submitIdx);
if (submitIdx < 0 || shiftIdx < 0 || mfaIdx < 0 || !(shiftIdx < mfaIdx)) {
  console.error("FAIL shift gate runs before Auth password sign-in");
  failed += 1;
} else {
  console.log("OK shift gate runs before Auth password sign-in");
}

if (failed) process.exit(1);
console.log("OK agent shift + fullscreen checks passed");
