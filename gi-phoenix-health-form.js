/* GEMEL INVEST — טופס מקורי בריאות · הפניקס (300302095 / 300306091 / 300107001)
   נטען לפי דרישה ממסמכי לקוח. ממלא רק ערכים שכבר שמורים בתיק. */
(function installPhoenixHealthForm(global){
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
  function coverBlob(list){
    return (Array.isArray(list) ? list : []).map(safeTrim).filter(Boolean).join(" ");
  }

  const PhoenixHealthForm = {
    TEMPLATE_BASE: "./forms/phoenix-health/",
    TEMPLATE_FILE: "phoenix-health-join.pdf",
    FONT_URL: "./fonts/Heebo-Bold.ttf",
    VERSION: "20260824-phoenix-health-v1",
    DOC_ID: "doc_phoenix_health_form",
    DOC_TYPE: "phoenix_health_form",

    HEART_FOLLOWUP: [
      { pdf: "Q2Q1", keys: ["q2_defect", "q2_diagnosis"] },
      { pdf: "Q2Q2", keys: ["q2_status"] },
      { pdf: "Q2Q3", keys: ["q2_docs"] },
      { pdf: "Q2Q4", keys: ["q3_diagnosis"] },
      { pdf: "Q2Q5", keys: ["q3_medication"] },
      { pdf: "Q2Q6", keys: ["q3_ablation"] },
      { pdf: "Q2Q7", keys: ["q3_pacemaker"] },
      { pdf: "Q2Q8", keys: ["q4_bp_value"] },
      { pdf: "Q2Q9", keys: ["q4_bp_value"] },
      { pdf: "Q2Q10", keys: ["q2_treatment"] },
      { pdf: "Q2Q11", keys: ["q2_date"] },
      { pdf: "Q2Q12", keys: ["q2_tests"] }
    ],

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
    isPhoenixHealthPolicy(policy){
      if(!policy || typeof policy !== "object") return false;
      if(safeTrim(policy.company) !== "הפניקס") return false;
      const docs = global.CustomerDocuments;
      if(docs && docs.isPhoenixRiskMortgagePolicy && docs.isPhoenixRiskMortgagePolicy(policy)) return false;
      const blob = this.policyBlob(policy);
      if(/משכנתא/.test(blob) || /ריסק/.test(blob)) return false;
      if(/מחלות\s*קשות/.test(blob) && !/בריאות/.test(blob)) return false;
      if(/סרטן/.test(blob) && !/בריאות/.test(blob)) return false;
      return /בריאות/.test(blob);
    },
    listPhoenixHealthPolicies(payload){
      const list = Array.isArray(payload?.newPolicies) ? payload.newPolicies : [];
      return list.filter((p) => this.isPhoenixHealthPolicy(p));
    },
    qualifies(payload){
      return this.listPhoenixHealthPolicies(payload).length > 0;
    },
    listPolicyCovers(policy){
      const out = [];
      (Array.isArray(policy?.healthCovers) ? policy.healthCovers : []).forEach((x) => {
        const s = safeTrim(x);
        if(s && out.indexOf(s) < 0) out.push(s);
      });
      const amounts = policy?.healthCoversWithAmounts && typeof policy.healthCoversWithAmounts === "object"
        ? policy.healthCoversWithAmounts : {};
      Object.keys(amounts).forEach((k) => {
        const s = safeTrim(k);
        if(s && out.indexOf(s) < 0) out.push(s);
      });
      const selected = policy?.phoenixHealthSelected && typeof policy.phoenixHealthSelected === "object"
        ? policy.phoenixHealthSelected : {};
      Object.keys(selected).forEach((k) => {
        if(selected[k] && out.indexOf(k) < 0) out.push(k);
      });
      return out;
    },
    coverLetters(covers){
      const list = (Array.isArray(covers) ? covers : []).map(safeTrim).filter(Boolean);
      const blob = coverBlob(list);
      const letters = [];
      const add = (letter, yes) => {
        if(yes && letters.indexOf(letter) < 0) letters.push(letter);
      };
      const has = (re) => list.some((c) => re.test(c)) || re.test(blob);
      add("C", has(/transplant|השתל/));
      add("E", has(/abroad_surgery|ניתוח.*חו.?ל|מחליפי\s*ניתוח\s*בחו/));
      add("D", has(/drugs|תרופ/));
      add("B", has(/surgery_first_shekel|מהשקל/) || (has(/ניתוחים/) && has(/בישראל/) && !has(/משלים/) && !has(/5000|5,000/)));
      add("A", has(/surgery_shaban_5000|5000|5,000|5\.000/));
      add("R", has(/surgery_shaban|משלים\s*שב/) && !has(/5000|5,000|5\.000/));
      if(has(/ambulatory_package|ייעוץ\s*ובדיקות\s*ואבחון/)) add("G", true);
      else {
        add("F", has(/ambulatory_consults|ייעוץ\s*ובדיקות|ייעוצים\s*ובדיקות/));
        add("Q", has(/fast_diagnosis|אבחון/));
      }
      add("I", has(/ambulatory_accompany|ליווי\s*רפואי/));
      add("J", has(/expert_click|בקליק|און[\s\-]*ליין|אונליין/));
      add("K", has(/complementary|רפואה\s*משלימה/));
      add("M", has(/child_dev|התפתחות\s*הילד/));
      return letters;
    },
    amountFromMap(policy, keys){
      const map = policy?.healthCoversWithAmounts && typeof policy.healthCoversWithAmounts === "object"
        ? policy.healthCoversWithAmounts : {};
      for(let i = 0; i < keys.length; i++){
        const v = this.fmtMoneyPlain(map[keys[i]]);
        if(v) return v;
      }
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
        coverLetters: [],
        criticalAmount: "",
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
    policyCoversPerson(policy, insured){
      const ids = Array.isArray(policy?.insuredIds) ? policy.insuredIds.map(safeTrim).filter(Boolean) : [];
      if(!ids.length) return true;
      const id = safeTrim(insured?.id);
      return !id || ids.indexOf(id) >= 0;
    },
    applyPolicyToPerson(person, insured, policy, letters){
      if(!person || !policy || !this.policyCoversPerson(policy, insured)) return;
      const next = Array.isArray(person.coverLetters) ? person.coverLetters.slice() : [];
      letters.forEach((letter) => {
        if(next.indexOf(letter) < 0) next.push(letter);
      });
      person.coverLetters = next;
      if(!person.criticalAmount){
        person.criticalAmount = this.fmtMoneyPlain(policy.phoenixCriticalAmount)
          || this.amountFromMap(policy, ["מדיכלל מחלות קשות", "מחלות קשות"]);
      }
      if(!person.cancerAmount){
        person.cancerAmount = this.fmtMoneyPlain(policy.phoenixCancerAmount)
          || this.amountFromMap(policy, ["מדיכלל פיצוי לסרטן", "סרטן"]);
      }
    },

    buildDraft(rec){
      const payload = rec?.payload && typeof rec.payload === "object" ? rec.payload : {};
      const policies = this.listPhoenixHealthPolicies(payload);
      const policy = policies[0] || {};
      const { primary, spouse, children } = this.classifyInsureds(payload);
      const primaryPerson = this.personFromInsured(primary || payload.primary || {}, global.GI_OFFICIAL_FORM_FILL?.fileFallbacks?.(rec, payload));
      const spousePerson = spouse ? this.personFromInsured(spouse) : null;
      const childPeople = children.map((ins) => this.personFromInsured(ins));
      policies.forEach((p) => {
        const letters = this.coverLetters(this.listPolicyCovers(p));
        this.applyPolicyToPerson(primaryPerson, primary, p, letters);
        this.applyPolicyToPerson(spousePerson, spouse, p, letters);
        childPeople.forEach((person, idx) => this.applyPolicyToPerson(person, children[idx], p, letters));
      });
      const agentNumbers = payload.companyAgentNumbers || payload.operational?.companyAgentNumbers
        || payload.primary?.operationalAgentNumbers || {};
      const payerSrc = payload.primary || primary?.data || {};
      const external = payerSrc.externalPayer && typeof payerSrc.externalPayer === "object" ? payerSrc.externalPayer : {};
      const useExternal = safeTrim(payerSrc.payerChoice) === "external";
      const pay = global.GI_OFFICIAL_FORM_FILL?.pickPayment?.(payload, payerSrc) || { method: "", isHo: false, bank: { name: "", branch: "", account: "", bankNo: "" } };
      const payerPerson = useExternal ? {
        firstName: safeTrim(external.firstName),
        lastName: safeTrim(external.lastName),
        fullName: safeTrim((external.firstName + " " + external.lastName).trim()),
        idNumber: safeTrim(external.idNumber),
        city: safeTrim(external.city),
        street: safeTrim(external.street),
        houseNumber: safeTrim(external.houseNumber),
        zip: safeTrim(external.zip)
      } : primaryPerson;
      return {
        today: this.fmtTodayHe(),
        insuranceBegin: this.fmtDateHe(policy.startDate || payload.insuranceStartDate),
        payment: pay,
        agentName: safeTrim(global.Auth?.current?.name) || safeTrim(rec?.agentName),
        agentNumber: safeTrim(agentNumbers["הפניקס"]) || safeTrim(policy.agentNumber),
        primary: primaryPerson,
        spouse: spousePerson,
        children: childPeople,
        payerPerson,
        ...(global.GI_OFFICIAL_FORM_FILL?.attachDraftHealth?.(payload, primary, spouse, children) || {}),
        payer: {
          firstName: useExternal ? safeTrim(external.firstName) : safeTrim(primaryPerson.firstName),
          lastName: useExternal ? safeTrim(external.lastName) : safeTrim(primaryPerson.lastName),
          fullName: useExternal ? safeTrim((external.firstName + " " + external.lastName).trim()) : safeTrim(primaryPerson.fullName),
          idNumber: useExternal ? safeTrim(external.idNumber) : safeTrim(primaryPerson.idNumber),
          phone: useExternal ? safeTrim(external.phone) : safeTrim(primaryPerson.phone),
          email: useExternal ? safeTrim(external.email) : safeTrim(primaryPerson.email),
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

    applyPerson(form, person, role, font){
      if(!person) return;
      const isSpouse = role === "spouse";
      const childIdx = String(role || "").indexOf("child") === 0 ? Number(role.slice(5)) : 0;
      const isChild = childIdx > 0;
      const nameS = isSpouse ? "Spouse" : (isChild ? ("Child" + childIdx) : "");
      this.setTextSafe(form, "FirstName" + nameS, person.firstName, font);
      this.setTextSafe(form, "LastName" + nameS, person.lastName, font);
      this.setTextSafe(form, isChild || isSpouse ? ("FullName" + nameS) : "FullName", person.fullName, font);
      this.setTextSafe(form, "PID" + nameS, person.idNumber, font);
      this.setTextSafe(form, "BirthDate" + nameS, person.birthDate, font);
      this.setTextSafe(form, "EmailAddress" + nameS, person.email, font);
      if(!nameS){
        this.setTextSafe(form, "City", person.city, font);
        this.setTextSafe(form, "StreetName", person.street, font);
        this.setTextSafe(form, "HouseNumber", person.houseNumber, font);
      } else if(isSpouse){
        this.setTextSafe(form, "CitySpouse", person.city, font);
        this.setTextSafe(form, "StreetNameSpouse", person.street, font);
        this.setTextSafe(form, "HouseNumberSpouse", person.houseNumber, font);
      } else if(isChild){
        this.setTextSafe(form, "CityChild" + childIdx, person.city, font);
        this.setTextSafe(form, "StreetNameChild" + childIdx, person.street, font);
        this.setTextSafe(form, "HouseNumberChild" + childIdx, person.houseNumber, font);
      }
      this.setTextSafe(form, "OccupationCode" + nameS, person.occupation, font);
      this.setTextSafe(form, isChild ? ("HMOChild" + childIdx) : (isSpouse ? "HMOSpouse" : "HMO"), person.clinic, font);
      this.setTextSafe(form, "Hight" + nameS, person.heightCm, font);
      this.setTextSafe(form, "Weight" + nameS, person.weightKg, font);
      if(person.smokingAmount && !isChild){
        this.setTextSafe(form, isSpouse ? "ClientSmokeNumSpouse" : "ClientSmokeNum", person.smokingAmount, font);
      }
      const phone = person.phone;
      if(phone){
        this.setTextSafe(form, "CellPhoneNumber" + nameS, phone, font);
      }
      this.setExport(form, "Gender" + nameS, this.mapGenderExport(person.gender));
      if(!isChild) this.setExport(form, "FamilyStatus" + nameS, this.mapMaritalExport(person.maritalStatus));
      const smokeField = !nameS ? "IsSmoking" : (isSpouse ? "IsSmokingBzug" : ("IsSmokingChild" + childIdx));
      this.setExport(form, smokeField, this.mapSmokingExport(person.smokingStatus));
      const prefix = !nameS ? "chkMain" : (isSpouse ? "chkBzug" : ("chkChild" + childIdx));
      (person.coverLetters || []).forEach((letter) => {
        if(letter === "M" && !isChild) return;
        this.setExport(form, prefix + letter, "1");
      });
      const critField = !nameS ? "chkDiseaseMainA" : (isSpouse ? "chkDiseaseBzugA" : ("chkDiseaseChildA" + childIdx));
      const cancerField = !nameS ? "chkDiseaseMainB" : (isSpouse ? "chkDiseaseBzugB" : ("chkDiseaseChildB" + childIdx));
      this.setTextSafe(form, critField, person.criticalAmount, font);
      this.setTextSafe(form, cancerField, person.cancerAmount, font);
    },

    fieldValueFromResponse(responses, qKey, insId, fieldKey){
      const helper = global.GI_OFFICIAL_FORM_FILL;
      if(!helper || !qKey || !insId || !fieldKey) return "";
      const row = responses?.[qKey]?.[insId];
      const fields = row && row.fields && typeof row.fields === "object" ? row.fields : {};
      return safeTrim(fields[fieldKey]);
    },
    applyHeartFollowup(form, responses, insId, font){
      if(!responses || !insId) return;
      this.HEART_FOLLOWUP.forEach((row) => {
        for(let i = 0; i < row.keys.length; i++){
          const val = this.fieldValueFromResponse(responses, "phoenix_full__heart", insId, row.keys[i]);
          if(val){
            this.setTextSafe(form, row.pdf, val, font);
            break;
          }
        }
      });
    },
    collectDiagnosisLines(responses, insId){
      const helper = global.GI_OFFICIAL_FORM_FILL;
      const keys = (helper && helper.HEALTH_QKEYS && helper.HEALTH_QKEYS.phoenix_health) || [];
      const lines = [];
      const pushLine = (text) => {
        const s = safeTrim(text);
        if(s && lines.indexOf(s) < 0) lines.push(s);
      };
      keys.forEach((qKey) => {
        const row = responses?.[qKey]?.[insId];
        if(!row || safeTrim(row.answer).toLowerCase() !== "yes") return;
        const fields = row.fields && typeof row.fields === "object" ? row.fields : {};
        Object.keys(fields).forEach((fk) => pushLine(fields[fk]));
        if(safeTrim(row.detail)) pushLine(row.detail);
        if(safeTrim(row.label)) pushLine(row.label);
      });
      return lines;
    },
    applyDiagnosisDetails(form, responses, insId, font){
      const lines = this.collectDiagnosisLines(responses, insId);
      lines.slice(0, 6).forEach((text, idx) => {
        const n = idx + 1;
        this.setTextSafe(form, "DiagnosisDetails" + n, text, font);
        this.setTextSafe(form, "DiagnosisNum" + n, String(n), font);
      });
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
    },

    async fillOriginalTemplate(draft){
      if(global.GI_LOAD_LIBS?.pdfLib) await global.GI_LOAD_LIBS.pdfLib();
      const PDFLib = global.PDFLib;
      if(!PDFLib?.PDFDocument) throw new Error("PDFLib missing");
      const templateBytes = await this.fetchFirstOk(
        this.candidateUrls("forms/phoenix-health/", this.TEMPLATE_FILE),
        "לא נמצא טופס בריאות של הפניקס"
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
      this.applyPerson(form, draft.primary, "primary", font);
      this.applyPerson(form, draft.spouse, "spouse", font);
      (draft.children || []).forEach((child, idx) => {
        this.applyPerson(form, child, "child" + (idx + 1), font);
      });
      this.applyPayerZone(form, draft, font);
      global.GI_OFFICIAL_FORM_FILL?.applyPrimaryNameExtras?.(form, draft.primary && draft.primary.fullName, font, ["FullNameBagir", "FullNameHolder"], { visual: false });
      global.GI_OFFICIAL_FORM_FILL?.applyMappedHealthYesNo?.(form, {
        map: "phoenix_health",
        responses: draft.healthResponses,
        primaryId: draft.primaryId || (draft.primary && draft.primary.id) || "",
        spouseId: draft.spouseId || (draft.spouse && draft.spouse.id) || "",
        childIds: draft.childIds || (draft.children || []).map((c) => c.id).filter(Boolean)
      });
      const primaryId = draft.primaryId || (draft.primary && draft.primary.id) || "";
      if(primaryId){
        this.applyHeartFollowup(form, draft.healthResponses, primaryId, font);
        this.applyDiagnosisDetails(form, draft.healthResponses, primaryId, font);
      }
      if(draft.payment?.method === "ho" && draft.payerPerson){
        global.GI_OFFICIAL_FORM_FILL?.applyInsuredPayerOwner?.(form, draft.payerPerson, font, {
          relation: draft.payer?.relation || "המבוטח"
        });
      }
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
      return "בריאות_הפניקס_" + name.replace(/[\\/:*?\"<>|]/g, "_") + "_" + nowISO().slice(0, 10) + ".pdf";
    },

    fieldRow(label, name, value, extra){
      return `<label class="phxHealthForm__field">
        <span>${escapeHtml(label)}</span>
        <input class="input" type="text" data-phxhealth="${escapeHtml(name)}" value="${escapeHtml(value || "")}" ${extra || ""} />
      </label>`;
    },
    personBlock(title, prefix, person){
      const p = person || {};
      return `<section class="phxHealthForm__block">
        <div class="phxHealthForm__blockTitle">${escapeHtml(title)}</div>
        <div class="phxHealthForm__grid">
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
          ${this.fieldRow("קופת חולים", prefix + ".clinic", p.clinic)}
          ${this.fieldRow("סכום מחלות קשות", prefix + ".criticalAmount", p.criticalAmount, 'dir="ltr"')}
          ${this.fieldRow("סכום סרטן", prefix + ".cancerAmount", p.cancerAmount, 'dir="ltr"')}
        </div>
      </section>`;
    },
    collectDraftFromModal(root, draft){
      const next = JSON.parse(JSON.stringify(draft || {}));
      root.querySelectorAll("[data-phxhealth]").forEach((el) => {
        const path = safeTrim(el.getAttribute("data-phxhealth"));
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
      if(document.getElementById("phxHealthFormStyle")) return;
      const style = document.createElement("style");
      style.id = "phxHealthFormStyle";
      style.textContent = `
        .phxHealthFormModal .giValModal__card{ max-width:min(980px,96vw); width:100%; height:min(92vh,920px); max-height:min(92vh,920px); }
        .phxHealthForm__hint{ font-size:13px; line-height:1.45; color:#475569; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:12px; padding:10px 12px; }
        .phxHealthForm__block{ border:1px solid #E5EAF3; border-radius:14px; padding:12px 14px 14px; background:#fff; }
        .phxHealthForm__blockTitle{ font-size:14px; font-weight:800; color:#0B1F4B; margin-bottom:10px; }
        .phxHealthForm__grid{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px 12px; }
        .phxHealthForm__field{ display:flex; flex-direction:column; gap:4px; min-width:0; }
        .phxHealthForm__field span{ font-size:12px; font-weight:700; color:#647287; }
        .phxHealthFormPreview{ padding:12px 4px; display:flex; flex-direction:column; gap:10px; }
        .phxHealthFormPreview__row{ display:flex; justify-content:space-between; gap:12px; font-size:13.5px; }
        .phxHealthFormPreview__row span{ color:#647287; }
        .phxHealthFormPreview__row strong{ color:#0F172A; font-weight:750; }
        @media (max-width:720px){ .phxHealthForm__grid{ grid-template-columns:1fr; } }
      `;
      document.head.appendChild(style);
    },
    renderPreviewHtml(draft){
      const people = [draft.primary, draft.spouse].concat(draft.children || []).filter(Boolean);
      const rows = people.map((p, idx) => {
        const role = idx === 0 ? "מבוטח ראשי" : (idx === 1 && draft.spouse ? "בן/בת זוג" : "ילד");
        return `<div class="phxHealthFormPreview__row"><span>${escapeHtml(role)}</span><strong>${escapeHtml(p.fullName || "—")}</strong></div>`;
      }).join("");
      return `<div class="phxHealthFormPreview">
        <div class="phxHealthFormPreview__row"><span>חברה / מוצר</span><strong>הפניקס · בריאות</strong></div>
        <div class="phxHealthFormPreview__row"><span>תחילת ביטוח</span><strong>${escapeHtml(draft.insuranceBegin || "—")}</strong></div>
        ${rows}
        ${global.CustomerDocuments?.canDownloadOfficialJoinForm?.() ? `<button class="btn btn--primary" type="button" data-phxhealth-open="1">פתח טופס דיגיטלי</button>` : ""}
      </div>`;
    },
    close(){
      const modal = this._modal;
      this._modal = null;
      this._draft = null;
      if(modal && modal.parentNode) modal.parentNode.removeChild(modal);
    },
    bind(modal){
      modal.querySelectorAll("[data-phxhealth-close]").forEach((el) => {
        el.addEventListener("click", () => this.close());
      });
      const dl = modal.querySelector("[data-phxhealth-download]");
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
            try { console.error("PHOENIX_HEALTH_PDF_FAILED", err); } catch(_e) {}
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
      const childBlocks = (draft.children || []).map((child, idx) => this.personBlock("ילד " + (idx + 1), "children." + idx, child)).join("");
      const modal = document.createElement("div");
      modal.className = "giValModal phxHealthFormModal is-open giValModal--visible";
      modal.innerHTML = `
        <div class="giValModal__backdrop" data-phxhealth-close="1"></div>
        <div class="giValModal__card">
          <div class="giValModal__head">
            <div class="giValModal__headText">
              <div class="giValModal__title">טופס מקורי — בריאות · הפניקס</div>
              <div class="giValModal__sub">פרטים מהתיק כבר ממולאים. השלימו מה שחסר והורידו PDF רשמי.</div>
            </div>
            <button type="button" class="giValModal__closeX" data-phxhealth-close="1" aria-label="סגירה">✕</button>
          </div>
          <div class="giValModal__body">
            <div class="phxHealthForm__hint">ממולא אוטומטית רק מה ששמור בתיק, כולל כיסויי בריאות שנבחרו, כן/לא בהצהרת בריאות ואמצעי תשלום. פירוט רפואי נוסף, ביטול/החלפת ביטוח וחתימות לא ממולאים — אותם משלימים בטופס או ב-PDF אחרי ההורדה.</div>
            <section class="phxHealthForm__block">
              <div class="phxHealthForm__blockTitle">פרטי הצעה וסוכן</div>
              <div class="phxHealthForm__grid">
                ${this.fieldRow("תחילת ביטוח", "insuranceBegin", draft.insuranceBegin, 'dir="ltr"')}
                ${this.fieldRow("תאריך היום", "today", draft.today, 'dir="ltr"')}
                ${this.fieldRow("שם סוכן", "agentName", draft.agentName)}
                ${this.fieldRow("מספר סוכן", "agentNumber", draft.agentNumber, 'dir="ltr"')}
              </div>
            </section>
            ${this.personBlock("מבוטח ראשי", "primary", draft.primary)}
            ${draft.spouse ? this.personBlock("בן/בת זוג", "spouse", draft.spouse) : ""}
            ${childBlocks}
            <section class="phxHealthForm__block">
              <div class="phxHealthForm__blockTitle">הוראת קבע — רק אם נרשמה בתיק</div>
              <div class="phxHealthForm__grid">
                ${this.fieldRow("בנק", "bank.name", draft.bank.name)}
                ${this.fieldRow("סניף", "bank.branch", draft.bank.branch, 'dir="ltr"')}
                ${this.fieldRow("חשבון", "bank.account", draft.bank.account, 'dir="ltr"')}
              </div>
            </section>
          </div>
          <div class="giValModal__foot">
            <button type="button" class="btn" data-phxhealth-close="1">סגור</button>
            <button type="button" class="btn btn--primary" data-phxhealth-download="1">הורד PDF רשמי</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      this._modal = modal;
      this.bind(modal);
    }
  };

  global.PhoenixHealthForm = PhoenixHealthForm;
})(typeof window !== "undefined" ? window : globalThis);
