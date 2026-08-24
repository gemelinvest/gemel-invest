/* GEMEL INVEST — טופס מקורי ריסק משכנתא · הכשרה (3453, 12.2025)
   נטען לפי דרישה ממסמכי לקוח. ממלא רק ערכים שכבר שמורים בתיק.
   עברית לוגית (לא הפוכה). */
(function installHachsharaMortgageForm(global){
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

  const HachsharaMortgageForm = {
    TEMPLATE_BASE: "./forms/hachshara-mortgage/",
    TEMPLATE_FILE: "hachshara-mortgage-join.pdf",
    FONT_URL: "./fonts/Heebo-Bold.ttf",
    VERSION: "20260824-hach-mort-v1",
    DOC_ID: "doc_hachshara_mortgage_form",
    DOC_TYPE: "hachshara_mortgage_form",

    fmtDateHe(value){
      const s = safeTrim(value);
      if(!s) return "";
      const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if(iso) return iso[3] + "/" + iso[2] + "/" + iso[1];
      const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if(dmy) return String(dmy[1]).padStart(2, "0") + "/" + String(dmy[2]).padStart(2, "0") + "/" + dmy[3];
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
    composeAddress(person){
      if(!person) return "";
      const parts = [person.street, person.houseNumber, person.apt, person.city, person.zip]
        .map(safeTrim).filter(Boolean);
      return parts.join(" ");
    },
    policyBlob(policy){
      return [policy?.type, policy?.productName, policy?.planName, policy?.label, policy?.cover, policy?.product]
        .map(safeTrim).join(" ");
    },
    isHachsharaMortgagePolicy(policy){
      if(!policy || typeof policy !== "object") return false;
      if(safeTrim(policy.company) !== "הכשרה") return false;
      const blob = this.policyBlob(policy);
      if(/מחלות\s*קשות/.test(blob) && !/משכנתא/.test(blob)) return false;
      if(/בריאות/.test(blob) && !/משכנתא/.test(blob)) return false;
      if((/ריסק/.test(blob) || /ביטוח\s*חיים/.test(blob)) && !/משכנתא/.test(blob)) return false;
      return /משכנתא/.test(blob) || safeTrim(policy.type) === "ריסק משכנתא";
    },
    listHachsharaMortgagePolicies(payload){
      const list = Array.isArray(payload?.newPolicies) ? payload.newPolicies : [];
      return list.filter((p) => this.isHachsharaMortgagePolicy(p));
    },
    qualifies(payload){
      return this.listHachsharaMortgagePolicies(payload).length > 0;
    },
    listPledgeBanks(policy){
      if(!policy || typeof policy !== "object") return [];
      if(Array.isArray(policy.pledgeBanks) && policy.pledgeBanks.length){
        return policy.pledgeBanks.filter((b) => b && typeof b === "object");
      }
      if(policy.pledgeBank && typeof policy.pledgeBank === "object") return [policy.pledgeBank];
      return [];
    },
    mortgageAmountMode(payload){
      const docs = global.CustomerDocuments;
      if(docs && typeof docs.hachsharaMortgageAmountMode === "function"){
        return docs.hachsharaMortgageAmountMode(payload);
      }
      const primary = payload?.primary && typeof payload.primary === "object" ? payload.primary : {};
      const fromPrimary = primary.healthDeclaration && typeof primary.healthDeclaration === "object"
        ? primary.healthDeclaration : {};
      const ins0 = Array.isArray(payload?.insureds) ? payload.insureds[0] : null;
      const fromIns = ins0?.data?.healthDeclaration && typeof ins0.data.healthDeclaration === "object"
        ? ins0.data.healthDeclaration : {};
      return safeTrim(fromPrimary.hachsharaMortgageAmountMode || fromIns.hachsharaMortgageAmountMode);
    },
    mortgageHealthMap(payload, policy){
      const docs = global.CustomerDocuments;
      if(docs && typeof docs.hachsharaMortgageIsShort === "function"){
        return docs.hachsharaMortgageIsShort(policy, payload) ? "life_short" : "mortgage_full";
      }
      const mode = this.mortgageAmountMode(payload);
      if(mode === "full") return "mortgage_full";
      if(mode === "short") return "life_short";
      return "life_short";
    },
    collectionMethodFor(payload, primaryData){
      const method = safeTrim(primaryData?.paymentMethod || payload?.paymentMethod);
      if(method === "ho") return "Hok";
      if(method === "cc") return "Credit";
      return "";
    },

    personFromInsured(ins, fallbacks){
      const picked = global.GI_OFFICIAL_FORM_FILL?.pickPerson?.(ins, fallbacks);
      const d = picked || ((ins && ins.data && typeof ins.data === "object") ? ins.data : (ins || {}));
      const firstName = safeTrim(d.firstName);
      const lastName = safeTrim(d.lastName);
      const fullName = safeTrim(d.fullName) || safeTrim((firstName + " " + lastName).trim()) || safeTrim(ins?.label);
      return {
        id: safeTrim(ins?.id),
        firstName, lastName, fullName,
        idNumber: safeTrim(d.idNumber),
        birthDate: this.fmtDateHe(d.birthDate),
        gender: safeTrim(d.gender),
        maritalStatus: safeTrim(d.maritalStatus || d.familyStatus),
        phone: safeTrim(d.phone),
        phoneHome: safeTrim(d.phoneHome),
        childrenCount: safeTrim(d.childrenCount),
        email: safeTrim(d.email),
        city: safeTrim(d.city),
        street: safeTrim(d.street),
        houseNumber: safeTrim(d.houseNumber),
        apt: safeTrim(d.apartment || d.aptNumber),
        zip: safeTrim(d.zip),
        occupation: safeTrim(d.occupation),
        clinic: safeTrim(d.clinic || d.hmo || d.kupatHolim),
        heightCm: safeTrim(d.heightCm),
        weightKg: safeTrim(d.weightKg),
        smokingStatus: safeTrim(d.smokingStatus),
        smokingAmount: safeTrim(d.smokingAmount),
        sumInsured: ""
      };
    },
    sumInsuredFor(policy, insuredId){
      if(!policy) return "";
      const map = policy.sumInsuredPerInsured && typeof policy.sumInsuredPerInsured === "object"
        ? policy.sumInsuredPerInsured : {};
      const fromMap = safeTrim(map[insuredId]);
      if(fromMap) return this.fmtMoneyPlain(fromMap);
      const compMap = policy.compensationPerInsured && typeof policy.compensationPerInsured === "object"
        ? policy.compensationPerInsured : {};
      const fromComp = safeTrim(compMap[insuredId]);
      if(fromComp) return this.fmtMoneyPlain(fromComp);
      return this.fmtMoneyPlain(policy.sumInsured || policy.compensation || policy.coverageAmount);
    },
    classifyInsureds(payload){
      const raw = Array.isArray(payload?.insureds) ? payload.insureds.slice() : [];
      if(!raw.length && payload?.primary && typeof payload.primary === "object"){
        raw.push({ type: "primary", label: "מבוטח ראשי", data: payload.primary });
      }
      const primary = raw.find((x) => safeTrim(x?.type) === "primary") || raw[0] || null;
      const spouse = raw.find((x) => {
        const t = safeTrim(x?.type);
        return t === "spouse" || t === "secondary";
      }) || raw.find((x, idx) => {
        if(!x || x === primary) return false;
        const t = safeTrim(x.type);
        return t !== "child" && idx > 0;
      }) || null;
      return { primary, spouse };
    },
    loansFromPolicy(policy){
      const banks = this.listPledgeBanks(policy).slice(0, 4);
      const fallbackSum = this.sumInsuredFor(policy);
      return banks.map((bank, idx) => ({
        amount: this.fmtMoneyPlain(bank.amount) || (idx === 0 ? fallbackSum : ""),
        years: safeTrim(bank.years),
        interest: safeTrim(bank.interestType || bank.interest || bank.interestRate),
        terminationDate: this.fmtDateHe(bank.terminationDate || bank.endDate || bank.loanEndDate)
      })).filter((loan) => loan.amount || loan.years || loan.interest || loan.terminationDate);
    },
    purchaseTypeOf(policy, payload){
      const src = policy && typeof policy === "object" ? policy : {};
      const raw = safeTrim(src.mortgagePurchaseType || src.purchaseType || src.loanPurpose
        || payload?.mortgagePurchaseType || payload?.purchaseType);
      if(!raw) return "";
      if(/קרקע|land/i.test(raw)) return "land";
      if(/דירה|apartment|נכס/i.test(raw)) return "apartment";
      return "";
    },

    buildDraft(rec){
      const payload = rec?.payload && typeof rec.payload === "object" ? rec.payload : {};
      const policies = this.listHachsharaMortgagePolicies(payload);
      const policy = policies[0] || {};
      const { primary, spouse } = this.classifyInsureds(payload);
      const primaryPerson = this.personFromInsured(primary || payload.primary || {}, global.GI_OFFICIAL_FORM_FILL?.fileFallbacks?.(rec, payload));
      const spousePerson = spouse ? this.personFromInsured(spouse) : null;
      primaryPerson.sumInsured = this.sumInsuredFor(policy, primary?.id);
      if(spousePerson) spousePerson.sumInsured = this.sumInsuredFor(policy, spouse?.id);
      const agentNumbers = payload.companyAgentNumbers || payload.operational?.companyAgentNumbers
        || payload.primary?.operationalAgentNumbers || {};
      const payerSrc = payload.primary || primary?.data || {};
      const external = payerSrc.externalPayer && typeof payerSrc.externalPayer === "object" ? payerSrc.externalPayer : {};
      const useExternal = safeTrim(payerSrc.payerChoice) === "external";
      const pay = global.GI_OFFICIAL_FORM_FILL?.pickPayment?.(payload, payerSrc) || { method: "", isHo: false, bank: { name: "", branch: "", account: "", bankNo: "" } };
      return {
        today: this.fmtTodayHe(),
        insuranceBegin: this.fmtDateHe(policy.startDate || payload.insuranceStartDate),
        collectionMethod: this.collectionMethodFor(payload, payerSrc),
        healthMap: this.mortgageHealthMap(payload, policy),
        payment: pay,
        agentName: safeTrim(global.Auth?.current?.name) || safeTrim(rec?.agentName),
        agentNumber: safeTrim(agentNumbers["הכשרה"]) || safeTrim(policy.agentNumber),
        primary: primaryPerson,
        spouse: spousePerson,
        loans: this.loansFromPolicy(policy),
        purchaseType: this.purchaseTypeOf(policy, payload),
        ...(global.GI_OFFICIAL_FORM_FILL?.attachDraftHealth?.(payload, primary, spouse) || {}),
        payer: {
          name: useExternal ? safeTrim((external.firstName + " " + external.lastName).trim()) : "",
          idNumber: useExternal ? safeTrim(external.idNumber) : "",
          relation: useExternal ? safeTrim(external.relation) : ""
        },
        bank: pay.bank
      };
    },

    mapGenderExport(genderRaw){
      const g = safeTrim(genderRaw).toLowerCase();
      if(g === "male" || g === "זכר" || g === "m") return "True";
      if(g === "female" || g === "נקבה" || g === "f") return "False";
      return "";
    },
    mapMaritalExport(statusRaw){
      const s = safeTrim(statusRaw);
      if(!s) return "";
      if(/רווק|רווקה|single/i.test(s)) return "Single";
      if(/נשוי|נשואה|married|ידוע/i.test(s)) return "Married";
      if(/גרוש|גרושה|divorced/i.test(s)) return "Divorced";
      if(/אלמן|אלמנה|widow/i.test(s)) return "Widow";
      return "";
    },
    mapSmokingExport(statusRaw){
      const s = safeTrim(statusRaw).toLowerCase();
      if(!s) return "";
      if(/^(yes|1|true|מעשן|כן)/.test(s)) return "True";
      if(/past|עבר|עישנתי|הפסק/.test(s)) return "Past";
      if(/^(no|0|false|לא|לא מעשן)/.test(s)) return "False";
      return "";
    },
    isMobilePhone(phone){
      return /^05\d{8}$/.test(String(phone || "").replace(/\D+/g, ""));
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
      push("/gemel-invest/" + folder + file + q);
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

    setTextSafe(form, fieldName, value, font){
      const helper = global.GI_OFFICIAL_FORM_FILL;
      if(helper && helper.setTextSafe){
        helper.setTextSafe(form, fieldName, value, font, { visual: false });
        return;
      }
      const text = safeTrim(value);
      if(!text) return;
      try {
        const field = form.getTextField(fieldName);
        field.setText(text);
        if(font && field.updateAppearances) field.updateAppearances(font);
      } catch(_e) {}
    },
    setExport(form, fieldName, exportValue){
      const helper = global.GI_OFFICIAL_FORM_FILL;
      if(helper && helper.setExport){
        helper.setExport(form, fieldName, exportValue);
        return;
      }
      if(!exportValue) return;
      try {
        const field = form.getField(fieldName);
        const PDFLib = global.PDFLib;
        const name = PDFLib?.PDFName?.of ? PDFLib.PDFName.of(String(exportValue)) : null;
        if(!field || !name) return;
        field.acroField.dict.set(PDFLib.PDFName.of("V"), name);
        field.acroField.dict.set(PDFLib.PDFName.of("AS"), name);
      } catch(_e) {}
    },

    applyPerson(form, person, suffix, font){
      if(!person) return;
      const s = suffix || "";
      const address = this.composeAddress(person);
      this.setTextSafe(form, "FirstName" + s, person.firstName, font);
      this.setTextSafe(form, "LastName" + s, person.lastName, font);
      this.setTextSafe(form, s ? ("FullName" + s) : "FullName", person.fullName, font);
      this.setTextSafe(form, "PID" + s, person.idNumber, font);
      this.setTextSafe(form, "BirthDate" + s, person.birthDate, font);
      this.setTextSafe(form, "EmailAddress" + s, person.email, font);
      this.setTextSafe(form, "City" + s, person.city, font);
      this.setTextSafe(form, "StreetName" + s, person.street, font);
      this.setTextSafe(form, "HouseNumber" + s, person.houseNumber, font);
      this.setTextSafe(form, "ZipCode" + s, person.zip, font);
      this.setTextSafe(form, "OccupationCode" + s, person.occupation, font);
      this.setTextSafe(form, s === "Spouse" ? "ProfessionSpouse" : "Profession", person.occupation, font);
      this.setTextSafe(form, s ? ("HMOName" + s) : "HMOName", person.clinic, font);
      this.setTextSafe(form, s ? ("HMO" + s) : "HMO", person.clinic, font);
      this.setTextSafe(form, "Hight" + s, person.heightCm, font);
      this.setTextSafe(form, "Weight" + s, person.weightKg, font);
      this.setTextSafe(form, s ? ("AptNumber" + s) : "AptNumber", person.apt, font);
      if(!s) this.setTextSafe(form, "Address", address, font);
      if(s === "Spouse") this.setTextSafe(form, "FullAddressSpouse", address, font);
      if(person.sumInsured){
        this.setTextSafe(form, s === "Spouse" ? "MaximumAmountText" : "MaximumAmount", person.sumInsured, font);
      }
      const phone = person.phone;
      if(phone){
        if(this.isMobilePhone(phone)) this.setTextSafe(form, "CellPhoneNumber" + s, phone, font);
        else this.setTextSafe(form, "PhoneNumber" + s, phone, font);
        if(this.isMobilePhone(phone) || !s) this.setTextSafe(form, "CellPhoneNumber" + s, phone, font);
      }
      this.setExport(form, "Gender" + s, this.mapGenderExport(person.gender));
      if(!s || s === "Spouse") this.setExport(form, "FamilyStatus" + s, this.mapMaritalExport(person.maritalStatus));
      const smokeField = !s ? "IsSmoking" : "IsSmokingBzug";
      this.setExport(form, smokeField, this.mapSmokingExport(person.smokingStatus));
      if(person.smokingAmount){
        this.setTextSafe(form, "ClientSmokeNum" + (s === "Spouse" ? "Spouse" : ""), person.smokingAmount, font);
      }
    },
    applyLoans(form, loans, font){
      (loans || []).slice(0, 4).forEach((loan, idx) => {
        const n = String(idx + 1);
        this.setTextSafe(form, "LoanSum" + n, loan.amount, font);
        this.setTextSafe(form, "LoanYears" + n, loan.years, font);
        this.setTextSafe(form, "LoanInterest" + n, loan.interest, font);
        this.setTextSafe(form, "LoanTerminationDate" + n, loan.terminationDate, font);
      });
    },
    applyPurchaseType(form, purchaseType){
      if(purchaseType === "apartment"){
        this.setExport(form, "ApartmentPurchase", "True");
      }else if(purchaseType === "land"){
        this.setExport(form, "LandPurchase", "True");
      }
    },
    payerPersonOf(draft){
      if(draft && draft.payer && draft.payer.name){
        return {
          fullName: draft.payer.name,
          idNumber: draft.payer.idNumber,
          firstName: "", lastName: "", city: "", street: "", houseNumber: "", zip: ""
        };
      }
      return draft && draft.primary;
    },
    applyDraftToForm(form, draft, font){
      const helper = global.GI_OFFICIAL_FORM_FILL;
      this.setTextSafe(form, "Date", draft.today, font);
      this.setTextSafe(form, "InsuranceBegin", draft.insuranceBegin, font);
      this.setTextSafe(form, "AgentName", draft.agentName, font);
      this.setTextSafe(form, "AgentNumber", draft.agentNumber, font);
      this.applyPerson(form, draft.primary, "", font);
      this.applyPerson(form, draft.spouse, "Spouse", font);
      this.applyLoans(form, draft.loans, font);
      this.applyPurchaseType(form, draft.purchaseType);
      helper?.applyInsuredPayerOwner?.(form, this.payerPersonOf(draft), font, {
        relation: draft.payer && draft.payer.relation
      });
      helper?.applyOfficialHealthAndNames?.(form, draft, font, {
        skipHealth: true,
        visual: false
      });
      helper?.applyMappedHealthYesNo?.(form, {
        map: draft.healthMap || "life_short",
        responses: draft.healthResponses,
        primaryId: draft.primaryId,
        spouseId: draft.spouseId
      });
      helper?.applyStoredPayment?.(form, {
        method: draft.payment?.method || "",
        bank: draft.bank || {},
        cc: draft.payment?.cc || {}
      }, font, {
        textOpts: { visual: false },
        hoMarks: [{ field: "CollectionMethod", value: "Hok" }],
        ccMarks: [{ field: "CollectionMethod", value: "Credit" }]
      });
      if(draft.collectionMethod){
        this.setExport(form, "CollectionMethod", draft.collectionMethod);
      }
    },
    async loadPdfDoc(){
      if(global.GI_LOAD_LIBS?.pdfLib) await global.GI_LOAD_LIBS.pdfLib();
      const PDFLib = global.PDFLib;
      if(!PDFLib?.PDFDocument) throw new Error("PDFLib missing");
      const templateBytes = await this.fetchFirstOk(
        this.candidateUrls("forms/hachshara-mortgage/", this.TEMPLATE_FILE),
        "לא נמצא טופס משכנתא של הכשרה"
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
      return { pdfDoc, form: pdfDoc.getForm(), font };
    },
    async fillOriginalTemplate(draft, editorValues){
      const { pdfDoc, form, font } = await this.loadPdfDoc();
      const helper = global.GI_OFFICIAL_FORM_FILL;
      if(editorValues && typeof editorValues === "object"){
        helper?.applyPdfValues?.(form, editorValues, font, { visual: false });
      } else {
        this.applyDraftToForm(form, draft, font);
      }
      if(font && form.updateFieldAppearances) form.updateFieldAppearances(font);
      return pdfDoc.save({ updateFieldAppearances: !!font });
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
      const name = safeTrim(draft?.primary?.fullName) || "לקוח";
      return "ריסק_משכנתא_הכשרה_" + name.replace(/[\\/:*?\"<>|]/g, "_") + "_" + nowISO().slice(0, 10) + ".pdf";
    },

    editorHint(){
      return "כל שדות הטופס הרשמי כאן, כולל הצהרת בריאות ותשלום. ממולא רק מה ששמור בתיק — אפשר להשלים שדות ריקים לפני ההורדה. פירוט רפואי (HealthDecQ), מוטבים, ביטול/החלפה וחתימות לא ממולאים ב-v1.";
    },
    ensureStyles(){
      global.GI_OFFICIAL_FORM_FILL?.ensurePdfEditorStyles?.();
    },
    renderPreviewHtml(draft){
      const people = [draft.primary, draft.spouse].filter(Boolean);
      const rows = people.map((p, idx) => {
        const role = idx === 0 ? "מבוטח ראשי" : "מועמד משני";
        return `<div class="hachMortFormPreview__row"><span>${escapeHtml(role)}</span><strong>${escapeHtml(p.fullName || "—")}</strong></div>`;
      }).join("");
      const loan = (draft.loans || [])[0] || {};
      const healthLabel = draft.healthMap === "mortgage_full" ? "בריאות מלאה" : "בריאות מקוצרת";
      return `<div class="hachMortFormPreview">
        <div class="hachMortFormPreview__row"><span>חברה / מוצר</span><strong>הכשרה · ריסק משכנתא</strong></div>
        <div class="hachMortFormPreview__row"><span>תחילת ביטוח</span><strong>${escapeHtml(draft.insuranceBegin || "—")}</strong></div>
        <div class="hachMortFormPreview__row"><span>הצהרת בריאות</span><strong>${escapeHtml(healthLabel)}</strong></div>
        <div class="hachMortFormPreview__row"><span>מסלול הלוואה 1</span><strong>${escapeHtml(loan.amount || "—")}${loan.years ? " · " + escapeHtml(loan.years) + " שנים" : ""}</strong></div>
        ${rows}
        ${global.CustomerDocuments?.canDownloadOfficialJoinForm?.() ? `<button class="btn btn--primary" type="button" data-hachmort-open="1">פתח טופס דיגיטלי</button>` : ""}
      </div>`;
    },

    close(){
      const modal = this._modal;
      this._modal = null;
      this._draft = null;
      if(modal && modal.parentNode) modal.parentNode.removeChild(modal);
    },
    bind(modal){
      modal.querySelectorAll("[data-hachmort-close]").forEach((el) => {
        el.addEventListener("click", () => this.close());
      });
      const dl = modal.querySelector("[data-hachmort-download]");
      if(dl){
        dl.addEventListener("click", async () => {
          const original = dl.textContent;
          dl.disabled = true;
          dl.textContent = "מפיק PDF…";
          try {
            const values = global.GI_OFFICIAL_FORM_FILL?.collectPdfFieldEditor?.(modal, "pdf-field") || {};
            const bytes = await this.fillOriginalTemplate(this._draft, values);
            this.downloadBytes(bytes, this.fileName(this._draft));
            try { global.showToast?.({ title: "הטופס הורד", text: "PDF מקורי של הכשרה — ממולא מהעורך.", variant: "success", durationMs: 5200 }); } catch(_e) {}
          } catch(err){
            try { console.error("HACHSHARA_MORTGAGE_PDF_FAILED", err); } catch(_e) {}
            try { global.showToast?.({ title: "שגיאה בהפקת PDF", text: safeTrim(err?.message) || "לא ניתן למלא את הטופס המקורי", variant: "warn", durationMs: 6200 }); } catch(_e2) {}
          } finally {
            dl.disabled = false;
            dl.textContent = original;
          }
        });
      }
    },
    async open(rec){
      if(global.CustomerFileUI?.denyOfficialJoinFormDownload?.()) return;
      this.ensureStyles();
      this.close();
      const draft = this.buildDraft(rec);
      this._draft = draft;
      const modal = document.createElement("div");
      modal.className = "giValModal hachMortFormModal giPdfEditorModal is-open giValModal--visible";
      modal.innerHTML = `
        <div class="giValModal__backdrop" data-hachmort-close="1"></div>
        <div class="giValModal__card">
          <div class="giValModal__head">
            <div class="giValModal__headText">
              <div class="giValModal__title">טופס מקורי — ריסק משכנתא · הכשרה</div>
              <div class="giValModal__sub">טוען את כל שדות הטופס הרשמי…</div>
            </div>
            <button type="button" class="giValModal__closeX" data-hachmort-close="1" aria-label="סגירה">✕</button>
          </div>
          <div class="giValModal__body"><div class="gi-pdf-ed-hint">טוען שדות הטופס…</div></div>
          <div class="giValModal__foot">
            <button type="button" class="btn" data-hachmort-close="1">סגור</button>
            <button type="button" class="btn btn--primary" data-hachmort-download="1" disabled>הורד PDF רשמי</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      this._modal = modal;
      this.bind(modal);
      try {
        const { form } = await this.loadPdfDoc();
        const helper = global.GI_OFFICIAL_FORM_FILL;
        const fields = helper?.listEditablePdfFields?.(form) || [];
        const capture = {};
        form.__giCapture = capture;
        this.applyDraftToForm(form, draft, null);
        delete form.__giCapture;
        const body = modal.querySelector(".giValModal__body");
        if(body){
          body.innerHTML = '<div class="gi-pdf-ed-hint">' + escapeHtml(this.editorHint()) + "</div>"
            + (helper?.renderPdfFieldEditor?.(fields, capture, "pdf-field") || "");
        }
        const sub = modal.querySelector(".giValModal__sub");
        if(sub) sub.textContent = "פרטים מהתיק כבר ממולאים. השלימו מה שחסר והורידו PDF רשמי.";
        const dl = modal.querySelector("[data-hachmort-download]");
        if(dl) dl.disabled = false;
      } catch(err){
        try { console.error("HACHSHARA_MORTGAGE_EDITOR_FAILED", err); } catch(_e) {}
        try { global.showToast?.({ title: "שגיאה בטעינת הטופס", text: safeTrim(err?.message) || "לא ניתן לפתוח את עורך הטופס", variant: "warn", durationMs: 6200 }); } catch(_e2) {}
        this.close();
      }
    }
  };

  global.HachsharaMortgageForm = HachsharaMortgageForm;
})(typeof window !== "undefined" ? window : globalThis);
