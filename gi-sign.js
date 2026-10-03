/* GEMEL INVEST — שליחה לחתימה מתוך מסמכי לקוח, והודעת טוסט לנציג השולח. */
(function installGiSign(global){
  "use strict";

  const FN_PATH = "/functions/v1/gi-sign";
  const FALLBACK_SUPABASE_URL = "https://vhvlkerectggovfihjgm.supabase.co";
  const FALLBACK_PUBLISHABLE_KEY = "sb_publishable_JixJJelGPWcP0BPKGq96Lw_nIiMyIBb";
  const CHANNEL = "gi-sign-toast";

  const state = { channel: null, joined: false, synced: Object.create(null), lastToast: "", previewUrls: Object.create(null) };

  function trim(v){
    return String(v == null ? "" : v).trim();
  }
  function engine(){
    return global.GiSignEngine || null;
  }
  function esc(v){
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function auth(){
    try { return global.Auth || null; } catch(_e) { return null; }
  }
  function fileUi(){
    return global.CustomersUI || global.__GI_CustomersUI || null;
  }
  function canSend(){
    try {
      const ui = fileUi();
      if(ui && typeof ui.canSendCancelSign === "function" && ui.canSendCancelSign()) return true;
    } catch(_e) {}
    const api = auth();
    try { if(api && api.isAdmin()) return true; } catch(_e) {}
    try { if(api && api.isManager()) return true; } catch(_e) {}
    try {
      const role = api && api.current ? api.current.role : "";
      if(engine() && engine().canSendRole(role)) return true;
    } catch(_e) {}
    return false;
  }
  function connection(){
    try {
      const bridge = global.__GI_FACE_BRIDGE__;
      if(bridge && trim(bridge.supabaseUrl) && trim(bridge.publishableKey)){
        return { url: trim(bridge.supabaseUrl), key: trim(bridge.publishableKey) };
      }
    } catch(_e) {}
    return { url: FALLBACK_SUPABASE_URL, key: FALLBACK_PUBLISHABLE_KEY };
  }
  function bytesToBase64(bytes){
    const list = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
    let bin = "";
    const chunk = 0x2000;
    for(let i = 0; i < list.length; i += chunk){
      bin += String.fromCharCode.apply(null, list.subarray(i, i + chunk));
    }
    return btoa(bin);
  }
  function base64ToBytes(raw){
    const clean = String(raw || "").replace(/^data:[^,]*,/, "").replace(/\s/g, "");
    const bin = atob(clean);
    const out = new Uint8Array(bin.length);
    for(let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  async function callEdge(payload){
    const cfg = connection();
    const res = await fetch(cfg.url.replace(/\/+$/, "") + FN_PATH, {
      method: "POST",
      cache: "no-store",
      headers: {
        apikey: cfg.key,
        Authorization: "Bearer " + cfg.key,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload || {})
    });
    let data = {};
    try { data = await res.json(); } catch(_e) { data = {}; }
    if(!res.ok || data.ok === false){
      const code = trim(data.error) || ("HTTP_" + res.status);
      const err = new Error(code);
      err.code = code;
      throw err;
    }
    return data;
  }
  function entryOf(rec, doc){
    const id = trim(doc && doc.id);
    const map = rec && rec.payload && rec.payload.giSignByDoc;
    if(!id || !map || typeof map !== "object") return null;
    return map[id] && typeof map[id] === "object" ? map[id] : null;
  }
  function statusLabel(rec, doc){
    const api = engine();
    const entry = entryOf(rec, doc);
    if(!api || !entry) return "";
    return api.statusLabel(api.deriveStatus(entry.links));
  }
  function currentAgent(){
    const api = auth();
    const current = api && api.current ? api.current : null;
    let row = null;
    try {
      const bridge = global.__GI_FACE_BRIDGE__;
      if(bridge && typeof bridge.getCurrentAgent === "function") row = bridge.getCurrentAgent();
    } catch(_e) {}
    let pin = trim(api && api._sessionPin);
    if(!pin){
      try {
        const bridge = global.__GI_FACE_BRIDGE__;
        if(bridge && typeof bridge.getMailSessionPin === "function") pin = trim(bridge.getMailSessionPin());
      } catch(_e2) {}
    }
    const who = row && typeof row === "object" ? row : null;
    return {
      id: trim((who && who.id) || (current && current.id)),
      name: trim((who && who.name) || (current && current.name)),
      username: trim((who && who.username) || (current && current.username) || (who && who.name) || (current && current.name)),
      pin: pin
    };
  }
  function customerName(rec){
    return trim(rec && (rec.fullName || rec.name)) || "הלקוח";
  }
  function docName(rec, doc){
    try {
      if(global.CustomerDocuments && typeof global.CustomerDocuments.getDocumentDisplay === "function"){
        return trim(global.CustomerDocuments.getDocumentDisplay(doc).title);
      }
    } catch(_e) {}
    return trim(doc && doc.name) || "טופס ביטול";
  }
  function toast(title, text, variant){
    try {
      global.showToast?.({ title, text, variant: variant || "warn", durationMs: 5200 });
    } catch(_e) {}
  }
  function playSound(){
    try {
      const Ctx = global.AudioContext || global.webkitAudioContext;
      if(!Ctx) return;
      if(!playSound._ctx) playSound._ctx = new Ctx();
      const ctx = playSound._ctx;
      if(ctx.state === "suspended"){ try { void ctx.resume(); } catch(_e) {} }
      const t0 = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, t0);
      master.gain.exponentialRampToValueAtTime(0.55, t0 + 0.01);
      master.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
      master.connect(ctx.destination);
      const tone = (when, freq, dur) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, when);
        g.gain.setValueAtTime(0.0001, when);
        g.gain.exponentialRampToValueAtTime(1, when + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
        osc.connect(g);
        g.connect(master);
        osc.start(when);
        osc.stop(when + dur + 0.02);
      };
      tone(t0, 1244.51, 0.09);
      tone(t0 + 0.07, 1864.66, 0.12);
    } catch(_e) {}
  }
  function customersViewOpen(){
    try { return document.body.classList.contains("view-customers-active"); } catch(_e) { return false; }
  }
  function openCustomerDocuments(customerId){
    const id = trim(customerId);
    if(!id) return;
    const rec = global.CustomersUI?.byId?.(id);
    if(rec) dropInlineSignPdfs(rec);
    const open = () => {
      try { global.CustomersUI?.openById?.(id, { section: "documents", skipDocPreview: true }); } catch(_e2) {}
    };
    if(customersViewOpen()){
      open();
      return;
    }
    try { global.UI?.goView?.("customers", { skipCustomersRender: true }); } catch(_e) {}
    global.setTimeout(open, 80);
  }
  function showSignedToast(payload){
    const api = engine();
    const me = currentAgent();
    const senderId = trim(payload && payload.senderId);
    if(senderId && me.id && senderId !== me.id) return;
    const customerId = trim(payload && payload.customerId);
    const name = trim(payload && payload.customerName) || "הלקוח";
    const key = customerId + "|" + trim(payload && payload.token);
    if(key && key === state.lastToast) return;
    state.lastToast = key;
    const host = document.getElementById("giSignToastHost");
    if(!host || !api) return;
    host.innerHTML = `<div class="giSignToast" role="status">
      <div class="giSignToast__body"><div class="giSignToast__text">${esc(api.toastText(name))}</div></div>
      <button class="giSignToast__open" type="button">פתח</button>
    </div>`;
    const btn = host.querySelector("button");
    if(btn) btn.addEventListener("click", () => openCustomerDocuments(customerId));
    playSound();
    global.setTimeout(() => {
      if(state.lastToast === key && host) host.innerHTML = "";
    }, 12000);
  }
  function subscribe(){
    const client = global.gemelInvestSupabaseClient;
    if(!client || typeof client.channel !== "function") return;
    try { state.channel?.unsubscribe?.(); } catch(_e) {}
    state.joined = false;
    state.channel = client.channel(CHANNEL, { config: { broadcast: { self: false } } });
    state.channel.on("broadcast", { event: "signed" }, (ev) => {
      const payload = ev && ev.payload;
      noteSigned(payload);
      if(payload && payload.complete === true) showSignedToast(payload);
    });
    state.channel.subscribe((status) => {
      if(status === "SUBSCRIBED") state.joined = true;
    });
  }
  function dropInlineSignPdfs(rec){
    const map = rec && rec.payload && rec.payload.giSignByDoc;
    if(!map || typeof map !== "object") return;
    Object.keys(map).forEach((id) => {
      const file = map[id] && map[id].file;
      if(!file || typeof file !== "object") return;
      delete file.dataUrl;
      delete file._giBytes;
    });
  }
  function noteSigned(payload){
    const api = engine();
    const customerId = trim(payload && payload.customerId);
    const docId = trim(payload && payload.docId);
    const token = trim(payload && payload.token);
    const rec = global.CustomersUI?.byId?.(customerId);
    if(!api || !rec || !docId || !token) return;
    dropInlineSignPdfs(rec);
    const prev = entryOf(rec, { id: docId }) || { docId, links: [] };
    const next = api.recordSignature(prev, token, trim(payload && payload.signedAt));
    next.file = null;
    if(!rec.payload || typeof rec.payload !== "object") rec.payload = {};
    if(!rec.payload.giSignByDoc || typeof rec.payload.giSignByDoc !== "object") rec.payload.giSignByDoc = {};
    rec.payload.giSignByDoc[docId] = next;
  }
  function signedLink(entry){
    const links = Array.isArray(entry && entry.links) ? entry.links : [];
    const signed = links.filter((row) => trim(row && row.status) === "signed" && trim(row && row.token));
    return signed.length ? signed[signed.length - 1] : null;
  }
  async function signedPreviewUrl(rec, doc){
    const entry = entryOf(rec, doc);
    const link = signedLink(entry);
    const token = trim(link && link.token);
    if(!token) return "";
    if(state.previewUrls[token]) return state.previewUrls[token];
    const me = currentAgent();
    const data = await callEdge({
      action: "get",
      token,
      includePdf: true,
      idNumber: trim(link && link.idNumber),
      pin: me.pin,
      username: me.username,
      agentId: me.id,
      agentName: me.name
    });
    const pdf = trim(data && data.pdfBase64);
    if(!pdf || typeof URL === "undefined" || typeof Blob === "undefined") return "";
    const url = URL.createObjectURL(new Blob([base64ToBytes(pdf)], { type: "application/pdf" }));
    state.previewUrls[token] = url;
    return url;
  }
  function markSending(docId, on){
    if(typeof document === "undefined") return;
    document.querySelectorAll("[data-send-cancel-sign]").forEach((el) => {
      const id = trim(el.getAttribute("data-send-cancel-sign"));
      const inModal = !!(el.closest && el.closest(".giCancelFormModal"));
      if(id !== docId && !inModal) return;
      if(on){
        if(!el.getAttribute("data-sign-label")) el.setAttribute("data-sign-label", el.textContent || "שלח לחתימה");
        el.disabled = true;
        el.textContent = "שולח…";
      } else {
        el.disabled = false;
        const label = el.getAttribute("data-sign-label");
        if(label) el.textContent = label;
      }
    });
  }
  function customerSignHref(pageHref, token){
    const url = new URL(pageHref || "/", "https://example.com");
    const dir = url.pathname.replace(/[^/]*$/, "");
    return url.origin + dir + "s.html#" + trim(token);
  }
  function asShortHref(raw){
    const match = trim(raw).match(/https?:\/\/spoo\.me\/([A-Za-z0-9]{2,})/i);
    return match ? "https://spoo.me/" + match[1] : "";
  }
  async function shortenSignHref(href){
    const long = trim(href);
    if(!long) return "";
    const ac = typeof AbortController === "function" ? new AbortController() : null;
    const timer = setTimeout(() => { try { if(ac) ac.abort(); } catch(_e) {} }, 2000);
    try {
      const res = await fetch("https://spoo.me", {
        method: "POST",
        cache: "no-store",
        signal: ac ? ac.signal : undefined,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: "url=" + encodeURIComponent(long)
      });
      const data = await res.json();
      const short = asShortHref(data && data.short_url);
      if(res.ok && short) return short;
    } catch(_e) {}
    finally { clearTimeout(timer); }
    return "";
  }
  function closeDialog(){
    const modal = document.getElementById("giSignSendModal");
    if(modal && modal.parentNode) modal.parentNode.removeChild(modal);
  }
  function showLinks(customer, links){
    closeDialog();
    const modal = document.createElement("div");
    modal.id = "giSignSendModal";
    modal.className = "giValModal is-open giValModal--visible giSignSendModal";
    const rows = links.map((row) => `
      <div class="giSignLink">
        <div class="giSignLink__name">${esc(row.name)}</div>
        <div class="giSignLink__url">${esc(row.href)}</div>
        <button class="btn btn--primary btn--small" type="button" data-copy-sign-link="${esc(row.href)}">העתק</button>
      </div>`).join("");
    modal.innerHTML = `
      <div class="giValModal__backdrop" data-sign-close="1"></div>
      <div class="giValModal__card">
        <div class="giValModal__head">
          <div class="giValModal__headText">
            <div class="giValModal__title">לינקים לחתימה</div>
            <div class="giValModal__sub">${esc(customer)}</div>
          </div>
          <button class="giSignSend__x" type="button" data-sign-close="1" aria-label="סגירה">✕</button>
        </div>
        <div class="giValModal__body"><div class="giSignLinks">${rows}</div></div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelectorAll("[data-sign-close]").forEach((el) => {
      el.addEventListener("click", () => closeDialog());
    });
    modal.querySelectorAll("[data-copy-sign-link]").forEach((el) => {
      el.addEventListener("click", async () => {
        const href = el.getAttribute("data-copy-sign-link") || "";
        try { await navigator.clipboard.writeText(href); } catch(_e) {}
        toast("הלינק הועתק", href, "success");
      });
    });
  }
  function yieldPaint(){
    return new Promise((resolve) => {
      if(typeof requestAnimationFrame !== "function"){
        setTimeout(resolve, 0);
        return;
      }
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  }
  async function openSend(rec, docOrId){
    const docId = trim(docOrId && docOrId.id) || trim(docOrId);
    markSending(docId, true);
    await yieldPaint();
    try {
      if(!canSend()){
        toast("אין הרשאה", "שליחה לחתימה זמינה למנהל ולמנהל מערכת.", "warn");
        return;
      }
      const api = engine();
      if(!api || !rec) return;
      const doc = global.CustomersUI?.findCustomerDocument?.(rec, docId) || null;
      try {
        if(typeof global.ensureGiCancelFormsLoaded === "function") await global.ensureGiCancelFormsLoaded();
      } catch(_e) {}
      const forms = global.GiCancelForms;
      if(!forms || typeof forms.buildDraft !== "function" || typeof forms.fillOriginalTemplate !== "function"){
        toast("לא ניתן לשלוח", "טופס הביטול לא נטען.", "warn");
        return;
      }
      const draft = forms.buildDraft(rec, doc);
      const signers = api.signersFor(draft.templateId, draft.people, new Date());
      if(!signers.length){
        toast("אין מבוטח לחתימה", "לא נמצא מבוטח שצריך לחתום על הטופס.", "warn");
        return;
      }
      const missingId = signers.filter((row) => !trim(row.idNumber));
      if(missingId.length){
        const who = missingId.map((row) => row.name).filter(Boolean).join(", ");
        toast("חסרה תעודת זהות", who ? ("לא ניתן לשלוח לחתימה בלי תעודת זהות של " + who + ".") : "לא ניתן לשלוח לחתימה בלי תעודת זהות של מי שצריך לחתום.", "warn");
        return;
      }
      const me = currentAgent();
      if(!me.pin){
        toast("נדרשת כניסה מחדש", "כדי לשלוח לחתימה יש להתחבר שוב למערכת.", "warn");
        return;
      }
      let bytes = null;
      try {
        bytes = global.CustomersUI?.cancelFormPdfBytes?.(rec, doc) || null;
        if(!bytes){
          await yieldPaint();
          bytes = await forms.fillOriginalTemplate(draft);
        }
        if(bytes) global.CustomersUI?.rememberCancelFormPdfBytes?.(rec, doc, bytes);
      } catch(err) {
        toast("שגיאה בהפקת PDF", trim(err && err.message) || "לא ניתן למלא את טופס הביטול", "warn");
        return;
      }
      const prepared = signers.map((row) => Object.assign({}, row, { token: api.shortToken() }));
      const shortJobs = prepared.map((row) => shortenSignHref(customerSignHref(global.location.href, row.token)));
      await yieldPaint();
      const pdfBase64 = bytesToBase64(bytes);
      let created = null;
      try {
        created = await callEdge({
          action: "create",
          pin: me.pin,
          username: me.username,
          agentId: me.id,
          agentName: me.name,
          customerId: trim(rec.id),
          customerName: customerName(rec),
          docId: trim(doc && doc.id) || docId,
          docName: docName(rec, doc),
          pdfBase64: pdfBase64,
          signers: prepared
        });
      } catch(err) {
        const code = trim(err && err.code);
        const text = code === "FORBIDDEN" || code === "AUTH_FAILED"
          ? "שליחה לחתימה זמינה למנהל ולמנהל מערכת."
          : code === "MISSING_ID"
            ? "לא ניתן לשלוח לחתימה בלי תעודת זהות של מי שצריך לחתום."
            : "שרת החתימה עדיין לא פורסם. צריך להפעיל את supabase-gi-sign.sql ולפרסם את gi-sign.";
        toast(code === "MISSING_ID" ? "חסרה תעודת זהות" : "לא ניתן ליצור לינק", text, "warn");
        return;
      }
      const shortList = await Promise.all(shortJobs);
      const shortByToken = Object.create(null);
      prepared.forEach((row, i) => { shortByToken[row.token] = asShortHref(shortList[i]); });
      const byToken = Object.create(null);
      prepared.forEach((row) => { byToken[row.token] = row; });
      const links = (created.links || prepared).map((row) => {
        const src = byToken[row.token] || row;
        return {
          token: row.token,
          name: row.name || src.name,
          slot: row.slot || src.slot,
          idNumber: trim(src.idNumber),
          status: "pending",
          href: shortByToken[row.token] || ""
        };
      });
      if(links.some((row) => !asShortHref(row.href))){
        toast("הלינק לא קוצר", "נסו לשלוח שוב. הכתובת הארוכה לא מוצגת.", "warn");
        return;
      }
      const saved = {
        docId: trim(doc && doc.id) || docId,
        packetId: trim(created.packetId),
        docName: docName(rec, doc),
        customerName: customerName(rec),
        links: links.map((row) => ({
          token: row.token,
          name: row.name,
          slot: row.slot,
          idNumber: trim(row.idNumber),
          status: "pending"
        })),
        status: "sent",
        file: null
      };
      showLinks(customerName(rec), links);
      try {
        const save = global.CustomersUI?.saveCancelSignState?.(rec, saved);
        if(save && typeof save.then === "function") void save;
      } catch(_e) {}
    } finally {
      markSending(docId, false);
    }
  }
  async function syncCustomer(rec){
    const id = trim(rec && rec.id);
    const map = rec && rec.payload && rec.payload.giSignByDoc;
    if(!id || !map || typeof map !== "object") return;
    const jobs = [];
    Object.keys(map).forEach((docId) => {
      const entry = map[docId];
      const links = Array.isArray(entry && entry.links) ? entry.links : [];
      links.forEach((link) => {
        if(trim(link && link.status) === "signed") return;
        const token = trim(link && link.token);
        if(token) jobs.push({ docId, token });
      });
    });
    if(!jobs.length) return;
    const syncKey = id + "|" + jobs.map((job) => job.token).join(",");
    if(state.synced[syncKey]) return;
    state.synced[syncKey] = true;
    for(let i = 0; i < jobs.length; i++){
      try {
        const data = await callEdge({ action: "status", token: jobs[i].token });
        if(trim(data.status) !== "signed") continue;
        noteSigned({
          customerId: id,
          docId: jobs[i].docId,
          token: jobs[i].token,
          signedAt: trim(data.signedAt)
        });
        const entry = entryOf(rec, { id: jobs[i].docId });
        if(entry && typeof global.CustomersUI?.saveCancelSignState === "function"){
          await global.CustomersUI.saveCancelSignState(rec, entry);
        }
      } catch(_e) {}
    }
  }

  const GiSign = {
    canSend,
    statusLabel,
    openSend,
    signedPreviewUrl,
    syncCustomer,
    showSignedToast,
    subscribe
  };
  try { global.GiSign = GiSign; } catch(_e) {}
  if(typeof document !== "undefined"){
    const boot = () => { try { subscribe(); } catch(_e) {} };
    if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
  }
})(typeof window !== "undefined" ? window : globalThis);
