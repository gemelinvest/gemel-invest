/* GEMEL INVEST — טופס מקורי סרטן מגדל (08.2025, 3159 / 494)
   נטען לפי דרישה ממסמכי לקוח. ממלא רק ערכים שכבר שמורים בתיק, כולל סכום פיצוי ותשלום.
   עברית לוגית (לא הפוכה) — כמו בטפסי כלל. */
(function installMigdalCancerForm(global){
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

  const MigdalCancerForm = {
    TEMPLATE_BASE: "./forms/migdal-cancer/",
    TEMPLATE_FILE: "migdal-cancer-join.pdf",
    FONT_URL: "./fonts/Heebo-Bold.ttf",
    VERSION: "20260824-health-align-v1",
    DOC_ID: "doc_migdal_cancer_form",
    DOC_TYPE: "migdal_cancer_form",

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
    isMigdalCancerPolicy(policy){
      if(!policy || typeof policy !== "object") return false;
      if(safeTrim(policy.company) !== "מגדל") return false;
      if(safeTrim(policy.type) === "סרטן") return true;
      const blob = this.policyBlob(policy);
      if(/משכנתא/.test(blob) || /בריאות/.test(blob) || /ריסק/.test(blob) || /מחלות\s*קשות/.test(blob)) return false;
      return /סרטן/.test(blob);
    },
    listMigdalCancerPolicies(payload){
      const list = Array.isArray(payload?.newPolicies) ? payload.newPolicies : [];
      return list.filter((p) => this.isMigdalCancerPolicy(p));
    },
    qualifies(payload){
      return this.listMigdalCancerPolicies(payload).length > 0;
    },
    policyCoversPerson(policy, insured){
      const ids = Array.isArray(policy?.insuredIds) ? policy.insuredIds.map(safeTrim).filter(Boolean) : [];
      if(!ids.length) return true;
      const id = safeTrim(insured?.id);
      return !id || ids.indexOf(id) >= 0;
    },
    amountFromPolicy(policy, insuredId){
      if(!policy) return "";
      const map = policy.compensationPerInsured && typeof policy.compensationPerInsured === "object"
        ? policy.compensationPerInsured : {};
      const fromMap = safeTrim(map[insuredId]);
      if(fromMap) return this.fmtMoneyPlain(fromMap);
      const sumMap = policy.sumInsuredPerInsured && typeof policy.sumInsuredPerInsured === "object"
        ? policy.sumInsuredPerInsured : {};
      const fromSum = safeTrim(sumMap[insuredId]);
      if(fromSum) return this.fmtMoneyPlain(fromSum);
      return this.fmtMoneyPlain(policy.compensation || policy.sumInsured || policy.coverageAmount);
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
        shaban: safeTrim(d.shaban || d.shabanLevel),
        heightCm: safeTrim(d.heightCm),
        weightKg: safeTrim(d.weightKg),
        smokingStatus: safeTrim(d.smokingStatus),
        smokingAmount: safeTrim(d.smokingAmount),
        cancerAmount: ""
      };
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
    applyAmount(person, insured, policies){
      if(!person) return;
      (policies || []).forEach((p) => {
        if(!this.policyCoversPerson(p, insured)) return;
        if(!person.cancerAmount) person.cancerAmount = this.amountFromPolicy(p, insured?.id);
      });
    },

    buildDraft(rec){
      const payload = rec?.payload && typeof rec.payload === "object" ? rec.payload : {};
      const policies = this.listMigdalCancerPolicies(payload);
      const policy = policies[0] || {};
      const { primary, spouse, children } = this.classifyInsureds(payload);
      const primaryPerson = this.personFromInsured(primary || payload.primary || {}, global.GI_OFFICIAL_FORM_FILL?.fileFallbacks?.(rec, payload));
      const spousePerson = spouse ? this.personFromInsured(spouse) : null;
      const childPeople = children.map((ins) => this.personFromInsured(ins));
      this.applyAmount(primaryPerson, primary, policies);
      this.applyAmount(spousePerson, spouse, policies);
      childPeople.forEach((p, idx) => this.applyAmount(p, children[idx], policies));
      const agentNumbers = payload.companyAgentNumbers || payload.operational?.companyAgentNumbers
        || payload.primary?.operationalAgentNumbers || {};
      const payerSrc = payload.primary || primary?.data || {};
      const external = payerSrc.externalPayer && typeof payerSrc.externalPayer === "object" ? payerSrc.externalPayer : {};
      const useExternal = safeTrim(payerSrc.payerChoice) === "external";
      const pay = global.GI_OFFICIAL_FORM_FILL?.pickPayment?.(payload, payerSrc) || { method: "", isHo: false, bank: { name: "", branch: "", account: "", bankNo: "" } };
      return {
        today: this.fmtTodayHe(),
        insuranceBegin: this.fmtDateHe(policy.startDate || payload.insuranceStartDate),
        payment: pay,
        agentName: safeTrim(global.Auth?.current?.name) || safeTrim(rec?.agentName),
        agentNumber: safeTrim(agentNumbers["מגדל"]) || safeTrim(policy.agentNumber),
        discountPack: safeTrim(policy.discountPackageNum || policy.packageNum || policy.discountOption?.packageNum),
        primary: primaryPerson,
        spouse: spousePerson,
        children: childPeople,
        ...(global.GI_OFFICIAL_FORM_FILL?.attachDraftHealth?.(payload, primary, spouse, children) || {}),
        payer: {
          name: useExternal ? safeTrim((external.firstName + " " + external.lastName).trim()) : (pay.isHo ? (primaryPerson.fullName || "") : ""),
          idNumber: useExternal ? safeTrim(external.idNumber) : (pay.isHo ? (primaryPerson.idNumber || "") : "")
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
      if(/past|עבר|עישנתי|הפסק/.test(s)) return "True";
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
    setExportFlex(form, fieldName, exportValue){
      if(!exportValue) return;
      this.setExport(form, fieldName, exportValue);
      if(exportValue === "True" || exportValue === "False"){
        this.setExport(form, fieldName, exportValue + " ");
      }
    },

    applyPerson(form, person, role, font){
      if(!person) return;
      const isSpouse = role === "spouse";
      const childIdx = String(role || "").indexOf("child") === 0 ? Number(role.slice(5)) : 0;
      const isChild = childIdx > 0;
      const nameS = isSpouse ? "Spouse" : (isChild ? ("Child" + childIdx) : "");
      this.setTextSafe(form, "FirstName" + nameS, person.firstName, font);
      this.setTextSafe(form, "LastName" + nameS, person.lastName, font);
      if(isChild) this.setTextSafe(form, "FullNameChild" + childIdx, person.fullName, font);
      this.setTextSafe(form, "PID" + nameS, person.idNumber, font);
      this.setTextSafe(form, "BirthDate" + nameS, person.birthDate, font);
      this.setTextSafe(form, "EmailAddress" + nameS, person.email, font);
      if(isSpouse){
        this.setTextSafe(form, "CitySpouse", person.city, font);
        this.setTextSafe(form, "StreetNameSpouse", person.street, font);
        this.setTextSafe(form, "OccupationCodeSpouse", person.occupation, font);
      } else if(!isChild){
        this.setTextSafe(form, "City", person.city, font);
        this.setTextSafe(form, "StreetName", person.street, font);
        this.setTextSafe(form, "OccupationCode", person.occupation, font);
      }
      this.setTextSafe(form, "HouseNumber" + nameS, person.houseNumber, font);
      this.setTextSafe(form, "AptNumber" + nameS, person.apt, font);
      this.setTextSafe(form, "ZipCode" + nameS, person.zip, font);
      this.setTextSafe(form, "Shaban" + nameS, person.shaban, font);
      const phone = person.phone || person.phoneHome;
      if(phone){
        if(this.isMobilePhone(phone) || !nameS) this.setTextSafe(form, "CellPhoneNumber" + nameS, phone, font);
        else this.setTextSafe(form, "PhoneNumber" + nameS, phone, font);
        if(!nameS) this.setTextSafe(form, "CellPhoneNumber", phone, font);
      }
      this.setExport(form, "Gender" + nameS, this.mapGenderExport(person.gender));
      if(!isChild) this.setExport(form, "FamilyStatus" + nameS, this.mapMaritalExport(person.maritalStatus));
      const smokeField = !nameS ? "IsSmoking" : (isSpouse ? "IsSmokingBzug" : ("IsSmokingChild" + childIdx));
      const smokeVal = this.mapSmokingExport(person.smokingStatus);
      if(isChild) this.setExportFlex(form, smokeField, smokeVal);
      else this.setExport(form, smokeField, smokeVal);
      if(person.smokingAmount && !isChild){
        this.setTextSafe(form, isSpouse ? "ClientSmokeNumSpouse" : "ClientSmokeNum", person.smokingAmount, font);
      }
      const cancerField = !nameS ? "chkDiseaseMainB" : (isSpouse ? "chkDiseaseBzugB" : ("chkDiseaseChildB" + childIdx));
      this.setTextSafe(form, cancerField, person.cancerAmount, font);
    },

    async fillOriginalTemplate(draft){
      if(global.GI_LOAD_LIBS?.pdfLib) await global.GI_LOAD_LIBS.pdfLib();
      const PDFLib = global.PDFLib;
      if(!PDFLib?.PDFDocument) throw new Error("PDFLib missing");
      const templateBytes = await this.fetchFirstOk(
        this.candidateUrls("forms/migdal-cancer/", this.TEMPLATE_FILE),
        "לא נמצא טופס סרטן של מגדל"
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
      this.setTextSafe(form, "DiseaseDiscountPack", draft.discountPack, font);
      this.applyPerson(form, draft.primary, "primary", font);
      this.applyPerson(form, draft.spouse, "spouse", font);
      (draft.children || []).forEach((child, idx) => {
        this.applyPerson(form, child, "child" + (idx + 1), font);
      });
      if((draft.payment?.method === "ho") && draft.payer){
        this.setTextSafe(form, "BankAccOwner", draft.payer.name, font);
        this.setTextSafe(form, "PIDBankAccOwner", draft.payer.idNumber, font);
      }
      global.GI_OFFICIAL_FORM_FILL?.applyPrimaryNameExtras?.(form, draft.primary && draft.primary.fullName, font, ["FullNameBagir", "FullNameHolder"], { visual: false });
      global.GI_OFFICIAL_FORM_FILL?.applyMappedHealthYesNo?.(form, {
        map: "migdal_cancer",
        responses: draft.healthResponses,
        primaryId: draft.primaryId || (draft.primary && draft.primary.id) || "",
        spouseId: draft.spouseId || (draft.spouse && draft.spouse.id) || "",
        childIds: (draft.childIds && draft.childIds.length)
          ? draft.childIds
          : (draft.children || []).map((c) => String(c && c.id != null ? c.id : "").trim()).filter(Boolean)
      });
      global.GI_OFFICIAL_FORM_FILL?.applyStoredPayment?.(form, {
        method: draft.payment?.method || "",
        bank: draft.bank || {},
        cc: draft.payment?.cc || {}
      }, font, {
        textOpts: { visual: false },
        bankNameCode: "BankNameCode",
        bankBranchCode: "BankBranchCode",
        bankAccountAlt: "AccountNumber",
        hoMarks: [{ field: "IncludeAuth", value: "1" }],
        ccMarks: [{ field: "CreditCardPay", value: "1" }]
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
      return "סרטן_מגדל_" + name.replace(/[\\/:*?\"<>|]/g, "_") + "_" + nowISO().slice(0, 10) + ".pdf";
    },

    fieldRow(label, name, value, extra){
      return `<label class="migCancerForm__field">
        <span>${escapeHtml(label)}</span>
        <input class="input" type="text" data-migcancer="${escapeHtml(name)}" value="${escapeHtml(value || "")}" ${extra || ""} />
      </label>`;
    },
    personBlock(title, prefix, person){
      const p = person || {};
      return `<section class="migCancerForm__block">
        <div class="migCancerForm__blockTitle">${escapeHtml(title)}</div>
        <div class="migCancerForm__grid">
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
          ${this.fieldRow("שבאן", prefix + ".shaban", p.shaban)}
          ${this.fieldRow("עישון", prefix + ".smokingStatus", p.smokingStatus)}
          ${this.fieldRow("סכום פיצוי סרטן", prefix + ".cancerAmount", p.cancerAmount, 'dir="ltr"')}
        </div>
      </section>`;
    },
    collectDraftFromModal(root, draft){
      const next = JSON.parse(JSON.stringify(draft || {}));
      root.querySelectorAll("[data-migcancer]").forEach((el) => {
        const path = safeTrim(el.getAttribute("data-migcancer"));
        if(!path) return;
        const parts = path.split(".");
        let cur = next;
        for(let i = 0; i < parts.length - 1; i++){
          const key = parts[i];
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
      if(document.getElementById("migCancerFormStyle")) return;
      const style = document.createElement("style");
      style.id = "migCancerFormStyle";
      style.textContent = `
        .migCancerFormModal .giValModal__card{ max-width:min(980px,96vw); width:100%; height:min(92vh,920px); max-height:min(92vh,920px); }
        .migCancerForm__hint{ font-size:13px; line-height:1.45; color:#475569; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:12px; padding:10px 12px; }
        .migCancerForm__block{ border:1px solid #E5EAF3; border-radius:14px; padding:12px 14px 14px; background:#fff; }
        .migCancerForm__blockTitle{ font-size:14px; font-weight:800; color:#0B1F4B; margin-bottom:10px; }
        .migCancerForm__grid{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px 12px; }
        .migCancerForm__field{ display:flex; flex-direction:column; gap:4px; min-width:0; }
        .migCancerForm__field span{ font-size:12px; font-weight:700; color:#647287; }
        .migCancerFormPreview{ padding:12px 4px; display:flex; flex-direction:column; gap:10px; }
        .migCancerFormPreview__row{ display:flex; justify-content:space-between; gap:12px; font-size:13.5px; }
        .migCancerFormPreview__row span{ color:#647287; }
        .migCancerFormPreview__row strong{ color:#0F172A; font-weight:750; }
        @media (max-width:720px){ .migCancerForm__grid{ grid-template-columns:1fr; } }
      `;
      document.head.appendChild(style);
    },
    renderPreviewHtml(draft){
      const people = [draft.primary, draft.spouse].concat(draft.children || []).filter(Boolean);
      const rows = people.map((p, idx) => {
        const role = idx === 0 ? "מבוטח ראשי" : (idx === 1 && draft.spouse ? "מועמד משני" : "ילד");
        const sum = p.cancerAmount ? (" · פיצוי " + p.cancerAmount) : "";
        return `<div class="migCancerFormPreview__row"><span>${escapeHtml(role)}</span><strong>${escapeHtml(p.fullName || "—")}${escapeHtml(sum)}</strong></div>`;
      }).join("");
      return `<div class="migCancerFormPreview">
        <div class="migCancerFormPreview__row"><span>חברה / מוצר</span><strong>מגדל · סרטן</strong></div>
        <div class="migCancerFormPreview__row"><span>תחילת ביטוח</span><strong>${escapeHtml(draft.insuranceBegin || "—")}</strong></div>
        ${rows}
        ${global.CustomerDocuments?.canDownloadOfficialJoinForm?.() ? `<button class="btn btn--primary" type="button" data-migcancer-open="1">פתח טופס דיגיטלי</button>` : ""}
      </div>`;
    },
    close(){
      const modal = this._modal;
      this._modal = null;
      this._draft = null;
      if(modal && modal.parentNode) modal.parentNode.removeChild(modal);
    },
    bind(modal){
      modal.querySelectorAll("[data-migcancer-close]").forEach((el) => {
        el.addEventListener("click", () => this.close());
      });
      const dl = modal.querySelector("[data-migcancer-download]");
      if(dl){
        dl.addEventListener("click", async () => {
          const original = dl.textContent;
          dl.disabled = true;
          dl.textContent = "מפיק PDF…";
          try {
            const draft = this.collectDraftFromModal(modal, this._draft);
            const bytes = await this.fillOriginalTemplate(draft);
            this.downloadBytes(bytes, this.fileName(draft));
            try { global.showToast?.({ title: "הטופס הורד", text: "PDF מקורי של מגדל סרטן — ממולא מהפרטים ומהפיצוי שבתיק.", variant: "success", durationMs: 5200 }); } catch(_e) {}
          } catch(err){
            try { console.error("MIGDAL_CANCER_PDF_FAILED", err); } catch(_e) {}
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
      const modal = document.createElement("div");
      modal.className = "giValModal migCancerFormModal is-open giValModal--visible";
      modal.innerHTML = `
        <div class="giValModal__backdrop" data-migcancer-close="1"></div>
        <div class="giValModal__card">
          <div class="giValModal__head">
            <div class="giValModal__headText">
              <div class="giValModal__title">טופס מקורי — סרטן · מגדל</div>
              <div class="giValModal__sub">פרטים וסכום פיצוי מההצעה כבר ממולאים. השלימו מה שחסר והורידו PDF רשמי.</div>
            </div>
            <button type="button" class="giValModal__closeX" data-migcancer-close="1" aria-label="סגירה">✕</button>
          </div>
          <div class="giValModal__body">
            <div class="migCancerForm__hint">ממולא אוטומטית רק מה ששמור בתיק: פרטים אישיים, סכום פיצוי מההצעה, כן/לא בהצהרת בריאות ואמצעי תשלום. עברית בטופס נשארת תקינה (לא הפוכה). פירוט רפואי, ביטול ביטוח וחתימות לא ממולאים.</div>
            <section class="migCancerForm__block">
              <div class="migCancerForm__blockTitle">פרטי הצעה וסוכן</div>
              <div class="migCancerForm__grid">
                ${this.fieldRow("תחילת ביטוח", "insuranceBegin", draft.insuranceBegin, 'dir="ltr"')}
                ${this.fieldRow("תאריך היום", "today", draft.today, 'dir="ltr"')}
                ${this.fieldRow("שם סוכן", "agentName", draft.agentName)}
                ${this.fieldRow("מספר סוכן", "agentNumber", draft.agentNumber, 'dir="ltr"')}
              </div>
            </section>
            ${this.personBlock("מבוטח ראשי", "primary", draft.primary)}
            ${draft.spouse ? this.personBlock("מועמד משני", "spouse", draft.spouse) : ""}
            ${(draft.children || []).map((c, i) => this.personBlock("ילד " + (i + 1), "children." + i, c)).join("")}
            <section class="migCancerForm__block">
              <div class="migCancerForm__blockTitle">משלם והוראת קבע — רק אם נרשם בתיק</div>
              <div class="migCancerForm__grid">
                ${this.fieldRow("שם משלם", "payer.name", draft.payer.name)}
                ${this.fieldRow("ת״ז משלם", "payer.idNumber", draft.payer.idNumber, 'dir="ltr"')}
                ${this.fieldRow("בנק", "bank.name", draft.bank.name)}
                ${this.fieldRow("סניף", "bank.branch", draft.bank.branch, 'dir="ltr"')}
                ${this.fieldRow("חשבון", "bank.account", draft.bank.account, 'dir="ltr"')}
              </div>
            </section>
          </div>
          <div class="giValModal__foot">
            <button type="button" class="btn" data-migcancer-close="1">סגור</button>
            <button type="button" class="btn btn--primary" data-migcancer-download="1">הורד PDF רשמי</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      this._modal = modal;
      this.bind(modal);
    }
  };

  global.MigdalCancerForm = MigdalCancerForm;
})(typeof window !== "undefined" ? window : globalThis);
