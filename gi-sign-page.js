/* GEMEL INVEST — דף חתימה לנייד. נפתח מהלינק הקצר בלי כניסה למערכת. */
(function installGiSignPage(global){
  "use strict";

  const FN_PATH = "/functions/v1/gi-sign";
  const FALLBACK_SUPABASE_URL = "https://vhvlkerectggovfihjgm.supabase.co";
  const FALLBACK_PUBLISHABLE_KEY = "sb_publishable_JixJJelGPWcP0BPKGq96Lw_nIiMyIBb";
  const PDFJS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js";
  const PDFJS_WORKER = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";

  const view = { token: "", data: null, scale: 1, png: "", placed: false };

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
    if(!res.ok || data.ok === false) throw new Error(trim(data.error) || "FAILED");
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
    ["giSignLoading", "giSignError", "giSignApp", "giSignSuccess"].forEach((key) => {
      const el = $(key);
      if(el) el.hidden = key !== id;
    });
  }

  function placeHotspot(){
    const box = view.data && view.data.box;
    const hot = $("giSignHot");
    if(!hot || !box) return;
    const scale = view.scale || 1;
    hot.style.left = (Number(box.x0) * scale) + "px";
    hot.style.top = (Number(box.y0) * scale) + "px";
    hot.style.width = Math.max(44, (Number(box.x1) - Number(box.x0)) * scale) + "px";
    hot.style.height = Math.max(44, (Number(box.y1) - Number(box.y0)) * scale) + "px";
    hot.hidden = view.placed;
  }

  async function renderPdf(pdfBase64){
    if(!global.pdfjsLib){
      await loadScript(PDFJS);
      global.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    }
    const doc = await global.pdfjsLib.getDocument({ data: b64ToBytes(pdfBase64) }).promise;
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const maxW = Math.max(280, Math.min((global.innerWidth || 360) - 24, 900));
    view.scale = maxW / base.width;
    const viewport = page.getViewport({ scale: view.scale });
    const canvas = $("giSignCanvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    placeHotspot();
  }

  function openPad(){
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
    if(!png) return;
    view.png = png;
    view.placed = true;
    $("giSignPad").hidden = true;
    const mark = $("giSignMark");
    const box = view.data.box || {};
    const scale = view.scale || 1;
    mark.src = png;
    mark.hidden = false;
    mark.style.left = (Number(box.x0) * scale) + "px";
    mark.style.top = (Number(box.y0) * scale) + "px";
    mark.style.width = ((Number(box.x1) - Number(box.x0)) * scale) + "px";
    mark.style.height = ((Number(box.y1) - Number(box.y0)) * scale) + "px";
    placeHotspot();
    $("giSignSend").hidden = false;
    try { $("giSignSend").scrollIntoView({ block: "nearest" }); } catch(_e) {}
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
    const btn = $("giSignSend");
    btn.disabled = true;
    try {
      const png = view.png.replace(/^data:image\/png;base64,/, "");
      const data = await callEdge({ action: "submit", token: view.token, pngBase64: png });
      view.data.pdfBase64 = data.pdfBase64 || view.data.pdfBase64;
      show("giSignSuccess");
      $("giSignDownload").onclick = () => downloadPdf(view.data.pdfBase64, view.data.docName);
    } catch(_e) {
      btn.disabled = false;
      $("giSignSendError").hidden = false;
    }
  }

  async function boot(){
    const api = engine();
    view.token = api ? api.tokenFromLocation(location.pathname, location.hash) : "";
    if(!view.token){
      show("giSignError");
      return;
    }
    try {
      view.data = await callEdge({ action: "get", token: view.token });
    } catch(_e) {
      show("giSignError");
      return;
    }
    $("giSignHello").textContent = api.greeting(view.data.signerName, new Date());
    $("giSignDoc").textContent = view.data.docName || "טופס ביטול";
    show("giSignApp");
    try { await renderPdf(view.data.pdfBase64); } catch(_e) {
      show("giSignError");
      return;
    }
    if(view.data.status === "signed"){
      $("giSignHot").hidden = true;
      $("giSignSend").hidden = true;
      $("giSignAlready").hidden = false;
      return;
    }
    $("giSignHot").addEventListener("click", () => openPad());
    $("giSignPadSave").addEventListener("click", () => savePad());
    $("giSignPadCancel").addEventListener("click", () => { $("giSignPad").hidden = true; });
    $("giSignSend").addEventListener("click", () => { void submit(); });
  }

  if(typeof document !== "undefined"){
    if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { void boot(); });
    else void boot();
  }
})(typeof window !== "undefined" ? window : globalThis);
