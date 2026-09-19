const fs = require("fs");
const app = fs.readFileSync("app.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");
const css = fs.readFileSync("app.css", "utf8") + fs.readFileSync("theme.css", "utf8") + fs.readFileSync("theme-unify-flat.css", "utf8");
const sw = fs.readFileSync("service-worker.js", "utf8");

const checks = [
  [html, /id="lcUserShiftStart"/, "shift start field"],
  [html, /id="lcUserShiftEnd"/, "shift end field"],
  [html, /שעות פעילות/, "shift section title"],
  [html, /app\.js\?v=20260919-myleads-chrome-v1/, "app.js cache bust"],
  [html, /app\.css\?v=20260919-myleads-chrome-v1/, "app.css cache bust"],
  [html, /theme\.css\?v=20260919-myleads-chrome-v1/, "theme.css cache bust"],
  [html, /gi-face-auth\.js\?v=20260919-shift-modal-v1/, "gi-face-auth cache bust"],
  [sw, /gi-v12-20260919-myleads-chrome-v1/, "service worker cache"],
  [css, /GI-SHIFT-BLOCK 2026-09-19/, "shift block modal CSS mark"],
  [css, /\.giHarNotice__card--shiftBlock/, "large centered shift card"],
  [css, /\.giHarNotice__hour/, "highlighted shift start hour"],
  [app, /function showAgentShiftBlockedModal/, "off-shift login uses centered modal"],
  [app, /function presentAgentShiftLoginBlock/, "shift block presenter clears inline login error"],
  [app, /giAgentShiftBlockedNotice/, "shift block modal id"],
  [app, /title: "אינך במשמרת"/, "shift modal title"],
  [app, /if\(shiftBlock\.blocked\)\{\s*void presentAgentShiftLoginBlock\(shiftBlock\);\s*return;/, "PIN shift gate opens modal not inline error"],
  [app, /try \{ presentAgentShiftLoginBlock\(shiftBlock\); \} catch\(_eModal\) \{\}/, "face login completion opens shift modal"],
  [css, /height:\s*100dvh/, "fullscreen height"],
  [css, /transform:\s*none/, "fullscreen not centered"],
  [app, /else delete a\.pin/, "empty edit PIN is omitted from write"],
  [app, /setAgentShiftHours/, "shift hours persist helper"],
  [app, /getAgentShiftLoginBlock/, "login shift gate helper"],
  [app, /לא ניתן להתחבר למערכת אינך במשמרת/, "off-shift login copy"],
  [app, /Asia\/Jerusalem/, "Israel clock"],
  [app, /const completeAgentLogin = async \(matched, options = \{\}\) => \{\s*try \{\s*if\(typeof App\?\.ensureLoginReady === "function"\) await App\.ensureLoginReady/, "login completion loads hours before shift gate"],
  [app, /if\(shiftBlock\.blocked\)\{\s*try \{ window\.__GI_FACE_LOGIN_DONE__ = false/, "off-shift face login does not mark face login done"],
  [app, /return \{ ok: false, blocked: true, message: shiftBlock\.message, start: shiftBlock\.start \|\| "" \}/, "shift block is returned to face login"],
  [app, /_allowFaceLoginError/, "shift error can surface during face login"],
  [app, /agentShiftHours/, "meta map persisted"],
  [app, /auth\.admin\.(createUser|updateUserById)|createUser\(|updateUserById\(/, "must not call Auth admin"],
  [app, /if\(matched\.active === false\) return this\._setError\('המשתמש מושבת'\);\s*try \{\s*const shiftBlock = getAgentShiftLoginBlock/, "shift gate before PIN and 2FA"],
  [app, /els\.shiftStart = \$\('#lcUserShiftStart'\)/, "modal wrapper re-queries shift start"],
  [app, /els\.shiftEnd = \$\('#lcUserShiftEnd'\)/, "modal wrapper re-queries shift end"],
  [app, /\(\?::\\d\{2\}\(\?:\\\.\\d\+\)\?\)\?/, "time input may include seconds"],
  [app, /mergedState\.meta\.agentShiftHours = mergeAgentShiftHoursMaps\(\s*remoteMeta\.agentShiftHours/, "metaOnly merge keeps server shift hours"],
  [app, /localState\.meta\.agentShiftHours = mergeAgentShiftHoursMaps\(\s*serverState\.meta\.agentShiftHours/, "saveSheets merge keeps server shift hours"],
  [app, /GI_LAST_SERVER_AGENT_SHIFT_HOURS/, "upsertMeta keeps last server shift hours"],
  [app, /mergeAgentShiftHoursMaps\(serverShiftHours, target\.meta\.agentShiftHours\)/, "upsertMeta merges shift hours before write"],
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

function normalizeShiftClock(value){
  const raw = String(value || "").trim();
  const m = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(raw);
  if(!m) return "";
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if(!Number.isFinite(hour) || !Number.isFinite(minute) || hour > 23 || minute > 59) return "";
  return String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0");
}
function shiftClockToMinutes(value){
  const clock = normalizeShiftClock(value);
  if(!clock) return null;
  const parts = clock.split(":");
  return (Number(parts[0]) * 60) + Number(parts[1]);
}
function isNowWithinAgentShift(start, end, nowM){
  const startM = shiftClockToMinutes(start);
  const endM = shiftClockToMinutes(end);
  if(startM == null || endM == null) return true;
  if(startM === endM) return true;
  if(startM < endM) return nowM >= startM && nowM < endM;
  return nowM >= startM || nowM < endM;
}
function compareIsoStamps(a, b){
  const ta = Date.parse(String(a || "").trim() || "") || 0;
  const tb = Date.parse(String(b || "").trim() || "") || 0;
  if(ta === tb) return 0;
  return ta > tb ? 1 : -1;
}
function mergeAgentShiftHoursMaps(srv, loc){
  const s = srv && typeof srv === "object" && !Array.isArray(srv) ? srv : {};
  const l = loc && typeof loc === "object" && !Array.isArray(loc) ? loc : {};
  const out = { ...s };
  Object.entries(l).forEach(([key, lEntry]) => {
    const sEntry = s[key];
    if(!sEntry || compareIsoStamps(lEntry.updatedAt, sEntry.updatedAt) >= 0){
      out[key] = lEntry;
    }
  });
  return out;
}

const behavior = [
  [isNowWithinAgentShift("", "", 12 * 60) === true, "empty hours are unrestricted"],
  [isNowWithinAgentShift("09:00", "17:00", 10 * 60) === true, "inside daytime shift"],
  [isNowWithinAgentShift("09:00", "17:00", 8 * 60) === false, "before daytime shift"],
  [isNowWithinAgentShift("09:00", "17:00", 17 * 60) === false, "at daytime end is outside"],
  [isNowWithinAgentShift("22:00", "06:00", 23 * 60) === true, "overnight after start"],
  [isNowWithinAgentShift("22:00", "06:00", 5 * 60) === true, "overnight before end"],
  [isNowWithinAgentShift("22:00", "06:00", 12 * 60) === false, "overnight daytime blocked"],
  [normalizeShiftClock("09:00:00") === "09:00", "time input seconds normalize to HH:MM"],
  [normalizeShiftClock("9:05:00.000") === "09:05", "time input with millis normalizes"],
  [normalizeShiftClock("09:00") === "09:00", "HH:MM still accepted"],
  [normalizeShiftClock("25:00:00") === "", "invalid hour stays empty"],
];
for (const [ok, label] of behavior) {
  if (!ok) {
    console.error("FAIL", label);
    failed += 1;
  } else {
    console.log("OK", label);
  }
}

const serverHours = {
  a_1: { start: "09:00", end: "17:00", updatedAt: "2026-09-18T10:00:00.000Z" }
};
const emptyLocal = {};
const mergedKeep = mergeAgentShiftHoursMaps(serverHours, emptyLocal);
if (!(mergedKeep.a_1 && mergedKeep.a_1.start === "09:00" && mergedKeep.a_1.end === "17:00")) {
  console.error("FAIL unrelated meta save with empty local must keep server shift hours");
  failed += 1;
} else {
  console.log("OK unrelated meta save with empty local must keep server shift hours");
}
const newerLocal = {
  a_1: { start: "22:00", end: "06:00", updatedAt: "2026-09-19T08:00:00.000Z" }
};
const mergedNewer = mergeAgentShiftHoursMaps(serverHours, newerLocal);
if (!(mergedNewer.a_1 && mergedNewer.a_1.start === "22:00" && mergedNewer.a_1.end === "06:00")) {
  console.error("FAIL newer local shift hours win recency merge");
  failed += 1;
} else {
  console.log("OK newer local shift hours win recency merge");
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

const enterStart = app.indexOf("const enterFromFaceSession = async");
const enterEnd = app.indexOf("try { window.__GI_FACE_ENTER__", enterStart);
const enterFn = (enterStart >= 0 && enterEnd > enterStart) ? app.slice(enterStart, enterEnd) : "";
if (!enterFn.includes("return await completeAgentLogin(agent, { loginDetailText: safeTrim(detail), skipMfa: true })")) {
  console.error("FAIL face enter goes through completeAgentLogin");
  failed += 1;
} else {
  console.log("OK face enter goes through completeAgentLogin");
}
if (enterFn.includes("Auth.unlock()") || enterFn.includes("lcAuthLock")) {
  console.error("FAIL face enter must not unlock before shift gate");
  failed += 1;
} else {
  console.log("OK face enter must not unlock before shift gate");
}

function buildAgentShiftBlockedCopy(options = {}){
  const start = String(options.start || "").trim();
  const message = String(options.message || "").trim();
  let startLabel = start;
  if(!startLabel){
    const m = /(?:השעה\s*:?\s*)(\d{1,2}:\d{2})/.exec(message);
    startLabel = m ? m[1] : "";
  }
  return {
    kicker: "כניסה למערכת",
    title: "אינך במשמרת",
    text: startLabel
      ? "לא ניתן להתחבר למערכת כרגע. תוכל/י להיכנס למערכת החל מהשעה"
      : (message || "לא ניתן להתחבר למערכת אינך במשמרת."),
    startLabel,
    ackText: "הבנתי"
  };
}
const copyFromStart = buildAgentShiftBlockedCopy({ start: "07:40" });
if (!(copyFromStart.title === "אינך במשמרת" && copyFromStart.startLabel === "07:40" && copyFromStart.ackText === "הבנתי")) {
  console.error("FAIL shift modal copy uses a large title and highlighted hour");
  failed += 1;
} else {
  console.log("OK shift modal copy uses a large title and highlighted hour");
}
const copyFromMessage = buildAgentShiftBlockedCopy({
  message: "לא ניתן להתחבר למערכת אינך במשמרת. תוכל/י היכנס למערכת החל מהשעה : 22:00"
});
if (copyFromMessage.startLabel !== "22:00") {
  console.error("FAIL shift modal parses start hour from the login message");
  failed += 1;
} else {
  console.log("OK shift modal parses start hour from the login message");
}

const pinShiftSnippet = app.slice(app.indexOf("if(matched.active === false) return this._setError('המשתמש מושבת')"), app.indexOf("readAgentPinOnlyFromServer"));
if (pinShiftSnippet.includes("_setError(shiftBlock.message)")) {
  console.error("FAIL PIN off-shift path must not write under התחבר");
  failed += 1;
} else {
  console.log("OK PIN off-shift path must not write under התחבר");
}
const completeShiftSnippet = app.slice(app.indexOf("const completeAgentLogin = async (matched, options = {}) => {"), app.indexOf("if(options.skipMfa === true)"));
if (completeShiftSnippet.includes("_setError(shiftBlock.message)")) {
  console.error("FAIL completeAgentLogin off-shift path must not write under התחבר");
  failed += 1;
} else {
  console.log("OK completeAgentLogin off-shift path must not write under התחבר");
}

if (failed) process.exit(1);
console.log("OK agent shift + fullscreen checks passed");
