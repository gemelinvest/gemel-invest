/* GEMEL INVEST — טפסי ביטול מקוריים (בריאות / חיים)
   נטען לפי דרישה ממסמכי לקוח. שלב א': ממלא רק מספר פוליסה על הטופס המקורי. */
(function installGiCancelForms(global){
  "use strict";

  function safeTrim(v){
    return String(v == null ? "" : v).trim();
  }
  function escapeHtml(v){
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function nowISO(){
    try { return new Date().toISOString(); } catch(_e){ return ""; }
  }

  const PAGE_H = 841.89;
  const mupdfToPdfY = (y) => PAGE_H - Number(y) - 2;

  const TEMPLATES = {
    migdal: {
      id: "migdal",
      file: "migdal-cancel.pdf",
      overlay: { full: { x: 470, y: mupdfToPdfY(462) }, partial: { x: 470, y: mupdfToPdfY(548) } }
    },
    phoenix_health: {
      id: "phoenix_health",
      file: "phoenix-health-cancel.pdf",
      overlay: { full: { x: 410, y: mupdfToPdfY(345) }, partial: { x: 410, y: mupdfToPdfY(435) } }
    },
    phoenix: {
      id: "phoenix",
      file: "phoenix-cancel.pdf",
      overlay: { full: { x: 490, y: mupdfToPdfY(290) }, partial: { x: 410, y: mupdfToPdfY(395) } }
    },
    hachshara: {
      id: "hachshara",
      file: "hachshara-cancel.pdf",
      overlay: { full: { x: 400, y: mupdfToPdfY(380) }, partial: { x: 400, y: mupdfToPdfY(495) } }
    },
    ayalon: {
      id: "ayalon",
      file: "ayalon-cancel.pdf",
      overlay: { full: { x: 500, y: mupdfToPdfY(325) }, partial: { x: 500, y: mupdfToPdfY(520) } }
    },
    ayalon_life: {
      id: "ayalon_life",
      file: "ayalon-life-cancel.pdf",
      overlay: { full: { x: 250, y: mupdfToPdfY(530) }, partial: { x: 250, y: mupdfToPdfY(530) } }
    },
    clal: {
      id: "clal",
      file: "clal-cancel.pdf",
      overlay: { full: { x: 410, y: mupdfToPdfY(360) }, partial: { x: 410, y: mupdfToPdfY(490) } }
    },
    clal_couple: {
      id: "clal_couple",
      file: "clal-life-couple-cancel.pdf",
      overlay: { full: { x: 420, y: mupdfToPdfY(340) }, partial: { x: 410, y: mupdfToPdfY(470) } }
    },
    harel_health: {
      id: "harel_health",
      file: "harel-health-cancel.pdf",
      overlay: { full: { x: 400, y: mupdfToPdfY(395) }, partial: { x: 400, y: mupdfToPdfY(500) } }
    },
    harel_life: {
      id: "harel_life",
      file: "harel-life-cancel.pdf",
      overlay: { full: { x: 400, y: mupdfToPdfY(365) }, partial: { x: 400, y: mupdfToPdfY(460) } }
    },
    menora: {
      id: "menora",
      file: "menora-cancel.pdf",
      overlay: { full: { x: 330, y: mupdfToPdfY(400) }, partial: { x: 40, y: mupdfToPdfY(545) } }
    },
    menora_mortgage: {
      id: "menora_mortgage",
      file: "menora-mortgage-cancel.pdf",
      overlay: { full: { x: 300, y: mupdfToPdfY(145) }, partial: { x: 300, y: mupdfToPdfY(145) } }
    }
  };

  const GiCancelForms = {
    TEMPLATE_BASE: "./forms/cancel/",
    FONT_URL: "./fonts/Heebo-Bold.ttf",
    VERSION: "20260906-cancel-forms-v1",
    DOC_TYPE: "company_cancel_form",
    TEMPLATES,

    isCancelStatus(status){
      const v = safeTrim(status).toLowerCase().replace(/[\s-]+/g, "_");
      return v === "full" || v === "partial_health" || v === "partial" || v === "partialhealth";
    },
    isPartialStatus(status){
      const v = safeTrim(status).toLowerCase().replace(/[\s-]+/g, "_");
      return v === "partial_health" || v === "partial" || v === "partialhealth";
    },
    cancelStatusLabel(status){
      return this.isPartialStatus(status) ? "ביטול חלקי" : "ביטול מלא";
    },
    canonicalCompany(raw){
      const s = safeTrim(raw);
      if(!s) return "";
      const compact = s.replace(/\s+/g, " ");
      const rules = [
        [/מנורה/, "מנורה"],
        [/מגדל/, "מגדל"],
        [/הראל/, "הראל"],
        [/הפניקס|פניקס/, "הפניקס"],
        [/הכשרה|ההכשרה/, "הכשרה"],
        [/איילון/, "איילון"],
        [/כלל/, "כלל"]
      ];
      for(let i = 0; i < rules.length; i++){
        if(rules[i][0].test(compact)) return rules[i][1];
      }
      return compact;
    },
    policyBlob(policy){
      const extras = [];
      (Array.isArray(policy?.sourceTypes) ? policy.sourceTypes : []).forEach((x) => extras.push(x));
      (Array.isArray(policy?.includedProducts) ? policy.includedProducts : []).forEach((x) => extras.push(x));
      return [policy?.type, policy?.productName, policy?.planName, policy?.label, policy?.cover, policy?.product]
        .concat(extras)
        .map(safeTrim)
        .filter(Boolean)
        .join(" ");
    },
    productFamily(policy){
      const t = safeTrim(policy?.type);
      const blob = this.policyBlob(policy);
      if(t === "ריסק משכנתא" || /משכנתא/.test(blob)) return "mortgage";
      if(t === "מחלות קשות" || t === "סרטן" || /מחלות\s*קשות/.test(blob) || /סרטן/.test(blob) || /מרפא/.test(blob)) return "ci";
      if(t === "בריאות" || (/בריאות/.test(blob) && !/ריסק/.test(blob))) return "health";
      if(t === "ריסק" || /ריסק/.test(blob) || /ביטוח\s*חיים/.test(blob) || /אובדן\s*כושר/.test(blob)) return "life";
      return "other";
    },
    productLabel(policy){
      const t = safeTrim(policy?.type);
      if(t) return t;
      const family = this.productFamily(policy);
      if(family === "mortgage") return "ריסק משכנתא";
      if(family === "ci") return "מחלות קשות";
      if(family === "health") return "בריאות";
      if(family === "life") return "ריסק";
      return "פוליסה";
    },
    isCoupleRiskPolicy(policy){
      if(this.canonicalCompany(policy?.company) !== "כלל") return false;
      if(this.productFamily(policy) !== "life") return false;
      const blob = this.policyBlob(policy);
      return safeTrim(policy?.insuredMode) === "couple" || /זוגי|כפול למשפחה|כלל כפול/.test(blob);
    },
    pickTemplateId(policy){
      const company = this.canonicalCompany(policy?.company);
      const family = this.productFamily(policy);
      if(company === "הראל") return (family === "life" || family === "mortgage") ? "harel_life" : "harel_health";
      if(company === "איילון") return (family === "life" || family === "mortgage") ? "ayalon_life" : "ayalon";
      if(company === "כלל") return this.isCoupleRiskPolicy(policy) ? "clal_couple" : "clal";
      if(company === "הפניקס") return family === "health" ? "phoenix_health" : "phoenix";
      if(company === "הכשרה") return "hachshara";
      if(company === "מגדל") return "migdal";
      if(company === "מנורה") return family === "mortgage" ? "menora_mortgage" : "menora";
      return "";
    },
    hasTemplateForPolicy(policy){
      return !!this.pickTemplateId(policy);
    },
    formatDocName(policy, cancel){
      const company = this.canonicalCompany(policy?.company) || "חברה";
      const product = this.productLabel(policy);
      const kind = this.cancelStatusLabel(cancel?.status);
      const num = safeTrim(policy?.policyNumber);
      return "טופס ביטול מקורי — " + product + " · " + company + " · " + kind + (num ? (" · " + num) : "");
    },
    docIdFor(insuredId, policyId){
      return "doc_cancel_" + safeTrim(insuredId || "ins") + "_" + safeTrim(policyId || "pol");
    },
    listCancelledPolicies(payload){
      const out = [];
      const insureds = Array.isArray(payload?.insureds) ? payload.insureds : [];
      insureds.forEach((ins) => {
        const d = (ins && ins.data && typeof ins.data === "object") ? ins.data : {};
        const policies = Array.isArray(d.existingPolicies) ? d.existingPolicies : [];
        const cancellations = (d.cancellations && typeof d.cancellations === "object") ? d.cancellations : {};
        policies.forEach((policy) => {
          if(!policy || typeof policy !== "object") return;
          const cancel = cancellations[policy.id] || {};
          if(!this.isCancelStatus(cancel.status)) return;
          if(!this.hasTemplateForPolicy(policy)) return;
          out.push({
            insured: ins,
            insuredId: safeTrim(ins?.id),
            policy,
            policyId: safeTrim(policy.id),
            policyNumber: safeTrim(policy.policyNumber),
            cancel,
            status: safeTrim(cancel.status),
            company: this.canonicalCompany(policy.company),
            productFamily: this.productFamily(policy),
            productLabel: this.productLabel(policy),
            templateId: this.pickTemplateId(policy)
          });
        });
      });
      return out;
    },
    createDoc(entry, options){
      const policy = entry?.policy || {};
      const cancel = entry?.cancel || {};
      const uploadedAt = safeTrim(options?.uploadedAt) || nowISO();
      return {
        id: this.docIdFor(entry?.insuredId, entry?.policyId),
        type: this.DOC_TYPE,
        templateId: safeTrim(entry?.templateId) || this.pickTemplateId(policy),
        name: this.formatDocName(policy, cancel),
        company: this.canonicalCompany(policy.company),
        productFamily: this.productFamily(policy),
        productLabel: this.productLabel(policy),
        policyId: safeTrim(entry?.policyId || policy.id),
        insuredId: safeTrim(entry?.insuredId),
        policyNumber: safeTrim(entry?.policyNumber || policy.policyNumber),
        cancelStatus: safeTrim(cancel.status),
        isLegacy: true,
        source: "מערכת",
        uploadedAt,
        uploadedBy: safeTrim(options?.uploadedBy)
      };
    },

    findEntry(rec, doc){
      const payload = rec?.payload && typeof rec.payload === "object" ? rec.payload : rec;
      const list = this.listCancelledPolicies(payload);
      const docId = safeTrim(doc?.id);
      const policyId = safeTrim(doc?.policyId);
      const insuredId = safeTrim(doc?.insuredId);
      return list.find((row) => {
        if(docId && this.docIdFor(row.insuredId, row.policyId) === docId) return true;
        return row.policyId === policyId && (!insuredId || row.insuredId === insuredId);
      }) || list[0] || null;
    },
    buildDraft(rec, doc){
      const payload = rec?.payload && typeof rec.payload === "object" ? rec.payload : {};
      const entry = this.findEntry(rec, doc) || {};
      const policy = entry.policy || {};
      const cancel = entry.cancel || {};
      const templateId = safeTrim(doc?.templateId) || safeTrim(entry.templateId) || this.pickTemplateId(policy);
      const template = TEMPLATES[templateId] || null;
      const policyNumber = safeTrim(doc?.policyNumber) || safeTrim(entry.policyNumber) || safeTrim(policy.policyNumber);
      return {
        rec,
        doc,
        payload,
        entry,
        policy,
        cancel,
        templateId,
        template,
        policyNumber,
        company: this.canonicalCompany(policy.company) || safeTrim(doc?.company),
        productLabel: this.productLabel(policy) || safeTrim(doc?.productLabel),
        status: safeTrim(cancel.status) || safeTrim(doc?.cancelStatus),
        statusLabel: this.cancelStatusLabel(cancel.status || doc?.cancelStatus),
        isPartial: this.isPartialStatus(cancel.status || doc?.cancelStatus)
      };
    },
    overlayPlan(draft){
      const template = draft?.template;
      const num = safeTrim(draft?.policyNumber);
      if(!template || !num) return [];
      const slot = draft.isPartial ? (template.overlay.partial || template.overlay.full) : template.overlay.full;
      if(!slot) return [];
      return [{ page: 0, x: slot.x, y: slot.y, text: num, size: 10 }];
    },

    detectDeployBase(){
      try {
        const path = String(global.location?.pathname || "");
        if(path.indexOf("/gemel-invest/") === 0) return "/gemel-invest/";
      } catch(_e) {}
      return "./";
    },
    candidateUrls(folder, file){
      const q = "?v=" + encodeURIComponent(this.VERSION);
      const base = this.detectDeployBase();
      const out = [];
      const push = (href) => {
        try {
          const url = new URL(href, global.location.href).href;
          if(out.indexOf(url) < 0) out.push(url);
        } catch(_e) {}
      };
      push(base + folder + file + q);
      push(this.TEMPLATE_BASE + file + q);
      push("./" + folder + file + q);
      push("/gemel-invest/" + folder + file + q);
      return out;
    },
    async fetchFirstOk(urls, label){
      let last = "";
      for(let i = 0; i < urls.length; i++){
        try {
          const res = await fetch(urls[i], { cache: "reload" });
          if(res && res.ok) return await res.arrayBuffer();
          last = String(res?.status || "");
        } catch(err){ last = String(err?.message || err); }
      }
      throw new Error(label + (last ? " (" + last + ")" : ""));
    },
    async fillOriginalTemplate(draft){
      if(global.GI_LOAD_LIBS?.pdfLib) await global.GI_LOAD_LIBS.pdfLib();
      const PDFLib = global.PDFLib;
      if(!PDFLib?.PDFDocument) throw new Error("PDFLib missing");
      const template = draft?.template;
      if(!template?.file) throw new Error("לא נמצא טופס ביטול לחברה זו");
      const templateBytes = await this.fetchFirstOk(
        this.candidateUrls("forms/cancel/", template.file),
        "לא נמצא טופס הביטול המקורי"
      );
      const pdfDoc = await PDFLib.PDFDocument.load(templateBytes, { ignoreEncryption: true });
      let font = null;
      try {
        const fontBytes = await this.fetchFirstOk(
          this.candidateUrls("fonts/", "Heebo-Bold.ttf"),
          "font"
        );
        if(fontBytes){
          if(global.fontkit) pdfDoc.registerFontkit(global.fontkit);
          font = await pdfDoc.embedFont(fontBytes);
        }
      } catch(_e) {}
      const helper = global.GI_OFFICIAL_FORM_FILL;
      const rgb = PDFLib.rgb ? PDFLib.rgb(0.08, 0.12, 0.22) : undefined;
      const pages = pdfDoc.getPages();
      this.overlayPlan(draft).forEach((op) => {
        const page = pages[op.page];
        if(!page) return;
        const raw = safeTrim(op.text);
        if(!raw) return;
        const painted = helper?.visualHebrew ? helper.visualHebrew(raw) : raw;
        try {
          page.drawText(painted, {
            x: op.x,
            y: op.y,
            size: op.size || 10,
            font: font || undefined,
            color: rgb
          });
        } catch(_e) {}
      });
      return pdfDoc.save();
    },
    downloadBytes(bytes, filename){
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    },
    fileName(draft){
      const company = safeTrim(draft?.company) || "חברה";
      const product = safeTrim(draft?.productLabel) || "פוליסה";
      const num = safeTrim(draft?.policyNumber) || "ללא-מספר";
      return ("ביטול_" + company + "_" + product + "_" + num)
        .replace(/[\\/:*?"<>|]/g, "_")
        + ".pdf";
    },
    renderPreviewHtml(draft){
      return `<div class="giCancelFormPreview">
        <div class="giCancelFormPreview__row"><span>חברה / מוצר</span><strong>${escapeHtml((draft.company || "—") + " · " + (draft.productLabel || "—"))}</strong></div>
        <div class="giCancelFormPreview__row"><span>סוג ביטול</span><strong>${escapeHtml(draft.statusLabel || "—")}</strong></div>
        <div class="giCancelFormPreview__row"><span>מספר פוליסה</span><strong dir="ltr">${escapeHtml(draft.policyNumber || "—")}</strong></div>
        <button class="btn btn--primary" type="button" data-cancel-form-open="1">פתח טופס ביטול</button>
      </div>`;
    },
    ensureStyles(){
      if(document.getElementById("giCancelFormStyle")) return;
      const style = document.createElement("style");
      style.id = "giCancelFormStyle";
      style.textContent = `
        .giCancelFormModal .giValModal__card{ max-width:min(640px,96vw); width:100%; }
        .giCancelFormPreview{ padding:12px 4px; display:flex; flex-direction:column; gap:10px; }
        .giCancelFormPreview__row{ display:flex; justify-content:space-between; gap:12px; font-size:13.5px; }
        .giCancelFormPreview__row span{ color:#647287; }
        .giCancelFormPreview__row strong{ color:#0F172A; font-weight:750; }
        .giCancelForm__hint{ font-size:13px; line-height:1.45; color:#475569; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:12px; padding:10px 12px; }
      `;
      document.head.appendChild(style);
    },
    close(){
      const modal = this._modal;
      this._modal = null;
      this._draft = null;
      if(modal && modal.parentNode) modal.parentNode.removeChild(modal);
    },
    bind(modal){
      modal.querySelectorAll("[data-cancel-form-close]").forEach((el) => {
        el.addEventListener("click", () => this.close());
      });
      const dl = modal.querySelector("[data-cancel-form-download]");
      if(dl){
        dl.addEventListener("click", async () => {
          const original = dl.textContent;
          dl.disabled = true;
          dl.textContent = "מפיק PDF…";
          try {
            const bytes = await this.fillOriginalTemplate(this._draft);
            this.downloadBytes(bytes, this.fileName(this._draft));
            try { global.showToast?.({ title: "הטופס הורד", text: "טופס הביטול המקורי הורד עם מספר הפוליסה.", variant: "success", durationMs: 5200 }); } catch(_e) {}
          } catch(err){
            try { console.error("CANCEL_FORM_PDF_FAILED", err); } catch(_e) {}
            try { global.showToast?.({ title: "שגיאה בהפקת PDF", text: safeTrim(err?.message) || "לא ניתן למלא את טופס הביטול", variant: "warn", durationMs: 6200 }); } catch(_e2) {}
          } finally {
            dl.disabled = false;
            dl.textContent = original;
          }
        });
      }
    },
    open(rec, doc){
      this.ensureStyles();
      this.close();
      const draft = this.buildDraft(rec, doc);
      this._draft = draft;
      const modal = document.createElement("div");
      modal.className = "giValModal giCancelFormModal is-open giValModal--visible";
      modal.innerHTML = `
        <div class="giValModal__backdrop" data-cancel-form-close="1"></div>
        <div class="giValModal__card">
          <div class="giValModal__head">
            <div class="giValModal__headText">
              <div class="giValModal__title">${escapeHtml(draft.doc?.name || "טופס ביטול מקורי")}</div>
              <div class="giValModal__sub">הטופס המקורי של החברה · מספר הפוליסה כבר ממולא</div>
            </div>
            <button class="btn btn--ghost" type="button" data-cancel-form-close="1">סגור</button>
          </div>
          <div class="giValModal__body">
            <div class="giCancelForm__hint">שלב ראשון: ממלאים רק את מספר הפוליסה על טופס הביטול המקורי של החברה.</div>
            ${this.renderPreviewHtml(draft)}
          </div>
          <div class="giValModal__foot">
            <button class="btn btn--ghost" type="button" data-cancel-form-close="1">סגור</button>
            <button class="btn btn--primary" type="button" data-cancel-form-download="1">הורד PDF</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      this._modal = modal;
      this.bind(modal);
    }
  };

  try { global.GiCancelForms = GiCancelForms; } catch(_e) {}
  try { global.window.GiCancelForms = GiCancelForms; } catch(_e) {}
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));
