/* GI-OPS-SUMMARY-PDF-WORKER 2026-10-13
   מסמך התאמה ודוח התפתחות פרמיה מצולמים כ-PNG בקנה מידה 3.
   jsPDF addImage של ה-PNG רץ כאן, לא על חוט המסך:
   שם הוא נועל את הדפדפן לכ־1.3–2.1 שניות לכל עמוד,
   והסימון לשליחה ולחצני פתח/הורדה לא מגיבים עד שהקריאה נגמרת.
   המסך רק מצלם את ה-HTML ומוסר את בייטי ה-PNG. */
"use strict";

let JsPdfCtor = null;

function installJsPdf(source){
  if(JsPdfCtor) return;
  (0, eval)(String(source || ""));
  JsPdfCtor = (self.jspdf && self.jspdf.jsPDF) || self.jsPDF;
  if(typeof JsPdfCtor !== "function") throw new Error("pdf engine missing");
}

function buildPdf(pages){
  const pdf = new JsPdfCtor({ unit: "pt", format: "a4", orientation: "portrait", compress: true });
  const pw = pdf.internal.pageSize.getWidth();
  const list = Array.isArray(pages) ? pages : [];
  for(let i = 0; i < list.length; i++){
    const page = list[i] || {};
    const bytes = new Uint8Array(page.png);
    const width = Number(page.width) || 0;
    const height = Number(page.height) || 0;
    if(!bytes.byteLength || !(width > 0) || !(height > 0)) throw new Error("pdf engine missing");
    if(i) pdf.addPage();
    const drawH = height / width * pw;
    pdf.addImage(bytes, "PNG", 0, 0, pw, drawH);
  }
  return pdf.output("arraybuffer");
}

self.onmessage = function(event){
  const data = event.data || {};
  const id = data.id;
  try {
    if(data.type === "init"){
      installJsPdf(data.source);
      self.postMessage({ type: "ready" });
      return;
    }
    if(data.type === "build"){
      const buffer = buildPdf(data.pages);
      self.postMessage({ type: "pdf", id: id, buffer: buffer }, [buffer]);
      return;
    }
    self.postMessage({ type: "error", id: id, message: "pdf engine missing" });
  } catch(err){
    self.postMessage({
      type: "error",
      id: id,
      message: err && err.message ? err.message : "pdf engine missing"
    });
  }
};
