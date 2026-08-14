/* GI-FACE 2026-08-14 — optional face login.
   Additive only: PIN / MFA / completeAgentLogin / AttendanceClock stay the same path.
   הרצה: node _test-face-login.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
let failed = 0;
let passed = 0;

function assert(cond, msg){
  if(cond){
    passed += 1;
    console.log("  PASS  " + msg);
  } else {
    failed += 1;
    console.error("  FAIL  " + msg);
  }
}

console.log("1) syntax + files");
const appFile = path.join(ROOT, "app.js");
const faceJsFile = path.join(ROOT, "gi-face-auth.js");
const faceHtmlFile = path.join(ROOT, "face-auth.html");
const edgeFile = path.join(ROOT, "supabase", "functions", "gi-face-auth", "index.ts");

const syntaxApp = spawnSync(process.execPath, ["--check", appFile], { encoding: "utf8" });
assert(syntaxApp.status === 0, "node --check app.js");
if(syntaxApp.status !== 0) console.error(syntaxApp.stderr || syntaxApp.stdout);

const syntaxFace = spawnSync(process.execPath, ["--check", faceJsFile], { encoding: "utf8" });
assert(syntaxFace.status === 0, "node --check gi-face-auth.js");
if(syntaxFace.status !== 0) console.error(syntaxFace.stderr || syntaxFace.stdout);

const app = fs.readFileSync(appFile, "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const faceJs = fs.readFileSync(faceJsFile, "utf8");
const faceHtml = fs.readFileSync(faceHtmlFile, "utf8");
const edge = fs.readFileSync(edgeFile, "utf8");
const css = fs.readFileSync(path.join(ROOT, "app.css"), "utf8");

assert(fs.existsSync(faceHtmlFile), "face-auth.html exists");
assert(html.includes("gi-face-auth.js?v=20260814-face-login-v4"), "index.html loads gi-face-auth.js");
assert(html.includes("app.js?v=20260814-face-login-v4"), "index.html bumps app.js cache");
assert(html.includes("app.css?v=20260814-face-login-v2"), "index.html bumps app.css cache");
assert(html.includes('id="btnFaceLogin"'), "login has face button");
assert(html.includes("היכנס באמצעות זיהוי פנים"), "face login label is Hebrew");
assert(html.includes('id="btnFaceEnroll"'), "user menu has face enroll");
assert(html.includes('id="giFaceEnrollModal"'), "enroll modal exists");
assert(html.indexOf('id="btnFaceEnroll"') < html.indexOf('id="btnLogout"'), "face enroll sits above logout");
assert(html.indexOf('id="btnFaceLogin"') < html.indexOf('id="lcLoginUser"'), "face button sits above username");
assert(html.indexOf('id="lcAttendanceClock"') < html.indexOf('id="btnFaceEnroll"'), "attendance clock still above the new menu item");

console.log("\n2) PIN / MFA / attendance contracts unchanged");
const submit = app.slice(app.indexOf("Auth._submit = async function(){"), app.indexOf("await completeAgentLogin(matched);\n        return;"));
assert(submit.includes("if(!username) return this._setError('נא להזין שם משתמש')"), "PIN submit still requires username");
assert(submit.includes("if(!pin) return this._setError('נא להזין קוד כניסה')"), "PIN submit still requires PIN");
assert(submit.includes("findAgentForLogin(username, agents)"), "PIN submit still resolves the agent");
assert(submit.includes("readAgentPinOnlyFromServer"), "pin-only server guard remains");
assert(submit.includes("SupabaseMFA.signInWithPassword"), "MFA password step remains in _submit");
assert(app.includes("this._showMfaStep(matched, flow.factorId"), "MFA step still opens from _submit");
assert(/await completeAgentLogin\(matched\);\s*return;/.test(app), "pin-only still calls completeAgentLogin without face options");
assert(/await completeAgentLogin\(matched\);\s*\} finally \{/.test(app), "non-MFA PIN still calls completeAgentLogin without face options");
assert(app.includes("await completeAgentLogin(pending.agent, { loaderMs: 500 })"), "MFA success still uses completeAgentLogin");
assert(app.includes("try { void AttendanceClock.onAuthenticated(); } catch(_e) {}"), "completeAgentLogin still starts attendance");
assert(app.includes("on(this.els.btnLogout, \"click\", () => Auth.logout())"), "logout binding unchanged");
assert(app.includes("btnIn: document.getElementById(\"btnAttendanceClockIn\")"), "attendance clock-in binding unchanged");
assert(app.includes("btnOut: document.getElementById(\"btnAttendanceClockOut\")"), "attendance clock-out binding unchanged");
assert(!app.includes("navigator.geolocation"), "app.js does not request GPS");
assert(!app.includes("getCurrentPosition"), "app.js has no geolocation calls");

console.log("\n3) additive face path");
assert(app.includes("window.__GI_FACE_BRIDGE__"), "app.js exposes a face bridge");
assert(app.includes("getCurrentAgentRecord"), "enroll resolves the session agent record, not only Auth.current.id");
assert(app.includes("getCurrentAgent(){"), "face bridge exposes getCurrentAgent");
assert(app.includes("loginDetailText: safeTrim(options.loginDetailText)"), "completeAgentLogin forwards optional loginDetailText");
assert(app.includes("async log(eventType, agentCtx, options)"), "activity log accepts optional detail");
assert(app.includes("detailText: safeTrim(ctx.loginDetailText)"), "login pipeline can store face detail_text");
assert(app.includes('login_face_fail: "ניסיון זיהוי פנים נכשל"'), "failed face attempts have a session label");
assert(app.includes('if(t === "login_face_fail") return "נדחה"'), "failed face attempts show rejected status");
assert(app.includes("type === \"login\" || type === \"login_face_fail\""), "session table shows detail only on login rows");
assert(css.includes(".giActLogTable__actionSub"), "session table has a subtitle style for login detail");
assert(faceJs.includes("FALLBACK_SUPABASE_URL"), "enroll works even if app.js bridge is missing");
assert(faceJs.includes("agentFromPill"), "enroll can read the logged-in name from the user pill");
assert(faceJs.includes("agent-admin-1"), "admin enroll falls back to the owner agent card");
assert(faceJs.includes("api.qrserver.com"), "QR is drawn as an image without waiting for a CDN library");
assert(faceJs.includes("kind: \"login\""), "desktop can open a login QR session");
assert(faceJs.includes("resolveAgentForEnroll"), "enroll looks up the agent even without Auth.current.id");
assert(faceJs.includes("fetchActiveAgents"), "enroll can load agents from Supabase if the local list is empty");
assert(edge.includes("resolveEnrollAgent"), "edge resolves enroll agent by id, name, or username");
assert(edge.includes("clientAgentFallback"), "edge can enroll from the desktop agent id if agents SELECT is denied");
assert(faceJs.includes("ROTATE_MS = 30000"), "QR rotates about every 30 seconds");
assert(faceJs.includes("completeAgentLogin(agent, { loginDetailText: detail })"), "approved face login reuses completeAgentLogin");
assert(faceHtml.includes("אישור וסיום"), "phone enroll has confirm button");
assert(faceHtml.includes("descriptors"), "phone sends descriptors, not a photo upload");
assert(!faceHtml.includes("multipart/form-data"), "phone page does not upload image files");
assert(edge.includes('verify') || edge.includes("desktop_secret") && edge.includes("public_token"), "edge authenticates by session tokens");
assert(edge.includes("verify_jwt") === false, "edge source does not enable JWT; tokens are custom");
assert(edge.includes("gi_face_templates"), "edge stores templates");
assert(edge.includes("descriptors"), "edge compares descriptors");
assert(!/photo|image_url|face_image/i.test(edge), "edge does not store photos");
assert(edge.includes("MATCH_THRESHOLD = 0.5"), "login match uses an in-house distance threshold");
assert(edge.includes('event_type: "login_face_fail"'), "edge logs failed face logins");
assert(edge.includes("geo_text"), "edge keeps location on the session for the login log");

console.log("\n4) matching helpers");
const sandbox = {
  window: {
    location: { href: "https://example.com/gemel-invest/" },
    addEventListener(){},
    setInterval(){ return 0; },
    clearInterval(){},
    QRCode: null,
    __GI_FACE_BRIDGE__: {}
  },
  document: {
    readyState: "complete",
    getElementById(){ return null; },
    querySelector(){ return null; },
    addEventListener(){},
    createElement(){ return { addEventListener(){} }; },
    head: { appendChild(){} }
  },
  setTimeout(){ return 0; },
  setInterval(){ return 0; },
  clearTimeout(){},
  clearInterval(){},
  Math,
  Number,
  String,
  Array,
  Promise,
  URL,
  encodeURIComponent,
  console
};
sandbox.window.window = sandbox.window;
sandbox.document.document = sandbox.document;
vm.runInNewContext(faceJs, sandbox);
const api = sandbox.window.GiFaceAuth;
assert(!!api, "GiFaceAuth is exported");
assert(Math.abs(api.euclidean([0, 0], [3, 4]) - 5) < 1e-9, "euclidean distance is 5 for 3-4-5");
assert(api.buildDetailText("iPhone", "תל אביב") === "זיהוי פנים · iPhone · תל אביב", "login detail text joins face + device + city");
assert(api.buildDetailText("", "") === "זיהוי פנים · טלפון · מיקום כבוי", "missing GPS still logs a login detail");
assert(api.deviceLabelFromUa("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)") === "iPhone", "iPhone UA maps to iPhone");
assert(String(api.phonePageUrl("abc123")).includes("face-auth.html"), "QR URL points at face-auth.html");
assert(String(api.phonePageUrl("abc123")).includes("t=abc123"), "QR URL carries the public token");

console.log("\n5) GPS stays off dashboard / attendance");
const dashSlice = app.includes("const DashboardUI") ? app.slice(app.indexOf("const DashboardUI"), app.indexOf("const DashboardUI") + 8000) : "";
assert(!/geolocation|getCurrentPosition/.test(dashSlice), "dashboard code has no geolocation");
assert(!app.slice(app.indexOf("const AttendanceClock"), app.indexOf("const AttendanceClock") + 12000).includes("geolocation"), "attendance has no geolocation");
assert(faceHtml.includes("navigator.geolocation"), "only the phone page may ask for GPS");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + "/" + (passed + failed));
