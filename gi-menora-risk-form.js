/* GEMEL INVEST — טופס מקורי ריסק / חיים מנורה (טופס 201, 08/2025)
   נטען לפי דרישה ממסמכי לקוח. ממלא רק ערכים שכבר שמורים בתיק. */
(function installMenoraRiskForm(global){
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

  const MenoraRiskForm = {
    TEMPLATE_BASE: "./forms/menora-risk/",
    TEMPLATE_FILE: "menora-risk-join.pdf",
    FONT_URL: "./fonts/Heebo-Bold.ttf",
    VERSION: "20260828-menora-health-decl-v1",
    DOC_ID: "doc_menora_risk_form",
    DOC_TYPE: "menora_risk_form",

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
    isMenoraRiskPolicy(policy){
      if(!policy || typeof policy !== "object") return false;
      if(safeTrim(policy.company) !== "מנורה") return false;
      const blob = this.policyBlob(policy);
      if(/משכנתא/.test(blob)) return false;
      if(/מחלות\s*קשות/.test(blob) || /סרטן/.test(blob)) return false;
      return /ריסק/.test(blob) || /ביטוח\s*חיים/.test(blob) || safeTrim(policy.type) === "ריסק";
    },
    listMenoraRiskPolicies(payload){
      const list = Array.isArray(payload?.newPolicies) ? payload.newPolicies : [];
      return list.filter((p) => this.isMenoraRiskPolicy(p));
    },
    qualifies(payload){
      return this.listMenoraRiskPolicies(payload).length > 0;
    },
    composeAddress(person){
      if(!person) return "";
      return [person.street, person.houseNumber, person.apt, person.city, person.zip].map(safeTrim).filter(Boolean).join(" ");
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
        heightCm: safeTrim(d.heightCm),
        weightKg: safeTrim(d.weightKg),
        smokingStatus: safeTrim(d.smokingStatus),
        smokingAmount: safeTrim(d.smokingAmount),
        smokingType: safeTrim(d.smokingType),
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

    buildDraft(rec){
      const payload = rec?.payload && typeof rec.payload === "object" ? rec.payload : {};
      const policies = this.listMenoraRiskPolicies(payload);
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
      const payerPerson = useExternal ? {
        firstName: safeTrim(external.firstName),
        lastName: safeTrim(external.lastName),
        fullName: safeTrim(((external.firstName || "") + " " + (external.lastName || "")).trim()),
        idNumber: safeTrim(external.idNumber),
        relation: safeTrim(external.relation),
        phone: safeTrim(external.phone),
        email: safeTrim(external.email)
      } : primaryPerson;
      return {
        today: this.fmtTodayHe(),
        insuranceBegin: this.fmtDateHe(policy.startDate || payload.insuranceStartDate),
        payment: pay,
        agentName: safeTrim(global.Auth?.current?.name) || safeTrim(rec?.agentName),
        agentNumber: safeTrim(agentNumbers["מנורה"]) || safeTrim(policy.agentNumber),
        primary: primaryPerson,
        spouse: spousePerson,
        payerPerson,
        ...(global.GI_OFFICIAL_FORM_FILL?.attachDraftHealth?.(payload, primary, spouse) || {}),
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

    mkqHealthRows(){
      return [
        { field: "ExtremeSports", spouseField: "SExtremeSports", sport: true, keys: ["menora_risk__hobby"] },
        { field: "FlightLicense", spouseField: "SFlightLicense", sport: true, keys: ["menora_risk__aviation"] },
        { field: "MKQ1", keys: ["menora_risk__alcohol"] },
        { field: "MKQ2", keys: ["menora_risk__drugs"] },
        { field: "MKQ3", keys: ["menora_risk__neuro", "menora_mort__neuro", "menora_crit__neuro"] },
        { field: "MKQ4", keys: ["menora_risk__heart", "menora_mort__heart", "menora_crit__heart"] },
        { field: "MKQ5", keys: ["menora_risk__heart", "menora_mort__heart", "menora_crit__heart"] },
        { field: "MKQ6", keys: ["menora_risk__metabolic"] },
        { field: "MKQ7", keys: ["menora_risk__mental"] },
        { field: "MKQ8", keys: ["menora_risk__metabolic"] },
        { field: "MKQ9", keys: ["menora_risk__metabolic"] },
        { field: "MKQ10", keys: ["menora_risk__surgery", "menora_risk__hospital", "menora_risk__inquiry", "menora_risk__meds"] },
        { field: "MKQ11", keys: ["menora_risk__tumors"] },
        { field: "MKQ12", keys: ["menora_risk__digestive"] },
        { field: "MKQ13", keys: ["menora_risk__digestive"] },
        { field: "MKQ14", keys: ["menora_risk__lungs"] },
        { field: "MKQ15", keys: ["menora_risk__kidneys"] },
        { field: "MKQ16", keys: ["menora_risk__rheum"] },
        { field: "MKQ17", keys: ["menora_risk__ortho"] },
        { field: "MKQ18", keys: ["menora_risk__ortho"] },
        { field: "MKQ19", keys: ["menora_risk__ortho"] },
        { field: "MKQ20", keys: ["menora_risk__female", "menora_risk__family", "menora_risk__adl"] },
        { field: "MKQ21", keys: ["menora_risk__eyes"] },
        { field: "MKQ22", keys: ["menora_risk__ent"] }
      ];
    },
    healthDetail(responses, qKey, insId, detailKey){
      if(!qKey || !insId) return "";
      const helper = global.GI_OFFICIAL_FORM_FILL;
      const keys = helper && typeof helper.healthAnswerAliasKeys === "function"
        ? helper.healthAnswerAliasKeys(qKey, responses)
        : [qKey];
      for(let i = 0; i < keys.length; i++){
        const row = responses?.[keys[i]]?.[insId];
        const bag = row?.details || row?.fields || row || {};
        const v = safeTrim(bag[detailKey]);
        if(v) return v;
      }
      return "";
    },
    mergedHealthAnswer(helper, responses, keys, insId){
      if(!helper || !Array.isArray(keys) || !keys.length) return "";
      let sawNo = false;
      for(let i = 0; i < keys.length; i++){
        let a = helper.healthAnswer(responses, keys[i], insId);
        if(!a && insId) a = helper.healthAnswerOrSolo(responses, keys[i], "");
        if(a === "yes") return "yes";
        if(a === "no") sawNo = true;
      }
      return sawNo ? "no" : "";
    },
    applyMenoraMkqHealth(form, draft){
      const helper = global.GI_OFFICIAL_FORM_FILL;
      if(!helper || !form || !draft) return;
      const responses = draft.healthResponses && typeof draft.healthResponses === "object" ? draft.healthResponses : {};
      const primaryId = safeTrim(draft.primaryId);
      const spouseId = safeTrim(draft.spouseId);
      const yesNo = (answer) => answer === "yes" ? "1" : (answer === "no" ? "2" : "");
      const writeYn = (fieldName, answer) => {
        const yn = yesNo(answer);
        if(!yn || !fieldName) return;
        if(fieldName === "MKQ6"){
          if(yn === "1"){
            this.setExport(form, "MKQ6", "1");
            this.setExport(form, "MQ6", "Off");
          } else {
            this.setExport(form, "MQ6", "2");
            this.setExport(form, "MKQ6", "Off");
          }
          return;
        }
        this.setExport(form, fieldName, yn);
      };
      const rows = this.mkqHealthRows();
      rows.forEach((row) => {
        if(!row || !Array.isArray(row.keys) || !row.keys.length) return;
        const primaryA = this.mergedHealthAnswer(helper, responses, row.keys, primaryId);
        const spouseA = spouseId ? this.mergedHealthAnswer(helper, responses, row.keys, spouseId) : "";
        if(row.sport){
          writeYn(row.field, primaryA);
          if(row.spouseField) writeYn(row.spouseField, spouseA);
          return;
        }
        writeYn(row.field, primaryA);
        if(spouseA) writeYn(row.field + "S", spouseA);
      });
    },
    applyMenoraHealthTextFields(form, draft, font){
      const helper = global.GI_OFFICIAL_FORM_FILL;
      if(!form || !draft) return;
      const responses = draft.healthResponses && typeof draft.healthResponses === "object" ? draft.healthResponses : {};
      const primaryId = safeTrim(draft.primaryId);
      const detailOf = (qKey, parts) => {
        if(!qKey || !primaryId) return "";
        const keys = helper && typeof helper.healthAnswerAliasKeys === "function"
          ? helper.healthAnswerAliasKeys(qKey, responses)
          : [qKey];
        for(let i = 0; i < keys.length; i++){
          const row = responses?.[keys[i]]?.[primaryId];
          const bag = row?.details || row?.fields || row || {};
          const bits = parts.map((k) => safeTrim(bag[k])).filter(Boolean);
          if(bits.length) return bits.join(" · ");
          const extra = Object.keys(bag).filter((k) => !/^(answer|saved|editing)$/.test(k) && safeTrim(bag[k])).map((k) => safeTrim(bag[k]));
          if(extra.length && (row?.answer === "yes" || bits.length)) return extra.join(" · ");
        }
        return "";
      };
      const medsText = detailOf("menora_risk__meds", ["name", "diagnosis", "since", "dose"]);
      if(medsText) this.setTextSafe(form, "Medication", medsText, font);
      const adlText = detailOf("menora_risk__adl", ["details"]);
      if(adlText) this.setTextSafe(form, "diagnosis", adlText, font);
    },
    applySmokingAndSport(form, draft){
      const helper = global.GI_OFFICIAL_FORM_FILL;
      if(!form || !draft) return;
      const responses = draft.healthResponses && typeof draft.healthResponses === "object" ? draft.healthResponses : {};
      const primaryId = safeTrim(draft.primaryId);
      const spouseId = safeTrim(draft.spouseId);
      const applyRole = (person, isSpouse) => {
        if(!person) return;
        let smokeRaw = person.smokingStatus;
        if(helper){
          const fromHealth = this.mergedHealthAnswer(helper, responses, ["menora_risk__smoking"], isSpouse ? spouseId : primaryId);
          if(fromHealth === "yes" || fromHealth === "no"){
            smokeRaw = fromHealth === "yes" ? "yes" : "no";
          }
        }
        const smokeExport = this.mapSmokingExport(smokeRaw);
        if(smokeExport){
          this.setExport(form, isSpouse ? "IsSmokingBzug" : "IsSmoking", smokeExport);
        }
        const typeFromHealth = helper
          ? this.healthDetail(responses, "menora_risk__smoking", isSpouse ? spouseId : primaryId, "type")
          : "";
        const smokeType = typeFromHealth || person.smokingType;
        const smokeAmount = person.smokingAmount
          || (helper ? this.healthDetail(responses, "menora_risk__smoking", isSpouse ? spouseId : primaryId, "amount") : "");
        if(smokeType){
          this.setTextSafe(form, isSpouse ? "SmokeTypeBzug" : "SmokeType", smokeType);
        }
        if(smokeAmount){
          this.setTextSafe(form, isSpouse ? "ClientSmokeNumSpouse" : "ClientSmokeNum", smokeAmount);
        }
      };
      applyRole(draft.primary, false);
      applyRole(draft.spouse, true);
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
      if(helper && typeof helper.setExport === "function"){
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
    setMenoraGenderExport(form, fieldName, exportValue){
      if(!exportValue || !fieldName) return;
      try {
        const field = form.getField(fieldName);
        if(!field) return;
        const PDFLib = global.PDFLib;
        const widgets = field.acroField.getWidgets?.() || [];
        if(widgets.length < 2){
          this.setExport(form, fieldName, exportValue);
          return;
        }
        const wantTrue = exportValue === "True";
        const wantFalse = exportValue === "False";
        widgets.forEach((w) => {
          const n = w.dict.lookup(PDFLib.PDFName.of("AP"))?.lookup(PDFLib.PDFName.of("N"));
          const keys = [];
          if(n && n.dict) n.dict.keys().forEach((k) => keys.push(String(k)));
          let as = "Off";
          if(wantTrue && keys.some((k) => /\/True$/.test(k))) as = "True";
          else if(wantFalse && keys.some((k) => /\/False$/.test(k))) as = "False";
          w.dict.set(PDFLib.PDFName.of("AS"), PDFLib.PDFName.of(as));
        });
        const vName = wantTrue ? "True" : (wantFalse ? "False" : String(exportValue));
        field.acroField.dict.set(PDFLib.PDFName.of("V"), PDFLib.PDFName.of(vName));
      } catch(_e) {}
    },

    applyPerson(form, person, isSpouse, font){
      if(!person) return;
      const s = isSpouse ? "Spouse" : "";
      this.setTextSafe(form, "FirstName" + s, person.firstName, font);
      this.setTextSafe(form, "LastName" + s, person.lastName, font);
      this.setTextSafe(form, isSpouse ? "FullNameSpouse" : "FullName", person.fullName, font);
      this.setTextSafe(form, isSpouse ? "MPIDSpouse" : "MPID", person.idNumber, font);
      this.setTextSafe(form, "PID" + s, person.idNumber, font);
      this.setTextSafe(form, isSpouse ? "MBirthDateSpouse" : "MBirthDate", person.birthDate, font);
      this.setTextSafe(form, "EmailAddress" + s, person.email, font);
      this.setTextSafe(form, isSpouse ? "MOccupationCodeSpouse" : "MOccupationCode", person.occupation, font);
      this.setTextSafe(form, "HMO" + s, person.clinic, font);
      this.setTextSafe(form, "Hight" + s, person.heightCm, font);
      this.setTextSafe(form, "Weight" + s, person.weightKg, font);
      this.setTextSafe(form, isSpouse ? "CitySpouseCode" : "CityCode", person.city, font);
      this.setTextSafe(form, "StreetName" + s, person.street, font);
      this.setTextSafe(form, "HouseNumber" + s, person.houseNumber, font);
      this.setTextSafe(form, "ZipCode" + s, person.zip, font);
      const address = this.composeAddress(person);
      if(isSpouse) this.setTextSafe(form, "FullAddressSpouse", address, font);
      else this.setTextSafe(form, "Address", address, font);
      if(person.phone){
        if(this.isMobilePhone(person.phone)) this.setTextSafe(form, "CellPhoneNumber" + s, person.phone, font);
        else this.setTextSafe(form, "CellPhoneNumber" + s, person.phone, font);
      }
      const genderField = isSpouse ? "GenderSpouse" : "Gender";
      this.setMenoraGenderExport(form, genderField, this.mapGenderExport(person.gender));
      this.setExport(form, "FamilyStatus" + s, this.mapMaritalExport(person.maritalStatus));
      if(person.sumInsured){
        this.setTextSafe(form, isSpouse ? "GiluiTotalRiskSpouse" : "GiluiTotalRisk", person.sumInsured, font);
      }
      if(person.childrenCount){
        this.setTextSafe(form, isSpouse ? "NumberOfChildrenSpouse" : "NumberOfChildren", person.childrenCount, font);
      }
    },

    async fillOriginalTemplate(draft){
      if(global.GI_LOAD_LIBS?.pdfLib) await global.GI_LOAD_LIBS.pdfLib();
      const PDFLib = global.PDFLib;
      if(!PDFLib?.PDFDocument) throw new Error("PDFLib missing");
      const templateBytes = await this.fetchFirstOk(
        this.candidateUrls("forms/menora-risk/", this.TEMPLATE_FILE),
        "לא נמצא טופס ריסק / חיים של מנורה"
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
      if(draft.payer){
        const payerFull = safeTrim(((draft.payer.firstName || "") + " " + (draft.payer.lastName || "")).trim());
        if(payerFull) this.setTextSafe(form, "FullNameMeshalem", payerFull, font);
        this.setTextSafe(form, "PIDMeshalem", draft.payer.idNumber, font);
        this.setTextSafe(form, "RelationMeshalem", draft.payer.relation, font);
        this.setTextSafe(form, "CellPhoneNumberMeshalem", draft.payer.phone, font);
        this.setTextSafe(form, "EmailMeshalem", draft.payer.email, font);
      }
      this.applySmokingAndSport(form, draft);
      this.applyMenoraMkqHealth(form, draft);
      this.applyMenoraHealthTextFields(form, draft, font);
      global.GI_OFFICIAL_FORM_FILL?.applyInsuredPayerOwner?.(form, draft.payerPerson, font, {
        relation: draft.payer?.relation || ""
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
      return "ריסק_חיים_מנורה_" + name.replace(/[\\/:*?\"<>|]/g, "_") + "_" + nowISO().slice(0, 10) + ".pdf";
    },

    fieldRow(label, name, value, extra){
      return `<label class="menoraRiskForm__field">
        <span>${escapeHtml(label)}</span>
        <input class="input" type="text" data-menorarisk="${escapeHtml(name)}" value="${escapeHtml(value || "")}" ${extra || ""} />
      </label>`;
    },
    personBlock(title, prefix, person){
      const p = person || {};
      return `<section class="menoraRiskForm__block">
        <div class="menoraRiskForm__blockTitle">${escapeHtml(title)}</div>
        <div class="menoraRiskForm__grid">
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
      root.querySelectorAll("[data-menorarisk]").forEach((el) => {
        const path = safeTrim(el.getAttribute("data-menorarisk"));
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
      if(document.getElementById("menoraRiskFormStyle")) return;
      const style = document.createElement("style");
      style.id = "menoraRiskFormStyle";
      style.textContent = `
        .menoraRiskFormModal .giValModal__card{ max-width:min(980px,96vw); width:100%; height:min(92vh,920px); max-height:min(92vh,920px); }
        .menoraRiskForm__hint{ font-size:13px; line-height:1.45; color:#475569; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:12px; padding:10px 12px; }
        .menoraRiskForm__block{ border:1px solid #E5EAF3; border-radius:14px; padding:12px 14px 14px; background:#fff; }
        .menoraRiskForm__blockTitle{ font-size:14px; font-weight:800; color:#0B1F4B; margin-bottom:10px; }
        .menoraRiskForm__grid{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px 12px; }
        .menoraRiskForm__field{ display:flex; flex-direction:column; gap:4px; min-width:0; }
        .menoraRiskForm__field span{ font-size:12px; font-weight:700; color:#647287; }
        .menoraRiskFormPreview{ padding:12px 4px; display:flex; flex-direction:column; gap:10px; }
        .menoraRiskFormPreview__row{ display:flex; justify-content:space-between; gap:12px; font-size:13.5px; }
        .menoraRiskFormPreview__row span{ color:#647287; }
        .menoraRiskFormPreview__row strong{ color:#0F172A; font-weight:750; }
        @media (max-width:720px){ .menoraRiskForm__grid{ grid-template-columns:1fr; } }
      `;
      document.head.appendChild(style);
    },
    renderPreviewHtml(draft){
      const people = [draft.primary, draft.spouse].filter(Boolean);
      const rows = people.map((p, idx) => {
        const role = idx === 0 ? "מבוטח ראשי" : "מועמד משני";
        return `<div class="menoraRiskFormPreview__row"><span>${escapeHtml(role)}</span><strong>${escapeHtml(p.fullName || "—")}</strong></div>`;
      }).join("");
      return `<div class="menoraRiskFormPreview">
        <div class="menoraRiskFormPreview__row"><span>חברה / מוצר</span><strong>מנורה · ריסק / חיים</strong></div>
        <div class="menoraRiskFormPreview__row"><span>תחילת ביטוח</span><strong>${escapeHtml(draft.insuranceBegin || "—")}</strong></div>
        ${rows}
        ${global.CustomerDocuments?.canDownloadOfficialJoinForm?.() ? `<button class="btn btn--primary" type="button" data-menorarisk-open="1">פתח טופס דיגיטלי</button>` : ""}
      </div>`;
    },
    close(){
      const modal = this._modal;
      this._modal = null;
      this._draft = null;
      if(modal && modal.parentNode) modal.parentNode.removeChild(modal);
    },
    bind(modal){
      modal.querySelectorAll("[data-menorarisk-close]").forEach((el) => {
        el.addEventListener("click", () => this.close());
      });
      const dl = modal.querySelector("[data-menorarisk-download]");
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
            try { console.error("MENORA_RISK_PDF_FAILED", err); } catch(_e) {}
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
      modal.className = "giValModal menoraRiskFormModal is-open giValModal--visible";
      modal.innerHTML = `
        <div class="giValModal__backdrop" data-menorarisk-close="1"></div>
        <div class="giValModal__card">
          <div class="giValModal__head">
            <div class="giValModal__headText">
              <div class="giValModal__title">טופס מקורי — ריסק / חיים · מנורה</div>
              <div class="giValModal__sub">פרטים מהתיק כבר ממולאים. השלימו מה שחסר והורידו PDF רשמי.</div>
            </div>
            <button type="button" class="giValModal__closeX" data-menorarisk-close="1" aria-label="סגירה">✕</button>
          </div>
          <div class="giValModal__body">
            <div class="menoraRiskForm__hint">ממולא אוטומטית רק מה ששמור בתיק: עמוד 1 (מבוטחים + סוכן + סכום ביטוח), עמוד 4 (הצהרת בריאות MKQ1–22, עישון, ספורט/טיסה), ועמוד 5 (תשלום). מוטבים, כיסויים נלווים, שאלוני המשך MKQ*n*Q*m וחתימות לא ממולאים — אותם משלימים בטופס או ב-PDF אחרי ההורדה.</div>
            <section class="menoraRiskForm__block">
              <div class="menoraRiskForm__blockTitle">פרטי הצעה וסוכן</div>
              <div class="menoraRiskForm__grid">
                ${this.fieldRow("תחילת ביטוח", "insuranceBegin", draft.insuranceBegin, 'dir="ltr"')}
                ${this.fieldRow("תאריך היום", "today", draft.today, 'dir="ltr"')}
                ${this.fieldRow("שם סוכן", "agentName", draft.agentName)}
                ${this.fieldRow("מספר סוכן", "agentNumber", draft.agentNumber, 'dir="ltr"')}
              </div>
            </section>
            ${this.personBlock("מבוטח ראשי", "primary", draft.primary)}
            ${draft.spouse ? this.personBlock("מועמד משני", "spouse", draft.spouse) : ""}
            <section class="menoraRiskForm__block">
              <div class="menoraRiskForm__blockTitle">משלם והוראת קבע — רק אם נרשם בתיק</div>
              <div class="menoraRiskForm__grid">
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
            <button type="button" class="btn" data-menorarisk-close="1">סגור</button>
            <button type="button" class="btn btn--primary" data-menorarisk-download="1">הורד PDF רשמי</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      this._modal = modal;
      this.bind(modal);
    }
  };

  global.MenoraRiskForm = MenoraRiskForm;
})(typeof window !== "undefined" ? window : globalThis);
