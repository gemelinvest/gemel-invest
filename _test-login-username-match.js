/**
 * Login username matching: empty roster, bidi marks, unique first name.
 * Run: node _test-login-username-match.js
 */
const fs = require("fs");
const path = require("path");
const app = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");

function assert(cond, msg){
  if(!cond) throw new Error(msg);
}

const loginFn = app.slice(
  app.indexOf("function findAgentForLogin(username, agents = []){"),
  app.indexOf("/* GI-SEC R9-pre-B — אימות PIN בשרת בלבד.")
);
assert(loginFn.includes("רשימת המשתמשים לא נטענה"), "empty roster must not say username-not-found");
assert(loginFn.includes("normalizeAgentLabelToken(label)"), "login must strip bidi / punctuation");
assert(loginFn.includes("agentLabelTokensPrefix"), "unique first name must match as a prefix");

assert(
  app.includes('if(tableName === SUPABASE_TABLES.agents && (!safeTrim(selectExpr) || selectExpr === "*"))'),
  "agents select=* must fall back to public columns"
);
assert(
  app.includes("this._loginReady = Array.isArray(State.data.agents) && State.data.agents.length > 0;"),
  "bootstrap must not mark login ready with an empty roster"
);
assert(
  app.includes("if(!loginMatch.agent){"),
  "submit must reload the roster once when the typed name is missing"
);
assert(
  app.includes("serverRestoredMfa"),
  "stale local pinOnly must not overwrite a newer server 2FA restore"
);

function normalizeAgentLabelToken(value){
  return String(value ?? "")
    .trim()
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, "")
    .toLowerCase()
    .replace(/["'`׳״.,;:!?()[\]{}<>|\\/+\-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function agentLabelTokens(value){
  return normalizeAgentLabelToken(value).split(/\s+/).filter(Boolean);
}
function agentLabelTokensPrefix(allTokens, partTokens){
  if(!partTokens.length || partTokens.length > allTokens.length) return false;
  return partTokens.every((token, i) => allTokens[i] === token);
}

function findAgentForLogin(username, agents = []){
  const label = String(username ?? "").trim();
  if(!label) return { agent:null, error:"נא להזין שם משתמש" };
  const active = (Array.isArray(agents) ? agents : []).filter((a) => a?.active !== false);
  if(!active.length) return { agent:null, error:"רשימת המשתמשים לא נטענה. רענן את הדף ונסה שוב." };
  const normLabel = normalizeAgentLabelToken(label);
  const fieldMatches = (agent, field) => {
    const raw = String(agent?.[field] ?? "").trim();
    if(!raw) return false;
    if(raw === label) return true;
    return normalizeAgentLabelToken(raw) === normLabel;
  };
  const byUsername = active.filter((a) => fieldMatches(a, "username"));
  if(byUsername.length === 1) return { agent: byUsername[0], error:"" };
  const byName = active.filter((a) => fieldMatches(a, "name"));
  if(byName.length === 1) return { agent: byName[0], error:"" };
  if(byUsername.length > 1 || byName.length > 1){
    return { agent:null, error:"שם המשתמש לא חד-משמעי. פנה למנהל המערכת." };
  }
  const labelTokens = agentLabelTokens(label);
  const prefixHits = active.filter((a) => {
    return agentLabelTokensPrefix(agentLabelTokens(a?.name), labelTokens)
      || agentLabelTokensPrefix(agentLabelTokens(a?.username), labelTokens);
  });
  if(prefixHits.length === 1) return { agent: prefixHits[0], error:"" };
  if(prefixHits.length > 1){
    return { agent:null, error:"יש כמה נציגים עם השם הזה. היכנס עם שם המשתמש המלא, למשל: " + prefixHits.map((a) => a.username || a.name).join(" / ") };
  }
  return { agent:null, error:"שם משתמש לא נמצא" };
}

const roster = [
  { name: "עומר שמולביץ", username: "עומר שמולביץ", active: true },
  { name: "דנה זנגי", username: "דנה זנגי", active: true },
  { name: "אילן איילין", username: "אילן", active: true },
  { name: "חן מזרחי", username: "חן מזרחי", active: true },
  { name: "חן אודיה מינץ", username: "חן מינץ", active: true },
  { name: "חן סיבוני", username: "חן סיבוני", active: true }
];

assert(findAgentForLogin("עומר", roster).agent?.username === "עומר שמולביץ", "unique first name must log in");
assert(findAgentForLogin("דנה", roster).agent?.username === "דנה זנגי", "unique first name דנה must log in");
assert(findAgentForLogin("אילן", roster).agent?.username === "אילן", "exact username still wins");
assert(findAgentForLogin("\u200fאילן\u200f", roster).agent?.username === "אילן", "bidi marks must not hide the user");
assert(findAgentForLogin("חן", roster).agent == null, "ambiguous first name must not pick one person");
assert(/יש כמה נציגים/.test(findAgentForLogin("חן", roster).error || ""), "ambiguous first name must ask for the full username");
assert(findAgentForLogin("אין כזה", roster).error === "שם משתמש לא נמצא", "unknown name stays not-found");
assert(/לא נטענה/.test(findAgentForLogin("עומר", []).error || ""), "empty roster must say the list was not loaded");

console.log("OK _test-login-username-match.js");
