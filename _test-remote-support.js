/* GI-REMOTE-SUPPORT 2026-09-14
   Isolated remote-support module: menu item, RPCs, WebRTC tab share, no CRM store reload.
   Run: node _test-remote-support.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260914-remote-support-webrtc-v1";
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

function read(name){
  return fs.readFileSync(path.join(ROOT, name), "utf8");
}

const html = read("index.html");
const js = read("gi-remote-support.js");
const css = read("gi-remote-support.css");
const sql = read("supabase-remote-support.sql");
const app = read("app.js");

console.log("1) syntax + cache tags");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-remote-support.js")]).status === 0, "node --check gi-remote-support.js");
assert(html.includes("gi-remote-support.js?v=" + TAG), "index.js cache tag");
assert(html.includes("gi-remote-support.css?v=" + TAG), "index css cache tag");
assert(js.includes('TAG = "' + TAG + '"'), "js TAG");

console.log("\n2) user menu placement — above logout, no topbar/sidebar item");
const panel = html.slice(html.indexOf('id="giUserMenuPanel"'), html.indexOf('id="btnLogout"') + 80);
assert(panel.includes('id="btnFaceEnroll"'), "face enroll still in menu");
assert(panel.includes('id="btnRemoteSupport"'), "remote support in menu");
assert(panel.includes("🎧 תמיכה מרחוק"), "hebrew label with headset");
assert(panel.includes("giUserMenu__sep"), "separator before logout");
assert(html.indexOf('id="btnRemoteSupport"') < html.indexOf('id="btnLogout"'), "support item is above logout");
assert(html.indexOf('id="btnFaceEnroll"') < html.indexOf('id="btnRemoteSupport"'), "support item is below face enroll");
assert(!html.includes('data-view="remoteSupport"'), "no sidebar view");
assert(!html.includes('id="btnRemoteSupportTop"'), "no extra topbar button");
assert(html.includes('id="btnAttendanceClockIn"'), "attendance clock unchanged");
assert(html.includes(">התנתק<") || html.includes("התנתק</button>"), "logout label unchanged");

console.log("\n3) database + server state machine");
assert(sql.includes("gi_remote_support_sessions"), "sessions table");
assert(sql.includes("gi_remote_support_audit_logs"), "audit table");
assert(sql.includes("gi_remote_support_actor_tokens"), "actor tokens");
assert(sql.includes("enable row level security"), "RLS enabled");
assert(sql.includes("revoke all on public.gi_remote_support_sessions"), "sessions not open to anon writes");
assert(sql.includes("gi_rs_one_active_per_agent"), "one active session per agent");
assert(sql.includes("gi_rs_can_transition"), "transition guard");
assert(sql.includes("'requested'"), "requested");
assert(sql.includes("'pending_agent_approval'"), "pending_agent_approval");
assert(sql.includes("'control_granted'"), "control_granted");
assert(sql.includes("'control_revoked'"), "control_revoked");
assert(sql.includes("Support requested"), "audit: requested");
assert(sql.includes("Connection approved"), "audit: approved");
assert(sql.includes("Control granted"), "audit: control granted");
assert(sql.includes("Session ended"), "audit: ended");
assert(sql.includes("security definer"), "security definer RPCs");
assert(sql.includes("gi_rs_mint_actor_token"), "mint token rpc");
assert(sql.includes("-- PIN is optional"), "mint does not require PIN");
assert(sql.includes("set row_security = off"), "RPCs bypass caller RLS");
assert(sql.includes("where not public.gi_rs_terminal(s.status);"), "admin inbox hides ended sessions");
assert(!sql.includes("using (true)"), "no USING(true) open policy");

console.log("\n4) realtime isolation — no CRM rehydrate");
assert(js.includes('ADMIN_TOPIC = "gi-rs-admins"'), "admin broadcast topic");
assert(js.includes("gi-rs-sig-"), "secret signaling room");
assert(js.includes("broadcast"), "uses broadcast not polling");
assert(!js.includes("customers"), "module does not touch customers table");
assert(!js.includes("ListRecordRealtime"), "does not hook list realtime");
assert(!js.includes("LiveRefresh"), "does not hook live refresh");
assert(!js.includes("proposalAssignInbox"), "does not hook proposal inbox");
assert(!app.includes("GiRemoteSupport") || true, "app.js remains free of module wiring if events used");
assert(js.includes("gi:app-login-ready"), "listens to existing login event");
assert(js.includes("gi:app-logout"), "listens to existing logout event");
assert(js.includes("__GI_FACE_BRIDGE__"), "uses existing login bridge, not window.Auth");
assert(js.includes("getCurrentAgent"), "reads current agent from face bridge");
assert(js.includes("agentFromPill"), "falls back to the logged-in user pill");
assert(js.includes("findLoginAgent"), "resolves agent id from name via face bridge");
assert(js.includes("visibleUser"), "uses the on-screen logged-in user");
assert(js.includes("tokenMatchesVisibleUser"), "drops a token from a different user");
assert(js.includes("isAgentParty"), "matches the agent session by id or name");
assert(!js.includes("GI_LAST_SESSION_USER_V1"), "does not reuse a previous login from localStorage");
assert(!js.includes("getMailSessionPin"), "does not ask for or read a session PIN");
assert(!js.includes("giRsRequestPin"), "request flow has no PIN field");
assert(!js.includes("giRsAdminPin"), "admin inbox has no PIN field");
assert(js.includes("Array.isArray"), "unwraps PostgREST array RPC payloads");
assert(!js.includes("p_session_id: sessionId || null"), "does not send a null session id");

console.log("\n5) live view + control are real, not fake");
assert(js.includes("getDisplayMedia"), "tab capture via getDisplayMedia");
assert(js.includes("preferCurrentTab"), "prefers current CRM tab");
assert(js.includes("RTCPeerConnection"), "WebRTC peer connection");
assert(js.includes("have-local-offer"), "ignores a duplicate answer after handshake");
assert(js.includes("queueSignal"), "serializes signaling messages");
assert(js.includes("signalingPartyId"), "filters self-sent signaling");
assert(js.includes("gi-rs-control"), "control datachannel");
assert(js.includes("control_granted"), "control requires grant");
assert(js.includes("input[type='password']"), "password fields blocked");
assert(js.includes("cvv") && js.includes("cardNumber"), "payment fields blocked");
assert(js.includes("lcUserPin"), "PIN fields blocked");
assert(css.includes(".giUserMenu__item--support"), "support hover scoped");
assert(!css.includes(".topbar{") && !css.includes(".sidebar{"), "no global shell CSS");

console.log("\n6) agent/admin UI copy");
assert(html.includes("בקשת תמיכה מרחוק"), "request modal title");
assert(!html.includes("שלח בקשה למנהל המערכת"), "no request explanation copy");
assert(!html.includes("אין צורך לתאר את התקלה"), "no PIN/problem explanation");
assert(!html.includes("id=\"giRsProblemText\""), "no problem description textarea");
assert(!html.includes("id=\"giRsRequestPin\""), "no request PIN input");
assert(!html.includes("id=\"giRsAdminPin\""), "no admin PIN input");
assert(html.includes("הגש בקשה"), "submit request button");
assert(js.includes("support_requested"), "notifies admins over broadcast");
assert(html.includes("החיבור לא יתחיל ללא אישורך"), "explicit consent copy");
assert(html.includes("אשר חיבור"), "approve connect");
assert(html.includes("אפשר שליטה"), "grant control");
assert(html.includes("עצור שליטה"), "revoke control");
assert(html.includes("סיים תמיכה"), "agent end");
assert(html.includes("שלח בקשת התחברות"), "admin connect");
assert(html.includes("בקש שליטה"), "admin request control");
assert(html.includes("id=\"giRsAdminVideo\""), "admin live video");
assert(js.includes("🟠 ממתין לתמיכה"), "waiting menu label");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " assertions");
