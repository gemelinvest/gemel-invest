/* GEMEL INVEST — טופס מקורי חיים ומחלות קשות · הפניקס (300101240)
   נפתח כשנרכשו יחד ריסק ומחלות קשות. ממלא פרטים, כיסויים, סכום ריסק,
   סכום מחלות קשות, והצהרת הבריאות המקוצרת. */
(function installPhoenixLifeCiForm(global){
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

  const DECL_ROWS = [
    { y: 524, keys: ["phoenix_critical_illness__ci_tests", "phoenix_risk_u55_under2m__s3_tests", "phoenix_full__tests"] },
    { y: 470, keys: ["phoenix_critical_illness__ci_heart", "phoenix_risk_u55_under2m__s5_1_heart", "phoenix_full__heart"] },
    { y: 448, keys: ["phoenix_critical_illness__ci_neuro", "phoenix_risk_u55_under2m__s5_2_neuro", "phoenix_full__neuro"] },
    { y: 424, keys: ["phoenix_critical_illness__ci_cancer", "phoenix_risk_u55_under2m__s5_3_cancer", "phoenix_full__cancer"] },
    { y: 401, keys: ["phoenix_critical_illness__ci_kidney", "phoenix_full__kidneys"] },
    { y: 382, keys: ["phoenix_critical_illness__ci_digestive", "phoenix_full__digestive"] },
    { y: 362, keys: ["phoenix_critical_illness__ci_lungs", "phoenix_risk_u55_under2m__s5_6_lungs", "phoenix_full__respiratory"] },
    { y: 342, keys: ["phoenix_critical_illness__ci_diabetes", "phoenix_full__endocrine"] },
    { y: 320, keys: ["phoenix_critical_illness__ci_ortho", "phoenix_risk_u55_under2m__s7_ortho", "phoenix_full__musculoskeletal"] },
    { y: 296, keys: ["phoenix_critical_illness__ci_mental", "phoenix_full__mental"] },
    { y: 272, keys: ["phoenix_critical_illness__ci_senses", "phoenix_full__eyes"] },
    { y: 230, keys: ["phoenix_critical_illness__ci_family", "phoenix_full__family"] }
  ];
  const SMOKE_KEYS = ["phoenix_critical_illness__ci_smoking", "phoenix_risk_u55_under2m__s4_smoking", "phoenix_full__smoking"];

  const PhoenixLifeCiForm = {
    TEMPLATE_BASE: "./forms/phoenix-life-ci/",
    TEMPLATE_FILE: "phoenix-life-ci-join.pdf",
    FONT_URL: "./fonts/Heebo-Bold.ttf",
    VERSION: "20260930-benef-risk-open-v1",
    DOC_ID: "doc_phoenix_life_ci_form",
    DOC_TYPE: "phoenix_life_ci_form",
    DECL_ROWS,
    SMOKE_KEYS,

    fmtDateHe(value){
      const health = global.PhoenixHealthForm;
      if(health && health.fmtDateHe) return health.fmtDateHe(value);
      const s = safeTrim(value);
      const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if(iso) return iso[3] + "/" + iso[2] + "/" + iso[1];
      return s;
    },
    fmtTodayHe(){
      const d = new Date();
      return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear();
    },
    fmtMoneyPlain(value){
      const n = Number(String(value == null ? "" : value).replace(/[^\d.]/g, ""));
      if(!Number.isFinite(n) || n <= 0) return "";
      try { return Math.round(n).toLocaleString("he-IL"); } catch(_e){ return String(Math.round(n)); }
    },
    isRiskPolicy(policy){
      const docs = global.CustomerDocuments;
      if(docs && docs.isPhoenixRiskMortgagePolicy && docs.isPhoenixRiskMortgagePolicy(policy)){
        const blob = [policy?.type, policy?.productName, policy?.planName, policy?.label].map(safeTrim).join(" ");
        return !/משכנתא/.test(blob);
      }
      if(!policy || safeTrim(policy.company) !== "הפניקס") return false;
      const blob = [policy.type, policy.productName, policy.planName, policy.label].map(safeTrim).join(" ");
      if(/משכנתא/.test(blob)) return false;
      return /ריסק|ביטוח\s*חיים/.test(blob) && !/מחלות\s*קשות|סרטן/.test(blob);
    },
    isCiPolicy(policy){
      const docs = global.CustomerDocuments;
      if(docs && docs.isPhoenixCiPolicy) return !!docs.isPhoenixCiPolicy(policy);
      if(!policy || safeTrim(policy.company) !== "הפניקס") return false;
      const t = safeTrim(policy.type);
      return t === "מחלות קשות" || t === "סרטן";
    },
    listPolicies(payload){
      return Array.isArray(payload?.newPolicies) ? payload.newPolicies : [];
    },
    qualifies(payload){
      const list = this.listPolicies(payload);
      return list.some((p) => this.isRiskPolicy(p)) && list.some((p) => this.isCiPolicy(p));
    },
    sumFor(policy, insured){
      const id = safeTrim(insured && insured.id);
      const maps = [policy && policy.sumInsuredPerInsured, policy && policy.compensationPerInsured];
      for(let i = 0; i < maps.length; i++){
        const map = maps[i];
        if(id && map && safeTrim(map[id])) return this.fmtMoneyPlain(map[id]);
      }
      return this.fmtMoneyPlain(policy && (policy.sumInsured || policy.compensation || policy.coverageAmount));
    },
    ciAmount(policy, kind){
      const amounts = policy && policy.healthCoversAmounts && typeof policy.healthCoversAmounts === "object"
        ? policy.healthCoversAmounts : {};
      const withAmounts = policy && policy.healthCoversWithAmounts && typeof policy.healthCoversWithAmounts === "object"
        ? policy.healthCoversWithAmounts : {};
      if(kind === "cancer"){
        return this.fmtMoneyPlain(policy && policy.phoenixCancerAmount)
          || this.fmtMoneyPlain(amounts.phoenixCancerAmount)
          || this.fmtMoneyPlain(withAmounts["מרפא סרטן"] || withAmounts["סרטן"] || policy && policy.compensation);
      }
      return this.fmtMoneyPlain(policy && policy.phoenixCriticalAmount)
        || this.fmtMoneyPlain(amounts.phoenixCriticalAmount)
        || this.fmtMoneyPlain(withAmounts["מרפא"] || withAmounts["מחלות קשות"] || policy && policy.compensation);
    },

    buildDraft(rec){
      const health = global.PhoenixHealthForm;
      const payload = rec?.payload && typeof rec.payload === "object" ? rec.payload : (rec || {});
      if(health && health.buildDraft){
        const draft = health.buildDraft(rec && rec.payload ? rec : { payload });
        draft.mode = "life-ci";
        const policies = this.listPolicies(payload);
        const risks = policies.filter((p) => this.isRiskPolicy(p));
        const cis = policies.filter((p) => this.isCiPolicy(p));
        const { primary, spouse } = health.classifyInsureds(payload);
        if(draft.primary){
          const risk = risks.find((p) => health.policyCoversPerson(p, primary)) || risks[0];
          if(risk) draft.primary.sumInsured = this.sumFor(risk, primary);
          cis.forEach((p) => {
            if(!health.policyCoversPerson(p, primary)) return;
            if(!draft.primary.criticalAmount) draft.primary.criticalAmount = this.ciAmount(p, "critical");
            if(!draft.primary.cancerAmount) draft.primary.cancerAmount = this.ciAmount(p, "cancer");
          });
        }
        if(draft.spouse && spouse){
          const risk = risks.find((p) => health.policyCoversPerson(p, spouse)) || null;
          if(risk) draft.spouse.sumInsured = this.sumFor(risk, spouse);
        }
        draft.insuranceBegin = draft.insuranceBegin || this.fmtDateHe((risks[0] || cis[0] || {}).startDate || payload.insuranceStartDate);
        return draft;
      }
      return { today: this.fmtTodayHe(), primary: null, spouse: null, children: [], healthResponses: {} };
    },

    setTextSafe(form, fieldName, value, font){
      const helper = global.GI_OFFICIAL_FORM_FILL;
      if(helper && helper.setTextSafe){
        helper.setTextSafe(form, fieldName, value, font, { visual: false });
        return;
      }
      const health = global.PhoenixHealthForm;
      if(health && health.setTextSafe) health.setTextSafe(form, fieldName, value, font);
    },
    markExport(form, fieldName, exportValue){
      const helper = global.GI_OFFICIAL_FORM_FILL;
      if(helper && helper.setExport) helper.setExport(form, fieldName, exportValue);
    },
    answerOf(draft, keys, insId){
      const helper = global.GI_OFFICIAL_FORM_FILL;
      const responses = draft && draft.healthResponses;
      if(!helper || !responses || !insId) return "";
      for(let i = 0; i < keys.length; i++){
        const a = helper.healthAnswer ? helper.healthAnswer(responses, keys[i], insId) : "";
        if(a) return a;
        if(helper.healthAnswerOrSolo){
          const solo = helper.healthAnswerOrSolo(responses, keys[i], "");
          if(solo) return solo;
        }
      }
      return "";
    },
    widgetsOnDeclPage(pdfDoc, form){
      const PDFLib = global.PDFLib;
      const pages = pdfDoc.getPages();
      const page = pages[4];
      if(!page || !PDFLib) return [];
      const out = [];
      form.getFields().forEach((field) => {
        let widgets = [];
        try { widgets = field.acroField.getWidgets() || []; } catch(_e) { return; }
        widgets.forEach((widget) => {
          const pref = widget.P && widget.P();
          if(!pref || String(pref) !== String(page.ref)) return;
          const rect = widget.getRectangle ? widget.getRectangle() : null;
          if(!rect) return;
          out.push({ name: field.getName(), widget, rect, y: rect.y, x: rect.x });
        });
      });
      return out;
    },
    applyShortDeclaration(pdfDoc, form, draft){
      const people = [draft.primary, draft.spouse].concat(draft.children || []).slice(0, 6);
      const widgets = this.widgetsOnDeclPage(pdfDoc, form);
      const smoke = widgets.filter((w) => w.name.indexOf("IsSmoking") === 0);
      people.forEach((person, idx) => {
        if(!person) return;
        const answer = this.answerOf(draft, SMOKE_KEYS, person.id);
        const exportValue = answer === "yes" ? "True" : (answer === "no" ? "False" : "");
        if(!exportValue) return;
        const field = idx === 0 ? "IsSmoking" : (idx === 1 ? "IsSmokingBzug" : ("IsSmokingChild" + (idx - 1)));
        this.markExport(form, field, exportValue);
        smoke.filter((w) => w.name === field).forEach((w) => {
          /* helper already sets the matching widget */
        });
      });
      DECL_ROWS.forEach((row) => {
        const line = widgets.filter((w) => Math.abs(w.y - row.y) <= 4 && w.name.indexOf("Check") === 0);
        line.sort((a, b) => b.x - a.x);
        people.forEach((person, idx) => {
          if(!person) return;
          const answer = this.answerOf(draft, row.keys, person.id);
          if(answer !== "yes" && answer !== "no") return;
          const slot = answer === "yes" ? line[idx * 2] : line[idx * 2 + 1];
          if(slot) this.markExport(form, slot.name, "1");
        });
      });
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
      const health = global.PhoenixHealthForm;
      const templateBytes = await this.fetchFirstOk(
        this.candidateUrls("forms/phoenix-life-ci/", this.TEMPLATE_FILE),
        "לא נמצא טופס חיים ומחלות קשות של הפניקס"
      );
      const pdfDoc = await PDFLib.PDFDocument.load(templateBytes, { ignoreEncryption: true });
      let font = null;
      try {
        const fontBytes = await this.fetchFirstOk(this.candidateUrls("fonts/", "Heebo-Bold.ttf"), "font");
        if(fontBytes){
          if(global.fontkit) pdfDoc.registerFontkit(global.fontkit);
          font = await pdfDoc.embedFont(fontBytes);
        }
      } catch(_e) {}
      const form = pdfDoc.getForm();
      if(health && health.applyPerson){
        health.applyPerson(form, draft.primary, "primary", font);
        health.applyPerson(form, draft.spouse, "spouse", font);
        (draft.children || []).forEach((child, idx) => health.applyPerson(form, child, "child" + (idx + 1), font));
        if(health.applyPayerZone) health.applyPayerZone(form, draft, font);
      }
      this.setTextSafe(form, "Date", draft.today, font);
      this.setTextSafe(form, "InsuranceBegin", draft.insuranceBegin, font);
      this.setTextSafe(form, "AgentName", draft.agentName, font);
      this.setTextSafe(form, "AgentNumber", draft.agentNumber, font);
      if(draft.primary) this.setTextSafe(form, "GiluiTotalRisk", draft.primary.sumInsured, font);
      if(draft.spouse) this.setTextSafe(form, "GiluiTotalRiskSpouse", draft.spouse.sumInsured, font);
      global.GI_OFFICIAL_FORM_FILL?.applyMappedHealthYesNo?.(form, {
        map: "phoenix_health",
        responses: draft.healthResponses,
        primaryId: draft.primaryId || (draft.primary && draft.primary.id) || "",
        spouseId: draft.spouseId || (draft.spouse && draft.spouse.id) || "",
        childIds: draft.childIds || (draft.children || []).map((c) => c.id).filter(Boolean)
      });
      this.applyShortDeclaration(pdfDoc, form, draft);
      const helper = global.GI_OFFICIAL_FORM_FILL;
      if(helper && helper.applyStoredPayment){
        helper.applyStoredPayment(form, {
          method: draft.payment?.method || "",
          bank: draft.bank || {},
          cc: draft.payment?.cc || {}
        }, font, { textOpts: { visual: false }, bankNameCode: "BankNameCode", bankBranchCode: "BankBranchCode" });
      }
      const marks = health && health.collectCheckedMarks ? health.collectCheckedMarks(pdfDoc, form) : [];
      if(font && form.updateFieldAppearances){
        try { form.updateFieldAppearances(font); } catch(_e) {}
      }
      if(health && health.drawCheckedMarks) health.drawCheckedMarks(marks);
      return pdfDoc.save({ updateFieldAppearances: false });
    },

    renderPreviewHtml(draft){
      const name = safeTrim(draft?.primary?.fullName) || "—";
      const sum = safeTrim(draft?.primary?.sumInsured) || "—";
      const ci = safeTrim(draft?.primary?.criticalAmount || draft?.primary?.cancerAmount) || "—";
      return `<div class="phxHealthFormPreview">
        <div class="phxHealthFormPreview__row"><span>חברה / מוצר</span><strong>הפניקס · ריסק ומחלות קשות</strong></div>
        <div class="phxHealthFormPreview__row"><span>מבוטח ראשי</span><strong>${escapeHtml(name)}</strong></div>
        <div class="phxHealthFormPreview__row"><span>סכום ריסק</span><strong>${escapeHtml(sum)}</strong></div>
        <div class="phxHealthFormPreview__row"><span>סכום מחלות קשות / סרטן</span><strong>${escapeHtml(ci)}</strong></div>
      </div>`;
    },
    fileName(draft){
      const name = safeTrim(draft?.primary?.fullName) || "לקוח";
      return "חיים_ומחלות_הפניקס_" + name.replace(/[\\/:*?\"<>|]/g, "_") + "_" + nowISO().slice(0, 10) + ".pdf";
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
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    },
    async open(rec){
      if(global.CustomerFileUI?.denyOfficialJoinFormDownload?.()) return;
      const draft = this.buildDraft(rec);
      const bytes = await this.fillOriginalTemplate(draft);
      this.downloadBytes(bytes, this.fileName(draft));
    }
  };

  try { global.PhoenixLifeCiForm = PhoenixLifeCiForm; } catch(_e) {}
})(typeof window !== "undefined" ? window : globalThis);
