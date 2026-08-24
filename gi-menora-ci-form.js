/* GEMEL INVEST — טופס מקורי מחלות קשות + סרטן מנורה (08.2025, 21-15)
   נטען לפי דרישה ממסמכי לקוח. ממלא רק ערכים שכבר שמורים בתיק. */
(function installMenoraCiForm(global){
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

  const MenoraCiForm = {
    TEMPLATE_BASE: "./forms/menora-ci/",
    TEMPLATE_FILE: "menora-ci-join.pdf",
    FONT_URL: "./fonts/Heebo-Bold.ttf",
    VERSION: "20260824-official-decl-pay-he-v1",
    DOC_ID: "doc_menora_ci_form",
    DOC_TYPE: "menora_ci_form",

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
    isMenoraCiPolicy(policy){
      if(!policy || typeof policy !== "object") return false;
      if(safeTrim(policy.company) !== "מנורה") return false;
      const blob = this.policyBlob(policy);
      return /מחלות\s*קשות/.test(blob);
    },
    isMenoraCancerPolicy(policy){
      if(!policy || typeof policy !== "object") return false;
      if(safeTrim(policy.company) !== "מנורה") return false;
      const blob = this.policyBlob(policy);
      return /סרטן/.test(blob);
    },
    isMenoraCiOrCancerPolicy(policy){
      return this.isMenoraCiPolicy(policy) || this.isMenoraCancerPolicy(policy);
    },
    listMenoraCiPolicies(payload){
      const list = Array.isArray(payload?.newPolicies) ? payload.newPolicies : [];
      return list.filter((p) => this.isMenoraCiOrCancerPolicy(p));
    },
    qualifies(payload){
      return this.listMenoraCiPolicies(payload).length > 0;
    },

    personFromInsured(ins, fallbacks){
      const picked = global.GI_OFFICIAL_FORM_FILL?.pickPerson?.(ins, fallbacks);
      const d = picked || ((ins && ins.data && typeof ins.data === "object") ? ins.data : (ins || {}));
      const firstName = safeTrim(d.firstName);
      const lastName = safeTrim(d.lastName);
      const fullName = safeTrim(d.fullName) || safeTrim((firstName + " " + lastName).trim()) || safeTrim(ins?.label);
      return {
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
        shaban: safeTrim(d.shaban || d.shabanLevel),
        heightCm: safeTrim(d.heightCm),
        weightKg: safeTrim(d.weightKg),
        smokingStatus: safeTrim(d.smokingStatus),
        smokingAmount: safeTrim(d.smokingAmount),
        criticalAmount: "",
        cancerAmount: ""
      };
    },
    amountFromPolicy(policy, insuredId){
      if(!policy) return "";
      const map = policy.compensationPerInsured && typeof policy.compensationPerInsured === "object"
        ? policy.compensationPerInsured : {};
      const fromMap = safeTrim(map[insuredId]);
      if(fromMap) return this.fmtMoneyPlain(fromMap);
      return this.fmtMoneyPlain(policy.compensation || policy.sumInsured || policy.coverageAmount);
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
      const children = raw.filter((x) => x && x !== primary && x !== spouse && safeTrim(x.type) === "child").slice(0, 4);
      return { primary, spouse, children };
    },
    applyAmounts(person, insured, ciPolicy, cancerPolicy){
      if(!person) return;
      person.criticalAmount = this.amountFromPolicy(ciPolicy, insured?.id);
      person.cancerAmount = this.amountFromPolicy(cancerPolicy, insured?.id);
    },

    buildDraft(rec){
      const payload = rec?.payload && typeof rec.payload === "object" ? rec.payload : {};
      const policies = this.listMenoraCiPolicies(payload);
      const ciPolicy = policies.find((p) => this.isMenoraCiPolicy(p)) || null;
      const cancerPolicy = policies.find((p) => this.isMenoraCancerPolicy(p)) || null;
      const { primary, spouse, children } = this.classifyInsureds(payload);
      const primaryPerson = this.personFromInsured(primary || payload.primary || {}, global.GI_OFFICIAL_FORM_FILL?.fileFallbacks?.(rec, payload));
      const spousePerson = spouse ? this.personFromInsured(spouse) : null;
      const childPeople = children.map((ins) => this.personFromInsured(ins));
      this.applyAmounts(primaryPerson, primary, ciPolicy, cancerPolicy);
      this.applyAmounts(spousePerson, spouse, ciPolicy, cancerPolicy);
      childPeople.forEach((p, idx) => this.applyAmounts(p, children[idx], ciPolicy, cancerPolicy));
      const agentNumbers = payload.companyAgentNumbers || payload.operational?.companyAgentNumbers
        || payload.primary?.operationalAgentNumbers || {};
      const payerSrc = payload.primary || primary?.data || {};
      const external = payerSrc.externalPayer && typeof payerSrc.externalPayer === "object" ? payerSrc.externalPayer : {};
      const useExternal = safeTrim(payerSrc.payerChoice) === "external";
      const pay = global.GI_OFFICIAL_FORM_FILL?.pickPayment?.(payload, payerSrc) || { method: "", isHo: false, bank: { name: "", branch: "", account: "", bankNo: "" } };
      const start = (ciPolicy || cancerPolicy || {}).startDate || payload.insuranceStartDate;
      return {
        today: this.fmtTodayHe(),
        insuranceBegin: this.fmtDateHe(start),
        hasCritical: !!ciPolicy,
        hasCancer: !!cancerPolicy,
        payment: pay,
        agentName: safeTrim(global.Auth?.current?.name) || safeTrim(rec?.agentName),
        agentNumber: safeTrim(agentNumbers["מנורה"]) || safeTrim((ciPolicy || cancerPolicy || {}).agentNumber),
        primary: primaryPerson,
        spouse: spousePerson,
        children: childPeople,
        ...(global.GI_OFFICIAL_FORM_FILL?.attachDraftHealth?.(payload, primary, spouse, children) || {}),
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
      return /^05\d{8}$/.test(String(phone || "").replace(/\D+/g, ""));
    },
    composeAddress(person){
      if(!person) return "";
      return [person.street, person.houseNumber, person.apt, person.city, person.zip].map(safeTrim).filter(Boolean).join(" ");
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

    applyPerson(form, person, role, font){
      if(!person) return;
      const isSpouse = role === "spouse";
      const childIdx = String(role || "").indexOf("child") === 0 ? Number(role.slice(5)) : 0;
      const isChild = childIdx > 0;
      const nameS = isSpouse ? "Spouse" : (isChild ? ("Child" + childIdx) : "");
      this.setTextSafe(form, "FirstName" + nameS, person.firstName, font);
      this.setTextSafe(form, "LastName" + nameS, person.lastName, font);
      this.setTextSafe(form, isChild || isSpouse ? ("FullName" + nameS) : "FullName", person.fullName, font);
      this.setTextSafe(form, isChild ? ("MPIDChild" + childIdx) : (isSpouse ? "MPIDSpouse" : "MPID"), person.idNumber, font);
      this.setTextSafe(form, "PID" + nameS, person.idNumber, font);
      this.setTextSafe(form, isChild ? ("MBirthDateChild" + childIdx) : (isSpouse ? "MBirthDateSpouse" : "MBirthDate"), person.birthDate, font);
      this.setTextSafe(form, "EmailAddress" + nameS, person.email, font);
      this.setTextSafe(form, isChild ? ("CityChild" + childIdx) : (isSpouse ? "CitySpouseCode" : "CityCode"), person.city, font);
      this.setTextSafe(form, "StreetName" + nameS, person.street, font);
      this.setTextSafe(form, "HouseNumber" + nameS, person.houseNumber, font);
      this.setTextSafe(form, "ZipCode" + nameS, person.zip, font);
      this.setTextSafe(form, isChild ? ("OccupationChild" + childIdx) : (isSpouse ? "MOccupationCodeSpouse" : "MOccupationCode"), person.occupation, font);
      this.setTextSafe(form, "HMO" + nameS, person.clinic, font);
      this.setTextSafe(form, "Shaban" + nameS, person.shaban, font);
      this.setTextSafe(form, "Hight" + nameS, person.heightCm, font);
      this.setTextSafe(form, "Weight" + nameS, person.weightKg, font);
      const address = this.composeAddress(person);
      if(isSpouse) this.setTextSafe(form, "FullAddressSpouse", address, font);
      if(isChild) this.setTextSafe(form, "FullAddressChild" + childIdx, address, font);
      if(!nameS) this.setTextSafe(form, "Address", address, font);
      const phone = person.phone;
      if(phone){
        if(this.isMobilePhone(phone)) this.setTextSafe(form, "CellPhoneNumber" + nameS, phone, font);
        else this.setTextSafe(form, "PhoneNumber" + nameS, phone, font);
        this.setTextSafe(form, "CellPhoneNumber" + nameS, phone, font);
      }
      this.setExport(form, "Gender" + nameS, this.mapGenderExport(person.gender));
      if(!isChild) this.setExport(form, "FamilyStatus" + nameS, this.mapMaritalExport(person.maritalStatus));
      const smokeField = !nameS ? "IsSmoking" : (isSpouse ? "IsSmokingBzug" : "IsSmoking" + nameS);
      this.setExport(form, smokeField, this.mapSmokingExport(person.smokingStatus));
      if(person.smokingAmount){
        this.setTextSafe(form, isSpouse ? "ClientSmokeNumSpouse" : ("ClientSmokeNum" + nameS), person.smokingAmount, font);
      }
      if((isSpouse || isChild) && !person.street && !person.city){
        this.setExport(form, isSpouse ? "SameAddressSpouse" : ("SameAddressC" + childIdx), "True");
      }
      const critField = !nameS ? "chkDiseaseMainA" : (isSpouse ? "chkDiseaseBzugA" : ("chkDiseaseChildA" + childIdx));
      const cancerField = !nameS ? "chkDiseaseMainB" : (isSpouse ? "chkDiseaseBzugB" : ("chkDiseaseChildB" + childIdx));
      this.setTextSafe(form, critField, person.criticalAmount, font);
      this.setTextSafe(form, cancerField, person.cancerAmount, font);
    },

    async fillOriginalTemplate(draft){
      if(global.GI_LOAD_LIBS?.pdfLib) await global.GI_LOAD_LIBS.pdfLib();
      const PDFLib = global.PDFLib;
      if(!PDFLib?.PDFDocument) throw new Error("PDFLib missing");
      const templateBytes = await this.fetchFirstOk(
        this.candidateUrls("forms/menora-ci/", this.TEMPLATE_FILE),
        "לא נמצא טופס מחלות קשות + סרטן של מנורה"
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
      this.setExport(form, "PolicyDetail", "1");
      this.setExport(form, "PayFrequency", "1");
      this.applyPerson(form, draft.primary, "primary", font);
      this.applyPerson(form, draft.spouse, "spouse", font);
      (draft.children || []).forEach((child, idx) => {
        this.applyPerson(form, child, "child" + (idx + 1), font);
      });
      if(draft.payer){
        this.setTextSafe(form, "FirstNameMeshalem", draft.payer.firstName, font);
        this.setTextSafe(form, "LastNameMeshalem", draft.payer.lastName, font);
        this.setTextSafe(form, "PIDMeshalem", draft.payer.idNumber, font);
        this.setTextSafe(form, "RelationMeshalem", draft.payer.relation, font);
        this.setTextSafe(form, "CellPhoneNumberMeshalem", draft.payer.phone, font);
        this.setTextSafe(form, "EmailMeshalem", draft.payer.email, font);
      }
      global.GI_OFFICIAL_FORM_FILL?.applyOfficialHealthAndNames?.(form, draft, font, {
        keys: "menora_ci",
        visual: false
      });
      global.GI_OFFICIAL_FORM_FILL?.applyStoredPayment?.(form, {
        method: draft.payment?.method || "",
        bank: draft.bank || {},
        cc: draft.payment?.cc || {}
      }, font, {
        textOpts: { visual: false },
        bankAccountAlt: "MBankAccountNumber",
        hoMarks: [{ field: "PayWay", value: "3" }],
        ccMarks: [{ field: "PayWay", value: "1" }]
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
      return "מחלות_קשות_סרטן_מנורה_" + name.replace(/[\\/:*?\"<>|]/g, "_") + "_" + nowISO().slice(0, 10) + ".pdf";
    },
    fieldRow(label, name, value, extra){
      return `<label class="menoraCiForm__field">
        <span>${escapeHtml(label)}</span>
        <input class="input" type="text" data-menoraci="${escapeHtml(name)}" value="${escapeHtml(value || "")}" ${extra || ""} />
      </label>`;
    },
    personBlock(title, prefix, person){
      const p = person || {};
      return `<section class="menoraCiForm__block">
        <div class="menoraCiForm__blockTitle">${escapeHtml(title)}</div>
        <div class="menoraCiForm__grid">
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
          ${this.fieldRow("קופת חולים", prefix + ".clinic", p.clinic)}
          ${this.fieldRow("שב״ן", prefix + ".shaban", p.shaban)}
          ${this.fieldRow("גובה", prefix + ".heightCm", p.heightCm, 'dir="ltr"')}
          ${this.fieldRow("משקל", prefix + ".weightKg", p.weightKg, 'dir="ltr"')}
          ${this.fieldRow("עישון", prefix + ".smokingStatus", p.smokingStatus)}
          ${this.fieldRow("סכום מחלות קשות", prefix + ".criticalAmount", p.criticalAmount, 'dir="ltr"')}
          ${this.fieldRow("סכום סרטן", prefix + ".cancerAmount", p.cancerAmount, 'dir="ltr"')}
        </div>
      </section>`;
    },
    collectDraftFromModal(root, draft){
      const next = JSON.parse(JSON.stringify(draft || {}));
      root.querySelectorAll("[data-menoraci]").forEach((el) => {
        const path = safeTrim(el.getAttribute("data-menoraci"));
        if(!path) return;
        const parts = path.split(".");
        let cur = next;
        for(let i = 0; i < parts.length - 1; i++){
          const key = parts[i];
          const idx = key.match(/^children\[(\d+)\]$/);
          if(idx){
            if(!Array.isArray(cur.children)) cur.children = [];
            const n = Number(idx[1]);
            if(!cur.children[n]) cur.children[n] = {};
            cur = cur.children[n];
          } else {
            if(!cur[key] || typeof cur[key] !== "object") cur[key] = {};
            cur = cur[key];
          }
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
      if(document.getElementById("menoraCiFormStyle")) return;
      const style = document.createElement("style");
      style.id = "menoraCiFormStyle";
      style.textContent = `
        .menoraCiFormModal .giValModal__card{ max-width:min(980px,96vw); width:100%; height:min(92vh,920px); max-height:min(92vh,920px); }
        .menoraCiForm__hint{ font-size:13px; line-height:1.45; color:#475569; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:12px; padding:10px 12px; }
        .menoraCiForm__block{ border:1px solid #E5EAF3; border-radius:14px; padding:12px 14px 14px; background:#fff; }
        .menoraCiForm__blockTitle{ font-size:14px; font-weight:800; color:#0B1F4B; margin-bottom:10px; }
        .menoraCiForm__grid{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px 12px; }
        .menoraCiForm__field{ display:flex; flex-direction:column; gap:4px; min-width:0; }
        .menoraCiForm__field span{ font-size:12px; font-weight:700; color:#647287; }
        .menoraCiFormPreview{ padding:12px 4px; display:flex; flex-direction:column; gap:10px; }
        .menoraCiFormPreview__row{ display:flex; justify-content:space-between; gap:12px; font-size:13.5px; }
        .menoraCiFormPreview__row span{ color:#647287; }
        .menoraCiFormPreview__row strong{ color:#0F172A; font-weight:750; }
        @media (max-width:720px){ .menoraCiForm__grid{ grid-template-columns:1fr; } }
      `;
      document.head.appendChild(style);
    },
    renderPreviewHtml(draft){
      const products = [draft.hasCritical ? "מחלות קשות" : "", draft.hasCancer ? "סרטן" : ""].filter(Boolean).join(" + ") || "מחלות קשות / סרטן";
      const people = [draft.primary, draft.spouse].concat(draft.children || []).filter(Boolean);
      const rows = people.map((p, idx) => {
        const role = idx === 0 ? "מבוטח ראשי" : (idx === 1 && draft.spouse ? "בן/בת זוג" : "ילד");
        return `<div class="menoraCiFormPreview__row"><span>${escapeHtml(role)}</span><strong>${escapeHtml(p.fullName || "—")}</strong></div>`;
      }).join("");
      return `<div class="menoraCiFormPreview">
        <div class="menoraCiFormPreview__row"><span>חברה / מוצר</span><strong>מנורה · ${escapeHtml(products)}</strong></div>
        <div class="menoraCiFormPreview__row"><span>תחילת ביטוח</span><strong>${escapeHtml(draft.insuranceBegin || "—")}</strong></div>
        ${rows}
        ${global.CustomerDocuments?.canDownloadOfficialJoinForm?.() ? `<button class="btn btn--primary" type="button" data-menoraci-open="1">פתח טופס דיגיטלי</button>` : ""}
      </div>`;
    },
    close(){
      const modal = this._modal;
      this._modal = null;
      this._draft = null;
      if(modal && modal.parentNode) modal.parentNode.removeChild(modal);
    },
    bind(modal){
      modal.querySelectorAll("[data-menoraci-close]").forEach((el) => {
        el.addEventListener("click", () => this.close());
      });
      const dl = modal.querySelector("[data-menoraci-download]");
      if(dl){
        dl.addEventListener("click", async () => {
          const original = dl.textContent;
          dl.disabled = true;
          dl.textContent = "מפיק PDF…";
          try {
            const draft = this.collectDraftFromModal(modal, this._draft);
            const bytes = await this.fillOriginalTemplate(draft);
            this.downloadBytes(bytes, this.fileName(draft));
            try { global.showToast?.({ title: "הטופס הורד", text: "PDF מקורי של מנורה — ממולא מהפרטים שבתיק.", variant: "success", durationMs: 5200 }); } catch(_e) {}
          } catch(err){
            try { console.error("MENORA_CI_PDF_FAILED", err); } catch(_e) {}
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
      const childrenHtml = (draft.children || []).map((child, idx) =>
        this.personBlock("ילד " + (idx + 1), "children[" + idx + "]", child)
      ).join("");
      const modal = document.createElement("div");
      modal.className = "giValModal menoraCiFormModal is-open giValModal--visible";
      modal.innerHTML = `
        <div class="giValModal__backdrop" data-menoraci-close="1"></div>
        <div class="giValModal__card">
          <div class="giValModal__head">
            <div class="giValModal__headText">
              <div class="giValModal__title">טופס מקורי — מחלות קשות + סרטן · מנורה</div>
              <div class="giValModal__sub">פרטים מהתיק כבר ממולאים. השלימו מה שחסר והורידו PDF רשמי.</div>
            </div>
            <button type="button" class="giValModal__closeX" data-menoraci-close="1" aria-label="סגירה">✕</button>
          </div>
          <div class="giValModal__body">
            <div class="menoraCiForm__hint">ממולא אוטומטית רק מה ששמור בתיק, כולל כן/לא בהצהרת בריאות ואמצעי תשלום. פירוט רפואי וחתימות לא ממולאים — אותם משלימים בטופס או ב-PDF אחרי ההורדה.</div>
            <section class="menoraCiForm__block">
              <div class="menoraCiForm__blockTitle">פרטי הצעה וסוכן</div>
              <div class="menoraCiForm__grid">
                ${this.fieldRow("תחילת ביטוח", "insuranceBegin", draft.insuranceBegin, 'dir="ltr"')}
                ${this.fieldRow("תאריך היום", "today", draft.today, 'dir="ltr"')}
                ${this.fieldRow("שם סוכן", "agentName", draft.agentName)}
                ${this.fieldRow("מספר סוכן", "agentNumber", draft.agentNumber, 'dir="ltr"')}
              </div>
            </section>
            ${this.personBlock("מבוטח ראשי", "primary", draft.primary)}
            ${draft.spouse ? this.personBlock("בן / בת זוג", "spouse", draft.spouse) : ""}
            ${childrenHtml}
            <section class="menoraCiForm__block">
              <div class="menoraCiForm__blockTitle">משלם והוראת קבע — רק אם נרשם בתיק</div>
              <div class="menoraCiForm__grid">
                ${this.fieldRow("שם פרטי משלם", "payer.firstName", draft.payer.firstName)}
                ${this.fieldRow("שם משפחה משלם", "payer.lastName", draft.payer.lastName)}
                ${this.fieldRow("ת״ז משלם", "payer.idNumber", draft.payer.idNumber, 'dir="ltr"')}
                ${this.fieldRow("קרבה", "payer.relation", draft.payer.relation)}
                ${this.fieldRow("בנק", "bank.name", draft.bank.name)}
                ${this.fieldRow("חשבון", "bank.account", draft.bank.account, 'dir="ltr"')}
              </div>
            </section>
          </div>
          <div class="giValModal__foot">
            <button type="button" class="btn" data-menoraci-close="1">סגור</button>
            <button type="button" class="btn btn--primary" data-menoraci-download="1">הורד PDF רשמי</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      this._modal = modal;
      this.bind(modal);
    }
  };

  global.MenoraCiForm = MenoraCiForm;
})(typeof window !== "undefined" ? window : globalThis);
