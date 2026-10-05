/* GEMEL INVEST — מערכת החתמת לקוח.
   העלאת מסמך, שם, הצבת חתימות, ואז לינק. בלי שליחת וואטסאפ. */
(function installCustomerSign(global){
  "use strict";

  const PDFJS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js";
  const PDFJS_WORKER = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
  const PDFJS_VIEWER = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/web/pdf_viewer.js";
  const PDFJS_VIEWER_CSS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/web/pdf_viewer.css";
  const FN_PATH = "/functions/v1/gi-sign";
  const FALLBACK_SUPABASE_URL = "https://vhvlkerectggovfihjgm.supabase.co";
  const FALLBACK_PUBLISHABLE_KEY = "sb_publishable_JixJJelGPWcP0BPKGq96Lw_nIiMyIBb";
  const HISTORY_KEY = "giCustSignLinks";
  const BOX_W = 150;
  const BOX_H = 44;

  const state = {
    name: "",
    bytes: null,
    marks: [],
    seq: 0,
    suppressClick: false,
    busy: false,
    mode: "home"
  };

  function trim(v){ return String(v == null ? "" : v).trim(); }
  function digits(v){ return trim(v).replace(/\D/g, ""); }
  function root(){ return document.getElementById("view-customerSign"); }
  function esc(v){
    return trim(v).replace(/[&<>"']/g, (ch) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#39;" }[ch]));
  }

  function agent(){
    const api = global.Auth;
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

  function history(){
    try {
      const raw = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch(_e) {
      return [];
    }
  }

  function remember(row){
    const next = [row].concat(history().filter((item) => item && item.href !== row.href)).slice(0, 8);
    try { sessionStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch(_e) {}
  }

  function bytesToBase64(bytes){
    let bin = "";
    const chunk = 0x8000;
    for(let i = 0; i < bytes.length; i += chunk){
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
  }

  function token(){
    const api = global.GiSignEngine;
    if(api && typeof api.shortToken === "function") return api.shortToken();
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    let out = "";
    for(let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
    return out;
  }

  function signHref(id){
    const api = global.GiSignEngine;
    if(api && typeof api.signLink === "function") return api.signLink(global.location.href, id);
    const url = new URL(global.location.href);
    const dir = url.pathname.replace(/[^/]*$/, "");
    return url.origin + dir + "s/" + trim(id);
  }

  async function callEdge(payload){
    const res = await fetch(FALLBACK_SUPABASE_URL + FN_PATH, {
      method: "POST",
      cache: "no-store",
      headers: {
        apikey: FALLBACK_PUBLISHABLE_KEY,
        Authorization: "Bearer " + FALLBACK_PUBLISHABLE_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload || {})
    });
    let data = {};
    try { data = await res.json(); } catch(_e) { data = {}; }
    if(!res.ok || data.ok === false){
      const err = new Error(trim(data.error) || ("HTTP_" + res.status));
      err.code = trim(data.error);
      throw err;
    }
    return data;
  }

  function loadScript(src, ready){
    return new Promise((resolve, reject) => {
      if(typeof ready === "function" && ready()) return resolve();
      const found = document.querySelector('script[src="' + src + '"]');
      if(found){
        if(found.dataset.ready === "1" || (typeof ready === "function" && ready())) return resolve();
        found.addEventListener("load", () => resolve(), { once: true });
        found.addEventListener("error", () => reject(new Error("PDFJS")), { once: true });
        return;
      }
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => { s.dataset.ready = "1"; resolve(); };
      s.onerror = () => reject(new Error("PDFJS"));
      document.head.appendChild(s);
    });
  }

  function loadCss(href){
    if(document.querySelector('link[href="' + href + '"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }

  function recentHtml(){
    const rows = history();
    if(!rows.length) return "";
    return `<div class="giCustSign__recent"><h2>לינקים שהופקו במסך הזה</h2>` + rows.map((row) => (
      `<div class="giCustSign__linkRow"><div><strong>${esc(row.name)}</strong><span>${esc(row.href)}</span></div>`
      + `<button class="giCustSign__copy" type="button" data-copy="${esc(row.href)}">העתק</button></div>`
    )).join("") + `</div>`;
  }

  function paintHome(){
    const el = root();
    if(!el) return;
    state.mode = "home";
    el.innerHTML = `<div class="giCustSign">
      <div class="giCustSign__home">
        <div class="giCustSign__kicker">GEMEL INVEST</div>
        <h1 class="giCustSign__title">מערכת החתמת לקוח</h1>
        <p class="giCustSign__lead">מעלים מסמך, נותנים לו שם, ומציבים חתימות במקום המדויק. בלחיצה על שלח מופק לינק ללקוח. הודעת וואטסאפ לא נשלחת עדיין.</p>
        <button class="giCustSign__upload" id="giCustSignUpload" type="button">העלאת מסמך לחתימה</button>
        ${recentHtml()}
      </div>
    </div>`;
    el.querySelector("#giCustSignUpload")?.addEventListener("click", openNameDialog);
    el.querySelectorAll("[data-copy]").forEach((btn) => {
      btn.addEventListener("click", () => copyText(btn.getAttribute("data-copy"), btn));
    });
  }

  function openNameDialog(){
    const el = root();
    if(!el || el.querySelector(".giCustSign__modal")) return;
    const modal = document.createElement("div");
    modal.className = "giCustSign__modal";
    modal.innerHTML = `<div class="giCustSign__dialog" role="dialog" aria-modal="true" aria-label="שם למסמך">
      <h2>שם למסמך</h2>
      <p>אחרי השם והקובץ המסמך ייפתח במלואו, ואפשר יהיה להציב עליו חתימות.</p>
      <label class="giCustSign__field">שם המסמך
        <input id="giCustSignName" type="text" maxlength="80" placeholder="לדוגמה: טופס הצטרפות"/>
      </label>
      <label class="giCustSign__field">קובץ PDF
        <input id="giCustSignFile" type="file" accept="application/pdf,.pdf"/>
      </label>
      <p class="giCustSign__error" id="giCustSignNameError" hidden></p>
      <div class="giCustSign__actions">
        <button class="giCustSign__upload" id="giCustSignOpen" type="button">פתח את המסמך</button>
        <button class="giCustSign__ghost" id="giCustSignCancel" type="button">ביטול</button>
      </div>
    </div>`;
    el.appendChild(modal);
    modal.querySelector("#giCustSignCancel")?.addEventListener("click", () => modal.remove());
    modal.addEventListener("click", (ev) => { if(ev.target === modal) modal.remove(); });
    modal.querySelector("#giCustSignOpen")?.addEventListener("click", () => beginDocument(modal));
    modal.querySelector("#giCustSignName")?.focus();
  }

  function setNameError(modal, text){
    const el = modal.querySelector("#giCustSignNameError");
    if(!el) return;
    el.hidden = !text;
    el.textContent = text || "";
  }

  async function beginDocument(modal){
    const name = trim(modal.querySelector("#giCustSignName")?.value);
    const file = modal.querySelector("#giCustSignFile")?.files?.[0];
    if(!name) return setNameError(modal, "צריך לתת שם למסמך.");
    if(!file) return setNameError(modal, "צריך לבחור קובץ PDF.");
    const kind = trim(file.type).toLowerCase();
    const looksPdf = kind === "application/pdf" || /\.pdf$/i.test(file.name);
    if(!looksPdf) return setNameError(modal, "אפשר להעלות קובץ PDF בלבד.");
    if(file.size > 8 * 1024 * 1024) return setNameError(modal, "הקובץ גדול מדי. עד 8MB.");
    setNameError(modal, "");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const head = String.fromCharCode.apply(null, bytes.subarray(0, 5));
    if(head !== "%PDF-") return setNameError(modal, "הקובץ אינו PDF תקין.");
    state.name = name;
    state.bytes = bytes;
    state.marks = [];
    state.seq = 0;
    modal.remove();
    await paintEditor();
  }

  async function paintEditor(){
    const el = root();
    if(!el) return;
    state.mode = "place";
    el.innerHTML = `<div class="giCustSign">
      <div class="giCustSign__editor">
        <div class="giCustSign__bar">
          <div>
            <strong>${esc(state.name)}</strong>
            <span>לחץ על המסמך כדי להציב חתימה. גרור כדי להזיז אותה.</span>
          </div>
          <button class="giCustSign__ghost" id="giCustSignBack" type="button">מסמך אחר</button>
        </div>
        <div class="giCustSign__pages" id="giCustSignPages"></div>
        <div class="giCustSign__dock">
          <div class="giCustSign__place">
            <button class="giCustSign__upload" id="giCustSignDone" type="button" disabled>סיימתי להציב חתימות</button>
            <p class="giCustSign__error" id="giCustSignPlaceError" hidden></p>
          </div>
        </div>
      </div>
    </div>`;
    el.querySelector("#giCustSignBack")?.addEventListener("click", () => {
      state.bytes = null;
      state.marks = [];
      paintHome();
    });
    el.querySelector("#giCustSignDone")?.addEventListener("click", paintSend);
    try {
      await renderPages();
      syncDone();
    } catch(_err) {
      const pages = root()?.querySelector("#giCustSignPages");
      if(pages) pages.innerHTML = '<p class="giCustSign__error">לא הצלחתי לפתוח את ה-PDF. נסו קובץ אחר.</p>';
    }
  }

  async function renderPages(){
    loadCss(PDFJS_VIEWER_CSS);
    await loadScript(PDFJS, () => !!global.pdfjsLib);
    global.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    await loadScript(PDFJS_VIEWER, () => !!global.pdfjsViewer);
    const doc = await global.pdfjsLib.getDocument({ data: state.bytes.slice(0) }).promise;
    const stage = root()?.querySelector("#giCustSignPages");
    if(!stage) return;
    stage.innerHTML = "";
    const scroller = document.createElement("div");
    scroller.className = "giCustSign__viewer";
    const viewerEl = document.createElement("div");
    viewerEl.className = "pdfViewer";
    scroller.appendChild(viewerEl);
    stage.appendChild(scroller);
    const eventBus = new global.pdfjsViewer.EventBus();
    const linkService = new global.pdfjsViewer.PDFLinkService({ eventBus: eventBus });
    const pdfViewer = new global.pdfjsViewer.PDFViewer({
      container: scroller,
      viewer: viewerEl,
      eventBus: eventBus,
      linkService: linkService,
      annotationMode: global.pdfjsLib.AnnotationMode.ENABLE_FORMS,
      textLayerMode: 0,
      removePageBorders: true
    });
    linkService.setViewer(pdfViewer);
    state.viewer = pdfViewer;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("pdf-view")), 20000);
      eventBus.on("pagesloaded", () => { clearTimeout(timer); resolve(); });
      pdfViewer.setDocument(doc);
      linkService.setDocument(doc, null);
    });
    pdfViewer.currentScaleValue = "page-width";
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    for(let n = 0; n < doc.numPages; n++){
      const pageView = pdfViewer.getPageView(n);
      const wrap = pageView && pageView.div;
      if(!wrap) continue;
      const base = pageView.pdfPage.getViewport({ scale: 1 });
      wrap.classList.add("giCustSign__page");
      wrap.dataset.page = String(n);
      wrap.dataset.pdfW = String(base.width);
      wrap.dataset.pdfH = String(base.height);
      wrap.addEventListener("click", onPageClick);
    }
    paintMarks();
  }

  function pageWrap(page){
    return root()?.querySelector('.giCustSign__page[data-page="' + page + '"]');
  }

  function addMark(page, x, y){
    const wrap = pageWrap(page);
    if(!wrap) return;
    const pdfW = Number(wrap.dataset.pdfW);
    const pdfH = Number(wrap.dataset.pdfH);
    const w = Math.min(BOX_W, pdfW - 16);
    const h = Math.min(BOX_H, pdfH - 16);
    let x0 = x - w / 2;
    let y0 = y - h / 2;
    x0 = Math.max(4, Math.min(x0, pdfW - w - 4));
    y0 = Math.max(4, Math.min(y0, pdfH - h - 4));
    state.seq += 1;
    state.marks.push({ id: state.seq, page, x0, y0, x1: x0 + w, y1: y0 + h });
    paintMarks();
    syncDone();
  }

  function paintMarks(){
    root()?.querySelectorAll(".giCustSign__mark").forEach((el) => el.remove());
    state.marks.forEach((mark, index) => {
      const wrap = pageWrap(mark.page);
      if(!wrap) return;
      const pdfW = Number(wrap.dataset.pdfW);
      const pdfH = Number(wrap.dataset.pdfH);
      const el = document.createElement("div");
      el.className = "giCustSign__mark";
      el.dataset.id = String(mark.id);
      el.style.left = (mark.x0 / pdfW * 100) + "%";
      el.style.top = (mark.y0 / pdfH * 100) + "%";
      el.style.width = ((mark.x1 - mark.x0) / pdfW * 100) + "%";
      el.style.height = ((mark.y1 - mark.y0) / pdfH * 100) + "%";
      el.appendChild(document.createTextNode("חתימה " + (index + 1)));
      const del = document.createElement("button");
      del.type = "button";
      del.dataset.del = "1";
      del.setAttribute("aria-label", "הסר חתימה");
      del.textContent = "×";
      del.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        state.marks = state.marks.filter((row) => row.id !== mark.id);
        paintMarks();
        syncDone();
      });
      el.appendChild(del);
      el.addEventListener("pointerdown", (ev) => startDrag(ev, mark, wrap));
      wrap.appendChild(el);
    });
  }

  function startDrag(ev, mark, wrap){
    if(ev.target && ev.target.closest && ev.target.closest("[data-del]")) return;
    ev.preventDefault();
    ev.stopPropagation();
    const pdfW = Number(wrap.dataset.pdfW);
    const pdfH = Number(wrap.dataset.pdfH);
    const startX = ev.clientX;
    const startY = ev.clientY;
    const orig = { x0: mark.x0, y0: mark.y0, x1: mark.x1, y1: mark.y1 };
    const width = orig.x1 - orig.x0;
    const height = orig.y1 - orig.y0;
    const move = (e) => {
      const rect = wrap.getBoundingClientRect();
      if(!rect.width || !rect.height) return;
      const dx = ((e.clientX - startX) / rect.width) * pdfW;
      const dy = ((e.clientY - startY) / rect.height) * pdfH;
      let x0 = orig.x0 + dx;
      let y0 = orig.y0 + dy;
      x0 = Math.max(4, Math.min(x0, pdfW - width - 4));
      y0 = Math.max(4, Math.min(y0, pdfH - height - 4));
      mark.x0 = x0;
      mark.y0 = y0;
      mark.x1 = x0 + width;
      mark.y1 = y0 + height;
      const el = wrap.querySelector('.giCustSign__mark[data-id="' + mark.id + '"]');
      if(el){
        el.style.left = (mark.x0 / pdfW * 100) + "%";
        el.style.top = (mark.y0 / pdfH * 100) + "%";
      }
    };
    const up = (e) => {
      if(Math.hypot(e.clientX - startX, e.clientY - startY) > 4) state.suppressClick = true;
      global.removeEventListener("pointermove", move);
      global.removeEventListener("pointerup", up);
    };
    global.addEventListener("pointermove", move);
    global.addEventListener("pointerup", up);
  }

  function onPageClick(ev){
    if(state.suppressClick){
      state.suppressClick = false;
      return;
    }
    if(ev.target && ev.target.closest && ev.target.closest(".giCustSign__mark")) return;
    const wrap = ev.currentTarget;
    const rect = wrap.getBoundingClientRect();
    if(!rect.width || !rect.height) return;
    const pdfW = Number(wrap.dataset.pdfW);
    const pdfH = Number(wrap.dataset.pdfH);
    const x = ((ev.clientX - rect.left) / rect.width) * pdfW;
    const y = ((ev.clientY - rect.top) / rect.height) * pdfH;
    addMark(Number(wrap.dataset.page) || 0, x, y);
  }

  function syncDone(){
    const btn = root()?.querySelector("#giCustSignDone");
    if(btn) btn.disabled = state.marks.length < 1;
  }

  function paintSend(){
    if(!state.marks.length) return;
    const el = root();
    const dock = el?.querySelector(".giCustSign__dock");
    if(!dock) return;
    state.mode = "send";
    dock.innerHTML = `<div class="giCustSign__phone">
      <label class="giCustSign__field">מספר טלפון לשליחה
        <input id="giCustSignPhone" type="tel" inputmode="numeric" dir="ltr" maxlength="16" placeholder="05XXXXXXXX"/>
      </label>
      <button class="giCustSign__upload" id="giCustSignSend" type="button">שלח</button>
      <button class="giCustSign__ghost" id="giCustSignMore" type="button">חזרה להצבת חתימות</button>
    </div>
    <p class="giCustSign__note">שליחה כרגע מפיקה לינק בלבד. וואטסאפ יישלח ישירות ללקוח רק אחרי שיוקם מספר וואטסאפ ייעודי.</p>
    <p class="giCustSign__error" id="giCustSignSendError" hidden></p>
    <div id="giCustSignResult"></div>`;
    dock.querySelector("#giCustSignMore")?.addEventListener("click", () => {
      const done = document.createElement("div");
      dock.innerHTML = "";
      dock.appendChild(done);
      dock.innerHTML = `<div class="giCustSign__place"><button class="giCustSign__upload" id="giCustSignDone" type="button">סיימתי להציב חתימות</button><p class="giCustSign__error" id="giCustSignPlaceError" hidden></p></div>`;
      dock.querySelector("#giCustSignDone")?.addEventListener("click", paintSend);
      syncDone();
      state.mode = "place";
    });
    dock.querySelector("#giCustSignSend")?.addEventListener("click", sendLink);
    dock.querySelector("#giCustSignPhone")?.focus();
  }

  function sendError(text){
    const el = root()?.querySelector("#giCustSignSendError");
    if(!el) return;
    el.hidden = !text;
    el.textContent = text || "";
  }

  function errorText(err){
    const code = trim(err && (err.code || err.message));
    if(code === "AUTH_REQUIRED" || code === "AUTH_FAILED") return "כדי להפיק לינק צריך להתחבר מחדש למערכת.";
    if(code === "FORBIDDEN") return "המשתמש לא מורשה להפיק לינק חתימה.";
    if(code === "PDF_TOO_LARGE") return "הקובץ גדול מדי.";
    if(code === "MISSING_FIELDS") return "חסרים שם, טלפון או חתימה.";
    return "לא הצלחתי להפיק לינק. נסו שוב.";
  }

  async function copyText(value, btn){
    const text = trim(value);
    if(!text) return;
    try {
      await navigator.clipboard.writeText(text);
      if(btn){
        const prev = btn.textContent;
        btn.textContent = "הועתק";
        setTimeout(() => { btn.textContent = prev; }, 1200);
      }
    } catch(_e) {
      window.prompt("העתיקו את הלינק", text);
    }
  }

  async function sendLink(){
    if(state.busy) return;
    const phone = digits(root()?.querySelector("#giCustSignPhone")?.value);
    if(phone.length < 9) return sendError("הזינו מספר טלפון לשליחה.");
    const me = agent();
    if(!me.pin || !me.username) return sendError("כדי להפיק לינק צריך להתחבר מחדש למערכת.");
    state.busy = true;
    const btn = root()?.querySelector("#giCustSignSend");
    if(btn) btn.disabled = true;
    sendError("");
    try {
      const id = token();
      await callEdge({
        action: "create_upload",
        pin: me.pin,
        username: me.username,
        agentId: me.id,
        agentName: me.name,
        docName: state.name,
        phone: phone,
        token: id,
        pdfBase64: bytesToBase64(state.bytes),
        boxes: state.marks.map((mark) => ({
          page: mark.page,
          x0: Math.round(mark.x0 * 10) / 10,
          y0: Math.round(mark.y0 * 10) / 10,
          x1: Math.round(mark.x1 * 10) / 10,
          y1: Math.round(mark.y1 * 10) / 10
        }))
      });
      const href = signHref(id);
      remember({ name: state.name, phone: phone, href: href, at: Date.now() });
      const box = root()?.querySelector("#giCustSignResult");
      if(box){
        box.innerHTML = `<div class="giCustSign__ready">
          <strong>הלינק לשליחה מוכן</strong>
          <div class="giCustSign__url" dir="ltr">${esc(href)}</div>
          <p class="giCustSign__note">לא נשלחה הודעת וואטסאפ. אפשר להעתיק את הלינק ולשלוח אותו ידנית. הלקוח פותח אותו ומזין את מספר הטלפון ${esc(phone)}.</p>
          <button class="giCustSign__copy" type="button" id="giCustSignCopy">העתק לינק</button>
        </div>`;
        box.querySelector(".giCustSign__url")?.scrollIntoView({ block: "nearest" });
        box.querySelector("#giCustSignCopy")?.addEventListener("click", (ev) => copyText(href, ev.currentTarget));
      }
    } catch(err) {
      sendError(errorText(err));
    } finally {
      state.busy = false;
      if(btn) btn.disabled = false;
    }
  }

  const CustomerSignUI = {
    open(){
      const el = root();
      if(!el) return;
      if(state.mode === "place" || state.mode === "send") return;
      paintHome();
    }
  };

  try { global.CustomerSignUI = CustomerSignUI; } catch(_e) {}
})(window);
