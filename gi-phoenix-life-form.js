/* GEMEL INVEST — טופס מקורי ריסק / משכנתא · הפניקס
   083 מקוצר עד גיל 55 ועד 2,000,000 ₪ · 085 מורחב מעל גיל 55 או מעל 2 מיליון.
   נטען לפי דרישה ממסמכי לקוח. ממלא רק ערכים שכבר שמורים בתיק.
   עברית לוגית (לא הפוכה). כן/לא לפי שמות שדות Q — בלי הזזה לפי אינדקס. */
(function installPhoenixLifeForm(global){
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

  const PhoenixLifeForm = {
    VERSION: "20260824-phoenix-life-v1",
    FONT_URL: "./fonts/Heebo-Bold.ttf",
    MODE_SHORT: "short",
    MODE_FULL: "full",

    templateOf(mode){
      if(mode === this.MODE_FULL){
        return {
          folder: "forms/phoenix-life-full/",
          file: "phoenix-life-full-join.pdf",
          docId: "doc_phoenix_life_full_form",
          docType: "phoenix_life_full_form",
          title: "טופס מקורי — ריסק / משכנתא מעל גיל 55 / מעל 2 מיליון · הפניקס",
          productLabel: "הפניקס · ריסק / משכנתא מורחב (טופס 300306085)",
          missing: "לא נמצא טופס ריסק מורחב של הפניקס"
        };
      }
      return {
        folder: "forms/phoenix-life-short/",
        file: "phoenix-life-short-join.pdf",
        docId: "doc_phoenix_life_short_form",
        docType: "phoenix_life_short_form",
        title: "טופס מקורי — ריסק / משכנתא עד גיל 55 · הפניקס",
        productLabel: "הפניקס · ריסק / משכנתא מקוצר עד גיל 55 ועד 2,000,000 ₪ (טופס 300306083)",
        missing: "לא נמצא טופס ריסק מקוצר של הפניקס"
      };
    },

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
    listPhoenixPolicies(payload){
      const docs = global.CustomerDocuments;
      const list = Array.isArray(payload?.newPolicies) ? payload.newPolicies : [];
      if(docs && docs.isPhoenixRiskMortgagePolicy){
        return list.filter((p) => docs.isPhoenixRiskMortgagePolicy(p));
      }
      return list.filter((p) => safeTrim(p?.company) === "הפניקס" && (safeTrim(p?.type) === "ריסק" || safeTrim(p?.type) === "ריסק משכנתא"));
    },
    qualifiesShort(payload, rec){
      return !!(global.CustomerDocuments && global.CustomerDocuments.qualifiesForPhoenixLifeShortForm(payload, rec));
    },
    qualifiesFull(payload, rec){
      return !!(global.CustomerDocuments && global.CustomerDocuments.qualifiesForPhoenixLifeFullForm(payload, rec));
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

    personFromExternal(external){
      const ex = external && typeof external === "object" ? external : {};
      const firstName = safeTrim(ex.firstName);
      const lastName = safeTrim(ex.lastName);
      const fullName = safeTrim((firstName + " " + lastName).trim()) || safeTrim(ex.fullName);
      return {
        firstName,
        lastName,
        fullName,
        idNumber: safeTrim(ex.idNumber),
        city: safeTrim(ex.city),
        street: safeTrim(ex.street),
        houseNumber: safeTrim(ex.houseNumber),
        zip: safeTrim(ex.zip),
        apt: safeTrim(ex.apartment || ex.aptNumber)
      };
    },

    buildDraft(rec, mode){
      const useMode = mode === this.MODE_FULL ? this.MODE_FULL : this.MODE_SHORT;
      const payload = rec?.payload && typeof rec.payload === "object" ? rec.payload : {};
      const policies = this.listPhoenixPolicies(payload);
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
      const payerPerson = useExternal ? this.personFromExternal(external) : primaryPerson;
      return {
        mode: useMode,
        today: this.fmtTodayHe(),
        insuranceBegin: this.fmtDateHe(policy.startDate || payload.insuranceStartDate),
        payment: pay,
        agentName: safeTrim(global.Auth?.current?.name) || safeTrim(rec?.agentName),
        agentNumber: safeTrim(agentNumbers["הפניקס"]) || safeTrim(policy.agentNumber),
        primary: primaryPerson,
        spouse: spousePerson,
        ...(global.GI_OFFICIAL_FORM_FILL?.attachDraftHealth?.(payload, primary, spouse) || {}),
        payerPerson,
        payer: {
          name: useExternal ? safeTrim((external.firstName + " " + external.lastName).trim()) : (primaryPerson.fullName || ""),
          idNumber: useExternal ? safeTrim(external.idNumber) : (primaryPerson.idNumber || ""),
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
      this.setTextSafe(form, s === "Spouse" ? "ProfessionSpouse" : "Proffession", person.occupation, font);
      this.setTextSafe(form, s ? ("HMOName" + s) : "HMOName", person.clinic, font);
      this.setTextSafe(form, "Hight" + s, person.heightCm, font);
      this.setTextSafe(form, "Weight" + s, person.weightKg, font);
      this.setTextSafe(form, s ? ("AptNumber" + s) : "AptNumber", person.apt, font);
      if(!s) this.setTextSafe(form, "Address", address, font);
      if(s === "Spouse") this.setTextSafe(form, "FullAddressSpouse", address, font);
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

    applyOwnerFromPrimary(form, person, font){
      if(!person) return;
      this.setTextSafe(form, "FirstNameOwner", person.firstName, font);
      this.setTextSafe(form, "LastNameOwner", person.lastName, font);
      this.setTextSafe(form, "PIDOwner", person.idNumber, font);
      this.setTextSafe(form, "BirthDateOwner", person.birthDate, font);
      this.setTextSafe(form, "EmailAddressOwner", person.email, font);
      this.setTextSafe(form, "CityOwner", person.city, font);
      this.setTextSafe(form, "StreetNameOwner", person.street, font);
      this.setTextSafe(form, "HouseNumberOwner", person.houseNumber, font);
      this.setTextSafe(form, "ZipCodeOwner", person.zip, font);
      this.setTextSafe(form, "AptNumberOwner", person.apt, font);
      this.setExport(form, "GenderOwner", this.mapGenderExport(person.gender));
      const phone = person.phone;
      if(phone){
        if(this.isMobilePhone(phone)) this.setTextSafe(form, "CellPhoneNumberOwner", phone, font);
        else this.setTextSafe(form, "PhoneNumberOwner", phone, font);
        this.setTextSafe(form, "CellPhoneNumberOwner", phone, font);
      }
    },

    applyPayerZone(form, draft, font){
      const person = draft.payerPerson || draft.primary;
      if(!person) return;
      this.setTextSafe(form, "PayerFirstName", person.firstName, font);
      this.setTextSafe(form, "PayerLastName", person.lastName, font);
      this.setTextSafe(form, "PayerPID", person.idNumber, font);
      this.setTextSafe(form, "FullNamePayer", person.fullName, font);
      this.setTextSafe(form, "PayerCity", person.city, font);
      this.setTextSafe(form, "PayerStreetName", person.street, font);
      this.setTextSafe(form, "PayerHouseNumber", person.houseNumber, font);
      this.setTextSafe(form, "PayerZipCode", person.zip, font);
      if(draft.payer && draft.payer.relation){
        this.setTextSafe(form, "PayerRelation", draft.payer.relation, font);
      }
      if((draft.payment?.method === "ho") && person.fullName){
        this.setTextSafe(form, "BankAccOwner", person.fullName, font);
        this.setTextSafe(form, "PIDBankAccOwner", person.idNumber, font);
      }
    },

    async fillOriginalTemplate(draft){
      if(global.GI_LOAD_LIBS?.pdfLib) await global.GI_LOAD_LIBS.pdfLib();
      const PDFLib = global.PDFLib;
      if(!PDFLib?.PDFDocument) throw new Error("PDFLib missing");
      const tpl = this.templateOf(draft && draft.mode);
      const templateBytes = await this.fetchFirstOk(
        this.candidateUrls(tpl.folder, tpl.file),
        tpl.missing
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
      this.applyPerson(form, draft.primary, "", font);
      this.applyPerson(form, draft.spouse, "Spouse", font);
      this.applyOwnerFromPrimary(form, draft.primary, font);
      this.applyPayerZone(form, draft, font);
      if(draft.primary){
        this.setTextSafe(form, "GiluiTotalRisk", draft.primary.sumInsured, font);
      }
      if(draft.spouse){
        this.setTextSafe(form, "GiluiTotalRiskSpouse", draft.spouse.sumInsured, font);
      }
      global.GI_OFFICIAL_FORM_FILL?.applyOfficialHealthAndNames?.(form, draft, font, {
        skipHealth: true,
        visual: false,
        extraNames: ["FullNameBagir", "FullNameHolder"]
      });
      global.GI_OFFICIAL_FORM_FILL?.applyNamedHealthYesNo?.(form, {
        mode: draft.mode === this.MODE_FULL ? this.MODE_FULL : this.MODE_SHORT,
        responses: draft.healthResponses,
        primaryId: draft.primaryId || (draft.primary && draft.primary.id) || "",
        spouseId: draft.spouseId || (draft.spouse && draft.spouse.id) || ""
      });
      global.GI_OFFICIAL_FORM_FILL?.applyStoredPayment?.(form, {
        method: draft.payment?.method || "",
        bank: draft.bank || {},
        cc: draft.payment?.cc || {}
      }, font, {
        textOpts: { visual: false },
        bankNameCode: "BankNameCode",
        bankBranchCode: "BankBranchCode"
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
      const kind = draft?.mode === this.MODE_FULL ? "מורחב" : "מקוצר";
      return "ריסק_הפניקס_" + kind + "_" + name.replace(/[\\/:*?\"<>|]/g, "_") + "_" + nowISO().slice(0, 10) + ".pdf";
    },

    fieldRow(label, name, value, extra){
      return `<label class="phxLifeForm__field">
        <span>${escapeHtml(label)}</span>
        <input class="input" type="text" data-phxlife="${escapeHtml(name)}" value="${escapeHtml(value || "")}" ${extra || ""} />
      </label>`;
    },
    personBlock(title, prefix, person){
      const p = person || {};
      return `<section class="phxLifeForm__block">
        <div class="phxLifeForm__blockTitle">${escapeHtml(title)}</div>
        <div class="phxLifeForm__grid">
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
          ${this.fieldRow("גובה", prefix + ".heightCm", p.heightCm, 'dir="ltr"')}
          ${this.fieldRow("משקל", prefix + ".weightKg", p.weightKg, 'dir="ltr"')}
          ${this.fieldRow("עישון", prefix + ".smokingStatus", p.smokingStatus)}
          ${this.fieldRow("סכום ביטוח", prefix + ".sumInsured", p.sumInsured, 'dir="ltr"')}
        </div>
      </section>`;
    },

    collectDraftFromModal(root, draft){
      const next = JSON.parse(JSON.stringify(draft || {}));
      root.querySelectorAll("[data-phxlife]").forEach((el) => {
        const path = safeTrim(el.getAttribute("data-phxlife"));
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
      if(next.payerPerson && next.primary && next.payerPerson === draft.payerPerson){
        next.payerPerson.fullName = next.payerPerson.fullName || next.primary.fullName;
      }
      return next;
    },

    ensureStyles(){
      if(document.getElementById("phxLifeFormStyle")) return;
      const style = document.createElement("style");
      style.id = "phxLifeFormStyle";
      style.textContent = `
        .phxLifeFormModal .giValModal__card{ max-width:min(980px,96vw); width:100%; height:min(92vh,920px); max-height:min(92vh,920px); }
        .phxLifeForm__hint{ font-size:13px; line-height:1.45; color:#475569; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:12px; padding:10px 12px; }
        .phxLifeForm__block{ border:1px solid #E5EAF3; border-radius:14px; padding:12px 14px 14px; background:#fff; }
        .phxLifeForm__blockTitle{ font-size:14px; font-weight:800; color:#0B1F4B; margin-bottom:10px; }
        .phxLifeForm__grid{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px 12px; }
        .phxLifeForm__field{ display:flex; flex-direction:column; gap:4px; min-width:0; }
        .phxLifeForm__field span{ font-size:12px; font-weight:700; color:#647287; }
        .phxLifeFormPreview{ padding:12px 4px; display:flex; flex-direction:column; gap:10px; }
        .phxLifeFormPreview__row{ display:flex; justify-content:space-between; gap:12px; font-size:13.5px; }
        .phxLifeFormPreview__row span{ color:#647287; }
        .phxLifeFormPreview__row strong{ color:#0F172A; font-weight:750; }
        @media (max-width:720px){ .phxLifeForm__grid{ grid-template-columns:1fr; } }
      `;
      document.head.appendChild(style);
    },

    renderPreviewHtml(draft){
      const tpl = this.templateOf(draft && draft.mode);
      const people = [draft.primary, draft.spouse].filter(Boolean);
      const rows = people.map((p, idx) => {
        const role = idx === 0 ? "מבוטח ראשי" : "מועמד משני";
        return `<div class="phxLifeFormPreview__row"><span>${escapeHtml(role)}</span><strong>${escapeHtml(p.fullName || "—")}</strong></div>`;
      }).join("");
      const openAttr = (draft && draft.mode === this.MODE_FULL) ? "data-phxlifefull-open" : "data-phxlifeshort-open";
      return `<div class="phxLifeFormPreview">
        <div class="phxLifeFormPreview__row"><span>חברה / מוצר</span><strong>${escapeHtml(tpl.productLabel)}</strong></div>
        <div class="phxLifeFormPreview__row"><span>תחילת ביטוח</span><strong>${escapeHtml(draft.insuranceBegin || "—")}</strong></div>
        ${rows}
        ${global.CustomerDocuments?.canDownloadOfficialJoinForm?.() ? `<button class="btn btn--primary" type="button" ${openAttr}="1">פתח טופס דיגיטלי</button>` : ""}
      </div>`;
    },

    close(){
      const modal = this._modal;
      this._modal = null;
      this._draft = null;
      if(modal && modal.parentNode) modal.parentNode.removeChild(modal);
    },

    bind(modal){
      modal.querySelectorAll("[data-phxlife-close]").forEach((el) => {
        el.addEventListener("click", () => this.close());
      });
      const dl = modal.querySelector("[data-phxlife-download]");
      if(dl){
        dl.addEventListener("click", async () => {
          const original = dl.textContent;
          dl.disabled = true;
          dl.textContent = "מפיק PDF…";
          try {
            const draft = this.collectDraftFromModal(modal, this._draft);
            const bytes = await this.fillOriginalTemplate(draft);
            this.downloadBytes(bytes, this.fileName(draft));
            try { global.showToast?.({ title: "הטופס הורד", text: "PDF מקורי של הפניקס — ממולא מהפרטים שבתיק.", variant: "success", durationMs: 5200 }); } catch(_e) {}
          } catch(err){
            try { console.error("PHOENIX_LIFE_PDF_FAILED", err); } catch(_e) {}
            try { global.showToast?.({ title: "שגיאה בהפקת PDF", text: safeTrim(err?.message) || "לא ניתן למלא את הטופס המקורי", variant: "warn", durationMs: 6200 }); } catch(_e2) {}
          } finally {
            dl.disabled = false;
            dl.textContent = original;
          }
        });
      }
    },

    open(rec, mode){
      if(global.CustomerFileUI?.denyOfficialJoinFormDownload?.()) return;
      this.ensureStyles();
      this.close();
      const draft = this.buildDraft(rec, mode);
      this._draft = draft;
      const tpl = this.templateOf(draft.mode);
      const modal = document.createElement("div");
      modal.className = "giValModal phxLifeFormModal is-open giValModal--visible";
      modal.innerHTML = `
        <div class="giValModal__backdrop" data-phxlife-close="1"></div>
        <div class="giValModal__card">
          <div class="giValModal__head">
            <div class="giValModal__headText">
              <div class="giValModal__title">${escapeHtml(tpl.title)}</div>
              <div class="giValModal__sub">פרטים מהתיק כבר ממולאים. השלימו מה שחסר והורידו PDF רשמי.</div>
            </div>
            <button type="button" class="giValModal__closeX" data-phxlife-close="1" aria-label="סגירה">✕</button>
          </div>
          <div class="giValModal__body">
            <div class="phxLifeForm__hint">ממולא אוטומטית רק מה ששמור בתיק, כולל כן/לא בהצהרת בריאות ואמצעי תשלום. פירוט רפואי, מוטבים, החלפת ביטוח וחתימות לא ממולאים — אותם משלימים בטופס או ב-PDF אחרי ההורדה.</div>
            <section class="phxLifeForm__block">
              <div class="phxLifeForm__blockTitle">פרטי הצעה וסוכן</div>
              <div class="phxLifeForm__grid">
                ${this.fieldRow("תחילת ביטוח", "insuranceBegin", draft.insuranceBegin, 'dir="ltr"')}
                ${this.fieldRow("תאריך היום", "today", draft.today, 'dir="ltr"')}
                ${this.fieldRow("שם סוכן", "agentName", draft.agentName)}
                ${this.fieldRow("מספר סוכן", "agentNumber", draft.agentNumber, 'dir="ltr"')}
              </div>
            </section>
            ${this.personBlock("מבוטח ראשי", "primary", draft.primary)}
            ${draft.spouse ? this.personBlock("מועמד משני", "spouse", draft.spouse) : ""}
            <section class="phxLifeForm__block">
              <div class="phxLifeForm__blockTitle">משלם והוראת קבע — רק אם נרשם בתיק</div>
              <div class="phxLifeForm__grid">
                ${this.fieldRow("שם משלם", "payer.name", draft.payer.name)}
                ${this.fieldRow("ת״ז משלם", "payer.idNumber", draft.payer.idNumber, 'dir="ltr"')}
                ${this.fieldRow("קרבה", "payer.relation", draft.payer.relation)}
                ${this.fieldRow("בנק", "bank.name", draft.bank.name)}
                ${this.fieldRow("סניף", "bank.branch", draft.bank.branch, 'dir="ltr"')}
                ${this.fieldRow("חשבון", "bank.account", draft.bank.account, 'dir="ltr"')}
              </div>
            </section>
          </div>
          <div class="giValModal__foot">
            <button type="button" class="btn" data-phxlife-close="1">סגור</button>
            <button type="button" class="btn btn--primary" data-phxlife-download="1">הורד PDF רשמי</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      this._modal = modal;
      this.bind(modal);
    }
  };

  global.PhoenixLifeForm = PhoenixLifeForm;
})(typeof window !== "undefined" ? window : globalThis);
