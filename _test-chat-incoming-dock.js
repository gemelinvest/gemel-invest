/* GI-CHAT 20260909-session-keep-v1 — הודעת צ׳אט נכנסת בצד שמאל למטה,
   נשארת פתוחה עם שם השולח ולחצן «השב». Realtime עם recipient_id=eq ולא or=.
   הרצה: node _test-chat-incoming-dock.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260909-session-keep-v1";
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

const app = read("app.js");
const html = read("index.html");
const css = read("app.css");
const theme = read("theme.css");
const sw = read("service-worker.js");

function sliceMethodBlock(src, startNeedle, endNeedle){
  const start = src.indexOf(startNeedle);
  const end = src.indexOf(endNeedle, start);
  if(start < 0 || end < start) return "";
  return src.slice(start, end);
}

function makeEl(tag){
  const el = {
    tagName: String(tag || "div").toUpperCase(),
    className: "",
    children: [],
    attrs: {},
    dataset: {},
    style: {},
    parent: null,
    value: "",
    disabled: false,
    isConnected: true,
    _html: "",
    _listeners: {},
    _focused: false,
    textContent: "",
    setAttribute(k, v){
      const val = String(v ?? "");
      this.attrs[k] = val;
      if(k === "class") this.className = val;
      if(k.startsWith("data-")){
        const ds = k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        this.dataset[ds] = val;
      }
    },
    getAttribute(k){
      if(k === "class") return this.className || null;
      return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null;
    },
    appendChild(child){
      child.parent = this;
      child.isConnected = true;
      this.children.push(child);
      return child;
    },
    remove(){
      if(this.parent) this.parent.children = this.parent.children.filter((c) => c !== this);
      this.parent = null;
      this.isConnected = false;
    },
    contains(node){
      if(node === this) return true;
      return this.children.some((c) => typeof c.contains === "function" && c.contains(node));
    },
    closest(sel){
      let n = this;
      while(n){
        if(matchSel(n, sel)) return n;
        n = n.parent;
      }
      return null;
    },
    querySelector(sel){
      const all = [];
      walk(this, all);
      return all.find((n) => n !== this && matchSel(n, sel)) || null;
    },
    addEventListener(type, fn){
      (this._listeners[type] || (this._listeners[type] = [])).push(fn);
    },
    dispatchEvent(ev){
      const fns = this._listeners[ev.type] || [];
      fns.forEach((fn) => fn(ev));
    },
    focus(){ this._focused = true; },
    setSelectionRange(){}
  };
  Object.defineProperty(el, "innerHTML", {
    get(){ return this._html; },
    set(html){
      this._html = String(html ?? "");
      this.children = hydrate(this._html, this);
    }
  });
  el.classList = {
    contains(name){ return (" " + el.className + " ").includes(" " + name + " "); },
    add(name){
      if(!el.classList.contains(name)) el.className = (el.className + " " + name).trim();
    },
    remove(name){
      el.className = el.className.split(/\s+/).filter((x) => x && x !== name).join(" ");
    }
  };
  return el;
}

function walk(node, out){
  out.push(node);
  (node.children || []).forEach((c) => walk(c, out));
}

function matchSel(node, sel){
  if(!node || !sel) return false;
  if(sel.startsWith(".")) return (" " + (node.className || "") + " ").includes(" " + sel.slice(1) + " ");
  if(sel.startsWith("[") && sel.endsWith("]")){
    const body = sel.slice(1, -1);
    const eq = body.indexOf("=");
    if(eq < 0) return node.getAttribute(body) != null;
    const key = body.slice(0, eq);
    const raw = body.slice(eq + 1).replace(/^["']|["']$/g, "");
    return String(node.getAttribute(key) || "") === raw;
  }
  return String(node.tagName || "").toLowerCase() === sel.toLowerCase();
}

function hydrate(html, parent){
  const kids = [];
  const re = /<([a-zA-Z0-9]+)([^>]*)>/g;
  let m;
  while((m = re.exec(html))){
    const child = makeEl(m[1]);
    child.parent = parent;
    const attrRe = /([:@A-Za-z0-9_-]+)=(?:"([^"]*)"|'([^']*)')/g;
    let a;
    while((a = attrRe.exec(m[2] || ""))){
      child.setAttribute(a[1], a[2] != null ? a[2] : a[3]);
    }
    const classMatch = /(?:^|\s)class=(?:"([^"]*)"|'([^']*)')/.exec(m[2] || "");
    if(classMatch) child.className = classMatch[1] || classMatch[2] || "";
    kids.push(child);
  }
  return kids;
}

function click(el, host){
  const ev = {
    type: "click",
    target: el,
    preventDefault(){ ev.prevented = true; }
  };
  host.dispatchEvent(ev);
}

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-chat-incoming-dock.js")]).status === 0, "node --check this test");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + APP_TAG), "index.html app.css cache");
assert(html.includes("theme.css?v=" + APP_TAG), "index.html theme.css cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");
assert(app.includes('const BUILD = "' + APP_TAG + '"'), "app.js BUILD tag");

console.log("\n2) מקור — דוק במקום טוסט");
assert(html.includes('id="giChatDock"'), "HTML של הדוק בצד");
assert(html.includes('aria-label="הודעות צ׳אט נכנסות"'), "aria לדוק");
assert(!html.includes("giChatToasts"), "טוסט הישן הוסר מה-HTML");
assert(app.includes("dock: $(\"#giChatDock\")"), "ChatUI מצביע לדוק");
assert(!app.includes("pushToast("), "pushToast הוסר");
assert(!app.includes("giChatToast"), "מחלקת הטוסט הוסרה מ-app.js");
assert(app.includes("pushIncomingDock(message)"), "הודעה נכנסת פותחת דוק");
assert(app.includes('button class="giChatDockCard__reply"'), "לחצן השב בכרטיס");
assert(app.includes(">השב<"), "תווית לחצן השב");
assert(app.includes('button class="giChatDockCard__ignore"'), "לחצן התעלם בכרטיס");
assert(app.includes(">התעלם<"), "תווית לחצן התעלם");
assert(app.includes('data-chat-dock-dismiss="1">התעלם<'), "התעלם סוגר את ההודעה");
assert(app.includes("sendDockReply(fromId)"), "שליחת תשובה מהדוק");
assert(app.includes("async sendTextToPeer(toId, toName, text)"), "שליחה לנציג בלי לפתוח את חלון הצ׳אט");
assert(app.includes("const result = await this.sendTextToPeer(this.selectedUser.id, this.selectedUser.name, text)"), "חלון הצ׳אט משתמש באותה שליחה");
assert(app.includes("this.dismissDockCard(this.selectedUser.id)"), "פתיחת חלון הצ׳אט מורידה את הכרטיס של השיחה");
assert(app.includes("this.dismissDockCard(user.id)"), "בחירת נציג מורידה את כרטיס הדוק");
assert(app.includes("this.clearIncomingDock()"), "התנתקות מנקה את הדוק");
assert(!sliceMethodBlock(app, "pushIncomingDock(message){", "renderDockCard(card,").includes("setTimeout"), "הכרטיס לא נעלם לבד");

console.log("\n2b) Realtime — פילטר תקין + גיבוי polling");
const listenBlock = sliceMethodBlock(app, "listenMessages(){", "handleIncomingDbInsert(row){");
assert(!!listenBlock, "listenMessages נמצא");
assert(!listenBlock.includes("filter: `or="), "Realtime לא משתמש ב-or= של PostgREST");
assert(!listenBlock.includes("encodeURIComponent"), "לא מקודדים את מזהה המשתמש בפילטר Realtime");
assert(listenBlock.includes("filter: `recipient_id=eq.${userId}`"), "פילטר recipient_id=eq");
assert(listenBlock.includes("filter: `sender_id=eq.${userId}`"), "פילטר sender_id=eq");
assert(app.includes("startIncomingPoll(){"), "גיבוי polling קיים");
assert(app.includes("async pollIncomingMessages(){"), "שאילתת REST להודעות נכנסות");
assert(app.includes(".eq('recipient_id', this.userKey)"), "polling לפי נמען");
assert(app.includes("this.startIncomingPoll();"), "polling מופעל אחרי חיבור");
assert(app.includes("if(Auth.current) this.ensureStarted();"), "צ׳אט עולה מיד ב-init");
assert(app.includes("if(this._subscribedUserKey && this.userKey && this._subscribedUserKey !== this.userKey){"), "חיבור מחדש אם מזהה המשתמש משתנה");

console.log("\n3) עיצוב שקוף בצד שמאל");
assert(css.includes(".giChatDock{"), "בלוק CSS לדוק");
assert(css.includes("left:16px") && css.includes("bottom:22px"), "מיקום בצד שמאל למטה");
assert(!css.includes("top:76px"), "הדוק כבר לא למעלה");
assert(css.includes("background:rgba(255,255,255,.28)"), "רקע שקוף");
assert(css.includes("backdrop-filter:blur(16px)"), "זכוכית עדינה");
assert(css.includes(".giChatDockCard.is-replying .giChatDockCard__composer{ display:flex; }"), "השב פותח את תיבת התשובה");
assert(css.includes(".giChatDockCard__ignore{"), "עיצוב לחצן התעלם");
assert(css.includes(".giChatDockCard.is-replying .giChatDockCard__reply{ display:none; }"), "במצב השב נשאר התעלם");
assert(theme.includes(".giChatDockCard:not(#\\9):not(#\\9)"), "theme שומר על זכוכית");
assert(!theme.includes(".giChatToast:not(#\\9):not(#\\9)"), "theme כבר לא מעצב את הטוסט הישן");

const dockStart = app.indexOf("    notifyIncoming(message){");
const dockEnd = app.indexOf("    playNotifySound(){");
const dockBlock = dockStart > 0 && dockEnd > dockStart ? app.slice(dockStart, dockEnd) : "";
assert(!!dockBlock, "בלוק notify/dock נמצא");

console.log("\n3b) צליל הודעה בסגנון וואטסאפ");
const chatSound = sliceMethodBlock(app, "function playGiChatWhatsAppTone(){", "function playGiLeadChime(){");
assert(!!chatSound, "playGiChatWhatsAppTone נמצא");
assert(chatSound.includes("drip(t0, 1174.66"), "טיפה ראשונה של הצליל");
assert(chatSound.includes("drip(t0 + 0.09, 1567.98"), "טיפה שנייה בסגנון הודעת וואטסאפ");
assert(chatSound.includes("if(playGiChatWhatsAppTone()) return;"), "הצליל הראשי הוא סגנון וואטסאפ");
assert(!chatSound.includes("playGiNotifySound()"), "אין נפילה לצלצול מרימבה");

const helpersStart = app.indexOf("    escapeHtml(v){");
const helpersEnd = app.indexOf("    async cleanupExpiredData(){");
const helperBlock = helpersStart > 0 && helpersEnd > helpersStart ? app.slice(helpersStart, helpersEnd) : "";

console.log("\n4) runtime — כרטיס נשאר, השב פותח תשובה, שליחה לנציג");
function loadDock(){
  const dock = makeEl("div");
  dock.id = "giChatDock";
  const win = makeEl("section");
  win.classList.add("is-hidden");
  const sandbox = {
    Map,
    String,
    Number,
    Date,
    Error,
    console,
    document: { createElement: (tag) => makeEl(tag), hasFocus(){ return true; }, hidden: false },
    DesktopNotifications: { notify(title, opts){ sandbox._notes.push({ title, opts }); } },
    on(el, evt, fn){ el && el.addEventListener(evt, fn); },
    safeTrim(v){ return String(v ?? "").trim(); },
    playGiChatMessageSound(){ sandbox._sounds += 1; },
    _notes: [],
    _sounds: 0,
    _sent: []
  };
  vm.runInNewContext(
    `"use strict";
     const ChatDock = {
       ${dockBlock}
       ${helperBlock}
       conversationId(otherUserId){ return [this.userKey, otherUserId].sort().join("__"); },
       normalizeKey(v){
         return String(v || "").normalize("NFKD").replace(/[^\\w֐-׿-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "user";
       },
       avatarMarkup(user, className){ return '<div class="' + className + '">AV</div>'; },
       renderFabBadge(){ this._badge = true; },
       renderUsers(){ this._users = true; },
       playNotifySound(){ try { playGiChatMessageSound(); } catch(_e) {} },
       async sendTextToPeer(toId, toName, text){
         this._sent.push({ toId, toName, text });
         if(this._sendFail) return { ok:false, error: new Error("NOPE") };
         return { ok:true };
       },
       openWindow(){ this._opened = true; },
       async selectUser(id){ this._selected = id; }
     };
     this.ChatDock = ChatDock;`,
    sandbox,
    { filename: "chat-incoming-dock.js" }
  );
  const ui = sandbox.ChatDock;
  ui.els = { dock, window: win };
  ui.dockCards = new Map();
  ui.usersMap = new Map([["u-dana", { id: "u-dana", name: "דנה לוי" }]]);
  ui.unreadByConversation = new Map();
  ui.userKey = "u-me";
  ui.selectedUser = null;
  ui._sent = [];
  ui._sendFail = false;
  ui.bindIncomingDockEvents();
  return { ui, dock, win, sandbox };
}

const first = loadDock();
first.ui.notifyIncoming({
  id: "m1",
  fromId: "u-dana",
  fromName: "דנה לוי",
  text: "אפשר רגע על התיק?"
});
assert(first.dock.children.length === 1, "כרטיס אחד נוצר להודעה נכנסת");
const card = first.dock.children[0];
assert(card.classList.contains("giChatDockCard"), "מחלקת כרטיס דוק");
assert(String(card.innerHTML).includes("דנה לוי"), "שם השולח בכרטיס");
assert(String(card.innerHTML).includes("אפשר רגע על התיק?"), "תוכן ההודעה בכרטיס");
assert(String(card.innerHTML).includes(">השב<"), "לחצן השב מוצג");
assert(!card.classList.contains("is-replying"), "תיבת תשובה סגורה עד שלוחצים השב");
assert(first.ui.unreadByConversation.get("u-dana__u-me") === 1, "מונה לא-נקרא עודכן");
assert(first.sandbox._sounds === 1, "צלצול על הודעה נכנסת");

first.ui.notifyIncoming({
  id: "m2",
  fromId: "u-dana",
  fromName: "דנה לוי",
  text: "עדכון שני"
});
assert(first.dock.children.length === 1, "אותו נציג מעדכן כרטיס קיים ולא מוסיף עוד אחד");
assert(String(card.innerHTML).includes("עדכון שני"), "הכרטיס מציג את ההודעה האחרונה");

const replyBtn = card.querySelector("[data-chat-dock-reply]");
assert(!!replyBtn, "לחצן השב נמצא ב-DOM");
click(replyBtn, first.dock);
assert(card.classList.contains("is-replying"), "השב פותח את תיבת התשובה על הכרטיס");
const input = card.querySelector("[data-chat-dock-input]");
assert(!!input && input._focused === true, "הפוקוס עובר לשדה התשובה");

input.value = "קיבלתי, תודה";
first.ui.notifyIncoming({
  id: "m3",
  fromId: "u-dana",
  fromName: "דנה לוי",
  text: "עוד שורה"
});
assert(card.classList.contains("is-replying"), "כרטיס נשאר במצב השב אחרי הודעה נוספת");
assert(card.querySelector("[data-chat-dock-input]").value === "קיבלתי, תודה", "טיוטת התשובה נשמרת");

(async () => {
  await first.ui.sendDockReply("u-dana");
  assert(first.ui._sent.length === 1 && first.ui._sent[0].toId === "u-dana", "התשובה נשלחת לנציג ששלח");
  assert(first.ui._sent[0].text === "קיבלתי, תודה", "תוכן התשובה זהה למה שנכתב");
  assert(first.dock.children.length === 0, "אחרי שליחה הכרטיס יורד");

  const openChat = loadDock();
  openChat.win.className = "";
  openChat.ui.selectedUser = { id: "u-dana", name: "דנה לוי" };
  openChat.ui.notifyIncoming({
    id: "m4",
    fromId: "u-dana",
    fromName: "דנה לוי",
    text: "כבר בשיחה"
  });
  assert(openChat.dock.children.length === 0, "אין כרטיס כשהשיחה עם אותו נציג כבר פתוחה");

  const other = loadDock();
  other.win.className = "";
  other.ui.selectedUser = { id: "u-other", name: "אחר" };
  other.ui.notifyIncoming({
    id: "m5",
    fromId: "u-dana",
    fromName: "דנה לוי",
    text: "הודעה בזמן שיחה אחרת"
  });
  assert(other.dock.children.length === 1, "כרטיס כן מופיע כשמדברים עם נציג אחר");

  const failRun = loadDock();
  failRun.ui.pushIncomingDock({ fromId: "u-dana", fromName: "דנה לוי", text: "נא השב" });
  failRun.ui.openDockReply("u-dana");
  failRun.ui.dockCards.get("u-dana").querySelector("[data-chat-dock-input]").value = "טיוטה";
  failRun.ui._sendFail = true;
  await failRun.ui.sendDockReply("u-dana");
  assert(failRun.dock.children.length === 1, "כרטיס נשאר כשהשליחה נכשלה");
  assert(String(failRun.ui.dockCards.get("u-dana").querySelector("[data-chat-dock-error]").textContent || "").includes("NOPE")
    || failRun.ui.dockCards.get("u-dana").querySelector("[data-chat-dock-error]").textContent === "NOPE",
    "שגיאת שליחה מוצגת על הכרטיס");

  const dismissRun = loadDock();
  dismissRun.ui.pushIncomingDock({ fromId: "u-dana", fromName: "דנה לוי", text: "סגור אותי" });
  const ignoreBtn = dismissRun.dock.children[0].querySelector(".giChatDockCard__ignore");
  assert(!!ignoreBtn && String(ignoreBtn.getAttribute("data-chat-dock-dismiss")) === "1", "לחצן התעלם נמצא בכרטיס");
  click(ignoreBtn, dismissRun.dock);
  assert(dismissRun.dock.children.length === 0, "התעלם סוגר את ההודעה");

  console.log("\n5) runtime — INSERT נכנס מפעיל התראה פעם אחת");
  const listenSrc = sliceMethodBlock(app, "listenMessages(){", "handleIncomingDbInsert(row){");
  const handleSrc = sliceMethodBlock(app, "handleIncomingDbInsert(row){", "normalizeMessage(row){");
  const normSrc = sliceMethodBlock(app, "normalizeMessage(row){", "renderMessages(){");
  const liveSandbox = {
    Map,
    Set,
    String,
    Number,
    Date,
    console,
    SUPABASE_CHAT: { messagesTable: "invest_chat_messages" },
    safeTrim(v){ return String(v ?? "").trim(); },
    nowISO(){ return new Date().toISOString(); }
  };
  vm.runInNewContext(
    `"use strict";
     const ChatLive = {
       ${listenSrc}
       ${handleSrc}
       ${normSrc}
       conversationId(other){ return [this.userKey, other].sort().join("__"); },
       schedulePresenceUiRefresh(){ this._presence = true; },
       renderMessages(){ this._rendered = true; },
       resetUnreadForSelected(){},
       notifyIncoming(msg){ this._notified.push(msg); },
       setConnectionStatus(){}
     };
     this.ChatLive = ChatLive;`,
    liveSandbox,
    { filename: "chat-live-listen.js" }
  );
  const live = liveSandbox.ChatLive;
  const captured = [];
  const channel = {
    on(_evt, cfg, cb){ captured.push({ cfg, cb }); return channel; },
    subscribe(cb){ if(typeof cb === "function") cb("SUBSCRIBED"); return channel; }
  };
  live.client = { channel(name){ live._channelName = name; return channel; } };
  live.userKey = "u-me";
  live.currentConversationId = "";
  live.currentMessages = [];
  live.lastMessageByConversation = new Map();
  live.els = { window: { classList: { contains(){ return true; } } } };
  live._notified = [];
  live.listenMessages();
  assert(captured.length === 2, "שני מאזיני INSERT על הערוץ");
  assert(captured[0].cfg.filter === "recipient_id=eq.u-me", "מאזין ראשון לפי נמען");
  assert(captured[1].cfg.filter === "sender_id=eq.u-me", "מאזין שני לפי שולח");
  assert(captured.every((item) => !String(item.cfg.filter || "").includes("or=")), "אין or= בפילטרים בזמן ריצה");
  const future = new Date(Date.now() + 3600000).toISOString();
  const row = {
    id: "m-live-1",
    conversation_id: "u-dana__u-me",
    sender_id: "u-dana",
    sender_name: "דנה לוי",
    recipient_id: "u-me",
    recipient_name: "אני",
    body: "בדיקת לייב",
    created_at: new Date().toISOString(),
    expires_at: future
  };
  captured[0].cb({ new: row });
  assert(live._notified.length === 1 && live._notified[0].text === "בדיקת לייב", "INSERT לנמען מפעיל התראה");
  captured[0].cb({ new: row });
  assert(live._notified.length === 1, "אותו מזהה הודעה לא מתריע פעמיים");

  if(failed){
    console.error("\nFAILED " + failed + " / " + (passed + failed));
    process.exit(1);
  }
  console.log("\nOK " + passed + " checks");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
