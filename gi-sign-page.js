/* GEMEL INVEST — דף חתימה לנייד. נפתח מהלינק הקצר בלי כניסה למערכת. */
(function installGiSignPage(global){
  "use strict";

  const FN_PATH = "/functions/v1/gi-sign";
  const FALLBACK_SUPABASE_URL = "https://vhvlkerectggovfihjgm.supabase.co";
  const FALLBACK_PUBLISHABLE_KEY = "sb_publishable_JixJJelGPWcP0BPKGq96Lw_nIiMyIBb";
  const PDFJS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js";
  const PDFJS_WORKER = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
  const PDFJS_VIEWER = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/web/pdf_viewer.js";

  const view = { token: "", idNumber: "", data: null, scale: 1, png: "", placed: false, holding: false, wired: false, waitTimer: 0, beatTimer: 0, polling: false, cells: [], active: 0, pdfViewer: null, pdfDoc: null };

  function trim(v){ return String(v == null ? "" : v).trim(); }
  function $(id){ return document.getElementById(id); }
  function engine(){ return global.GiSignEngine; }

  function b64ToBytes(raw){
    const clean = String(raw || "").replace(/^data:[^,]*,/, "").replace(/\s/g, "");
    const bin = atob(clean);
    const out = new Uint8Array(bin.length);
    for(let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
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
      const err = new Error(trim(data.error) || "FAILED");
      err.signerName = trim(data.signerName);
      throw err;
    }
    return data;
  }

  function loadScript(src){
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("script"));
      document.head.appendChild(s);
    });
  }

  function show(id){
    ["giSignLoading", "giSignError", "giSignGate", "giSignWait", "giSignApp", "giSignSuccess"].forEach((key) => {
      const el = $(key);
      if(el) el.hidden = key !== id;
    });
  }

  function showUnavailable(text){
    show("giSignError");
    const el = $("giSignErrorText");
    if(el && text) el.textContent = text;
  }

  function signatureCells(data){
    const box = data && data.box;
    if(box && Array.isArray(box.boxes) && box.boxes.length) return box.boxes;
    if(box && box.x1 != null) return [box];
    return [];
  }

  function stepText(index){
    const total = view.cells.length;
    const n = Math.min(total, Math.max(1, index + 1));
    return "חתימה " + n + " מתוך " + total;
  }

  function refreshStep(index){
    const el = $("giSignStep");
    const total = view.cells.length;
    const next = view.cells.findIndex((cell) => !cell.png);
    const at = Number.isFinite(index) ? index : (next >= 0 ? next : Math.max(0, total - 1));
    if(el){
      el.hidden = !total;
      if(total) el.textContent = stepText(at);
    }
    const title = document.querySelector(".giSignPad__title");
    if(title && total) title.textContent = stepText(view.active);
    reportStep(at);
  }

  function reportStep(at){
    const total = view.cells.length;
    if(!total || !view.token || !view.idNumber) return;
    const step = Math.min(total, Math.max(1, at + 1));
    const key = step + "/" + total;
    const now = Date.now();
    if(view.touchKey === key && now - (view.touchAt || 0) < 2500) return;
    view.touchKey = key;
    view.touchAt = now;
    void callEdge({ action: "touch", token: view.token, idNumber: view.idNumber, step: step, total: total }).catch(() => {});
  }

  function jumpToCell(index, missed){
    view.cells.forEach((cell, i) => {
      if(cell.hot) cell.hot.classList.toggle("is-missed", !!missed && i === index);
    });
    refreshStep(index);
    const hot = view.cells[index] && view.cells[index].hot;
    if(!hot) return;
    try { hot.scrollIntoView({ behavior: "smooth", block: "center" }); } catch(_e) {}
  }

  function placeHotspot(cell){
    const hot = cell && cell.hot;
    const mark = cell && cell.mark;
    const box = cell && cell.box;
    if(!box) return;
    const pageView = view.pdfViewer && view.pdfViewer.getPageView(Number(box.page) || 0);
    const vp = pageView && pageView.viewport;
    if(!vp || !(vp.scale > 0) || !vp.width || !vp.height) return;
    const pdfW = vp.width / vp.scale;
    const pdfH = vp.height / vp.scale;
    if(!(pdfW > 0) || !(pdfH > 0)) return;
    const left = (Number(box.x0) / pdfW) * 100;
    const top = (Number(box.y0) / pdfH) * 100;
    const width = ((Number(box.x1) - Number(box.x0)) / pdfW) * 100;
    const height = ((Number(box.y1) - Number(box.y0)) / pdfH) * 100;
    const apply = (el, minPx) => {
      if(!el) return;
      el.style.left = left + "%";
      el.style.top = top + "%";
      el.style.width = width + "%";
      el.style.height = height + "%";
      if(minPx){
        el.style.minWidth = minPx + "px";
        el.style.minHeight = minPx + "px";
      }
    };
    apply(hot, 44);
    apply(mark, 0);
    if(hot) hot.hidden = !!cell.png;
  }

  async function ensurePdfViewer(){
    if(!global.pdfjsLib){
      await loadScript(PDFJS);
      global.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    }
    if(!global.pdfjsViewer) await loadScript(PDFJS_VIEWER);
  }

  async function renderPdf(pdfBase64){
    await ensurePdfViewer();
    if(view.pdfDoc && typeof view.pdfDoc.destroy === "function"){
      try { view.pdfDoc.destroy(); } catch(_e) {}
    }
    const doc = await global.pdfjsLib.getDocument({ data: b64ToBytes(pdfBase64) }).promise;
    view.pdfDoc = doc;
    const stage = $("giSignStage");
    const legacy = $("giSignCanvas");
    if(legacy) legacy.hidden = true;
    const legacyHot = $("giSignHot");
    if(legacyHot) legacyHot.hidden = true;
    const previous = $("giSignViewer");
    if(previous) previous.remove();
    const viewerEl = document.createElement("div");
    viewerEl.id = "giSignViewer";
    viewerEl.className = "pdfViewer";
    stage.appendChild(viewerEl);
    const eventBus = new global.pdfjsViewer.EventBus();
    const linkService = new global.pdfjsViewer.PDFLinkService({ eventBus: eventBus });
    const pdfViewer = new global.pdfjsViewer.PDFViewer({
      container: stage,
      viewer: viewerEl,
      eventBus: eventBus,
      linkService: linkService,
      annotationMode: global.pdfjsLib.AnnotationMode.ENABLE_FORMS,
      textLayerMode: 0,
      removePageBorders: true
    });
    linkService.setViewer(pdfViewer);
    view.pdfViewer = pdfViewer;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("pdf-view")), 20000);
      eventBus.on("pagesloaded", () => {
        clearTimeout(timer);
        resolve();
      });
      pdfViewer.setDocument(doc);
      linkService.setDocument(doc, null);
    });
    pdfViewer.currentScaleValue = "page-width";
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const boxes = signatureCells(view.data);
    view.cells = boxes.map((box) => ({ box: box, png: "", hot: null, mark: null }));
    view.cells.forEach((cell, idx) => {
      const pageView = pdfViewer.getPageView(Number(cell.box.page) || 0);
      const page = pageView && pageView.div;
      if(!page) return;
      page.classList.add("giSignSheet");
      const hot = document.createElement("button");
      hot.type = "button";
      hot.className = "giSignHot";
      hot.textContent = "לחץ לחתימה";
      hot.addEventListener("click", () => openPad(idx));
      const mark = document.createElement("img");
      mark.className = "giSignMark";
      mark.alt = "";
      mark.hidden = true;
      cell.hot = hot;
      cell.mark = mark;
      page.appendChild(hot);
      page.appendChild(mark);
      placeHotspot(cell);
    });
    if(!view.fitWired){
      view.fitWired = true;
      global.addEventListener("resize", () => {
        if(!view.pdfViewer) return;
        try { view.pdfViewer.currentScaleValue = "page-width"; } catch(_e) {}
        view.cells.forEach((cell) => placeHotspot(cell));
      });
    }
  }

  function openPad(index){
    view.active = index;
    refreshStep(index);
    const pad = $("giSignPad");
    const canvas = $("giSignDraw");
    pad.hidden = false;
    const width = Math.min(global.innerWidth - 32, 560);
    const height = Math.max(180, Math.min(280, global.innerHeight * 0.36));
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#0F172A";
    ctx.lineWidth = 2.6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    let drawing = false;
    const point = (ev) => {
      const rect = canvas.getBoundingClientRect();
      const src = ev.touches ? ev.touches[0] : ev;
      return {
        x: (src.clientX - rect.left) * (canvas.width / rect.width),
        y: (src.clientY - rect.top) * (canvas.height / rect.height)
      };
    };
    const start = (ev) => {
      drawing = true;
      const p = point(ev);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ev.preventDefault();
    };
    const move = (ev) => {
      if(!drawing) return;
      const p = point(ev);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ev.preventDefault();
    };
    const end = () => { drawing = false; };
    canvas.onpointerdown = start;
    canvas.onpointermove = move;
    canvas.onpointerup = end;
    canvas.onpointerleave = end;
    canvas.ontouchstart = start;
    canvas.ontouchmove = move;
    canvas.ontouchend = end;
  }

  function cropSignature(canvas){
    const ctx = canvas.getContext("2d");
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let minX = canvas.width;
    let minY = canvas.height;
    let maxX = 0;
    let maxY = 0;
    let ink = false;
    for(let y = 0; y < canvas.height; y++){
      for(let x = 0; x < canvas.width; x++){
        const i = (y * canvas.width + x) * 4;
        const alpha = img.data[i + 3];
        const dark = img.data[i] < 250 || img.data[i + 1] < 250 || img.data[i + 2] < 250;
        if(alpha > 10 && dark){
          ink = true;
          if(x < minX) minX = x;
          if(y < minY) minY = y;
          if(x > maxX) maxX = x;
          if(y > maxY) maxY = y;
        }
      }
    }
    if(!ink) return "";
    const pad = 8;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(canvas.width, maxX + pad);
    maxY = Math.min(canvas.height, maxY + pad);
    const w = Math.max(1, maxX - minX);
    const h = Math.max(1, maxY - minY);
    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    out.getContext("2d").drawImage(canvas, minX, minY, w, h, 0, 0, w, h);
    return out.toDataURL("image/png");
  }

  function savePad(){
    const png = cropSignature($("giSignDraw"));
    const cell = view.cells[view.active];
    if(!png || !cell) return;
    cell.png = png;
    view.png = png;
    view.placed = view.cells.every((row) => !!row.png);
    $("giSignPad").hidden = true;
    const mark = cell.mark;
    if(mark){
      mark.src = png;
      mark.hidden = false;
    }
    placeHotspot(cell);
    const next = view.cells.findIndex((row) => !row.png);
    $("giSignSend").hidden = !view.cells.length;
    if(next >= 0) jumpToCell(next, false);
    else {
      refreshStep(view.cells.length - 1);
      try { $("giSignSend").scrollIntoView({ block: "nearest" }); } catch(_e) {}
    }
  }

  function playDone(){
    const layer = $("giSignCelebrate");
    if(!layer) return Promise.resolve();
    layer.hidden = false;
    return new Promise((resolve) => { setTimeout(resolve, 1600); });
  }

  function downloadPdf(pdfBase64, name){
    const bytes = b64ToBytes(pdfBase64);
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (trim(name) || "טופס-ביטול-חתום") + ".pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function submit(){
    const missing = view.cells.findIndex((cell) => !cell.png);
    if(missing >= 0){
      jumpToCell(missing, true);
      return;
    }
    const btn = $("giSignSend");
    btn.disabled = true;
    const done = playDone();
    try {
      const stamps = view.cells.map((cell) => ({
        pngBase64: String(cell.png || "").replace(/^data:image\/png;base64,/, ""),
        page: Number(cell.box && cell.box.page) || 0
      }));
      const png = stamps.length ? stamps[0].pngBase64 : String(view.png || "").replace(/^data:image\/png;base64,/, "");
      const data = await callEdge({
        action: "submit",
        token: view.token,
        pngBase64: png,
        stamps: stamps,
        idNumber: view.idNumber
      });
      view.data.pdfBase64 = data.pdfBase64 || view.data.pdfBase64;
      view.holding = false;
      stopBeat();
      view.idNumber = "";
      await done;
      const layer = $("giSignCelebrate");
      if(layer) layer.hidden = true;
      show("giSignSuccess");
      $("giSignDownload").onclick = () => downloadPdf(view.data.pdfBase64, view.data.docName);
    } catch(err) {
      const layer = $("giSignCelebrate");
      if(layer) layer.hidden = true;
      if(trim(err && err.message) === "WAITING"){
        btn.disabled = false;
        showWait(err && err.signerName);
        return;
      }
      btn.disabled = false;
      $("giSignSendError").hidden = false;
    }
  }

  function stopWait(){
    if(view.waitTimer) clearInterval(view.waitTimer);
    view.waitTimer = 0;
  }

  function stopBeat(){
    if(view.beatTimer) clearInterval(view.beatTimer);
    view.beatTimer = 0;
  }

  function waitText(name){
    return (trim(name) || "מבוטח") + " מבצע חתימה";
  }

  function showWait(name){
    view.holding = false;
    stopBeat();
    show("giSignWait");
    const el = $("giSignWaitName");
    if(el) el.textContent = waitText(name);
    if(view.waitTimer) return;
    view.waitTimer = setInterval(() => { void pollWait(); }, 1000);
  }

  async function pollWait(){
    if(view.polling || view.holding || !view.token || !view.idNumber) return;
    view.polling = true;
    try {
      const data = await callEdge({ action: "get", token: view.token, idNumber: view.idNumber });
      if(data && data.waiting){
        const el = $("giSignWaitName");
        if(el) el.textContent = waitText(data.signerName);
        return;
      }
      stopWait();
      view.data = data;
      await openDocument();
    } catch(_e) {}
    finally { view.polling = false; }
  }

  function startBeat(){
    stopBeat();
    view.holding = true;
    view.beatTimer = setInterval(() => { void beatHold(); }, 8000);
  }

  async function beatHold(){
    if(!view.holding || !view.token || !view.idNumber) return;
    try {
      const total = view.cells.length;
    const step = total ? Math.min(total, Math.max(1, (Number.isFinite(view.active) ? view.active : 0) + 1)) : 0;
    const data = await callEdge({ action: "beat", token: view.token, idNumber: view.idNumber, step: step, total: total });
      if(data && data.waiting) showWait(data.signerName);
    } catch(_e) {}
  }

  function releaseHold(){
    if(!view.holding || !view.token || !view.idNumber) return;
    view.holding = false;
    stopBeat();
    try {
      fetch(FALLBACK_SUPABASE_URL + FN_PATH, {
        method: "POST",
        keepalive: true,
        headers: {
          apikey: FALLBACK_PUBLISHABLE_KEY,
          Authorization: "Bearer " + FALLBACK_PUBLISHABLE_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ action: "release", token: view.token, idNumber: view.idNumber })
      });
    } catch(_e) {}
  }

  function wireDocument(){
    if(view.wired) return;
    view.wired = true;
    $("giSignPadSave").addEventListener("click", () => savePad());
    $("giSignPadCancel").addEventListener("click", () => { $("giSignPad").hidden = true; });
    $("giSignSend").addEventListener("click", () => { void submit(); });
  }

  async function openDocument(){
    const api = engine();
    stopWait();
    view.placed = false;
    view.png = "";
    view.cells = [];
    const mark = $("giSignMark");
    if(mark) mark.hidden = true;
    $("giSignHello").textContent = api.greeting(view.data.signerName, new Date());
    $("giSignDoc").textContent = view.data.docName || "טופס ביטול";
    show("giSignApp");
    const typed = $("giSignId");
    if(typed) typed.value = "";
    const signing = trim(view.data && view.data.status) !== "signed";
    if(signing) view.holding = true;
    try { await renderPdf(view.data.pdfBase64); } catch(_e) {
      if(signing) releaseHold();
      showUnavailable("לא הצלחנו לפתוח את המסמך לחתימה.");
      return;
    }
    wireDocument();
    if(view.data.status === "signed"){
      view.holding = false;
      stopBeat();
      view.cells.forEach((cell) => { if(cell.hot) cell.hot.hidden = true; });
      $("giSignSend").hidden = true;
      $("giSignAlready").hidden = false;
      return;
    }
    view.cells.forEach((cell) => placeHotspot(cell));
    refreshStep(0);
    $("giSignSend").hidden = !view.cells.length;
    $("giSignAlready").hidden = true;
    startBeat();
  }

  async function unlock(ev){
    if(ev && ev.preventDefault) ev.preventDefault();
    const api = engine();
    const typed = trim($("giSignId") && $("giSignId").value);
    const errEl = $("giSignGateError");
    if(errEl) errEl.hidden = true;
    if(!api || !api.normalizeId(typed)){
      if(errEl) errEl.hidden = false;
      return;
    }
    const btn = $("giSignGateGo");
    if(btn) btn.disabled = true;
    try {
      view.data = await callEdge({ action: "get", token: view.token, idNumber: typed });
      view.idNumber = typed;
      if(view.data && view.data.waiting){
        showWait(view.data.signerName);
        return;
      }
    } catch(err) {
      if(btn) btn.disabled = false;
      const code = trim(err && err.message);
      if(code === "NEEDS_RESEND"){
        showUnavailable("הלינק הזה צריך להישלח מחדש. בקשו מהסוכן לשלוח לינק חדש.");
        return;
      }
      if(code === "NOT_FOUND" || code === "MISSING_TOKEN"){
        showUnavailable("");
        return;
      }
      if(errEl){
        errEl.textContent = "תעודת הזהות לא תואמת";
        errEl.hidden = false;
      }
      return;
    }
    await openDocument();
  }

  async function boot(){
    const api = engine();
    view.token = api ? api.tokenFromLocation(location.pathname, location.hash) : "";
    if(!view.token){
      showUnavailable("");
      return;
    }
    try {
      const peek = await callEdge({ action: "peek", token: view.token });
      if(peek && peek.needsResend){
        showUnavailable("הלינק הזה צריך להישלח מחדש. בקשו מהסוכן לשלוח לינק חדש.");
        return;
      }
    } catch(_e) {
      showUnavailable("");
      return;
    }
    show("giSignGate");
    const form = $("giSignGateForm");
    if(form) form.addEventListener("submit", (ev) => { void unlock(ev); });
    const field = $("giSignId");
    if(field && field.focus) field.focus();
  }

  if(typeof document !== "undefined"){
    if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { void boot(); });
    else void boot();
    addEventListener("pagehide", (ev) => {
      if(ev && ev.persisted) return;
      releaseHold();
    });
  }
})(typeof window !== "undefined" ? window : globalThis);
