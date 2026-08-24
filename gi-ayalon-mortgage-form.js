/* GEMEL INVEST — טופס מקורי ריסק משכנתא איילון
   נטען לפי דרישה ממסמכי לקוח. ממלא רק ערכים שכבר שמורים בתיק. */
(function installAyalonMortgageForm(global){
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

  const AyalonMortgageForm = {
    TEMPLATE_BASE: "./forms/ayalon-mortgage/",
    TEMPLATE_FILE: "ayalon-mortgage-join.pdf",
    FONT_URL: "./fonts/Heebo-Bold.ttf",
    VERSION: "20260824-menora-ayalon-mort-v1",
    DOC_ID: "doc_ayalon_mortgage_form",
    DOC_TYPE: "ayalon_mortgage_form",

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
    isAyalonMortgagePolicy(policy){
      if(!policy || typeof policy !== "object") return false;
      if(safeTrim(policy.company) !== "איילון") return false;
      const blob = this.policyBlob(policy);
      if(/בריאות/.test(blob) && !/משכנתא/.test(blob)) return false;
      return /משכנתא/.test(blob);
    },
    listAyalonMortgagePolicies(payload){
      const list = Array.isArray(payload?.newPolicies) ? payload.newPolicies : [];
      return list.filter((p) => this.isAyalonMortgagePolicy(p));
    },
    qualifies(payload){
      return this.listAyalonMortgagePolicies(payload).length > 0;
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
      const banks = this.listPledgeBanks(policy).slice(0, 6);
      const fallbackSum = this.sumInsuredFor(policy);
      return banks.map((bank, idx) => ({
        bankName: safeTrim(bank.bankName || policy?.pledgeBankName),
        bankNo: safeTrim(bank.bankNo),
        branch: safeTrim(bank.branch),
        amount: this.fmtMoneyPlain(bank.amount) || (idx === 0 ? fallbackSum : ""),
        years: safeTrim(bank.years),
        loanNumber: safeTrim(bank.loanNumber || bank.number),
        interestType: safeTrim(bank.interestType),
        loanType: safeTrim(bank.loanType),
        address: safeTrim(bank.address)
      })).filter((loan) => loan.bankName || loan.amount || loan.years || loan.branch);
    },
    beneficiariesFromPolicy(policy){
      const list = Array.isArray(policy?.beneficiaries) ? policy.beneficiaries : [];
      return list.filter((b) => b && typeof b === "object").slice(0, 5).map((b) => ({
        firstName: safeTrim(b.firstName),
        lastName: safeTrim(b.lastName),
        fullName: safeTrim(b.fullName) || safeTrim((safeTrim(b.firstName) + " " + safeTrim(b.lastName)).trim()),
        idNumber: safeTrim(b.idNumber || b.pid),
        birthDate: this.fmtDateHe(b.birthDate),
        relation: safeTrim(b.relation),
        sharePct: safeTrim(b.sharePct || b.percentage || b.percent)
      })).filter((b) => b.fullName || b.firstName || b.idNumber);
    },
    propertyFromPayload(payload, policy){
      const src = policy?.mortgagedProperty && typeof policy.mortgagedProperty === "object"
        ? policy.mortgagedProperty
        : (payload?.mortgagedProperty && typeof payload.mortgagedProperty === "object" ? payload.mortgagedProperty : {});
      return {
        city: safeTrim(src.city),
        street: safeTrim(src.street),
        houseNumber: safeTrim(src.houseNumber),
        apt: safeTrim(src.apartment || src.aptNumber),
        zip: safeTrim(src.zip),
        value: this.fmtMoneyPlain(src.value || src.apartmentValue)
      };
    },

    buildDraft(rec){
      const payload = rec?.payload && typeof rec.payload === "object" ? rec.payload : {};
      const policies = this.listAyalonMortgagePolicies(payload);
      const policy = policies[0] || {};
      const { primary, spouse } = this.classifyInsureds(payload);
      const primaryPerson = this.personFromInsured(primary || payload.primary || {}, global.GI_OFFICIAL_FORM_FILL?.fileFallbacks?.(rec, payload));
      const spousePerson = spouse ? this.personFromInsured(spouse) : null;
      primaryPerson.sumInsured = this.sumInsuredFor(policy, primary?.id);
      if(spousePerson) spousePerson.sumInsured = this.sumInsuredFor(policy, spouse?.id);
      const agentNumbers = payload.companyAgentNumbers || payload.operational?.companyAgentNumbers
        || payload.primary?.operationalAgentNumbers || {};
      const payerSrc = payload.primary || primary?.data || {};
      const pay = global.GI_OFFICIAL_FORM_FILL?.pickPayment?.(payload, payerSrc) || { method: "", isHo: false, bank: { name: "", branch: "", account: "", bankNo: "" } };
      const loans = this.loansFromPolicy(policy);
      const firstLoan = loans[0] || {};
      return {
        today: this.fmtTodayHe(),
        insuranceBegin: this.fmtDateHe(policy.startDate || payload.insuranceStartDate),
        payment: pay,
        agentName: safeTrim(global.Auth?.current?.name) || safeTrim(rec?.agentName),
        agentNumber: safeTrim(agentNumbers["איילון"]) || safeTrim(policy.agentNumber),
        discountPack: safeTrim(policy.discountPackageNum || policy.packageNum),
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
        beneficiaries: this.beneficiariesFromPolicy(policy),
        property: this.propertyFromPayload(payload, policy),
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

    applyPerson(form, person, isSpouse, font){
      if(!person) return;
      const s = isSpouse ? "Spouse" : "";
      this.setTextSafe(form, "FirstName" + s, person.firstName, font);
      this.setTextSafe(form, "LastName" + s, person.lastName, font);
      this.setTextSafe(form, isSpouse ? "FullNameSpouse" : "FullName", person.fullName, font);
      this.setTextSafe(form, "PID" + s, person.idNumber, font);
      this.setTextSafe(form, "BirthDate" + s, person.birthDate, font);
      this.setTextSafe(form, "EmailAddress" + s, person.email, font);
      this.setTextSafe(form, isSpouse ? "CitySpouseCode" : "CityCode", person.city, font);
      this.setTextSafe(form, isSpouse ? "StreetCodeSpouse" : "StreetCode", person.street, font);
      this.setTextSafe(form, "HouseNumber" + s, person.houseNumber, font);
      this.setTextSafe(form, "ZipCode" + s, person.zip, font);
      this.setTextSafe(form, isSpouse ? "OccupationCodeSpouse" : "OccupationCode", person.occupation, font);
      this.setTextSafe(form, isSpouse ? "ProfessionCodeSpouse" : "ProfessionCode", person.occupation, font);
      this.setTextSafe(form, isSpouse ? "HMOSpouse" : "HMO", person.clinic, font);
      this.setTextSafe(form, "Hight" + s, person.heightCm, font);
      this.setTextSafe(form, "Weight" + s, person.weightKg, font);
      if(person.sumInsured){
        this.setTextSafe(form, isSpouse ? "MaximumAmountText" : "MaximumAmount", person.sumInsured, font);
      }
      const phone = person.phone;
      if(phone){
        if(this.isMobilePhone(phone)) this.setTextSafe(form, "CellPhoneNumber" + s, phone, font);
        else this.setTextSafe(form, "PhoneNumber" + s, phone, font);
        this.setTextSafe(form, "CellPhoneNumber" + s, phone, font);
      }
      this.setExport(form, isSpouse ? "GenderSpouse" : "Gender", this.mapGenderExport(person.gender));
      this.setExport(form, "FamilyStatus" + s, this.mapMaritalExport(person.maritalStatus));
      this.setExport(form, isSpouse ? "IsSmokingBzug" : "IsSmoking", this.mapSmokingExport(person.smokingStatus));
      if(person.smokingAmount){
        this.setTextSafe(form, isSpouse ? "ClientSmokeNumSpouse" : "ClientSmokeNum", person.smokingAmount, font);
      }
    },
    applyLoaner(form, loaner, font){
      if(!loaner) return;
      this.setTextSafe(form, "EnslaveBankName", loaner.name, font);
      this.setTextSafe(form, "EnslaveBankNameCode", loaner.bankNo, font);
      this.setTextSafe(form, "EnslaveBankBranchCode", loaner.branch, font);
      this.setTextSafe(form, "EnslaveBankAddress", loaner.address, font);
    },
    applyLoans(form, loans, font){
      (loans || []).slice(0, 6).forEach((loan, idx) => {
        const n = String(idx + 1);
        this.setTextSafe(form, "LoanSum" + n, loan.amount, font);
        this.setTextSafe(form, "LoanYears" + n, loan.years, font);
        this.setTextSafe(form, "LoanNumber" + n, loan.loanNumber, font);
        this.setTextSafe(form, "LoanInterest" + n, loan.interestType, font);
        this.setTextSafe(form, "LoanType" + n, loan.loanType, font);
      });
    },
    applyBeneficiaries(form, beneficiaries, isSpouse, font){
      (beneficiaries || []).slice(0, 5).forEach((ben, idx) => {
        const n = String(idx + 1);
        const mid = isSpouse ? "BeneficiarySpouse" : "Beneficiary";
        this.setTextSafe(form, "FirstName" + mid + n, ben.firstName, font);
        this.setTextSafe(form, "LastName" + mid + n, ben.lastName, font);
        this.setTextSafe(form, "PID" + mid + n, ben.idNumber, font);
        this.setTextSafe(form, "BirthDate" + mid + n, ben.birthDate, font);
        this.setTextSafe(form, mid + "Relation" + n, ben.relation, font);
        this.setTextSafe(form, mid + "percentage" + n, ben.sharePct, font);
      });
    },
    applyProperty(form, property, font){
      if(!property) return;
      const hasAny = property.city || property.street || property.houseNumber || property.value;
      if(!hasAny) return;
      this.setTextSafe(form, "MortgagedPropertyCity", property.city, font);
      this.setTextSafe(form, "MortgagedPropertyStreetName", property.street, font);
      this.setTextSafe(form, "MortgagedPropertyHouseNumber", property.houseNumber, font);
      this.setTextSafe(form, "MortgagedPropertyAptNumber", property.apt, font);
      this.setTextSafe(form, "MortgagedPropertyZipCode", property.zip, font);
      this.setTextSafe(form, "ApartmentValue", property.value, font);
    },

    async fillOriginalTemplate(draft){
      if(global.GI_LOAD_LIBS?.pdfLib) await global.GI_LOAD_LIBS.pdfLib();
      const PDFLib = global.PDFLib;
      if(!PDFLib?.PDFDocument) throw new Error("PDFLib missing");
      const templateBytes = await this.fetchFirstOk(
        this.candidateUrls("forms/ayalon-mortgage/", this.TEMPLATE_FILE),
        "לא נמצא טופס משכנתא של איילון"
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
      this.setTextSafe(form, "MashkantaDiscountPack", draft.discountPack, font);
      this.applyPerson(form, draft.primary, false, font);
      this.applyPerson(form, draft.spouse, true, font);
      this.applyLoaner(form, draft.loaner, font);
      this.applyLoans(form, draft.loans, font);
      this.applyBeneficiaries(form, draft.beneficiaries, false, font);
      this.applyProperty(form, draft.property, font);
      global.GI_OFFICIAL_FORM_FILL?.applyOfficialHealthAndNames?.(form, draft, font, {
        skipHealth: true,
        visual: false
      });
      global.GI_OFFICIAL_FORM_FILL?.applyMappedHealthYesNo?.(form, {
        map: "ayalon_mortgage",
        responses: draft.healthResponses,
        primaryId: draft.primaryId,
        spouseId: draft.spouseId,
        childIds: draft.childIds || []
      });
      global.GI_OFFICIAL_FORM_FILL?.applyStoredPayment?.(form, {
        method: draft.payment?.method || "",
        bank: draft.bank || {},
        cc: draft.payment?.cc || {}
      }, font, {
        textOpts: { visual: false },
        bankBranchCode: "BankBranchCode",
        hoMarks: [{ field: "LifeInsuranceHok", value: "1" }, { field: "StructureInsuranceHok", value: "1" }]
      });
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
      return "ריסק_משכנתא_איילון_" + name.replace(/[\\/:*?\"<>|]/g, "_") + "_" + nowISO().slice(0, 10) + ".pdf";
    },

    fieldRow(label, name, value, extra){
      return `<label class="ayalMortForm__field">
        <span>${escapeHtml(label)}</span>
        <input class="input" type="text" data-ayalmort="${escapeHtml(name)}" value="${escapeHtml(value || "")}" ${extra || ""} />
      </label>`;
    },
    personBlock(title, prefix, person){
      const p = person || {};
      return `<section class="ayalMortForm__block">
        <div class="ayalMortForm__blockTitle">${escapeHtml(title)}</div>
        <div class="ayalMortForm__grid">
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
      root.querySelectorAll("[data-ayalmort]").forEach((el) => {
        const path = safeTrim(el.getAttribute("data-ayalmort"));
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
      if(document.getElementById("ayalMortFormStyle")) return;
      const style = document.createElement("style");
      style.id = "ayalMortFormStyle";
      style.textContent = `
        .ayalMortFormModal .giValModal__card{ max-width:min(980px,96vw); width:100%; height:min(92vh,920px); max-height:min(92vh,920px); }
        .ayalMortForm__hint{ font-size:13px; line-height:1.45; color:#475569; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:12px; padding:10px 12px; }
        .ayalMortForm__block{ border:1px solid #E5EAF3; border-radius:14px; padding:12px 14px 14px; background:#fff; }
        .ayalMortForm__blockTitle{ font-size:14px; font-weight:800; color:#0B1F4B; margin-bottom:10px; }
        .ayalMortForm__grid{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px 12px; }
        .ayalMortForm__field{ display:flex; flex-direction:column; gap:4px; min-width:0; }
        .ayalMortForm__field span{ font-size:12px; font-weight:700; color:#647287; }
        .ayalMortFormPreview{ padding:12px 4px; display:flex; flex-direction:column; gap:10px; }
        .ayalMortFormPreview__row{ display:flex; justify-content:space-between; gap:12px; font-size:13.5px; }
        .ayalMortFormPreview__row span{ color:#647287; }
        .ayalMortFormPreview__row strong{ color:#0F172A; font-weight:750; }
        @media (max-width:720px){ .ayalMortForm__grid{ grid-template-columns:1fr; } }
      `;
      document.head.appendChild(style);
    },
    renderPreviewHtml(draft){
      const people = [draft.primary, draft.spouse].filter(Boolean);
      const rows = people.map((p, idx) => {
        const role = idx === 0 ? "מבוטח ראשי" : "מועמד משני";
        return `<div class="ayalMortFormPreview__row"><span>${escapeHtml(role)}</span><strong>${escapeHtml(p.fullName || "—")}</strong></div>`;
      }).join("");
      return `<div class="ayalMortFormPreview">
        <div class="ayalMortFormPreview__row"><span>חברה / מוצר</span><strong>איילון · ריסק משכנתא</strong></div>
        <div class="ayalMortFormPreview__row"><span>תחילת ביטוח</span><strong>${escapeHtml(draft.insuranceBegin || "—")}</strong></div>
        <div class="ayalMortFormPreview__row"><span>בנק משעבד</span><strong>${escapeHtml(draft.loaner?.name || "—")}</strong></div>
        ${rows}
        ${global.CustomerDocuments?.canDownloadOfficialJoinForm?.() ? `<button class="btn btn--primary" type="button" data-ayalmort-open="1">פתח טופס דיגיטלי</button>` : ""}
      </div>`;
    },
    close(){
      const modal = this._modal;
      this._modal = null;
      this._draft = null;
      if(modal && modal.parentNode) modal.parentNode.removeChild(modal);
    },
    bind(modal){
      modal.querySelectorAll("[data-ayalmort-close]").forEach((el) => {
        el.addEventListener("click", () => this.close());
      });
      const dl = modal.querySelector("[data-ayalmort-download]");
      if(dl){
        dl.addEventListener("click", async () => {
          const original = dl.textContent;
          dl.disabled = true;
          dl.textContent = "מפיק PDF…";
          try {
            const draft = this.collectDraftFromModal(modal, this._draft);
            const bytes = await this.fillOriginalTemplate(draft);
            this.downloadBytes(bytes, this.fileName(draft));
            try { global.showToast?.({ title: "הטופס הורד", text: "PDF מקורי של איילון — ממולא מהפרטים שבתיק.", variant: "success", durationMs: 5200 }); } catch(_e) {}
          } catch(err){
            try { console.error("AYALON_MORTGAGE_PDF_FAILED", err); } catch(_e) {}
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
      modal.className = "giValModal ayalMortFormModal is-open giValModal--visible";
      modal.innerHTML = `
        <div class="giValModal__backdrop" data-ayalmort-close="1"></div>
        <div class="giValModal__card">
          <div class="giValModal__head">
            <div class="giValModal__headText">
              <div class="giValModal__title">טופס מקורי — ריסק משכנתא · איילון</div>
              <div class="giValModal__sub">פרטים מהתיק כבר ממולאים. השלימו מה שחסר והורידו PDF רשמי.</div>
            </div>
            <button type="button" class="giValModal__closeX" data-ayalmort-close="1" aria-label="סגירה">✕</button>
          </div>
          <div class="giValModal__body">
            <div class="ayalMortForm__hint">ממולא אוטומטית רק מה ששמור בתיק, כולל כן/לא בהצהרת בריאות ואמצעי תשלום. פירוט רפואי, נכס משועבד, ביטול/החלפת ביטוח וחתימות לא ממולאים — אותם משלימים בטופס או ב-PDF אחרי ההורדה.</div>
            <section class="ayalMortForm__block">
              <div class="ayalMortForm__blockTitle">פרטי הצעה וסוכן</div>
              <div class="ayalMortForm__grid">
                ${this.fieldRow("תחילת ביטוח", "insuranceBegin", draft.insuranceBegin, 'dir="ltr"')}
                ${this.fieldRow("תאריך היום", "today", draft.today, 'dir="ltr"')}
                ${this.fieldRow("שם סוכן", "agentName", draft.agentName)}
                ${this.fieldRow("מספר סוכן", "agentNumber", draft.agentNumber, 'dir="ltr"')}
                ${this.fieldRow("מספר חבילה", "discountPack", draft.discountPack, 'dir="ltr"')}
              </div>
            </section>
            ${this.personBlock("מבוטח ראשי", "primary", draft.primary)}
            ${draft.spouse ? this.personBlock("מועמד משני", "spouse", draft.spouse) : ""}
            <section class="ayalMortForm__block">
              <div class="ayalMortForm__blockTitle">בנק משעבד והלוואה — רק אם נרשם בתיק</div>
              <div class="ayalMortForm__grid">
                ${this.fieldRow("שם הבנק", "loaner.name", draft.loaner.name)}
                ${this.fieldRow("מספר בנק", "loaner.bankNo", draft.loaner.bankNo, 'dir="ltr"')}
                ${this.fieldRow("סניף", "loaner.branch", draft.loaner.branch, 'dir="ltr"')}
                ${this.fieldRow("כתובת הבנק", "loaner.address", draft.loaner.address)}
                ${loanRows}
              </div>
            </section>
            <section class="ayalMortForm__block">
              <div class="ayalMortForm__blockTitle">הוראת קבע — רק אם נרשמה בתיק</div>
              <div class="ayalMortForm__grid">
                ${this.fieldRow("בנק", "bank.name", draft.bank.name)}
                ${this.fieldRow("סניף", "bank.branch", draft.bank.branch, 'dir="ltr"')}
                ${this.fieldRow("חשבון", "bank.account", draft.bank.account, 'dir="ltr"')}
              </div>
            </section>
          </div>
          <div class="giValModal__foot">
            <button type="button" class="btn" data-ayalmort-close="1">סגור</button>
            <button type="button" class="btn btn--primary" data-ayalmort-download="1">הורד PDF רשמי</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      this._modal = modal;
      this.bind(modal);
    }
  };

  global.AyalonMortgageForm = AyalonMortgageForm;
})(typeof window !== "undefined" ? window : globalThis);
