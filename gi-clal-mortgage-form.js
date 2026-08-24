/* GEMEL INVEST — טופס מקורי ריסק משכנתא כלל
   נטען לפי דרישה ממסמכי לקוח. ממלא רק ערכים שכבר שמורים בתיק. */
(function installClalMortgageForm(global){
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

  /* Page 3: מועמד ראשי = עמודת ימין (x גבוה), מועמד שני = שמאל.
     כן/לא הם CheckBox עם on=Yes — מסמנים את התיבה המתאימה בלבד. */
  const HEALTH_ROWS = [
    { keys: ["clal_risk_neuro"], primaryNo: "Check Box210", primaryYes: "Check Box209", spouseNo: "Check Box88", spouseYes: "Check Box89" },
    { keys: ["clal_risk_mental"], primaryNo: "Check Box116", primaryYes: "Check Box117", spouseNo: "Check Box87", spouseYes: "Check Box86" },
    { keys: ["clal_risk_respiratory"], primaryNo: "Check Box115", primaryYes: "Check Box114", spouseNo: "Check Box74", spouseYes: "Check Box85" },
    { keys: ["clal_risk_skin"], primaryNo: "Check Box111", primaryYes: "Check Box113", spouseNo: "Check Box73", spouseYes: "Check Box84" },
    { keys: ["clal_risk_heart"], primaryNo: "Check Box109", primaryYes: "Check Box110", spouseNo: "Check Box72", spouseYes: "Check Box83" },
    { keys: ["clal_risk_digestive"], primaryNo: "Check Box108", primaryYes: "Check Box107", spouseNo: "Check Box70", spouseYes: "Check Box82" },
    { keys: ["clal_risk_liver"], primaryNo: "Check Box105", primaryYes: "Check Box106", spouseNo: "Check Box81", spouseYes: "Check Box71" },
    { keys: ["clal_risk_kidney"], primaryNo: "Check Box104", primaryYes: "Check Box103", spouseNo: "Check Box69", spouseYes: "Check Box80" },
    { keys: ["clal_risk_metabolic"], primaryNo: "Check Box101", primaryYes: "Check Box102", spouseNo: "Check Box68", spouseYes: "Check Box79" },
    { keys: ["clal_risk_blood"], primaryNo: "Check Box100", primaryYes: "Check Box99", spouseNo: "Check Box25", spouseYes: "Check Box78" },
    { keys: ["clal_risk_infectious"], primaryNo: "Check Box97", primaryYes: "Check Box98", spouseNo: "Check Box26", spouseYes: "Check Box77" },
    { keys: ["clal_risk_tumors"], primaryNo: "Check Box95", primaryYes: "Check Box94", spouseNo: "Check Box27", spouseYes: "Check Box76" },
    { keys: ["clal_risk_musculoskeletal"], primaryNo: "Check Box91", primaryYes: "Check Box92", spouseNo: "fhfgh", spouseYes: "Check Box75" },
    { keys: ["clal_risk_vision"], primaryNo: "Check Box90", primaryYes: "Check Box93", spouseNo: "Check Box29", spouseYes: "Check Box67" },
    { keys: ["clal_risk_ent"], primaryNo: "Check Box37", primaryYes: "Check Box38", spouseNo: "Check Box30", spouseYes: "Check Box66" },
    { keys: ["clal_risk_reproductive"], primaryNo: "Check Box39", primaryYes: "Check Box40", spouseNo: "Check Box31", spouseYes: "Check Box65" },
    { keys: ["clal_risk_rheumatic"], primaryNo: "Check Box41", primaryYes: "Check Box42", spouseNo: "gfsxbhgf", spouseYes: "Check Box64" },
    { keys: ["clal_mortgage_alcohol"], primaryNo: "Check Box435454", primaryYes: "Check Box445454", spouseNo: "hnjfhjmkhj", spouseYes: "Check Box34" },
    { keys: ["clal_mortgage_drugs"], primaryNo: "Check Box45", primaryYes: "Check Box465454", spouseNo: "Check Box35", spouseYes: "Check Box36" },
    { keys: ["clal_risk_regular_meds"], primaryNo: "Check Box211", primaryYes: "Check Box212", spouseNo: "Check Box221", spouseYes: "Check Box222", detailPrimary: "Text1", detailSpouse: "Text6" },
    { keys: ["clal_risk_future_surgery"], primaryNo: "Check Box213", primaryYes: "Check Box214", spouseNo: "Check Box223", spouseYes: "Check Box224", detailPrimary: "Text2", detailSpouse: "Text7" },
    { keys: ["clal_risk_hospital_surgery"], primaryNo: "Check Box215", primaryYes: "Check Box216", spouseNo: "Check Box225", spouseYes: "Check Box226", detailPrimary: "Text3", detailSpouse: "Text8" },
    { keys: ["clal_risk_disability"], primaryNo: "Check Box217", primaryYes: "Check Box218", spouseNo: "Check Box227", spouseYes: "Check Box228", detailPrimary: "Text4", detailSpouse: "Text9" }
  ];

  const ClalMortgageForm = {
    TEMPLATE_BASE: "./forms/clal-mortgage/",
    TEMPLATE_FILE: "clal-mortgage-join.pdf",
    FONT_URL: "./fonts/Heebo-Bold.ttf",
    VERSION: "20260824-clal-mort-v1",
    DOC_ID: "doc_clal_mortgage_form",
    DOC_TYPE: "clal_mortgage_form",
    HEALTH_ROWS,

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
    policyBlob(policy){
      return [policy?.type, policy?.productName, policy?.planName, policy?.label, policy?.cover, policy?.product]
        .map(safeTrim).join(" ");
    },
    isClalMortgagePolicy(policy){
      if(!policy || typeof policy !== "object") return false;
      if(safeTrim(policy.company) !== "כלל") return false;
      return /משכנתא/.test(this.policyBlob(policy));
    },
    listClalMortgagePolicies(payload){
      const list = Array.isArray(payload?.newPolicies) ? payload.newPolicies : [];
      return list.filter((p) => this.isClalMortgagePolicy(p));
    },
    qualifies(payload){
      return this.listClalMortgagePolicies(payload).length > 0;
    },
    listPledgeBanks(policy){
      if(!policy || typeof policy !== "object") return [];
      if(Array.isArray(policy.pledgeBanks) && policy.pledgeBanks.length){
        return policy.pledgeBanks.filter((b) => b && typeof b === "object");
      }
      if(policy.pledgeBank && typeof policy.pledgeBank === "object") return [policy.pledgeBank];
      return [];
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
        bankName: safeTrim(bank.bankName || policy?.pledgeBankName),
        bankNo: safeTrim(bank.bankNo),
        branch: safeTrim(bank.branch),
        amount: this.fmtMoneyPlain(bank.amount) || (idx === 0 ? fallbackSum : ""),
        years: safeTrim(bank.years),
        address: safeTrim(bank.address)
      })).filter((loan) => loan.bankName || loan.amount || loan.years || loan.branch);
    },

    buildDraft(rec){
      const payload = rec?.payload && typeof rec.payload === "object" ? rec.payload : {};
      const policies = this.listClalMortgagePolicies(payload);
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
      const loans = this.loansFromPolicy(policy);
      const firstLoan = loans[0] || {};
      return {
        today: this.fmtTodayHe(),
        insuranceBegin: this.fmtDateHe(policy.startDate || payload.insuranceStartDate),
        payment: pay,
        agentName: safeTrim(global.Auth?.current?.name) || safeTrim(rec?.agentName),
        agentNumber: safeTrim(agentNumbers["כלל"]) || safeTrim(policy.agentNumber),
        primary: primaryPerson,
        spouse: spousePerson,
        ...(global.GI_OFFICIAL_FORM_FILL?.attachDraftHealth?.(payload, primary, spouse) || {}),
        loaner: {
          name: safeTrim(firstLoan.bankName),
          bankNo: safeTrim(firstLoan.bankNo),
          branch: safeTrim(firstLoan.branch),
          address: safeTrim(firstLoan.address)
        },
        loans,
        payer: {
          firstName: useExternal ? safeTrim(external.firstName) : "",
          lastName: useExternal ? safeTrim(external.lastName) : "",
          idNumber: useExternal ? safeTrim(external.idNumber) : "",
          relation: useExternal ? safeTrim(external.relation) : "",
          phone: useExternal ? safeTrim(external.phone) : "",
          email: useExternal ? safeTrim(external.email) : ""
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
      if(/^(no|0|false|לא|לא מעשן)/.test(s)) return "False";
      return "";
    },
    isMobilePhone(phone){
      const digits = String(phone || "").replace(/\D/g, "");
      return /^05\d{8}$/.test(digits) || /^9725\d{8}$/.test(digits);
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
      if(!exportValue) return;
      const helper = global.GI_OFFICIAL_FORM_FILL;
      if(helper && helper.setExport){
        helper.setExport(form, fieldName, exportValue);
        return;
      }
      try {
        const field = form.getField(fieldName);
        const PDFLib = global.PDFLib;
        const name = PDFLib?.PDFName?.of ? PDFLib.PDFName.of(String(exportValue)) : null;
        if(!field || !name) return;
        field.acroField.dict.set(PDFLib.PDFName.of("V"), name);
        field.acroField.dict.set(PDFLib.PDFName.of("AS"), name);
      } catch(_e) {}
    },

    applyPerson(form, person, isSpouse, font){
      if(!person) return;
      const s = isSpouse ? "Spouse" : "";
      this.setTextSafe(form, "FirstName" + s, person.firstName, font);
      this.setTextSafe(form, "LastName" + s, person.lastName, font);
      this.setTextSafe(form, "PID" + s, person.idNumber, font);
      this.setTextSafe(form, "BirthDate" + s, person.birthDate, font);
      this.setTextSafe(form, "EmailAddress" + s, person.email, font);
      this.setTextSafe(form, "City" + s, person.city, font);
      this.setTextSafe(form, "StreetName" + s, person.street, font);
      this.setTextSafe(form, "HouseNumber" + s, person.houseNumber, font);
      this.setTextSafe(form, "ZipCode" + s, person.zip, font);
      this.setTextSafe(form, "OccupationCode" + s, person.occupation, font);
      this.setTextSafe(form, "Hight" + s, person.heightCm, font);
      this.setTextSafe(form, "Weight" + s, person.weightKg, font);
      if(person.childrenCount){
        this.setTextSafe(form, "NumberOfChildren" + s, person.childrenCount, font);
      }
      const phone = person.phone || person.phoneHome;
      if(phone){
        if(this.isMobilePhone(phone) || !isSpouse) this.setTextSafe(form, "CellPhoneNumber" + s, phone, font);
        else this.setTextSafe(form, "PhoneNumber" + s, phone, font);
        if(person.phoneHome && person.phoneHome !== phone){
          this.setTextSafe(form, "PhoneNumber" + s, person.phoneHome, font);
        }
      }
      this.setExport(form, "Gender" + s, this.mapGenderExport(person.gender));
      this.setExport(form, "FamilyStatus" + s, this.mapMaritalExport(person.maritalStatus));
      this.setExport(form, isSpouse ? "IsSmokingBzug" : "IsSmoking", this.mapSmokingExport(person.smokingStatus));
    },
    applyLoaner(form, loaner, font){
      if(!loaner) return;
      this.setTextSafe(form, "Text135", loaner.name, font);
      this.setTextSafe(form, "Text139", loaner.bankNo, font);
      this.setTextSafe(form, "Text144", loaner.branch, font);
      this.setTextSafe(form, "Text136", loaner.address, font);
    },
    applyLoans(form, loans, font){
      (loans || []).slice(0, 4).forEach((loan, idx) => {
        const n = idx + 1;
        this.setTextSafe(form, "LoanSumShpiz" + n, loan.amount, font);
        this.setTextSafe(form, "LoanYearsShpiz" + n, loan.years, font);
      });
    },

    healthAnswer(responses, keys, insId, allowSolo){
      const helper = global.GI_OFFICIAL_FORM_FILL;
      let sawNo = false;
      for(let i = 0; i < keys.length; i++){
        let a = helper?.healthAnswer ? helper.healthAnswer(responses, keys[i], insId) : "";
        if(!a && allowSolo && helper?.healthAnswerOrSolo) a = helper.healthAnswerOrSolo(responses, keys[i], "");
        if(a === "yes") return "yes";
        if(a === "no") sawNo = true;
      }
      return sawNo ? "no" : "";
    },
    healthDetailText(responses, keys, insId){
      if(!responses || !insId) return "";
      for(let i = 0; i < keys.length; i++){
        const row = responses[keys[i]] && responses[keys[i]][insId];
        if(!row || typeof row !== "object") continue;
        const fields = row.fields && typeof row.fields === "object" ? row.fields : {};
        const candidates = [
          row.details, fields.details, fields.meds, fields.diagnosis, fields.treatment, fields.currentStatus
        ];
        for(let j = 0; j < candidates.length; j++){
          const t = safeTrim(candidates[j]);
          if(t) return t.slice(0, 220);
        }
      }
      return "";
    },
    applyHealth(form, draft, font){
      const responses = draft?.healthResponses && typeof draft.healthResponses === "object" ? draft.healthResponses : {};
      const primaryId = safeTrim(draft?.primaryId) || safeTrim(draft?.primary?.id);
      const spouseId = safeTrim(draft?.spouseId) || safeTrim(draft?.spouse?.id);
      const mark = (answer, noField, yesField) => {
        if(answer === "yes" && yesField) this.setExport(form, yesField, "Yes");
        else if(answer === "no" && noField) this.setExport(form, noField, "Yes");
      };
      HEALTH_ROWS.forEach((row) => {
        const keys = row.keys || [];
        if(!keys.length) return;
        const primaryA = this.healthAnswer(responses, keys, primaryId, true);
        mark(primaryA, row.primaryNo, row.primaryYes);
        if(primaryA === "yes" && row.detailPrimary){
          this.setTextSafe(form, row.detailPrimary, this.healthDetailText(responses, keys, primaryId), font);
        }
        if(spouseId){
          const spouseA = this.healthAnswer(responses, keys, spouseId, false);
          mark(spouseA, row.spouseNo, row.spouseYes);
          if(spouseA === "yes" && row.detailSpouse){
            this.setTextSafe(form, row.detailSpouse, this.healthDetailText(responses, keys, spouseId), font);
          }
        }
      });
    },

    async fillOriginalTemplate(draft){
      if(global.GI_LOAD_LIBS?.pdfLib) await global.GI_LOAD_LIBS.pdfLib();
      const PDFLib = global.PDFLib;
      if(!PDFLib?.PDFDocument) throw new Error("PDFLib missing");
      const templateBytes = await this.fetchFirstOk(
        this.candidateUrls("forms/clal-mortgage/", this.TEMPLATE_FILE),
        "לא נמצא טופס משכנתא של כלל"
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
      const form = pdfDoc.getForm();
      this.setTextSafe(form, "Date", draft.today, font);
      this.setTextSafe(form, "InsuranceBegin", draft.insuranceBegin, font);
      this.setTextSafe(form, "AgentName", draft.agentName, font);
      this.setTextSafe(form, "AgentNumber", draft.agentNumber, font);
      this.applyPerson(form, draft.primary, false, font);
      this.applyPerson(form, draft.spouse, true, font);
      this.applyLoaner(form, draft.loaner, font);
      this.applyLoans(form, draft.loans, font);
      this.applyHealth(form, draft, font);
      global.GI_OFFICIAL_FORM_FILL?.applyStoredPayment?.(form, {
        method: draft.payment?.method || "",
        bank: draft.bank || {},
        cc: draft.payment?.cc || {}
      }, font, {
        textOpts: { visual: false },
        bankBranchCode: "BankBranchCode",
        bankNameCode: "BankNameCode"
      });
      if(draft.payment?.method === "ho" && draft.primary){
        global.GI_OFFICIAL_FORM_FILL?.applyInsuredPayerOwner?.(form, draft.primary, font, {
          relation: draft.payer?.relation || ""
        });
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
      return "ריסק_משכנתא_כלל_" + name.replace(/[\\/:*?\"<>|]/g, "_") + "_" + nowISO().slice(0, 10) + ".pdf";
    },

    fieldRow(label, name, value, extra){
      return `<label class="clalMortForm__field">
        <span>${escapeHtml(label)}</span>
        <input class="input" type="text" data-clalmort="${escapeHtml(name)}" value="${escapeHtml(value || "")}" ${extra || ""} />
      </label>`;
    },
    personBlock(title, prefix, person){
      const p = person || {};
      return `<section class="clalMortForm__block">
        <div class="clalMortForm__blockTitle">${escapeHtml(title)}</div>
        <div class="clalMortForm__grid">
          ${this.fieldRow("שם פרטי", prefix + ".firstName", p.firstName)}
          ${this.fieldRow("שם משפחה", prefix + ".lastName", p.lastName)}
          ${this.fieldRow("תעודת זהות", prefix + ".idNumber", p.idNumber, 'dir="ltr"')}
          ${this.fieldRow("תאריך לידה", prefix + ".birthDate", p.birthDate, 'dir="ltr"')}
          ${this.fieldRow("מין", prefix + ".gender", p.gender)}
          ${this.fieldRow("מצב משפחתי", prefix + ".maritalStatus", p.maritalStatus)}
          ${this.fieldRow("טלפון", prefix + ".phone", p.phone, 'dir="ltr"')}
          ${this.fieldRow("דוא״ל", prefix + ".email", p.email, 'dir="ltr"')}
          ${this.fieldRow("עיר", prefix + ".city", p.city)}
          ${this.fieldRow("רחוב", prefix + ".street", p.street)}
          ${this.fieldRow("מספר בית", prefix + ".houseNumber", p.houseNumber, 'dir="ltr"')}
          ${this.fieldRow("מיקוד", prefix + ".zip", p.zip, 'dir="ltr"')}
          ${this.fieldRow("עיסוק", prefix + ".occupation", p.occupation)}
          ${this.fieldRow("גובה", prefix + ".heightCm", p.heightCm, 'dir="ltr"')}
          ${this.fieldRow("משקל", prefix + ".weightKg", p.weightKg, 'dir="ltr"')}
          ${this.fieldRow("עישון", prefix + ".smokingStatus", p.smokingStatus)}
          ${this.fieldRow("סכום ביטוח", prefix + ".sumInsured", p.sumInsured, 'dir="ltr"')}
        </div>
      </section>`;
    },
    collectDraftFromModal(root, draft){
      const next = JSON.parse(JSON.stringify(draft || {}));
      root.querySelectorAll("[data-clalmort]").forEach((el) => {
        const path = safeTrim(el.getAttribute("data-clalmort"));
        if(!path) return;
        const parts = path.split(".");
        let cur = next;
        for(let i = 0; i < parts.length - 1; i++){
          const key = parts[i];
          if(/^\d+$/.test(key)){
            const idx = Number(key);
            if(!Array.isArray(cur)) return;
            if(!cur[idx] || typeof cur[idx] !== "object") cur[idx] = {};
            cur = cur[idx];
            continue;
          }
          if(!cur[key] || typeof cur[key] !== "object") cur[key] = {};
          cur = cur[key];
        }
        const last = parts[parts.length - 1];
        cur[last] = safeTrim(el.value);
        if(last === "firstName" || last === "lastName"){
          cur.fullName = safeTrim(((cur.firstName || "") + " " + (cur.lastName || "")).trim());
        }
      });
      return next;
    },
    ensureStyles(){
      if(document.getElementById("clalMortFormStyle")) return;
      const style = document.createElement("style");
      style.id = "clalMortFormStyle";
      style.textContent = `
        .clalMortFormModal .giValModal__card{ max-width:min(980px,96vw); width:100%; height:min(92vh,920px); max-height:min(92vh,920px); }
        .clalMortForm__hint{ font-size:13px; line-height:1.45; color:#475569; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:12px; padding:10px 12px; }
        .clalMortForm__block{ border:1px solid #E5EAF3; border-radius:14px; padding:12px 14px 14px; background:#fff; }
        .clalMortForm__blockTitle{ font-size:14px; font-weight:800; color:#0B1F4B; margin-bottom:10px; }
        .clalMortForm__grid{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px 12px; }
        .clalMortForm__field{ display:flex; flex-direction:column; gap:4px; min-width:0; }
        .clalMortForm__field span{ font-size:12px; font-weight:700; color:#647287; }
        .clalMortFormPreview{ padding:12px 4px; display:flex; flex-direction:column; gap:10px; }
        .clalMortFormPreview__row{ display:flex; justify-content:space-between; gap:12px; font-size:13.5px; }
        .clalMortFormPreview__row span{ color:#647287; }
        .clalMortFormPreview__row strong{ color:#0F172A; font-weight:750; }
        @media (max-width:720px){ .clalMortForm__grid{ grid-template-columns:1fr; } }
      `;
      document.head.appendChild(style);
    },
    renderPreviewHtml(draft){
      const people = [draft.primary, draft.spouse].filter(Boolean);
      const rows = people.map((p, idx) => {
        const role = idx === 0 ? "מבוטח ראשי" : "מועמד משני";
        return `<div class="clalMortFormPreview__row"><span>${escapeHtml(role)}</span><strong>${escapeHtml(p.fullName || "—")}</strong></div>`;
      }).join("");
      return `<div class="clalMortFormPreview">
        <div class="clalMortFormPreview__row"><span>חברה / מוצר</span><strong>כלל · ריסק משכנתא</strong></div>
        <div class="clalMortFormPreview__row"><span>תחילת ביטוח</span><strong>${escapeHtml(draft.insuranceBegin || "—")}</strong></div>
        <div class="clalMortFormPreview__row"><span>בנק משעבד</span><strong>${escapeHtml(draft.loaner?.name || "—")}</strong></div>
        ${rows}
        ${global.CustomerDocuments?.canDownloadOfficialJoinForm?.() ? `<button class="btn btn--primary" type="button" data-clalmort-open="1">פתח טופס דיגיטלי</button>` : ""}
      </div>`;
    },
    close(){
      const modal = this._modal;
      this._modal = null;
      this._draft = null;
      if(modal && modal.parentNode) modal.parentNode.removeChild(modal);
    },
    bind(modal){
      modal.querySelectorAll("[data-clalmort-close]").forEach((el) => {
        el.addEventListener("click", () => this.close());
      });
      const dl = modal.querySelector("[data-clalmort-download]");
      if(dl){
        dl.addEventListener("click", async () => {
          const original = dl.textContent;
          dl.disabled = true;
          dl.textContent = "מפיק PDF…";
          try {
            const draft = this.collectDraftFromModal(modal, this._draft);
            const bytes = await this.fillOriginalTemplate(draft);
            this.downloadBytes(bytes, this.fileName(draft));
            try { global.showToast?.({ title: "הטופס הורד", text: "PDF מקורי של כלל — ממולא מהפרטים שבתיק.", variant: "success", durationMs: 5200 }); } catch(_e) {}
          } catch(err){
            try { console.error("CLAL_MORTGAGE_PDF_FAILED", err); } catch(_e) {}
            try { global.showToast?.({ title: "שגיאה בהפקת PDF", text: safeTrim(err?.message) || "לא ניתן למלא את הטופס המקורי", variant: "warn", durationMs: 6200 }); } catch(_e2) {}
          } finally {
            dl.disabled = false;
            dl.textContent = original;
          }
        });
      }
    },
    open(rec){
      if(global.CustomerFileUI?.denyOfficialJoinFormDownload?.()) return;
      this.ensureStyles();
      this.close();
      const draft = this.buildDraft(rec);
      this._draft = draft;
      const loanRows = (draft.loans || []).map((loan, idx) => `
        ${this.fieldRow("סכום הלוואה " + (idx + 1), "loans." + idx + ".amount", loan.amount, 'dir="ltr"')}
        ${this.fieldRow("שנים " + (idx + 1), "loans." + idx + ".years", loan.years, 'dir="ltr"')}
      `).join("");
      const modal = document.createElement("div");
      modal.className = "giValModal clalMortFormModal is-open giValModal--visible";
      modal.innerHTML = `
        <div class="giValModal__backdrop" data-clalmort-close="1"></div>
        <div class="giValModal__card">
          <div class="giValModal__head">
            <div class="giValModal__headText">
              <div class="giValModal__title">טופס מקורי — ריסק משכנתא · כלל</div>
              <div class="giValModal__sub">פרטים מהתיק כבר ממולאים. השלימו מה שחסר והורידו PDF רשמי.</div>
            </div>
            <button type="button" class="giValModal__closeX" data-clalmort-close="1" aria-label="סגירה">✕</button>
          </div>
          <div class="giValModal__body">
            <div class="clalMortForm__hint">ממולא אוטומטית רק מה ששמור בתיק, כולל כן/לא בהצהרת בריאות ואמצעי תשלום. פירוט רפואי מלא, ביטול/החלפת ביטוח, סוג ריבית וחתימות לא ממולאים אוטומטית — אותם משלימים בטופס או ב-PDF אחרי ההורדה.</div>
            <section class="clalMortForm__block">
              <div class="clalMortForm__blockTitle">פרטי הצעה וסוכן</div>
              <div class="clalMortForm__grid">
                ${this.fieldRow("תחילת ביטוח", "insuranceBegin", draft.insuranceBegin, 'dir="ltr"')}
                ${this.fieldRow("תאריך היום", "today", draft.today, 'dir="ltr"')}
                ${this.fieldRow("שם סוכן", "agentName", draft.agentName)}
                ${this.fieldRow("מספר סוכן", "agentNumber", draft.agentNumber, 'dir="ltr"')}
              </div>
            </section>
            ${this.personBlock("מבוטח ראשי", "primary", draft.primary)}
            ${draft.spouse ? this.personBlock("מועמד משני", "spouse", draft.spouse) : ""}
            <section class="clalMortForm__block">
              <div class="clalMortForm__blockTitle">בנק משעבד והלוואה — רק אם נרשם בתיק</div>
              <div class="clalMortForm__grid">
                ${this.fieldRow("שם הבנק", "loaner.name", draft.loaner.name)}
                ${this.fieldRow("מספר בנק", "loaner.bankNo", draft.loaner.bankNo, 'dir="ltr"')}
                ${this.fieldRow("סניף", "loaner.branch", draft.loaner.branch, 'dir="ltr"')}
                ${this.fieldRow("כתובת הבנק", "loaner.address", draft.loaner.address)}
                ${loanRows}
              </div>
            </section>
            <section class="clalMortForm__block">
              <div class="clalMortForm__blockTitle">משלם והוראת קבע — רק אם נרשם בתיק</div>
              <div class="clalMortForm__grid">
                ${this.fieldRow("שם פרטי משלם", "payer.firstName", draft.payer.firstName)}
                ${this.fieldRow("שם משפחה משלם", "payer.lastName", draft.payer.lastName)}
                ${this.fieldRow("ת״ז משלם", "payer.idNumber", draft.payer.idNumber, 'dir="ltr"')}
                ${this.fieldRow("קרבה", "payer.relation", draft.payer.relation)}
                ${this.fieldRow("בנק", "bank.name", draft.bank.name)}
                ${this.fieldRow("סניף", "bank.branch", draft.bank.branch, 'dir="ltr"')}
                ${this.fieldRow("חשבון", "bank.account", draft.bank.account, 'dir="ltr"')}
              </div>
            </section>
          </div>
          <div class="giValModal__foot">
            <button type="button" class="btn" data-clalmort-close="1">סגור</button>
            <button type="button" class="btn btn--primary" data-clalmort-download="1">הורד PDF רשמי</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      this._modal = modal;
      this.bind(modal);
    }
  };

  global.ClalMortgageForm = ClalMortgageForm;
})(typeof window !== "undefined" ? window : globalThis);
